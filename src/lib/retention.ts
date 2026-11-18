import { db } from '@/lib/db'
let inFlight: Promise<unknown> | null = null
let lastRun = 0
/** Delete whole expired participation records so event and timestamp analytics agree. */
export async function purgeExpired(force = false) {
 if (!force && Date.now() - lastRun < 60_000) return { purged: 0 }
 if (inFlight) return inFlight
 inFlight = (async () => {
  const settings = await db.setting.findMany()
  const values = new Map(settings.map(s => [s.key, s.value]))
  if (!force && values.get('autoPurge') === 'false') return { purged: 0 }
  const globalDays = Math.max(7, Math.min(365, Number(values.get('defaultRetentionDays') || 90)))
  const now = Date.now()
  const result = await db.$transaction(async tx => {
   const campaigns = await tx.campaign.findMany({ where: { launchedAt: { not: null } } })
   let purged = 0
   for (const c of campaigns) {
    const cutoff = new Date(now - Math.min(globalDays, c.retentionDays) * 86400_000)
    const count = await tx.enrollment.deleteMany({ where: { campaignId: c.id, deliveredAt: { lt: cutoff } } })
    purged += count.count
    if (c.launchedAt! < cutoff && c.status === 'running') await tx.campaign.update({ where: { id: c.id }, data: { status: 'completed', completedAt: new Date() } })
   }
   const cutoff = new Date(now - globalDays * 86400_000)
   const invitations = await tx.setting.findMany({ where: { key: { startsWith: 'invite:' } } })
   for (const invitation of invitations) {
    try { const data = JSON.parse(invitation.value); if (!data.expiresAt || data.expiresAt < now) await tx.setting.delete({where:{key:invitation.key}}) }
    catch { await tx.setting.delete({where:{key:invitation.key}}) }
   }
   await tx.trainingAttempt.deleteMany({ where: { createdAt: { lt: cutoff } } })
   await tx.trainingCompletion.deleteMany({ where: { completedAt: { lt: cutoff } } })
   await tx.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } })
   const inactive = await tx.participant.findMany({ where: { active: false, enrollments: { none: {} }, createdAt: { lt: cutoff } }, select: { id: true } })
   for (const p of inactive) { await tx.setting.deleteMany({ where: { key: `invite:${p.id}` } }); await tx.participant.delete({ where: { id: p.id } }) }
   await tx.setting.upsert({ where: { key: 'lastPurgeAt' }, create: { key: 'lastPurgeAt', value: new Date().toISOString() }, update: { value: new Date().toISOString() } })
   if (purged || force) await tx.auditLog.create({ data: { action: 'RETENTION_PURGE', actor: force ? 'program-administrator' : 'system', detail: `Removed ${purged} expired participation record(s), including their interaction events. Training and audit retention also applied.` } })
   return { purged, cutoffAt: cutoff.toISOString(), autoPurge: values.get('autoPurge') !== 'false' }
  })
  lastRun = Date.now()
  return result
 })().finally(() => { inFlight = null })
 return inFlight
}
