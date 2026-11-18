import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes, scryptSync } from 'node:crypto'
import { spawnSync } from 'node:child_process'
mkdirSync('.verification', {recursive:true})
const root=mkdtempSync(join(process.cwd(),'.verification','run-'))
writeFileSync(join(root,'test.db'), '')
const password=randomBytes(24).toString('hex'),salt=randomBytes(16).toString('hex')
const env={...process.env,DATABASE_URL:`file:${join(root,'test.db')}`,TEST_ADMIN_PASSWORD:password,SESSION_SECRET:randomBytes(32).toString('hex'),ADMIN_PASSWORD_HASH:`${salt}:${scryptSync(password,salt,64).toString('hex')}`,APP_ORIGIN:'http://localhost:3000',COOKIE_SECURE:'false',AI_ENABLED:'false',NEXT_TELEMETRY_DISABLED:'1'}
const run=(args)=>{const result=spawnSync(process.execPath,args,{env,stdio:'inherit'});if(result.status!==0)throw new Error(`Verification step failed (${result.status})`)}
try{
 run(['node_modules/prisma/build/index.js','db','push','--skip-generate'])
 run(['--import','tsx','scripts/seed.ts'])
 run(['--import','tsx','scripts/install-training.ts'])
 run(['--import','tsx','scripts/install-training.ts'])
 const args=['node_modules/@playwright/test/cli.js','test']
 if(!process.argv.includes('--browser'))args.push('--grep','authorization|retention|domain|Studio|password rotation')
 run(args)
}catch(e){console.error(e.message);process.exitCode=1}finally{rmSync(root,{recursive:true,force:true})}
