import { participantAlias, csvCell } from '@/lib/privacy'
import { purgeExpired } from '@/lib/retention'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { ADMIN_ACTOR, logAudit } from '@/lib/audit'
import { formatDateKey, zodFirstIssueMessage } from '@/app/api/_lib/shared'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  entity: z.enum(['events', 'campaigns', 'participants']),
})

/* ------------------------------ CSV helpers ------------------------------ */

/** Quote a field when it contains a comma, quote, or newline (RFC 4180). */
const csvField = csvCell

function toCsv(header: string[], rows: unknown[][]): string {
  const lines = [header, ...rows].map((row) => row.map(csvField).join(','))
  return `${lines.join('\r\n')}\r\n`
}

/* --------------------------------- routes -------------------------------- */

export async function GET(request: Request) {
  try {
    await purgeExpired()
    const url = new URL(request.url)
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams))
    if (!parsed.success) {
      return NextResponse.json({ error: zodFirstIssueMessage(parsed.error) }, { status: 400 })
    }
    const entity = parsed.data.entity

    let header: string[]
    let rows: unknown[][]

    if (entity === 'events') {
      const events = await db.trackedEvent.findMany({
        orderBy: { createdAt: 'asc' },
        include: {
          enrollment: {
            include: {
              participant: { select: { id: true } },
              campaign: { include: { template: { select: { category: true } } } },
            },
          },
        },
      })
      header = ['id', 'type', 'createdAt', 'campaignName', 'participantAlias', 'templateCategory', 'note']
      rows = events.map((event) => [
        event.id,
        event.type,
        event.createdAt.toISOString(),
        event.enrollment.campaign.name,
        participantAlias(event.enrollment.participant.id),
        event.enrollment.campaign.template.category,
        '',
      ])
    } else if (entity === 'campaigns') {
      const campaigns = await db.campaign.findMany({
        orderBy: { createdAt: 'asc' },
        include: { template: true, enrollments: true },
      })
      header = [
        'id',
        'name',
        'status',
        'templateName',
        'templateCategory',
        'templateDifficulty',
        'retentionDays',
        'participantCount',
        'delivered',
        'opens',
        'clicks',
        'landed',
        'submitted',
        'reports',
        'launchedAt',
        'completedAt',
      ]
      rows = campaigns.map((campaign) => [
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.template.name,
        campaign.template.category,
        campaign.template.difficulty,
        campaign.retentionDays,
        campaign.enrollments.length,
        campaign.enrollments.filter((e) => e.deliveredAt !== null).length,
        campaign.enrollments.filter((e) => e.openedAt !== null).length,
        campaign.enrollments.filter((e) => e.clickedAt !== null).length,
        campaign.enrollments.filter((e) => e.landedAt !== null).length,
        campaign.enrollments.filter((e) => e.submittedAt !== null).length,
        campaign.enrollments.filter((e) => e.reportedAt !== null).length,
        campaign.launchedAt ? campaign.launchedAt.toISOString() : '',
        campaign.completedAt ? campaign.completedAt.toISOString() : '',
      ])
    } else {
      const [participants, enrollments] = await Promise.all([
        db.participant.findMany({ orderBy: { name: 'asc' } }),
        db.enrollment.findMany(),
      ])
      const byParticipant = new Map<string, typeof enrollments>()
      for (const enrollment of enrollments) {
        const list = byParticipant.get(enrollment.participantId)
        if (list) list.push(enrollment)
        else byParticipant.set(enrollment.participantId, [enrollment])
      }
      header = [
        'id',
        'participantAlias',
        'identityOmitted',
        'department',
        'consented',
        'active',
        'delivered',
        'opens',
        'clicks',
        'landed',
        'submitted',
        'reports',
      ]
      rows = participants.map((participant) => {
        const own = byParticipant.get(participant.id) ?? []
        return [
          participantAlias(participant.id),
          participantAlias(participant.id),
          true,
          participant.department,
          participant.consented,
          participant.active,
          own.filter((e) => e.deliveredAt !== null).length,
          own.filter((e) => e.openedAt !== null).length,
          own.filter((e) => e.clickedAt !== null).length,
          own.filter((e) => e.landedAt !== null).length,
          own.filter((e) => e.submittedAt !== null).length,
          own.filter((e) => e.reportedAt !== null).length,
        ]
      })
    }

    const csv = toCsv(header, rows)
    const date = formatDateKey(new Date())

    await logAudit(
      'DATA_EXPORTED',
      ADMIN_ACTOR,
      `Exported ${entity} as CSV (${rows.length} row(s))`
    )

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="phishguard-${entity}-${date}.csv"`,
      },
    })
  } catch (error) {
    console.error('GET /api/export failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
