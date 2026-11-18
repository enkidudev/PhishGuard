import { purgeExpired } from '@/lib/retention'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseJsonArray } from '@/lib/events'
import {
  buildDepartments,
  buildTrend,
  computeRates,
  computeResilienceScore,
  pct,
  readRetentionPolicy,
  type DepartmentStat,
  type TrendPoint,
} from '@/app/api/_lib/shared'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

/* ------------------------- report-only analytics ------------------------- */

const TIME_BUCKETS = ['< 1h', '1–6h', '6–24h', '1–3 days', '> 3 days'] as const

/** Enrollment rows as loaded by this route (participant name + department). */
type ReportEnrollment = Prisma.EnrollmentGetPayload<{
  include: { participant: { select: { name: true; department: true } } }
}>

/** Bucket enrollments by how fast participants reported (reportedAt - deliveredAt). */
function buildTimeToReport(enrollments: ReportEnrollment[]): { bucket: string; count: number }[] {
  const buckets = TIME_BUCKETS.map((bucket) => ({ bucket, count: 0 }))
  const HOUR = 60 * 60 * 1000
  for (const enrollment of enrollments) {
    if (!enrollment.reportedAt || !enrollment.deliveredAt) continue
    const diffMs = enrollment.reportedAt.getTime() - enrollment.deliveredAt.getTime()
    if (diffMs < 0) continue
    const hours = diffMs / HOUR
    const index = hours < 1 ? 0 : hours < 6 ? 1 : hours < 24 ? 2 : hours < 72 ? 3 : 4
    buckets[index].count += 1
  }
  return buckets
}

/** Participants who clicked in 2+ campaigns · coaching candidates. */
function buildRepeatClickers(
  enrollments: ReportEnrollment[]
): { name: string; department: string; clicks: number; submitted: number; reports: number }[] {
  const perParticipant = new Map<
    string,
    { name: string; department: string; clicks: number; submitted: number; reports: number }
  >()
  for (const enrollment of enrollments) {
    const entry =
      perParticipant.get(enrollment.participantId) ?? {
        name: enrollment.participant.name,
        department: enrollment.participant.department,
        clicks: 0,
        submitted: 0,
        reports: 0,
      }
    if (enrollment.clickedAt !== null) entry.clicks += 1
    if (enrollment.submittedAt !== null) entry.submitted += 1
    if (enrollment.reportedAt !== null) entry.reports += 1
    perParticipant.set(enrollment.participantId, entry)
  }
  return [...perParticipant.values()]
    .filter((entry) => entry.clicks >= 2)
    .sort((a, b) => b.clicks - a.clicks || b.reports - a.reports || a.name.localeCompare(b.name))
    .slice(0, 6)
}

/** Name of the department with the highest vulnerabilityIndex ('' when none). */
function pickTopRiskyDepartment(departments: DepartmentStat[]): string {
  const risky = departments
    .filter((department) => department.delivered > 0)
    .sort((a, b) => b.vulnerabilityIndex - a.vulnerabilityIndex)[0]
  return risky ? risky.department : ''
}

