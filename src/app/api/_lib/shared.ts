import { safeTemplateHtml } from '@/lib/template-safety'
// PhishGuard API · shared serialization & aggregation helpers.
// Colocated under src/app/api/_lib (underscore folder = private, never routed).

import { db } from '@/lib/db'
import { parseJsonArray } from '@/lib/events'
import type { ZodError } from 'zod'
import type { Enrollment, Participant, Prisma, Template, TrackedEvent } from '@prisma/client'

/* ----------------------------- primitives ----------------------------- */

export function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/** Percentage rounded to 1 decimal; 0 when the denominator is 0. */
export function pct(part: number, whole: number): number {
  return whole > 0 ? round1((part / whole) * 100) : 0
}

export function computeRates(delivered: number, opens: number, clicks: number, reports: number) {
  return {
    openRate: pct(opens, delivered),
    clickRate: pct(clicks, delivered),
    reportRate: pct(reports, delivered),
  }
}

export type Rates = ReturnType<typeof computeRates>

export function computeResilienceScore(
  clickRate: number,
  reportRate: number,
  trainingCompletionRate: number
): number {
  return Math.max(0, Math.min(100, Math.round(0.4 * (100 - clickRate) + 0.4 * reportRate + 0.2 * trainingCompletionRate)))
}

/** Local-calendar YYYY-MM-DD key. */
export function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/* --------------------------- body parsing ----------------------------- */

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

export function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

export function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.filter((item): item is string => typeof item === 'string')
}

/** Human-readable first issue of a failed zod parse, for 400 error bodies. */
export function zodFirstIssueMessage(error: ZodError): string {
  const issue = error.issues[0]
  if (!issue) return 'Invalid request body'
  const path = issue.path.length > 0 ? issue.path.join('.') : ''
  return path ? `${path}: ${issue.message}` : issue.message
}

/* --------------------------- serializers ------------------------------ */

export type CampaignSummaryRow = Prisma.CampaignGetPayload<{
  include: { template: true; enrollments: true }
}>

export type CampaignDetailRow = Prisma.CampaignGetPayload<{
  include: { template: true; enrollments: { include: { participant: true } } }
}>

export interface CampaignSummary {
  id: string
  name: string
  description: string
  status: string
  retentionDays: number
  createdAt: string
  launchedAt: string | null
  completedAt: string | null
  template: {
    id: string
    name: string
    category: string
    difficulty: string
    senderName: string
    senderEmail: string
  }
  participantCount: number
  delivered: number
  opens: number
  clicks: number
  landed: number
  submitted: number
  reports: number
}

export interface CampaignDetail extends CampaignSummary {
  participants: {
    enrollmentId: string
    participantId: string
    name: string
    email: string
    department: string
    consented: boolean
    active: boolean
    deliveredAt: string | null
    openedAt: string | null
    clickedAt: string | null
    landedAt: string | null
    submittedAt: string | null
    reportedAt: string | null
  }[]
}

export function serializeCampaignSummary(campaign: CampaignSummaryRow): CampaignSummary {
  const enrollments = campaign.enrollments
  return {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description ?? '',
    status: campaign.status,
    retentionDays: campaign.retentionDays,
    createdAt: campaign.createdAt.toISOString(),
    launchedAt: campaign.launchedAt ? campaign.launchedAt.toISOString() : null,
    completedAt: campaign.completedAt ? campaign.completedAt.toISOString() : null,
    template: {
      id: campaign.template.id,
      name: campaign.template.name,
      category: campaign.template.category,
      difficulty: campaign.template.difficulty,
      senderName: campaign.template.senderName,
      senderEmail: campaign.template.senderEmail,
    },
    participantCount: enrollments.length,
    delivered: enrollments.filter((e) => e.deliveredAt !== null).length,
    opens: enrollments.filter((e) => e.openedAt !== null).length,
    clicks: enrollments.filter((e) => e.clickedAt !== null).length,
    landed: enrollments.filter((e) => e.landedAt !== null).length,
    submitted: enrollments.filter((e) => e.submittedAt !== null).length,
    reports: enrollments.filter((e) => e.reportedAt !== null).length,
  }
}

