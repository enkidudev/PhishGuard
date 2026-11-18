import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, COOKIE } from '@/lib/session'
export async function POST() {
 const s = await getSession()
 if (s?.role !== 'participant') return NextResponse.json({ error: 'Participant session required' }, { status: 403 })
 await db.$transaction(async tx => {
  await tx.participant.update({ where: { id: s.sub }, data: { consented: false, consentedAt: null } })
  await tx.auditLog.create({ data: { action: 'CONSENT_REVOKED', actor: `participant:${s.sub}`, detail: 'Participant withdrew consent; further interaction is blocked' } })
 })
 const response = NextResponse.json({ ok: true }); response.cookies.set(COOKIE, '', { maxAge: 0, path: '/' }); return response
}
