import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ADMIN_ACTOR, logAudit } from '@/lib/audit'
import { asBoolean, asRecord, asString, serializeParticipant } from '@/app/api/_lib/shared'

export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const participant = await db.participant.findUnique({ where: { id } })
    if (!participant) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 })
    }

    const raw: unknown = await request.json().catch(() => null)
    const body = asRecord(raw)
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const data: {
      name?: string
      department?: string
      consented?: boolean
      consentedAt?: Date | null
      active?: boolean
    } = {}

    const name = asString(body.name)
    if (name !== undefined) {
      const trimmed = name.trim()
      if (!trimmed) {
        return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
      }
      data.name = trimmed
    }

    const department = asString(body.department)
    if (department !== undefined) {
      const trimmed = department.trim()
      if (!trimmed) {
        return NextResponse.json({ error: 'Department cannot be empty' }, { status: 400 })
      }
      data.department = trimmed
    }

    const consented = asBoolean(body.consented)
    if (consented === true && !participant.consented) return NextResponse.json({ error: 'Participants must grant consent through their private invitation' }, { status: 400 })
    if (consented !== undefined && consented !== participant.consented) {
      data.consented = consented
      data.consentedAt = consented ? new Date() : null
    }

    const active = asBoolean(body.active)
    if (active !== undefined) {
      data.active = active
    }

    const updated =
      Object.keys(data).length > 0 ? await db.participant.update({ where: { id }, data }) : participant

    if (data.consented === true) {
      await logAudit('CONSENT_RECORDED', ADMIN_ACTOR, `"${updated.name}" granted consent`)
    }
    if (data.consented === false) {
      await logAudit('CONSENT_REVOKED', ADMIN_ACTOR, `"${updated.name}" revoked consent`)
    }

    if (data.active !== undefined) await logAudit('PARTICIPANT_STATUS', ADMIN_ACTOR, `Participant status changed to ${data.active ? 'active' : 'inactive'}`)
    const enrollments = await db.enrollment.findMany({ where: { participantId: id } })
    return NextResponse.json({ participant: serializeParticipant(updated, enrollments) })
  } catch (error) {
    console.error('PATCH /api/participants/[id] failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const participant = await db.participant.findUnique({
      where: { id },
      include: { _count: { select: { enrollments: true } } },
    })
    if (!participant) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 })
    }
    if (participant._count.enrollments > 0) {
      return NextResponse.json(
        { error: 'Participant has campaign history; deactivate instead to preserve records' },
        { status: 400 }
      )
    }
    await db.participant.delete({ where: { id } })
    await logAudit(
      'PARTICIPANT_DELETED',
      ADMIN_ACTOR,
      `Participant "${participant.name}" <${participant.email}> removed from the program`
    )
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/participants/[id] failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
