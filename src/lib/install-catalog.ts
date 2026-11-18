import type { Prisma } from '@prisma/client'
import { casePresentation } from './catalog-cases'
import { makeTrainingDraft, trainingCatalog } from './training-catalog'
import { installOriginalTemplates } from './original-templates'

export async function installCatalog(db: Prisma.TransactionClient) {
  await installOriginalTemplates(db)
  for (const entry of trainingCatalog) {
    const id = `training-catalog-${entry.id}`
    const difficulty = ['recovery', 'app-access'].includes(entry.id) ? 'hard' : entry.id === 'qr-notice' ? 'easy' : 'medium'
    const draft = makeTrainingDraft(entry, difficulty)
    await db.template.upsert({
      where: { id },
      update: { id },
      create: { ...draft, id, isBuiltIn: true, redFlags: JSON.stringify(draft.redFlags) },
    })

    const previousSubject = `Training exercise: ${entry.name}`
    const stock = casePresentation(entry.id)
    if (!stock) continue

    const oldCaseBody = stock.bodyHtml.replace(/\n {4}<p><a href="#">Open practice screen<\/a><\/p>/, '')
    await db.template.updateMany({
      where: {
        id,
        isBuiltIn: true,
        OR: [
          { subject: previousSubject, bodyHtml: { contains: 'Internal awareness exercise' } },
          { subject: stock.subject, bodyHtml: oldCaseBody },
        ],
      },
      data: { subject: draft.subject, bodyHtml: draft.bodyHtml },
    })
  }
}
