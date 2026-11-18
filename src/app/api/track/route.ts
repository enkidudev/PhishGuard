import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/session'
import { TRACK_TYPES, trackInteraction } from '@/lib/tracking'
import { purgeExpired } from '@/lib/retention'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
const schema = z.object({ enrollmentId: z.string().min(1).max(100), type: z.enum(TRACK_TYPES) }).strict()
export async function POST(request: Request) {
 const s = await getSession()
 if (!s) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
 const limit = checkRateLimit(`track:${s.sub}`, 120, 60_000)
 if (!limit.allowed) return rateLimitResponse(limit.retryAfterSec)
 const parsed = schema.safeParse(await request.json().catch(() => null))
 if (!parsed.success) return NextResponse.json({ error: 'Only enrollmentId and an allowed event type are accepted. Input values and notes are forbidden.' }, { status: 400 })
 await purgeExpired()
 try { return NextResponse.json(await trackInteraction(parsed.data.enrollmentId, parsed.data.type, s.role === 'participant' ? s.sub : undefined)) }
 catch (error) {
  const message = error instanceof Error ? error.message : ''
  if (message === 'OUTCOME_LOCKED') return NextResponse.json({ error: 'This exercise already has a recorded outcome. Reporting and proceeding are separate outcomes.' }, { status: 409 })
  return NextResponse.json({ error: message === 'INACTIVE' ? 'Campaign stopped, authorization withdrawn or participation expired' : 'Interaction unavailable' }, { status: message === 'INACTIVE' ? 409 : 403 })
 }
}
