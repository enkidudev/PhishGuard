import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'
export const TRACK_TYPES = ['OPEN','CLICK','LANDED','SUBMITTED','REPORT'] as const
export type TrackType = typeof TRACK_TYPES[number]
const fields = { OPEN: 'openedAt', CLICK: 'clickedAt', LANDED: 'landedAt', SUBMITTED: 'submittedAt', REPORT: 'reportedAt' } as const
export async function trackInteraction(id: string, type: TrackType, participantId?: string) {
 return db.$transaction(async tx => {
  const e = await tx.enrollment.findUnique({ where: { id }, include: { participant: true, campaign: { include: { template: true } } } })
  if (!e || (participantId && participantId !== e.participantId)) throw new Error('FORBIDDEN')
  if (!e.participant.active || !e.participant.consented || e.campaign.status !== 'running' || !e.deliveredAt) throw new Error('INACTIVE')
  const domain = e.campaign.template.senderEmail.split('@').pop()!.toLowerCase()
  if (!await tx.allowedDomain.findUnique({ where: { domain } })) throw new Error('INACTIVE')
  if (!await tx.allowedDomain.findUnique({ where: { domain: e.participant.email.split('@').pop()!.toLowerCase() } })) throw new Error('INACTIVE')
  if ((type === 'REPORT' && e.submittedAt && !e.reportedAt) || (type === 'SUBMITTED' && e.reportedAt && !e.submittedAt)) throw new Error('OUTCOME_LOCKED')
  const stages: TrackType[] = type === 'REPORT' ? ['REPORT'] : TRACK_TYPES.slice(0, TRACK_TYPES.indexOf(type) + 1)
  let created = false
  for (const stage of stages) {
   const field = fields[stage]
   const now = new Date()
   const outcomeGuard = stage === 'REPORT' ? { submittedAt: null } : stage === 'SUBMITTED' ? { reportedAt: null } : {}
   const changed = await tx.enrollment.updateMany({ where: { id, [field]: null, ...outcomeGuard }, data: { [field]: now } as Prisma.EnrollmentUpdateManyMutationInput })
   if (changed.count) {
    await tx.trackedEvent.create({ data: { enrollmentId: id, type: stage, createdAt: now } })
    if (stage === type) created = true
   }
  }
  const updated = await tx.enrollment.findUniqueOrThrow({ where: { id } })
  if ((type === 'REPORT' && updated.submittedAt && !updated.reportedAt) || (type === 'SUBMITTED' && updated.reportedAt && !updated.submittedAt)) throw new Error('OUTCOME_LOCKED')
  return { already: !created, enrollment: { id, openedAt: updated.openedAt, clickedAt: updated.clickedAt, landedAt: updated.landedAt, submittedAt: updated.submittedAt, reportedAt: updated.reportedAt }, credentialsStored: false }
 })
}
