import { participantAlias } from '@/lib/privacy'
import { purgeExpired } from '@/lib/retention'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { round1 } from '@/app/api/_lib/shared'

export const dynamic = 'force-dynamic'

// Gamification scoring model (per enrollment outcome):
//   +8   delivered phish safely handled (opened at most, never clicked/submitted)
//   +15  phish reported
//         link opens are analytics only
//   -20  submitted a credential attempt on the simulated page
const SCORE_SAFE_DELIVERY = 8
const SCORE_REPORT = 15
const SCORE_SUBMITTED = -20

const SCORING_MODEL =
  '+8 per simulated phish handled safely (reported without submitting), +15 per report, no points per click, -20 per submitted action.'
const PRIVACY_NOTE =
  'Individual rows are simulated demo data; aliases are pseudonyms, not anonymous identities. Shared reports use aggregates.'

interface ParticipantTally {
  participantId: string
  name: string
  department: string
  delivered: number
  clicks: number
  submitted: number
  reports: number
  score: number
  badges: string[]
}

function computeBadges(tally: {
  delivered: number
  clicks: number
  submitted: number
  reports: number
  score: number
}): string[] {
  const badges: string[] = []
  if (tally.reports >= 3) badges.push('Phish Spotter')
  if (tally.delivered >= 3 && tally.clicks === 0 && tally.submitted === 0) {
    badges.push('Zero-Click Champion')
  }
  if (tally.score >= 40) badges.push('Guardian')
  if (tally.submitted >= 2) badges.push('Practice recommended')
  if (tally.reports === 1) badges.push('Report Rookie')
  return badges
}

export async function GET() {
  try {
    await purgeExpired()
    const [participants, enrollments] = await Promise.all([
      db.participant.findMany(),
      db.enrollment.findMany(),
    ])

    const byParticipant = new Map<string, typeof enrollments>()
    for (const enrollment of enrollments) {
      const list = byParticipant.get(enrollment.participantId)
      if (list) list.push(enrollment)
      else byParticipant.set(enrollment.participantId, [enrollment])
    }

    const tallies: ParticipantTally[] = participants.map((participant) => {
      const own = byParticipant.get(participant.id) ?? []
      const delivered = own.filter((e) => e.deliveredAt !== null).length
      const clicks = own.filter((e) => e.clickedAt !== null).length
      const submitted = own.filter((e) => e.submittedAt !== null).length
      const reports = own.filter((e) => e.reportedAt !== null).length
      const safelyHandled = own.filter(
        (e) => e.deliveredAt !== null && e.reportedAt !== null && e.submittedAt === null
      ).length

      const score = Math.round(
        SCORE_SAFE_DELIVERY * safelyHandled +
          SCORE_REPORT * reports +
          SCORE_SUBMITTED * submitted
      )
      const tally = { delivered, clicks, submitted, reports, score }
      return {
        participantId: participant.id,
        name: participantAlias(participant.id),
        department: participant.department,
        ...tally,
        badges: computeBadges(tally),
      }
    })

    const individuals = tallies
      .slice()
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))

    const byDepartment = new Map<
      string,
      { participants: number; reports: number; clicks: number; submitted: number; score: number }
    >()
    for (const tally of tallies) {
      const bucket = byDepartment.get(tally.department) ?? {
        participants: 0,
        reports: 0,
        clicks: 0,
        submitted: 0,
        score: 0,
      }
      bucket.participants += 1
      bucket.reports += tally.reports
      bucket.clicks += tally.clicks
      bucket.submitted += tally.submitted
      bucket.score += tally.score
      byDepartment.set(tally.department, bucket)
    }
    const departments = [...byDepartment.entries()].filter(([, d]) => d.participants >= 3)
      .map(([department, bucket]) => ({
        department,
        ...bucket,
        avgScore: round1(bucket.score / bucket.participants),
      }))
      .sort((a, b) => b.avgScore - a.avgScore || a.department.localeCompare(b.department))

    return NextResponse.json({
      leaderboard: {
        individuals,
        departments,
        meta: {
          scoringModel: SCORING_MODEL,
          generatedAt: new Date().toISOString(),
        },
        privacyNote: PRIVACY_NOTE,
      },
    })
  } catch (error) {
    console.error('GET /api/leaderboard failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
