import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ADMIN_ACTOR, logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const domain = await db.allowedDomain.findUnique({ where: { id } })
    if (!domain) {
      return NextResponse.json({ error: 'Domain not found' }, { status: 404 })
    }
    await db.allowedDomain.delete({ where: { id } })
    await logAudit('DOMAIN_REVOKED', ADMIN_ACTOR, `Revoked sender domain: ${domain.domain}`)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/compliance/domains/[id] failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
