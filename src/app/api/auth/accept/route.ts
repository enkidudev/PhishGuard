import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken, issueSession, sessionCookie } from '@/lib/session'
import { createHash } from 'node:crypto'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
export async function POST(request: Request) {
 const limit = checkRateLimit('invite-accept', 30, 60_000)
 if (!limit.allowed) return rateLimitResponse(limit.retryAfterSec)
 const body = await request.json().catch(() => null)
 const invite = typeof body?.token === 'string' ? verifyToken(body.token, 'invite') : null
 if (!invite || invite.role !== 'participant' || body.consent !== true) return NextResponse.json({ error: 'Valid invitation and explicit consent required' }, { status: 400 })
 const accepted = await db.$transaction(async tx => {
  const p = await tx.participant.findUnique({ where: { id: invite.sub } })
  if (!p?.active) return false
  const stored = await tx.setting.findUnique({where:{key:`invite:${p.id}`}})
  if (!stored) return false
  const metadata = JSON.parse(stored.value)
  if (metadata.expiresAt < Date.now() || metadata.hash !== createHash('sha256').update(body.token).digest('hex')) return false
  const used = await tx.setting.deleteMany({ where: { key: `invite:${p.id}`, value: stored.value } })
  if (used.count !== 1) return false
  await tx.participant.update({ where: { id: p.id }, data: { consented: true, consentedAt: new Date() } })
  await tx.auditLog.create({ data: { action: 'CONSENT_RECORDED', actor: `participant:${p.id}`, detail: 'Participant accepted notice v1: internal simulations, interaction metrics, retention policy and withdrawal rights' } })
  return true
 })
 if (!accepted) return NextResponse.json({ error: 'Invitation expired, replaced or already used' }, { status: 400 })
 const response = NextResponse.json({ ok: true }); response.cookies.set(sessionCookie(issueSession('participant', invite.sub))); return response
}
