import { installOriginalTemplates } from '../src/lib/original-templates'
import { installModules } from '../src/lib/training-modules'
/**
 * PhishGuard · Seed script
 * Creates a rich, realistic demo dataset: participants, templates,
 * campaigns with a month of tracked events, training, compliance records.
 * Used by demo:install and demo:reset.
 */
import { PrismaClient, type Prisma } from '@prisma/client'

const day = (n: number, hourOffset = 0, minOffset = 0) =>
  new Date(Date.now() - n * 24 * 3600 * 1000 + hourOffset * 3600 * 1000 + minOffset * 60 * 1000)

export async function seedDemo(db: Prisma.TransactionClient, merge: boolean) {
  const marker = 'originalDemoRestoredV1'
  if (merge && await db.setting.findUnique({ where: { key: marker } })) return

  const installCampaign = async ({data}: {data: Prisma.CampaignUncheckedCreateInput}) => {
    if (merge && await db.campaign.findFirst({ where: { name: data.name } })) return null
    return db.campaign.create({ data })
  }
  const addedCampaignIds: string[] = []

  if (!merge) {
    console.log('Clearing existing data...')
    await db.trainingAttempt.deleteMany()
    await db.auditLog.deleteMany()
    await db.trackedEvent.deleteMany()
    await db.enrollment.deleteMany()
    await db.campaign.deleteMany()
    await db.trainingCompletion.deleteMany()
    await db.trainingModule.deleteMany()
    await db.template.deleteMany()
    await db.participant.deleteMany()
    await db.allowedDomain.deleteMany()
    await db.setting.deleteMany({ where: { key: { not: 'adminPasswordHash' } } })
  }

  // ---------------- Settings ----------------
  for (const setting of [
      { key: 'defaultRetentionDays', value: '90' },
      { key: 'autoPurge', value: 'true' },
    ]) await db.setting.upsert({ where: { key: setting.key }, update: {}, create: setting })

  // ---------------- Allowed sender domains ----------------
  for (const domain of [
      { domain: 'acme-corp.test', approvedBy: 'demo-fixture' },
      { domain: 'mail.securelab.test', approvedBy: 'security.admin@acme-corp.test', createdAt: day(60) },
      { domain: 'notifications.acme-corp.test', approvedBy: 'security.admin@acme-corp.test', createdAt: day(60) },
      { domain: 'hr-benefits.acme-corp.test', approvedBy: 'security.admin@acme-corp.test', createdAt: day(60) },
      { domain: 'billing.acme-vendor.test', approvedBy: 'security.admin@acme-corp.test', createdAt: day(45) },
    ]) await db.allowedDomain.upsert({ where: { domain: domain.domain }, update: {}, create: domain })

  // ---------------- Participants ----------------
  const people: {
    name: string
    email: string
    department: string
    consented?: boolean
  }[] = [
    { name: 'Priya Nair', email: 'priya.nair@acme-corp.test', department: 'Finance' },
    { name: 'Marcus Chen', email: 'marcus.chen@acme-corp.test', department: 'Finance' },
    { name: 'Elena Petrova', email: 'elena.petrova@acme-corp.test', department: 'Finance' },
    { name: 'Arjun Mehta', email: 'arjun.mehta@acme-corp.test', department: 'Engineering' },
    { name: 'Sofia Rossi', email: 'sofia.rossi@acme-corp.test', department: 'Engineering' },
    { name: 'David Kim', email: 'david.kim@acme-corp.test', department: 'Engineering' },
    { name: 'Grace Wanjiru', email: 'grace.wanjiru@acme-corp.test', department: 'HR' },
    { name: 'Hannah Lee', email: 'hannah.lee@acme-corp.test', department: 'Marketing' },
    { name: 'Omar Farouk', email: 'omar.farouk@acme-corp.test', department: 'Marketing' },
    { name: 'Ingrid Svensson', email: 'ingrid.svensson@acme-corp.test', department: 'Operations' },
    // Two people have NOT consented -> used to demonstrate the authorization gate
    { name: 'Tomás Alvarez', email: 'tomas.alvarez@acme-corp.test', department: 'HR', consented: false },
    { name: 'Kenji Tanaka', email: 'kenji.tanaka@acme-corp.test', department: 'Operations', consented: false },
  ]

  const participants: Record<string, { id: string }> = {}
  for (const p of people) {
    const row = await db.participant.upsert({
      where: { email: p.email },
      update: {},
      create: {
        name: p.name,
        email: p.email,
        department: p.department,
        consented: p.consented ?? true,
        consentedAt: p.consented ?? true ? day(58) : null,
        active: true,
        createdAt: day(59),
      },
    })
    participants[p.name] = row
  }

  const { tPassword, tInvoice, tPayroll, tLayoff } = await installOriginalTemplates(db)

  // ---------------- Campaigns ----------------
  // Stage offsets relative to the click day: landed = click +5 min, submitted = click +17 min.
  type Outcome = {
    who: string
    delivered: number
    open?: number
    click?: number
    landed?: boolean // simulated phishing page rendered after the click
    submitted?: boolean // credentials typed on the simulated page (values discarded, never stored)
    report?: number
  }
  const enroll = async (campaignId: string, outcomes: Outcome[]) => {
    for (const o of outcomes) {
      const didLand = o.landed === true && o.click !== undefined
      const didSubmit = o.submitted === true && didLand
      const e = await db.enrollment.create({
        data: {
          campaignId,
          participantId: participants[o.who].id,
          deliveredAt: day(o.delivered, 9, 15),
          openedAt: o.open !== undefined ? day(o.open, 11, 30) : null,
          clickedAt: o.click !== undefined ? day(o.click, 13, 45) : null,
          landedAt: didLand ? day(o.click as number, 13, 50) : null,
          submittedAt: didSubmit ? day(o.click as number, 14, 2) : null,
          reportedAt: o.report !== undefined ? day(o.report, 15, 10) : null,
          createdAt: day(o.delivered, 9, 14),
        },
      })
      const evs: { type: string; at: Date; note?: string }[] = [
        { type: 'DELIVERED', at: day(o.delivered, 9, 15) },
      ]
      if (o.open !== undefined) evs.push({ type: 'OPEN', at: day(o.open, 11, 30) })
      if (o.click !== undefined) evs.push({ type: 'CLICK', at: day(o.click, 13, 45) })
      if (didLand)
        evs.push({
          type: 'LANDED',
          at: day(o.click as number, 13, 50),
          note: 'Simulated phishing page rendered',
        })
      if (didSubmit)
        evs.push({
          type: 'SUBMITTED',
          at: day(o.click as number, 14, 2),
          note: 'Credentials entered on simulated page · input values discarded, never stored',
        })
      if (o.report !== undefined)
        evs.push({
          type: 'REPORT',
          at: day(o.report, 15, 10),
          note:
            o.click !== undefined
              ? 'Reported after clicking · good recovery!'
              : 'Reported before clicking · ideal behaviour!',
        })
      for (const ev of evs) {
        await db.trackedEvent.create({
          data: { enrollmentId: e.id, type: ev.type, note: ev.note, createdAt: ev.at },
        })
      }
    }
  }

  // Campaign 1 · completed, 32 days ago (easy)
  const c1 = await installCampaign({
    data: {
      name: 'Q3 Password Expiry Drill',
      description:
        'Baseline awareness drill targeting Finance, Engineering and Operations with a classic password-expiry lure.',
      status: 'completed',
      templateId: tPassword.id,
      retentionDays: 90,
      launchedAt: day(32, 9, 15),
      completedAt: day(28),
      createdAt: day(34),
    },
  })
  if (c1) addedCampaignIds.push(c1.id)
  if (c1) await enroll(c1.id, [
    { who: 'Priya Nair', delivered: 32, open: 32, click: 31, landed: true, submitted: true },
    { who: 'Marcus Chen', delivered: 32, open: 32, click: 31, landed: true, submitted: true, report: 30 },
    { who: 'Elena Petrova', delivered: 32, open: 31, report: 31 },
    { who: 'Arjun Mehta', delivered: 32, open: 33 },
    { who: 'Sofia Rossi', delivered: 32, open: 32, click: 30, landed: true },
    { who: 'David Kim', delivered: 32, open: 31, report: 29 },
    { who: 'Ingrid Svensson', delivered: 32 },
  ])

  // Campaign 2 · completed, 14 days ago (easy)
  const c2 = await installCampaign({
    data: {
      name: 'Q4 Invoice Fraud Drill',
      description: 'Vendor invoice-fraud simulation for Finance and Operations ahead of month-end close.',
      status: 'completed',
      templateId: tInvoice.id,
      retentionDays: 90,
      launchedAt: day(14, 9, 0),
      completedAt: day(10),
      createdAt: day(16),
    },
  })
  if (c2) addedCampaignIds.push(c2.id)
  if (c2) await enroll(c2.id, [
    { who: 'Priya Nair', delivered: 14, open: 14, report: 14 },
    { who: 'Marcus Chen', delivered: 14, open: 14, click: 13, landed: true },
    { who: 'Elena Petrova', delivered: 14, open: 13, report: 13 },
    { who: 'Ingrid Svensson', delivered: 14, open: 14 },
    { who: 'Hannah Lee', delivered: 14, open: 13, click: 12, landed: true, submitted: true, report: 12 },
  ])

  // Campaign 3 · RUNNING, launched 5 days ago, partial activity (live demo target)
  const c3 = await installCampaign({
    data: {
      name: 'Q4 Payroll Verification Drill',
      description:
        'Running drill: payroll-verification lure for Finance, HR and Marketing. Live training moment on click.',
      status: 'running',
      templateId: tPayroll.id,
      retentionDays: 90,
      launchedAt: day(5, 9, 0),
      createdAt: day(6),
    },
  })
  if (c3) addedCampaignIds.push(c3.id)
  if (c3) await enroll(c3.id, [
    { who: 'Priya Nair', delivered: 5, open: 5, click: 4, landed: true, submitted: true },
    { who: 'Marcus Chen', delivered: 5, open: 4, click: 4, landed: true },
    { who: 'Grace Wanjiru', delivered: 5, open: 4, report: 3 },
    { who: 'Elena Petrova', delivered: 5, open: 3, report: 2 },
    { who: 'Hannah Lee', delivered: 5, open: 5 },
    { who: 'Omar Farouk', delivered: 5 },
  ])

  // Campaign 4 · DRAFT, includes a NON-CONSENTED participant (authorization gate demo)
  const c4 = await installCampaign({
    data: {
      name: 'Q1 Confidential Data Test',
      description: 'Planned curiosity-driven drill with a hard-difficulty lure. Pending authorization review.',
      status: 'draft',
      templateId: tLayoff.id,
      retentionDays: 90,
      createdAt: day(2),
    },
  })
  if (c4) addedCampaignIds.push(c4.id)
  if (c4) for (const who of ['Grace Wanjiru', 'Tomás Alvarez', 'Arjun Mehta', 'David Kim']) {
    await db.enrollment.create({
      data: { campaignId: c4.id, participantId: participants[who].id },
    })
  }

  await installModules(db)

  // Learning scores start empty: only scored assessments can create completions.
  // Normalize fixture chronology so no event precedes delivery.
  const fixtureEvents = await db.trackedEvent.findMany({ where: { enrollment: { campaignId: { in: addedCampaignIds } } }, include: { enrollment: true } })
  for (const e of fixtureEvents) if (e.enrollment.deliveredAt && e.createdAt < e.enrollment.deliveredAt) await db.trackedEvent.update({ where: { id: e.id }, data: { createdAt: e.enrollment.deliveredAt } })

  // ---------------- Audit log ----------------
  const audits: [string, string, string, number][] = [
    ['CONSENT_RECORDED', 'system', '10 participants granted informed consent for simulation participation', 58],
    ['DOMAIN_APPROVED', 'security.admin@acme-corp.test', 'Approved sender domain: mail.securelab.test', 60],
    ['DOMAIN_APPROVED', 'security.admin@acme-corp.test', 'Approved sender domain: notifications.acme-corp.test', 60],
    ['DOMAIN_APPROVED', 'security.admin@acme-corp.test', 'Approved sender domain: hr-benefits.acme-corp.test', 60],
    ['DOMAIN_APPROVED', 'security.admin@acme-corp.test', 'Approved sender domain: billing.acme-vendor.test', 45],
    ['TEMPLATE_CREATED', 'security.admin@acme-corp.test', 'Simulation template "Password Expiry Alert" created', 55],
    ['TEMPLATE_CREATED', 'security.admin@acme-corp.test', 'Simulation template "Payroll Verification Request" created', 40],
    ['CAMPAIGN_LAUNCHED', 'security.admin@acme-corp.test', 'Campaign "Q3 Password Expiry Drill" launched for 7 authorized participants', 32],
    ['CAMPAIGN_COMPLETED', 'system', 'Campaign "Q3 Password Expiry Drill" completed', 28],
    ['CAMPAIGN_LAUNCHED', 'security.admin@acme-corp.test', 'Campaign "Q4 Invoice Fraud Drill" launched for 5 authorized participants', 14],
    ['CAMPAIGN_COMPLETED', 'system', 'Campaign "Q4 Invoice Fraud Drill" completed', 10],
    ['CAMPAIGN_LAUNCHED', 'security.admin@acme-corp.test', 'Campaign "Q4 Payroll Verification Drill" launched for 6 authorized participants', 5],
    ['RETENTION_POLICY', 'compliance.officer@acme-corp.test', 'Default retention set to 90 days, auto-purge enabled', 30],
    ['CAMPAIGN_CREATED', 'security.admin@acme-corp.test', 'Draft campaign "Q1 Confidential Data Test" created (pending authorization review)', 2],
  ]
  if (!merge) for (const [action, actor, detail, d] of audits) {
    await db.auditLog.create({ data: { action, actor, detail, createdAt: day(d, 10, 0) } })
  }

  if (merge) await db.setting.create({ data: { key: marker, value: 'true' } })

  const counts = {
    participants: await db.participant.count(),
    templates: await db.template.count(),
    campaigns: await db.campaign.count(),
    events: await db.trackedEvent.count(),
    modules: await db.trainingModule.count(),
    domains: await db.allowedDomain.count(),
  }
  console.log('Seed complete:', JSON.stringify(counts))
}

if (process.argv[1]?.endsWith('seed.ts')) {
  const db = new PrismaClient()
  db.$transaction(tx => seedDemo(tx, false), { timeout: 15000 })
    .catch((error) => {
      console.error(error)
      process.exitCode = 1
    })
    .finally(() => db.$disconnect())
}
