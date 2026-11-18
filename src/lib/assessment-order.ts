import { createHmac } from 'node:crypto'
import type { Question } from './learning'

export function orderAssessment(questions: Question[], scope: string, nonce: string) {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) throw new Error('Session secret is not configured')

  return questions.map((question, index) => {
    const order = question.options.map((_, option) => ({
      option,
      rank: createHmac('sha256', secret).update(JSON.stringify([scope, nonce, index, option])).digest('hex'),
    })).sort((a, b) => a.rank.localeCompare(b.rank))
    return {
      ...question,
      options: order.map(({ option }) => question.options[option]),
      answer: order.findIndex(({ option }) => option === question.answer),
    }
  })
}
