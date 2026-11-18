import { spawnSync } from 'node:child_process'

const direct = process.env.DIRECT_DATABASE_URL
if (!direct || !/^postgres(?:ql)?:\/\//.test(direct)) {
  console.error('Set DIRECT_DATABASE_URL to the direct connection for a fresh hosted demo database.')
  process.exit(1)
}

const env = { ...process.env, DATABASE_URL: direct }
function run(args) {
  const result = spawnSync(process.execPath, args, { env, stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

// Use a disposable demo database. Prisma refuses changes that would lose data.
run(['node_modules/prisma/build/index.js', 'db', 'push', '--schema', 'prisma/schema.postgres.prisma'])
run(['--import', 'tsx', 'scripts/install-training.ts', '--with-demo'])
