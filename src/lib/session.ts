import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'

export const COOKIE = 'phishguard_session'
export type Session = { role: 'admin' | 'participant'; sub: string; exp: number; purpose: 'session' | 'invite'; nonce?: string }
function secret() {
  const key = process.env.SESSION_SECRET
  if (!key || key.length < 32) throw new Error('Run npm run setup to configure a session secret')
  return key
}
export function signToken(payload: Session) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${data}.${createHmac('sha256', secret()).update(data).digest('base64url')}`
}
export function verifyToken(token: string, purpose: Session['purpose'] = 'session'): Session | null {
  try {
    const [data, sig, extra] = token.split('.')
    if (!data || !sig || extra) return null
    const expected = createHmac('sha256', secret()).update(data).digest()
    const received = Buffer.from(sig, 'base64url')
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null
    const p = JSON.parse(Buffer.from(data, 'base64url').toString()) as Session
    return p.purpose === purpose && ['admin','participant'].includes(p.role) && typeof p.sub === 'string' && p.exp > Date.now() ? p : null
  } catch { return null }
}
export async function getSession() { return verifyToken((await cookies()).get(COOKIE)?.value ?? '') }
export function issueSession(role: Session['role'], sub: string) {
  return signToken({ role, sub, purpose: 'session', exp: Date.now() + 8 * 3600_000 })
}
export function sessionCookie(value: string) {
  return { name: COOKIE, value, httpOnly: true, sameSite: 'strict' as const, secure: process.env.COOKIE_SECURE === 'true', path: '/', maxAge: 8 * 3600 }
}
export function invitationToken(sub: string) { return signToken({ role: 'participant', sub, purpose: 'invite', nonce: randomBytes(24).toString('hex'), exp: Date.now() + 24 * 3600_000 }) }
