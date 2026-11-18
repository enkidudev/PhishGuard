import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { purgeExpired } from '@/lib/retention'
export async function GET() {
 await purgeExpired()
 const [participants, campaigns, domains, attempts, purge] = await Promise.all([db.participant.findMany(),db.campaign.findMany(),db.allowedDomain.count(),db.trainingAttempt.findMany({orderBy:{createdAt:'asc'}}),db.setting.findUnique({where:{key:'lastPurgeAt'}})])
 const pairs = new Map<string,{before?:number;after?:number}>()
 for (const a of attempts) { const key=`${a.participantId}:${a.moduleId}`; const p=pairs.get(key)||{}; if(a.phase==='baseline'&&p.before===undefined)p.before=100*a.score/a.total; if(a.phase==='followup')p.after=100*a.score/a.total; pairs.set(key,p) }
 const measured=[...pairs.values()].filter(p=>p.before!==undefined&&p.after!==undefined)
 return NextResponse.json({ activeParticipants:participants.filter(p=>p.active&&p.consented).length, runningCampaigns:campaigns.filter(c=>c.status==='running').length, approvedDomains:domains, lastPurgeAt:purge?.value||null, pairedAssessments:measured.length, learningGain:measured.length?Math.round(measured.reduce((sum,p)=>sum+p.after!-p.before!,0)/measured.length):null, aiMode:process.env.AI_ENABLED==='true'?'External AI enabled':'Local coaching', safeguards:['Signed sessions and participant scoping','Sender and recipient domain gates','No simulation credential inputs','Sandboxed email previews','Server-side small-group suppression','Scored learning assessments'] })
}
export async function POST() {
 const stopped = await db.$transaction(async tx => {
  const r=await tx.campaign.updateMany({where:{status:'running'},data:{status:'cancelled'}})
  await tx.auditLog.create({data:{action:'EMERGENCY_STOP',actor:'program-administrator',detail:`Stopped ${r.count} running campaigns; subsequent tracking is blocked`}})
  return r.count
 })
 return NextResponse.json({stopped})
}
