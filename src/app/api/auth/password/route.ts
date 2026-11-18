import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getSession, issueSession, sessionCookie } from '@/lib/session'
import { adminCredentialKey, adminSessionSubject, currentAdminHash, hashAdminPassword, verifyAdminPassword } from '@/lib/admin-credentials'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

const input = z.object({
  current: z.string().min(1).max(256),
  replacement: z.string().min(12).max(256),
}).strict()

export async function POST(request: Request) {
  const session = await getSession()
  if (session?.role !== 'admin') return NextResponse.json({ error: 'Administrator access required' }, { status: 403 })
  const limit = checkRateLimit('admin-password-change', 5, 60_000)
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSec)

  const parsed = input.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Choose a new passphrase of 12 to 256 characters.' }, { status: 400 })
  const { current, replacement } = parsed.data
  if (current === replacement || replacement.trim().length < 12) return NextResponse.json({ error: 'Choose a different passphrase with at least 12 characters.' }, { status: 400 })

  const previous = await currentAdminHash()
  if (session.sub !== adminSessionSubject(previous) || !await verifyAdminPassword(current, previous)) {
    return NextResponse.json({ error: 'Current passphrase is incorrect or the session has expired.' }, { status: 401 })
  }

  const hash = await hashAdminPassword(replacement)
  try {
    const updated = await db.setting.updateMany({ where: { key: adminCredentialKey, value: previous }, data: { value: hash } })
    if (!updated.count) await db.setting.create({ data: { key: adminCredentialKey, value: hash } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'The passphrase changed in another session. Sign in again.' }, { status: 409 })
    }
    throw error
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(sessionCookie(issueSession('admin', adminSessionSubject(hash))))
  return response
}
