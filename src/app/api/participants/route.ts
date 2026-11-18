import { getSession } from '@/lib/session'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ADMIN_ACTOR, logAudit } from '@/lib/audit'
import { asBoolean, asRecord, asString, serializeParticipant } from '@/app/api/_lib/shared'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getSession()
    const own = session?.role === 'participant' ? session.sub : undefined
    const [participants, enrollments] = await Promise.all([
      db.participant.findMany({ where: own ? { id: own } : undefined }),
      db.enrollment.findMany({ where: own ? { participantId: own } : undefined }),
    ])
    const byParticipant = new Map<string, typeof enrollments>()
    for (const enrollment of enrollments) {
      const list = byParticipant.get(enrollment.participantId)
      if (list) list.push(enrollment)
      else byParticipant.set(enrollment.participantId, [enrollment])
    }
    const list = participants
      .map((participant) => serializeParticipant(participant, byParticipant.get(participant.id) ?? []))
      .sort((a, b) => a.name.localeCompare(b.name))
    return NextResponse.json({ participants: list })
  } catch (error) {
    console.error('GET /api/participants failed:', error)
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
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    const department = (asString(body.department) ?? '').trim()
    if (!department) {
      return NextResponse.json({ error: 'Department is required' }, { status: 400 })
    }
    const email = (asString(body.email) ?? '').trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 })
    }

    const all = await db.participant.findMany({ select: { email: true } })
    if (all.some((p) => p.email.toLowerCase() === email.toLowerCase())) {
      return NextResponse.json(
        { error: 'A participant with this email already exists' },
        { status: 409 }
      )
    }

    const consented = false // Only the participant invitation flow can grant consent.
    const created = await db.participant.create({
      data: {
        name,
        email,
        department,
        consented,
        consentedAt: consented ? new Date() : null,
      },
    })

    await logAudit(
      'PARTICIPANT_CREATED',
      ADMIN_ACTOR,
      `Participant "${name}" <${email}> added to the program`
    )
    if (consented) {
      await logAudit('CONSENT_RECORDED', ADMIN_ACTOR, `"${name}" granted consent`)
    }

    return NextResponse.json({ participant: serializeParticipant(created, []) }, { status: 201 })
  } catch (error) {
    console.error('POST /api/participants failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
