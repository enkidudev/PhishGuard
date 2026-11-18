import { purgeExpired } from '@/lib/retention'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { buildRetentionDetail } from '@/app/api/_lib/shared'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await purgeExpired()
    const [participants, domains, retention, auditLogs] = await Promise.all([
      db.participant.findMany({ orderBy: { name: 'asc' } }),
      db.allowedDomain.findMany({ orderBy: { createdAt: 'desc' } }),
      buildRetentionDetail(),
      db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    ])

    return NextResponse.json({
      consent: participants.map((participant) => ({
        id: participant.id,
        name: participant.name,
        email: participant.email,
        department: participant.department,
        consented: participant.consented,
        consentedAt: participant.consentedAt ? participant.consentedAt.toISOString() : null,
      })),
      domains: domains.map((domain) => ({
        id: domain.id,
        domain: domain.domain,
        approvedBy: domain.approvedBy,
        createdAt: domain.createdAt.toISOString(),
      })),
      retention,
      audit: auditLogs.map((entry) => ({
        id: entry.id,
        action: entry.action,
        actor: entry.actor,
        detail: entry.detail,
        createdAt: entry.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('GET /api/compliance failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