export function serializeCampaignDetail(campaign: CampaignDetailRow): CampaignDetail {
  return {
    ...serializeCampaignSummary(campaign),
    participants: campaign.enrollments
      .map((enrollment) => ({
        enrollmentId: enrollment.id,
        participantId: enrollment.participantId,
        name: enrollment.participant.name,
        email: enrollment.participant.email,
        department: enrollment.participant.department,
        consented: enrollment.participant.consented,
        active: enrollment.participant.active,
        deliveredAt: enrollment.deliveredAt ? enrollment.deliveredAt.toISOString() : null,
        openedAt: enrollment.openedAt ? enrollment.openedAt.toISOString() : null,
        clickedAt: enrollment.clickedAt ? enrollment.clickedAt.toISOString() : null,
        landedAt: enrollment.landedAt ? enrollment.landedAt.toISOString() : null,
        submittedAt: enrollment.submittedAt ? enrollment.submittedAt.toISOString() : null,
        reportedAt: enrollment.reportedAt ? enrollment.reportedAt.toISOString() : null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}

export function serializeParticipant(participant: Participant, enrollments: Enrollment[]) {
  return {
    id: participant.id,
    name: participant.name,
    email: participant.email,
    department: participant.department,
    consented: participant.consented,
    consentedAt: participant.consentedAt ? participant.consentedAt.toISOString() : null,
    active: participant.active,
    createdAt: participant.createdAt.toISOString(),
    stats: {
      campaigns: enrollments.length,
      delivered: enrollments.filter((e) => e.deliveredAt !== null).length,
      opens: enrollments.filter((e) => e.openedAt !== null).length,
      clicks: enrollments.filter((e) => e.clickedAt !== null).length,
      landed: enrollments.filter((e) => e.landedAt !== null).length,
      submitted: enrollments.filter((e) => e.submittedAt !== null).length,
      reports: enrollments.filter((e) => e.reportedAt !== null).length,
    },
  }
}

export function serializeTemplate(template: Template, usageCount: number) {
  return {
    id: template.id,
    name: template.name,
    category: template.category,
    difficulty: template.difficulty,
    subject: template.subject,
    senderName: template.senderName,
    senderEmail: template.senderEmail,
    bodyHtml: safeTemplateHtml(template.bodyHtml),
    landingMessage: template.landingMessage,
    redFlags: parseJsonArray(template.redFlags),
    isBuiltIn: template.isBuiltIn,
    aiGenerated: template.aiGenerated,
    createdAt: template.createdAt.toISOString(),
    usageCount,
  }
}

/* ------------------------------- trend -------------------------------- */

export interface TrendPoint {
  date: string
  delivered: number
  opens: number
  clicks: number
  reports: number
}

/** Last 14 calendar days (oldest first, zero days included), grouped by local date. */
export function buildTrend(events: TrackedEvent[]): TrendPoint[] {
  const today = new Date()
  const days: TrendPoint[] = []
  for (let offset = 13; offset >= 0; offset -= 1) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset)
    days.push({ date: formatDateKey(day), delivered: 0, opens: 0, clicks: 0, reports: 0 })
  }
  const byDate = new Map<string, TrendPoint>(days.map((d) => [d.date, d]))
  for (const event of events) {
    const bucket = byDate.get(formatDateKey(event.createdAt))
    if (!bucket) continue
    if (event.type === 'DELIVERED') bucket.delivered += 1
    else if (event.type === 'OPEN') bucket.opens += 1
    else if (event.type === 'CLICK') bucket.clicks += 1
    else if (event.type === 'REPORT') bucket.reports += 1
  }
  return days
}

/* ---------------------------- departments ------------------------------ */

export interface DepartmentStat {
  department: string
  participants: number
  delivered: number
  opens: number
  clicks: number
  reports: number
  clickRate: number
  reportRate: number
  /** Higher = riskier: 0.6*clickRate + 0.4*(100-reportRate). */
  vulnerabilityIndex: number
}

/**
 * Aggregate tracked events per distinct participant department.
 * `enrollmentDepartment` maps enrollmentId -> participant department.
 * `participants` counts only active members; events from all members count.
 */
export function buildDepartments(
  participants: Participant[],
  events: TrackedEvent[],
  enrollmentDepartment: Map<string, string>
): DepartmentStat[] {
  const stats = new Map<string, DepartmentStat>()
  for (const participant of participants) {
    const existing = stats.get(participant.department)
    if (existing) {
      if (participant.active) existing.participants += 1
    } else {
      stats.set(participant.department, {
        department: participant.department,
        participants: participant.active ? 1 : 0,
        delivered: 0,
        opens: 0,
        clicks: 0,
        reports: 0,
        clickRate: 0,
        reportRate: 0,
        vulnerabilityIndex: 0,
      })
    }
  }
  for (const event of events) {
    const department = enrollmentDepartment.get(event.enrollmentId)
    const bucket = department ? stats.get(department) : undefined
    if (!bucket) continue
    if (event.type === 'DELIVERED') bucket.delivered += 1
    else if (event.type === 'OPEN') bucket.opens += 1
    else if (event.type === 'CLICK') bucket.clicks += 1
    else if (event.type === 'REPORT') bucket.reports += 1
  }
  const list = [...stats.values()]
  for (const item of list) {
    item.clickRate = pct(item.clicks, item.delivered)
    item.reportRate = pct(item.reports, item.delivered)
    item.vulnerabilityIndex = Math.round(0.6 * item.clickRate + 0.4 * (100 - item.reportRate))
  }
  return list.filter(d => d.participants >= 3).sort((a, b) => b.delivered - a.delivered || a.department.localeCompare(b.department))
}

/* ----------------------------- retention ------------------------------- */

export async function readRetentionPolicy(): Promise<{
  defaultRetentionDays: number
  autoPurge: boolean
}> {
  const settings = await db.setting.findMany({
    where: { key: { in: ['defaultRetentionDays', 'autoPurge'] } },
  })
  const values = new Map(settings.map((setting) => [setting.key, setting.value]))
  const parsedDays = Number.parseInt(values.get('defaultRetentionDays') ?? '90', 10)
  const autoPurgeRaw = values.get('autoPurge')
  return {
    defaultRetentionDays: Number.isFinite(parsedDays) ? parsedDays : 90,
    autoPurge: autoPurgeRaw === undefined ? true : autoPurgeRaw === 'true',
  }
}

export async function buildRetentionDetail() {
  const [policy, totalEvents, oldest] = await Promise.all([
    readRetentionPolicy(),
    db.trackedEvent.count(),
    db.trackedEvent.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
  ])
  return {
    ...policy,
    totalEvents,
    oldestEventAt: oldest ? oldest.createdAt.toISOString() : null,
  }
}

/* ------------------------- template validation -------------------------- */

export const TEMPLATE_DIFFICULTIES = ['easy', 'medium', 'hard'] as const
export type TemplateDifficulty = (typeof TEMPLATE_DIFFICULTIES)[number]

export function isTemplateDifficulty(value: string): value is TemplateDifficulty {
  return (TEMPLATE_DIFFICULTIES as readonly string[]).includes(value)
}

export interface TemplateFields {
  name: string
  category: string
  difficulty: string
  subject: string
  senderName: string
  senderEmail: string
  bodyHtml: string
  landingMessage: string
  redFlags: string[]
}

/** Returns an error message when invalid, or null when the fields are valid. */
export function validateTemplateFields(fields: TemplateFields): string | null {
  if (!fields.name.trim()) return 'Name is required'
  if (!fields.category.trim()) return 'Category is required'
  if (!isTemplateDifficulty(fields.difficulty)) return 'Difficulty must be easy, medium, or hard'
  if (!fields.subject.trim()) return 'Subject is required'
  if (!fields.senderName.trim()) return 'Sender name is required'
  if (!fields.senderEmail.trim()) return 'Sender email is required'
  if (!fields.senderEmail.includes('@')) return 'Sender email must contain @'
  if (!fields.bodyHtml.trim()) return 'Body HTML is required'
  if (!fields.landingMessage.trim()) return 'Landing message is required'
  return null
}

export function templateFieldsToData(fields: TemplateFields) {
  return {
    name: fields.name.trim(),
    category: fields.category.trim(),
    difficulty: fields.difficulty,
    subject: fields.subject.trim(),
    senderName: fields.senderName.trim(),
    senderEmail: fields.senderEmail.trim(),
    bodyHtml: safeTemplateHtml(fields.bodyHtml),
    landingMessage: fields.landingMessage,
    redFlags: JSON.stringify(fields.redFlags),
  }
}
