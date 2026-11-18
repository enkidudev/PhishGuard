import { NextResponse } from 'next/server'
import { z } from 'zod'
import { logAudit } from '@/lib/audit'
import { AI_ACTOR, aiJson, withTimeout } from '@/lib/ai'
import { checkRateLimit, clientIp, rateLimitResponse } from '@/lib/rate-limit'
import { zodFirstIssueMessage } from '@/app/api/_lib/shared'

export const dynamic = 'force-dynamic'

const AI_RATE_LIMIT = 12
const AI_RATE_WINDOW_MS = 60_000
const AI_TIMEOUT_MS = 45_000

const bodySchema = z.object({
  content: z
    .string()
    .min(20, 'content must be at least 20 characters')
    .max(10000, 'content must be at most 10000 characters'),
})

const VERDICTS = ['phishing', 'suspicious', 'likely_legitimate'] as const
type Verdict = (typeof VERDICTS)[number]

const SEVERITIES = ['high', 'medium', 'low'] as const
type Severity = (typeof SEVERITIES)[number]

interface Flag {
  title: string
  severity: Severity
  explanation: string
}

interface Analysis {
  riskScore: number
  verdict: Verdict
  confidence: number
  summary: string
  flags: Flag[]
  recommendations: string[]
  disclaimer: string
}

const DISCLAIMER = 'This screening result is for training and requires independent verification.'

const SYSTEM_PROMPT = `You are a senior email security analyst working for a security-awareness training platform. You assess email content for phishing indicators: urgency pressure, authority claims, mismatched or suspicious links, requests for credentials or one-time codes, payment diversion, unusual attachments, and impersonation cues.

Score guidance: 0-39 = likely legitimate, 40-69 = suspicious, 70-100 = phishing. Confidence reflects how certain the evidence makes you.

Respond with valid JSON only, no markdown fences. JSON shape:
{ "riskScore": 0-100 integer, "verdict": "phishing"|"suspicious"|"likely_legitimate", "confidence": 0-100 integer, "summary": "2-3 sentence plain-language assessment", "flags": [ { "title": string, "severity": "high"|"medium"|"low", "explanation": string } ], "recommendations": string[] (1-6 short actionable items) }`

const clamp = (value: number): number => Math.max(0, Math.min(100, Math.round(value)))

function deriveVerdict(riskScore: number): Verdict {
  if (riskScore >= 70) return 'phishing'
  if (riskScore >= 40) return 'suspicious'
  return 'likely_legitimate'
}

function normalizeFlags(value: unknown): Flag[] {
  if (!Array.isArray(value)) return []
  const flags: Flag[] = []
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue
    const record = item as Record<string, unknown>
    const title = typeof record.title === 'string' ? record.title.trim() : ''
    const explanation = typeof record.explanation === 'string' ? record.explanation.trim() : ''
    if (!title) continue
    const severity = (SEVERITIES as readonly string[]).includes(String(record.severity))
      ? (record.severity as Severity)
      : 'medium'
    flags.push({ title: title.slice(0, 120), severity, explanation: explanation.slice(0, 500) })
  }
  return flags.slice(0, 8)
}

function normalizeRecommendations(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim().slice(0, 240))
    .slice(0, 6)
}

/*
 * Deterministic heuristic scan used when the LLM is unavailable. Scores the
 * content against classic phishing indicators so the analyzer keeps working.
 */
