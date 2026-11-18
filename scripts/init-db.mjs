import { existsSync, mkdirSync, closeSync, openSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'
if (existsSync('.env')) process.loadEnvFile('.env')
const url = process.env.DATABASE_URL || 'file:../db/custom.db'
if (url.startsWith('file:')) {
 const file = url.startsWith('file:/') ? url.slice(5) : resolve('prisma',url.slice(5))
 mkdirSync(dirname(file),{recursive:true})
 if (!existsSync(file)) closeSync(openSync(file,'wx'))
 process.env.DATABASE_URL = 'file:' + file
}
const result = spawnSync(process.execPath,['node_modules/prisma/build/index.js','db','push'],{env:process.env,stdio:'inherit'})
process.exitCode = result.status ?? 1
