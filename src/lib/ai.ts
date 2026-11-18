// PhishGuard — shared LLM helper built on z-ai-web-dev-sdk.
// Server-side only. Every consumer must degrade gracefully when the model
// is unavailable (fallbacks live in the routes, never a 500 for AI hiccups).

import ZAI from 'z-ai-web-dev-sdk'

/** Actor used for audit-log entries created by AI generation endpoints. */
export const AI_ACTOR = 'admin@phishguard.local'

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null

/**
 * Memoized ZAI client. A failed creation is NOT cached so later calls can
 * retry (used by /api/health to recover from transient backend outages).
 */
export async function getZai(): Promise<Awaited<ReturnType<typeof ZAI.create>>> {
  if (process.env.AI_ENABLED !== 'true') throw new Error('External AI disabled; using local coaching')
  if (zaiInstance) return zaiInstance
  const zai = await ZAI.create()
  zaiInstance = zai
  return zai
}

/** Strip markdown code fences the model sometimes wraps JSON in. */
function extractJsonText(content: string): string {
  let text = content.trim()
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced && fenced[1]) text = fenced[1].trim()
  return text
}

/**
 * Ask the LLM and parse a JSON reply. Instructs the model to emit raw JSON
 * (no fences) and parses defensively (fence stripping, brace slicing).
 * Throws when no parsable JSON comes back — callers own the fallback.
 */
export async function aiJson<T>(system: string, user: string): Promise<T> {
  const zai = await getZai()
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: system },
      { role: 'user', content: user },
    ],
    thinking: { type: 'disabled' },
  })
  const raw = completion.choices[0]?.message?.content ?? ''
  if (!raw.trim()) throw new Error('AI returned an empty response')

  const text = extractJsonText(raw)
  try {
    return JSON.parse(text) as T
  } catch {
    // Last resort: slice from the first '{' to the last '}'.
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start === -1 || end <= start) {
      throw new Error('AI response was not valid JSON')
    }
    return JSON.parse(text.slice(start, end + 1)) as T
  }
}

/** Reject with a timeout error when `promise` takes longer than `timeoutMs`. */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label = 'AI request'
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