function heuristicAnalysis(content: string): Analysis {
  const lower = content.toLowerCase()
  const flags: Flag[] = []
  let score = 15

  const has = (pattern: RegExp): boolean => pattern.test(lower)

  if (has(/urgent|immediately|act now|expires today|final notice|within 24 hours|asap|account (will be )?suspended|deadline/)) {
    flags.push({
      title: 'Urgency pressure language',
      severity: 'medium',
      explanation: 'The message pushes for immediate action, a classic tactic to short-circuit careful review.',
    })
    score += 15
  }
  if (has(/verify your account|confirm your identity|update your (payment|billing|bank)|re-?confirm your (details|account)/)) {
    flags.push({
      title: 'Account-verification lure',
      severity: 'high',
      explanation: 'Asks the recipient to verify or re-confirm account details, the hallmark of credential-harvesting emails.',
    })
    score += 20
  }
  if (has(/https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/)) {
    flags.push({
      title: 'Link points to a raw IP address',
      severity: 'high',
      explanation: 'Legitimate services almost never link to bare IP addresses; this usually indicates attacker-controlled infrastructure.',
    })
    score += 20
  }
  if (has(/http:\/\//)) {
    flags.push({
      title: 'Unencrypted http:// link',
      severity: 'medium',
      explanation: 'The message contains a non-HTTPS link; reputable providers use HTTPS for login and account pages.',
    })
    score += 10
  }
  if (has(/bit\.ly|tinyurl\.com|goo\.gl|t\.co|is\.gd|ow\.ly|cutt\.ly/)) {
    flags.push({
      title: 'URL shortener hides the real destination',
      severity: 'medium',
      explanation: 'Shortened links conceal where they actually lead and should be treated with caution.',
    })
    score += 10
  }
  if (has(/\bpassword\b|one[- ]time code|\botp\b|verification code|security question/)) {
    flags.push({
      title: 'Requests credentials or one-time codes',
      severity: 'high',
      explanation: 'No legitimate email asks you to submit passwords or OTP codes; real systems never collect them by mail.',
    })
    score += 20
  }
  if (has(/\battach(ed|ment)\b|\.zip\b|\.exe\b|\.js\b|\.scr\b/)) {
    flags.push({
      title: 'Mentions an attachment',
      severity: 'medium',
      explanation: 'Unexpected attachments (especially archives or executables) are a common malware delivery vector.',
    })
    score += 10
  }
  if (has(/dear (customer|user|account holder)|valued customer/)) {
    flags.push({
      title: 'Generic greeting',
      severity: 'low',
      explanation: 'Mass phishing runs greet recipients generically because the sender does not know their name.',
    })
    score += 5
  }

  const indicators = [
    { pattern: /(?:lottery|jackpot|prize|vacation|raffle|giveaway).{0,120}(?:won|winner|claim|fee)|(?:won|claim|winner).{0,120}(?:lottery|jackpot|prize|vacation|raffle|giveaway)/, title: 'Unexpected prize or travel offer', explanation: 'Check whether you entered and verify through the organizer’s official channel.', points: 25 },
    { pattern: /new (?:bank|account|payment) details|changed bank|gift cards?|advance fee|processing fee/, title: 'Unusual payment request', explanation: 'Verify payment changes or fees independently before authorizing anything.', points: 25 },
    { pattern: /keep this (?:between us|confidential)|do not (?:call|tell)|(?:message|contact) me on (?:whatsapp|telegram)/, title: 'Secrecy or channel change', explanation: 'Confirm the request with the purported sender through an established channel.', points: 20 },
  ]
  for (const indicator of indicators) {
    if (!has(indicator.pattern)) continue
    flags.push({ title: indicator.title, severity: 'medium', explanation: indicator.explanation })
    score += indicator.points
  }
  const headers = [...content.matchAll(/^(?:from|reply-to):[^\r\n]*?@([a-z0-9.-]+\.[a-z]{2,})/gim)]
  const sender = headers.find(header => /^from:/i.test(header[0]))?.[1].toLowerCase()
  const reply = headers.find(header => /^reply-to:/i.test(header[0]))?.[1].toLowerCase()
  if (sender && reply && sender !== reply) {
    flags.push({ title: 'Reply address domain differs', severity: 'medium', explanation: 'Compare the actual sender and reply addresses before responding.' })
    score += 20
  }

  const riskScore = clamp(score)
  const verdict = deriveVerdict(riskScore)
  const summary =
    flags.length === 0
      ? 'No strong phishing indicators were found in this content, but treat unexpected email with healthy skepticism and verify unusual requests through a trusted channel.'
      : `Found ${flags.length} indicator(s) in this content, including ${flags
          .slice(0, 2)
          .map((flag) => flag.title.toLowerCase())
          .join(' and ')}. Combined, these ${verdict === 'phishing' ? 'strongly suggest' : 'are consistent with'} a ${verdict.replace('_', ' ')} message.`

  const recommendations =
    flags.length === 0
      ? [
          'Verify the sender address and any links before acting.',
          'Report the message if anything about it feels off.',
        ]
      : [
          'Do not click links or open attachments until the sender is verified.',
          'Check the actual sender domain character by character.',
          'Report the message using the phishing report button if the indicators hold.',
        ]

  return {
    riskScore,
    verdict,
    confidence: 55,
    summary,
    flags: flags.length > 0 ? flags.slice(0, 8) : [
      {
        title: 'No strong indicators detected',
        severity: 'low',
        explanation: 'The heuristic scan found no classic phishing markers; manual review is still advised for sensitive requests.',
      },
    ],
    recommendations: recommendations.slice(0, 6),
    disclaimer: DISCLAIMER,
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
    if (!parsed.success) {
      return NextResponse.json({ error: zodFirstIssueMessage(parsed.error) }, { status: 400 })
    }
    const { content } = parsed.data

    try {
      if (process.env.AI_ENABLED !== 'true') {
        return NextResponse.json({ analysis: heuristicAnalysis(content), source: 'fallback' })
      }
      const result = await withTimeout(
        aiJson<unknown>(
          SYSTEM_PROMPT,
          `Analyze the following email content for phishing indicators:\n"""\n${content}\n"""`
        ),
        AI_TIMEOUT_MS,
        'AI analyze'
      )

      const record = (typeof result === 'object' && result !== null ? result : {}) as Record<
        string,
        unknown
      >
      const riskScore = clamp(
        typeof record.riskScore === 'number' && Number.isFinite(record.riskScore) ? record.riskScore : 0
      )
      const confidence = clamp(
        typeof record.confidence === 'number' && Number.isFinite(record.confidence)
          ? record.confidence
          : 50
      )
      const verdict = (VERDICTS as readonly string[]).includes(String(record.verdict))
        ? (record.verdict as Verdict)
        : deriveVerdict(riskScore)
      let flags = normalizeFlags(record.flags)
      if (flags.length === 0) {
        flags = [
          {
            title: 'Manual review recommended',
            severity: 'low',
            explanation: 'The model returned no specific indicators; treat the content with normal caution.',
          },
        ]
      }
      let recommendations = normalizeRecommendations(record.recommendations)
      if (recommendations.length === 0) {
        recommendations = ['Verify the sender through a trusted channel before acting on this email.']
      }
      const summary =
        typeof record.summary === 'string' && record.summary.trim().length > 0
          ? record.summary.trim().slice(0, 800)
          : 'The model did not provide a summary; review the listed indicators manually.'

      const analysis: Analysis = {
        riskScore,
        verdict,
        confidence,
        summary,
        flags,
        recommendations,
        disclaimer: DISCLAIMER,
      }

      void logAudit(
        'AI_ANALYZE',
        AI_ACTOR,
        `Phish analysis completed (verdict: ${verdict}, riskScore: ${riskScore}, source: ai)`
      ).catch(() => undefined)

      return NextResponse.json({ analysis, source: 'ai' })
    } catch (aiError) {
      console.error('AI analyze fell back to heuristics:', aiError)
      const analysis = heuristicAnalysis(content)

      void logAudit(
        'AI_ANALYZE',
        AI_ACTOR,
        `Phish analysis completed (verdict: ${analysis.verdict}, riskScore: ${analysis.riskScore}, source: fallback)`
      ).catch(() => undefined)

      return NextResponse.json({ analysis, source: 'fallback' })
    }
  } catch (error) {
    console.error('POST /api/ai/analyze failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
