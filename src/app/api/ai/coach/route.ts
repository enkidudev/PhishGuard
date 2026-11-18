import { randomInt } from 'node:crypto'
import { getSession } from '@/lib/session'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { parseJsonArray } from '@/lib/events'
import { AI_ACTOR, aiJson, withTimeout } from '@/lib/ai'
import { checkRateLimit, clientIp, rateLimitResponse } from '@/lib/rate-limit'
import { zodFirstIssueMessage } from '@/app/api/_lib/shared'

export const dynamic = 'force-dynamic'

const AI_RATE_LIMIT = 12
const AI_RATE_WINDOW_MS = 60_000
const AI_TIMEOUT_MS = 20_000 // latency safety: fall back quickly during demos
const COACH_CACHE_MAX = 50

const bodySchema = z.object({
  action: z.enum(['click', 'submit', 'report', 'open']),
  templateId: z.string().min(1, 'templateId is required'),
  participantName: z.string().max(120).optional(),
})

// LLM output shape · parsed defensively, anything off goes to the fallback.
const coachSchema = z.object({
  headline: z.string().min(1),
  message: z.string().min(1),
  microQuiz: z.object({
    question: z.string().min(1),
    options: z.array(z.string().min(1)).min(2),
    answerIndex: z.number(),
  }),
})

interface MicroQuiz {
  question: string
  options: string[]
  answerIndex: number
}

interface CoachContent {
  headline: string
  message: string
  microQuiz: MicroQuiz
}

interface CoachPayload {
  coach: CoachContent
  source: 'ai' | 'fallback'
  aiGenerated: boolean
}

/** In-memory cache so repeated triggers during a demo return instantly. */
const coachCache = new Map<string, CoachPayload>()

function cachePut(key: string, value: CoachPayload): void {
  if (coachCache.size >= COACH_CACHE_MAX) {
    const oldest = coachCache.keys().next().value
    if (oldest !== undefined) coachCache.delete(oldest)
  }
  coachCache.set(key, value)
}

const SYSTEM_PROMPT = `You are the friendly coach inside PhishGuard, an authorized phishing-simulation platform. After a participant interacts with a simulated phishing email, you deliver a short, encouraging micro-lesson. Never shame the participant. Explain the psychological hook the lure used and the single most important red flag to remember next time.

Respond with valid JSON only, no markdown fences. JSON shape:
{ "headline": "short punchy headline (max ~8 words)", "message": "2-3 encouraging sentences explaining the psychological hook and the #1 red flag to remember", "microQuiz": { "question": "one short question", "options": ["option a", "option b", "option c", "option d"], "answerIndex": 0-3 } }`

const FALLBACK_HEADLINES: Record<string, string> = {
  open: "You opened the simulated phish · let's talk",
  click: "You paused · here's what to check",
  submit: "Close one · let's review what happened",
  report: 'Excellent instincts · that report was spot on',
}

function variedQuiz(payload: CoachPayload) {
  const quiz = payload.coach.microQuiz
  const choices = quiz.options.map((label, index) => ({ label, correct: index === quiz.answerIndex }))
  for (let index = choices.length - 1; index > 0; index--) {
    const other = randomInt(index + 1)
    ;[choices[index], choices[other]] = [choices[other], choices[index]]
  }
  return { ...payload, coach: { ...payload.coach, microQuiz: {
    ...quiz, options: choices.map(choice => choice.label), answerIndex: choices.findIndex(choice => choice.correct),
  } } }
}

function buildFallbackCoach(
  action: string,
  template: { landingMessage: string; redFlags: string }
): CoachPayload {
  const redFlags = parseJsonArray(template.redFlags)
  const firstFlag = redFlags[0] ?? 'The message created a false sense of urgency'
  return {
    coach: {
      headline: FALLBACK_HEADLINES[action] ?? 'Good catch · here is what to remember',
      message:
        template.landingMessage ||
        'This was a simulated phishing email. Take a moment to review the red flags below before acting on similar messages.',
      microQuiz: {
        question: 'Which signal most strongly suggested a suspicious request?',
        options: [
          firstFlag,
          'The email was too long',
          'It arrived at night',
          'The font was ugly',
        ],
        answerIndex: 0,
      },
    },
    source: 'fallback',
    aiGenerated: false,
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
    const { action, templateId } = parsed.data
    const session = await getSession()
    if (session?.role === 'participant') {
      const allowed = await db.enrollment.findFirst({ where: { participantId: session.sub, participant: { active: true, consented: true }, campaign: { templateId, status: 'running' }, deliveredAt: { not: null } } })
      if (!allowed) return NextResponse.json({ error: 'Not authorized for this exercise' }, { status: 403 })
    }

    const template = await db.template.findUnique({ where: { id: templateId } })
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    const cacheKey = `${templateId}:${action}`
    const cached = coachCache.get(cacheKey)
    if (cached) {
      return NextResponse.json({ ...variedQuiz(cached), cached: true })
    }

    const redFlags = parseJsonArray(template.redFlags)
    const actionText =
      action === 'click'
        ? 'clicked the link in a simulated phishing email'
        : action === 'submit'
          ? 'confirmed a request on the simulated landing page (practice inputs were cleared locally; no entered values were transmitted)'
          : action === 'report'
            ? 'correctly reported a simulated phishing email'
            : 'opened a simulated phishing email'

    try {
      const userPrompt = [
        `The participant ${actionText}.`,

        '',
        'Simulated email details:',
        `- Template: ${template.name} (category: ${template.category}, difficulty: ${template.difficulty})`,
        `- Post-click educational feedback: ${template.landingMessage}`,
        redFlags.length > 0 ? `- Known red flags: ${redFlags.join('; ')}` : null,
        '',
        'Produce the coaching JSON now. Make the microQuiz options plausible; the correct answer must match answerIndex.',
      ]
        .filter((line): line is string => line !== null)
        .join('\n')

      const result = await withTimeout(
        aiJson<unknown>(SYSTEM_PROMPT, userPrompt),
        AI_TIMEOUT_MS,
        'AI coach'
      )
      const validated = coachSchema.safeParse(result)
      if (!validated.success) {
        throw new Error('AI coach did not match the expected schema')
      }

      const options = validated.data.microQuiz.options
        .map((option) => option.trim())
        .filter((option) => option.length > 0)
        .slice(0, 6)
      if (options.length < 2) {
        throw new Error('AI coach quiz needs at least two options')
      }
      const coach: CoachContent = {
        headline: validated.data.headline.trim(),
        message: validated.data.message.trim(),
        microQuiz: {
          question: validated.data.microQuiz.question.trim(),
          options,
          answerIndex: Math.max(
            0,
            Math.min(options.length - 1, Math.round(validated.data.microQuiz.answerIndex))
          ),
        },
      }

      const payload: CoachPayload = { coach, source: 'ai', aiGenerated: true }
      cachePut(cacheKey, payload)

      void logAudit(
        'AI_COACH_GENERATED',
        AI_ACTOR,
        `Coaching generated for action "${action}" using template "${template.name}"`
      ).catch(() => undefined)

      return NextResponse.json(variedQuiz(payload))
    } catch (aiError) {
      console.error('AI coach fell back:', aiError)
      return NextResponse.json(variedQuiz(buildFallbackCoach(action, template)))
    }
  } catch (error) {
    console.error('POST /api/ai/coach failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
