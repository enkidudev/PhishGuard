import { NextResponse } from 'next/server'
import { z } from 'zod'
import { logAudit } from '@/lib/audit'
import { AI_ACTOR, aiJson, withTimeout } from '@/lib/ai'
import { checkRateLimit, clientIp, rateLimitResponse } from '@/lib/rate-limit'
import { asNumber, asRecord, zodFirstIssueMessage } from '@/app/api/_lib/shared'

export const dynamic = 'force-dynamic'

const AI_RATE_LIMIT = 12
const AI_RATE_WINDOW_MS = 60_000
const AI_TIMEOUT_MS = 45_000

const bodySchema = z.object({
  report: z.record(z.string(), z.unknown()),
})

// LLM output shape · parsed defensively, anything off goes to the fallback.
const summarySchema = z.object({
  executiveSummary: z.string().min(1),
  narrative: z.string().min(1),
  keyRisks: z.array(z.string()),
  wins: z.array(z.string()),
  nextSteps: z.array(z.string()),
})

const SYSTEM_PROMPT = `You are a CISO-level security awareness program analyst writing the executive section of a phishing-simulation report produced by PhishGuard, an authorized awareness platform. Summarize ONLY the data you are given · never invent numbers. Keep a professional, board-ready tone. Respect privacy: reference departments, not individuals.

Respond with valid JSON only, no markdown fences. JSON shape:
{ "executiveSummary": "3-4 sentence overview quoting the key numbers", "narrative": "2 short paragraphs separated by a blank line: what the data says, how it changed", "keyRisks": string[] (1-5 items), "wins": string[] (1-5 items), "nextSteps": string[] (2-5 items) }`

const MAX_LIST_ITEMS = 5

/** Keep only non-empty strings, capped at 5 items per list. */
function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, MAX_LIST_ITEMS)
}

/*
 * Deterministic narrative built from report.overall when the LLM is
 * unavailable: same shape as the AI answer, actual numbers interpolated.
 */
function fallbackSummary(report: Record<string, unknown>): {
  summary: Record<string, unknown>
  source: 'fallback'
} {
  const overall = asRecord(report.overall) ?? {}
  const num = (key: string, fallback = 0): number => asNumber(overall[key]) ?? fallback

  const delivered = num('delivered')
  const clicks = num('clicks')
  const reports = num('reports')
  const clickRate = num('clickRate')
  const reportRate = num('reportRate')
  const resilienceScore = num('resilienceScore')

  const executiveSummary = `Across the reporting period ${delivered} simulated phishing emails were delivered. The click rate stands at ${clickRate}% and ${reportRate}% of simulated phishes were reported by participants, producing a program resilience score of ${resilienceScore}/100. These figures cover consented participants only, and no credential data is ever collected by the platform.`

  const narrative = `The simulation data shows ${clicks} click(s) and ${reports} report(s) against ${delivered} deliveries. A click rate of ${clickRate}% with a report rate of ${reportRate}% indicates how often staff engaged with simulated lures versus how often they flagged them, and the overall resilience score of ${resilienceScore} blends both with training completion.\n\nCompared with the start of the program, the goal is a falling click rate and a rising report rate; department-level vulnerability indexes in this report show where coaching should focus next. Results are aggregated for team leads, while named outcomes are excluded from this summary.`

  const keyRisks: string[] = []
  if (clickRate >= 30) {
    keyRisks.push(`Click rate of ${clickRate}% shows urgency-based lures are still effective for a meaningful share of staff.`)
  } else {
    keyRisks.push(`Click rate of ${clickRate}% is moderate, but hard-difficulty lures are expected to find residual gaps.`)
  }
  if (reportRate < 25) {
    keyRisks.push(`Report rate of ${reportRate}% suggests many suspicious emails go unreported.`)
  } else {
    keyRisks.push(`Report rate of ${reportRate}% is solid, yet underreporting pockets remain in lower-engagement departments.`)
  }
  if (resilienceScore < 60) {
    keyRisks.push(`Resilience score of ${resilienceScore} is below the 60-point comfort threshold.`)
  }

  const wins: string[] = []
  if (reportRate >= 25) {
    wins.push(`A ${reportRate}% report rate demonstrates that reporting habits are taking hold.`)
  }
  if (resilienceScore >= 70) {
    wins.push(`A resilience score of ${resilienceScore} puts the program in a healthy band.`)
  }
  if (delivered > 0) {
    wins.push(`${delivered} simulated deliveries gave every consented participant realistic practice.`)
  }
  if (wins.length === 0) {
    wins.push('The program is generating the baseline data needed to target coaching effectively.')
  }

  const nextSteps = [
    'Schedule micro-training for departments with the highest vulnerability index.',
    `Reinforce reporting habits · the next campaign should push the report rate above ${Math.min(100, Math.round(reportRate) + 10)}%.`,
    'Review the top red flags report and refresh templates that no longer challenge staff.',
  ]

  return {
    summary: {
      executiveSummary,
      narrative,
      keyRisks: keyRisks.slice(0, MAX_LIST_ITEMS),
      wins: wins.slice(0, MAX_LIST_ITEMS),
      nextSteps,
    },
    source: 'fallback',
  }
}

export async function POST(request: Request) {
  try {
    const limit = checkRateLimit(`ai:${clientIp(request)}`, AI_RATE_LIMIT, AI_RATE_WINDOW_MS)
    if (!limit.allowed) {
      return rateLimitResponse(limit.retryAfterSec)
    }

    const raw: unknown = await request.json().catch(() => null)
    const parsed = bodySchema.safeParse(raw)
    if (!parsed.success || typeof parsed.data.report !== 'object' || parsed.data.report === null) {
      const message = parsed.success
        ? 'report must be a JSON object'
        : zodFirstIssueMessage(parsed.error)
      return NextResponse.json({ error: message }, { status: 400 })
    }
    const input = parsed.data.report
    // Explicit aggregation allowlist: no names, IDs, free-text notes or raw report data sent externally.
    const overall = asRecord(input.overall) ?? {}
    const report = { overall: Object.fromEntries(['delivered','opens','clicks','reports','clickRate','reportRate','resilienceScore','trainingCompletionRate'].map(k => [k, asNumber(overall[k]) ?? 0])) }

    try {
      const result = await withTimeout(
        aiJson<unknown>(
          SYSTEM_PROMPT,
          `Here is the awareness report JSON to summarize:\n${JSON.stringify(report)}`
        ),
        AI_TIMEOUT_MS,
        'AI report summary'
      )
      const validated = summarySchema.safeParse(result)
      if (!validated.success) {
        throw new Error('AI report summary did not match the expected schema')
      }

      const summary = {
        executiveSummary: validated.data.executiveSummary.trim(),
        narrative: validated.data.narrative.trim(),
        keyRisks: cleanList(validated.data.keyRisks),
        wins: cleanList(validated.data.wins),
        nextSteps: cleanList(validated.data.nextSteps),
      }

      void logAudit(
        'AI_REPORT_SUMMARY',
        AI_ACTOR,
        'Executive narrative generated for the awareness report'
      ).catch(() => undefined)

      return NextResponse.json({ summary, source: 'ai' })
    } catch (aiError) {
      console.error('AI report summary fell back:', aiError)
      const fallback = fallbackSummary(report)
      return NextResponse.json(fallback)
    }
  } catch (error) {
    console.error('POST /api/ai/report-summary failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
