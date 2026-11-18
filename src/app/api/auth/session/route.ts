import { adminSessionSubject, currentAdminHash } from '@/lib/admin-credentials'
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
export async function GET() {
 const session = await getSession()
 if (!session) return NextResponse.json({ session: null })
 if (session.role === 'participant') {
  const p = await db.participant.findUnique({ where: { id: session.sub } })
  if (!p?.active) return NextResponse.json({ session: null })
  return NextResponse.json({ session: { role: session.role, name: p.name, participantId: p.id, consented: p.consented } })
 }
 if (session.sub !== adminSessionSubject(await currentAdminHash())) return NextResponse.json({ session: null })
 return NextResponse.json({ session: { role: 'admin', name: 'Program administrator' } })
}
