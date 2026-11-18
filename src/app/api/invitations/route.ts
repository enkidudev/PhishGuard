import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { invitationToken } from '@/lib/session'
import { createHash } from 'node:crypto'
import { logAudit } from '@/lib/audit'
export async function POST(request: Request) {
 const body = await request.json().catch(() => null)
 const p = typeof body?.participantId === 'string' ? await db.participant.findUnique({ where: { id: body.participantId } }) : null
 if (!p?.active) return NextResponse.json({ error: 'Active participant required' }, { status: 400 })
 const token = invitationToken(p.id)
 const invitationValue = JSON.stringify({ hash: createHash('sha256').update(token).digest('hex'), expiresAt: Date.now() + 24 * 3600_000 })
 await db.setting.upsert({ where: { key: `invite:${p.id}` }, create: { key: `invite:${p.id}`, value: invitationValue }, update: { value: invitationValue } })
 await logAudit('INVITATION_CREATED', 'program-administrator', 'Issued a single-use participant invitation; previous invitation invalidated')
 return NextResponse.json({ url: `${process.env.APP_ORIGIN || new URL(request.url).origin}/#invite=${token}`, expiresHours: 24 })
}
