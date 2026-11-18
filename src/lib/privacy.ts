import { createHmac } from 'node:crypto'
export function participantAlias(id: string) {
 const key = process.env.SESSION_SECRET
 if (!key || key.length < 32) throw new Error('Session secret is required')
 return 'Learner-' + createHmac('sha256', key).update(id).digest('hex').slice(0, 10)
}
export function csvCell(value: unknown) {
 let text = value === null || value === undefined ? '' : value instanceof Date ? value.toISOString() : String(value)
 if (/^[\s]*[=+@\-\t\r]/.test(text)) text = "'" + text
 return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
