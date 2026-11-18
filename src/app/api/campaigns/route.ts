import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ADMIN_ACTOR, logAudit } from '@/lib/audit'
import { checkCampaignAuthorization } from '@/lib/authz'
import {
  asNumber,
  asRecord,
  asString,
  asStringArray,
  serializeCampaignDetail,
  serializeCampaignSummary,
} from '@/app/api/_lib/shared'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const campaigns = await db.campaign.findMany({
      include: { template: true, enrollments: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ campaigns: campaigns.map(serializeCampaignSummary) })
  } catch (error) {
    console.error('GET /api/campaigns failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const raw: unknown = await request.json().catch(() => null)
    const body = asRecord(raw)
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const name = (asString(body.name) ?? '').trim()
    if (!name) {
      return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 })
    }

    const templateId = asString(body.templateId) ?? ''
    const template = templateId ? await db.template.findUnique({ where: { id: templateId } }) : null
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 400 })
    }

    const rawParticipantIds = asStringArray(body.participantIds) ?? []
    if (rawParticipantIds.length === 0) {
      return NextResponse.json({ error: 'At least one participant is required' }, { status: 400 })
    }
    const participantIds = [...new Set(rawParticipantIds)]

    const participants = await db.participant.findMany({ where: { id: { in: participantIds } } })
    if (participants.length !== participantIds.length) {
      const foundIds = new Set(participants.map((p) => p.id))
      const missing = participantIds.find((id) => !foundIds.has(id)) ?? ''
      return NextResponse.json({ error: `Participant not found: ${missing}` }, { status: 400 })
    }

    const requestedRetention = asNumber(body.retentionDays) ?? 90
    const retentionDays = Math.min(365, Math.max(7, Math.round(requestedRetention)))

    const violations = await checkCampaignAuthorization({
      senderEmail: template.senderEmail,
      participants,
    })
    if (violations.length > 0) {
      return NextResponse.json(
        { error: 'Authorization checks failed', violations },
        { status: 400 }
      )
    }

    const description = (asString(body.description) ?? '').trim()
    const created = await db.campaign.create({
      data: {
        name,
        description: description || null,
        templateId: template.id,
        retentionDays,
        status: 'draft',
        enrollments: {
          create: participantIds.map((participantId) => ({ participantId })),
        },
      },
    })

    await logAudit(
      'CAMPAIGN_CREATED',
      ADMIN_ACTOR,
      `Campaign "${name}" created for ${participantIds.length} participants`
    )

    const campaign = await db.campaign.findUnique({
      where: { id: created.id },
      include: { template: true, enrollments: { include: { participant: true } } },
    })
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    return NextResponse.json({ campaign: serializeCampaignDetail(campaign) }, { status: 201 })
  } catch (error) {
    console.error('POST /api/campaigns failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
