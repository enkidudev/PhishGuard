import { NextResponse } from 'next/server'
import { z } from 'zod'
import { AI_ACTOR } from '@/lib/ai'
import { logAudit } from '@/lib/audit'
import { makeTrainingDraft, trainingCatalog } from '@/lib/training-catalog'

const schema = z.object({
  scenario: z.string().trim().min(5).max(500),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  category: z.string().trim().max(100).optional(),
})

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a scenario of 5 to 500 characters and select a difficulty.' }, { status: 400 })
  }
  const { scenario, difficulty, category } = parsed.data
  const entry = trainingCatalog.find(item => item.name.toLowerCase() === scenario.toLowerCase())
    ?? trainingCatalog.find(item => item.keywords.test(scenario))
  if (!entry) {
    return NextResponse.json({ error: 'Choose a preset or describe an account notice, prize draw, travel offer, coworker request, payment, or shared document.' }, { status: 422 })
  }
  const template = makeTrainingDraft(entry, difficulty)
  if (category) template.category = category
  await logAudit('AI_TEMPLATE_GENERATED', AI_ACTOR, `Local training draft: ${entry.id} (${difficulty})`)
  return NextResponse.json({ template, rationale: entry.clue, source: 'fallback', aiGenerated: false })
}
