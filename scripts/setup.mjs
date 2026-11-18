import { randomBytes, scryptSync } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { updateEnv, defaults } from './env-config.mjs'
const file = '.env'
const old = existsSync(file) ? readFileSync(file, 'utf8') : 'DATABASE_URL="file:../db/custom.db"\n'
if (process.argv.includes('--repair-local')) {
 writeFileSync(file, updateEnv(old, defaults, {APP_ORIGIN: defaults.APP_ORIGIN, COOKIE_SECURE:'false'}), {mode:0o600});
 console.log('Local configuration repaired. Open http://127.0.0.1:3000 after restarting. Passphrase and database preserved.'); process.exit(0)
}
if (/^ADMIN_PASSWORD_HASH=.+/m.test(old)) {
 const secret = old.match(/^SESSION_SECRET=(.+)$/m)?.[1].trim().replace(/^(['"])(.*)\1$/, '$2')
 const overrides = secret && secret.length >= 32 ? {} : {SESSION_SECRET:randomBytes(32).toString('hex')}
 writeFileSync(file, updateEnv(old, defaults, overrides), {mode:0o600});
 console.log('Configuration preserved and duplicate entries removed.'); process.exit(0)
}
const rl = createInterface({ input: process.stdin, output: process.stdout })
const password = await rl.question('Choose a local administrator passphrase (12 to 256 characters; input is visible): ')
rl.close()
if (password.length < 12 || password.length > 256) { console.error('Use 12 to 256 characters.'); process.exit(1) }
const salt = randomBytes(16).toString('hex')
writeFileSync(file, updateEnv(old, defaults, {SESSION_SECRET:randomBytes(32).toString('hex'), ADMIN_PASSWORD_HASH:`${salt}:${scryptSync(password, salt, 64).toString('hex')}`}), { mode: 0o600 })
console.log('Configured. Keep .env private. Use HTTPS and COOKIE_SECURE=true when deploying.')
