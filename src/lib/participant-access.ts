import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
export async function canActFor(participantId: string) {
 const session = await getSession()
 if (!session || (session.role === 'participant' && session.sub !== participantId)) return false
 const p = await db.participant.findUnique({ where: { id: participantId } })
 return !!p?.active && p.consented
}
