import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { db } from './db'

const derive = promisify(scrypt)
export const adminCredentialKey = 'adminPasswordHash'

export async function currentAdminHash() {
  const stored = await db.setting.findUnique({ where: { key: adminCredentialKey } })
  return stored?.value ?? process.env.ADMIN_PASSWORD_HASH ?? ''
}

export function adminSessionSubject(hash: string) {
  return 'admin:' + createHash('sha256').update(hash).digest('hex')
}

export async function verifyAdminPassword(value: string, stored: string) {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash || !/^[0-9a-f]{128}$/i.test(hash) || value.length > 256) return false
  const actual = await derive(value, salt, 64) as Buffer
  return timingSafeEqual(Buffer.from(hash, 'hex'), actual)
}

export async function hashAdminPassword(value: string) {
  const salt = randomBytes(16).toString('hex')
  const hash = await derive(value, salt, 64) as Buffer
  return `${salt}:${hash.toString('hex')}`
}
