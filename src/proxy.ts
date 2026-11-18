import { adminSessionSubject, currentAdminHash } from '@/lib/admin-credentials'
import { validRequestOrigin } from '@/lib/request-origin'
import { NextRequest, NextResponse } from 'next/server'
import { COOKIE, verifyToken } from '@/lib/session'
const PUBLIC = new Set(['/api/auth/login', '/api/auth/accept', '/api/auth/session'])
const PARTICIPANT = new Set(['/api/auth/logout','/api/consent','/api/participants','/api/inbox','/api/track','/api/training','/api/training/complete','/api/training/assessment','/api/ai/coach'])
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  if (!['GET','HEAD','OPTIONS'].includes(request.method)) {
    const origin = request.headers.get('origin')
    const expected = process.env.APP_ORIGIN || request.nextUrl.origin
    if (!validRequestOrigin(origin, request.url, expected, process.env.NODE_ENV === 'development')) return NextResponse.json({ error: 'Request origin does not match APP_ORIGIN. Open the configured address or run npm.cmd run setup -- --repair-local for local development, then restart.' }, { status: 403 })
    const length = Number(request.headers.get('content-length') || 0)
    if (length > 64_000) return NextResponse.json({ error: 'Request too large' }, { status: 413 })
    if (!request.headers.get('content-type')?.startsWith('application/json')) return NextResponse.json({ error: 'JSON required' }, { status: 415 })
  }
  if (!PUBLIC.has(path)) {
    const session = verifyToken(request.cookies.get(COOKIE)?.value ?? '')
    if (!session) return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 })
    if (session.role === 'admin' && session.sub !== adminSessionSubject(await currentAdminHash())) return NextResponse.json({ error: 'Session expired. Sign in again.' }, { status: 401 })
    if (session.role === 'participant' && (!PARTICIPANT.has(path) || (path === '/api/participants' && request.method !== 'GET'))) return NextResponse.json({ error: 'Administrator access required' }, { status: 403 })
  }
  const response = NextResponse.next()
  response.headers.set('Cache-Control', 'no-store')
  return response
}
export const config = { matcher: '/api/:path*' }
