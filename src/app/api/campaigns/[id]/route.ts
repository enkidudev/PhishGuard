import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ADMIN_ACTOR, logAudit } from '@/lib/audit'
import { checkCampaignAuthorization } from '@/lib/authz'
import {
  asRecord,
  asString,
  serializeCampaignDetail,
  type CampaignDetailRow,
} from '@/app/api/_lib/shared'

export const dynamic = 'force-dynamic'

async function fetchCampaignDetail(id: string): Promise<CampaignDetailRow | null> {
  return db.campaign.findUnique({
    where: { id },
    include: { template: true, enrollments: { include: { participant: true } } },
  })
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const campaign = await fetchCampaignDetail(id)
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    return NextResponse.json({ campaign: serializeCampaignDetail(campaign) })
  } catch (error) {
    console.error('GET /api/campaigns/[id] failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const raw: unknown = await request.json().catch(() => null)
    const body = asRecord(raw)
    const action = body ? asString(body.action) : undefined

    const campaign = await fetchCampaignDetail(id)
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (action === 'launch') {
      const violation = await db.$transaction(async tx => {
        const current = await tx.campaign.findUnique({ where: { id }, include: { template: true, enrollments: { include: { participant: true } } } })
        if (!current || current.status !== 'draft') return 'Only draft campaigns can be launched'
        if (!current.enrollments.length) return 'At least one participant is required'
        const domains = new Set((await tx.allowedDomain.findMany()).map(d => d.domain))
        if (!domains.has(current.template.senderEmail.split('@').pop()!.toLowerCase())) return 'Sender domain is not approved'
        for (const e of current.enrollments) {
          if (!e.participant.active || !e.participant.consented) return 'Every participant must be active and consented'
          if (!domains.has(e.participant.email.split('@').pop()!.toLowerCase())) return 'Participant domain is not approved'
        }
        const now = new Date()
        await tx.enrollment.updateMany({ where: { campaignId: id }, data: { deliveredAt: now } })
        for (const e of current.enrollments) await tx.trackedEvent.create({ data: { enrollmentId: e.id, type: 'DELIVERED', createdAt: now } })
        await tx.campaign.update({ where: { id }, data: { status: 'running', launchedAt: now } })
        await tx.auditLog.create({ data: { action: 'CAMPAIGN_LAUNCHED', actor: ADMIN_ACTOR, detail: `Campaign launched for ${current.enrollments.length} authorized participants` } })
        return null
      })
      if (violation) return NextResponse.json({ error: violation }, { status: 409 })
    } else if (action === 'complete') {
      if (campaign.status !== 'running') {
        return NextResponse.json(
          { error: 'Only running campaigns can be completed' },
          { status: 400 }
        )
      }
      await db.campaign.update({
        where: { id },
        data: { status: 'completed', completedAt: new Date() },
      })
      await logAudit(
        'CAMPAIGN_COMPLETED',
        ADMIN_ACTOR,
        `Campaign "${campaign.name}" marked as completed`
      )
    } else if (action === 'cancel') {
      if (campaign.status !== 'draft' && campaign.status !== 'running') {
        return NextResponse.json(
          { error: 'Only draft or running campaigns can be cancelled' },
          { status: 400 }
        )
      }
      await db.campaign.update({ where: { id }, data: { status: 'cancelled' } })
      await logAudit('CAMPAIGN_CANCELLED', ADMIN_ACTOR, `Campaign "${campaign.name}" cancelled`)
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const updated = await fetchCampaignDetail(id)
    if (!updated) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    return NextResponse.json({ campaign: serializeCampaignDetail(updated) })
  } catch (error) {
    console.error('PATCH /api/campaigns/[id] failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const campaign = await db.campaign.findUnique({
      where: { id },
      select: { id: true, name: true, status: true },
    })
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    if (campaign.status !== 'draft' && campaign.status !== 'cancelled') {
      return NextResponse.json(
        { error: 'Only draft or cancelled campaigns can be deleted' },
        { status: 400 }
      )
    }
    // Enrollments and their tracked events are removed via cascade.
    await db.campaign.delete({ where: { id } })
    await logAudit('CAMPAIGN_DELETED', ADMIN_ACTOR, `Campaign "${campaign.name}" deleted`)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/campaigns/[id] failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