export async function GET() {
  try {
    await purgeExpired()
    const [participants, campaigns, enrollments, events, modules, completions, retention] =
      await Promise.all([
        db.participant.findMany(),
        db.campaign.findMany({ include: { template: true, enrollments: true } }),
        db.enrollment.findMany({
          include: { participant: { select: { name: true, department: true } } },
        }),
        db.trackedEvent.findMany(),
        db.trainingModule.findMany(),
        db.trainingCompletion.findMany(),
        readRetentionPolicy(),
      ])

    const delivered = events.filter((event) => event.type === 'DELIVERED').length
    const opens = events.filter((event) => event.type === 'OPEN').length
    const clicks = events.filter((event) => event.type === 'CLICK').length
    const landed = events.filter((event) => event.type === 'LANDED').length
    const submitted = events.filter((event) => event.type === 'SUBMITTED').length
    const reports = events.filter((event) => event.type === 'REPORT').length

    const rates = computeRates(delivered, opens, clicks, reports)
    const consentedActiveCount = participants.filter((p) => p.consented && p.active).length
    const trainingCompletions = completions.filter(c => participants.some(p => p.id === c.participantId && p.active && p.consented)).length
    const trainingCompletionRate = pct(trainingCompletions, consentedActiveCount * modules.length)
    const resilienceScore = computeResilienceScore(
      rates.clickRate,
      rates.reportRate,
      trainingCompletionRate
    )

    const overall = {
      participants: participants.length,
      consentedParticipants: participants.filter((p) => p.consented).length,
      delivered,
      opens,
      clicks,
      reports,
      openRate: rates.openRate,
      clickRate: rates.clickRate,
      reportRate: rates.reportRate,
      resilienceScore,
      trainingCompletionRate,
      trainingCompletions,
      stageCounts: { landed, submitted },
    }

    const trend: TrendPoint[] = buildTrend(events)

    const launchedCampaigns = campaigns.filter((campaign) => campaign.launchedAt !== null)
    launchedCampaigns.sort((a, b) => {
      const aTime = a.launchedAt ? a.launchedAt.getTime() : 0
      const bTime = b.launchedAt ? b.launchedAt.getTime() : 0
      return bTime - aTime
    })

    const reportCampaigns = launchedCampaigns.map((campaign) => {
      const campaignDelivered = campaign.enrollments.filter((e) => e.deliveredAt !== null).length
      const campaignOpens = campaign.enrollments.filter((e) => e.openedAt !== null).length
      const campaignClicks = campaign.enrollments.filter((e) => e.clickedAt !== null).length
      const campaignReports = campaign.enrollments.filter((e) => e.reportedAt !== null).length
      return {
        name: campaign.name,
        status: campaign.status,
        launchedAt: campaign.launchedAt ? campaign.launchedAt.toISOString() : '',
        completedAt: campaign.completedAt ? campaign.completedAt.toISOString() : null,
        participantCount: campaign.enrollments.length,
        delivered: campaignDelivered,
        opens: campaignOpens,
        clicks: campaignClicks,
        reports: campaignReports,
        clickRate: pct(campaignClicks, campaignDelivered),
        reportRate: pct(campaignReports, campaignDelivered),
      }
    })

    const enrollmentDepartment = new Map<string, string>(
      enrollments.map((enrollment): [string, string] => [
        enrollment.id,
        enrollment.participant.department,
      ])
    )
    const departments = buildDepartments(participants, events, enrollmentDepartment)

    // Red flags of templates used by running/completed campaigns,
    // counted once per campaign using that template.
    const flagCounts = new Map<string, number>()
    for (const campaign of campaigns) {
      if (campaign.status !== 'running' && campaign.status !== 'completed') continue
      for (const flag of new Set(parseJsonArray(campaign.template.redFlags))) {
        flagCounts.set(flag, (flagCounts.get(flag) ?? 0) + 1)
      }
    }
    const topRedFlags = [...flagCounts.entries()]
      .map(([flag, count]) => ({ flag, count }))
      .sort((a, b) => b.count - a.count || a.flag.localeCompare(b.flag))
      .slice(0, 8)

    // Data-driven recommendations (max 4 conditional + 2 always-on).
    const unconsentedCount = participants.filter((p) => !p.consented).length
    const conditional: string[] = []
    if (rates.clickRate > 30) {
      conditional.push(
        'Click rates above 30% indicate urgency-based lures are still effective · schedule the "Urgency & Pressure Tactics" module for all departments.'
      )
    }
    if (rates.reportRate < 25) {
      conditional.push(
        'Reporting rates below 25% show suspicious emails are going unreported · reinforce the "Spot & Report Phishing" module in your next security briefing.'
      )
    }
    for (const department of departments) {
      if (department.clickRate > 50) {
        conditional.push(
          `${department.department} shows elevated click susceptibility · assign targeted micro-training.`
        )
      }
    }
    if (trainingCompletionRate < 70) {
      conditional.push(
        'Training completion is below 70% · block calendar time this week and send reminders to participants with outstanding modules.'
      )
    }
    if (unconsentedCount > 0) {
      conditional.push(
        `${unconsentedCount} participant(s) have not yet granted consent · follow up before including them in future simulations.`
      )
    }
    const recommendations = [
      ...conditional.slice(0, 4),
      'Shared report omits named participant outcomes and suppresses departments with fewer than three active participants.',
      `Retention: up to ${retention.defaultRetentionDays} days, shortened by campaign policy. Automatic sweep ${retention.autoPurge ? "enabled while the service runs" : "disabled"}.`,
    ]

    const report = {
      generatedAt: new Date().toISOString(),
      overall,
      funnel: [
        { stage: 'delivered', count: delivered },
        { stage: 'opened', count: opens },
        { stage: 'clicked', count: clicks },
        { stage: 'landed', count: landed },
        { stage: 'submitted', count: submitted },
        { stage: 'reported', count: reports },
      ],
      timeToReport: buildTimeToReport(enrollments),
      repeatClickers: [],
      repeatClickersNote: 'Visible to administrators only for coaching.',
      topRiskyDepartment: pickTopRiskyDepartment(departments),
      trend,
      campaigns: reportCampaigns,
      departments,
      topRedFlags,
      recommendations,
      privacy: {
        credentialCollection: false,
        realEmailDelivery: false,
        individualScoresAnonymous: true,
        defaultRetentionDays: retention.defaultRetentionDays,
        autoPurge: retention.autoPurge,
      },
    }

    return NextResponse.json({ report })
  } catch (error) {
    console.error('GET /api/analytics/report failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
