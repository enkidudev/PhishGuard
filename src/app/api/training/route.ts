import { installModules } from '@/lib/training-modules'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { parseJsonArray } from '@/lib/events'
import { recommendModule } from '@/lib/learning'
import { purgeExpired } from '@/lib/retention'
export async function GET() {
 await purgeExpired()
 const s = await getSession()
 if (!s) return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 })
 const scope = s?.role === 'participant' ? { participantId: s.sub } : {}
 if (s?.role === 'participant') { const p = await db.participant.findUnique({ where: { id: s.sub } }); if (!p?.active || !p.consented) return NextResponse.json({ error: 'Participation not authorized' }, { status: 403 }) }
 await installModules(db)
 const [modules, completions, attempts, enrollments] = await Promise.all([
  db.trainingModule.findMany({ orderBy: { createdAt: 'asc' } }),
  db.trainingCompletion.findMany({ where: scope, include: { participant: true } }),
  db.trainingAttempt.findMany({ where: scope, orderBy: { createdAt: 'asc' } }),
  db.enrollment.findMany({ where: { ...scope, clickedAt: { not: null } }, include: { campaign: { include: { template: true } } } }),
 ])
 const recommendations = enrollments.map(e => ({ participantId: e.participantId, moduleTitle: recommendModule(e.campaign.template.category, modules.map(m => m.title)), reason: `Practice after an interaction with a ${e.campaign.template.category.toLowerCase()} simulation.` }))
 return NextResponse.json({ modules: modules.map(m => ({ ...m, redFlagTips: parseJsonArray(m.redFlagTips), completions: completions.filter(c => c.moduleId === m.id).length })), completions: completions.map(c => ({ participantId: c.participantId, participantName: c.participant.name, moduleId: c.moduleId, completedAt: c.completedAt.toISOString() })), attempts, recommendations })
}
