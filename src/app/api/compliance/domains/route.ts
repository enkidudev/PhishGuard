import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ADMIN_ACTOR, logAudit } from '@/lib/audit'
import { asRecord, asString } from '@/app/api/_lib/shared'

export const dynamic = 'force-dynamic'

// Lowercase letters/digits/hyphen labels; supports a leading "*." wildcard label.
const DOMAIN_PATTERN = /^(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)+$/

export async function POST(request: Request) {
  try {
    const raw: unknown = await request.json().catch(() => null)
    const body = asRecord(raw)
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const domain = (asString(body.domain) ?? '').trim().toLowerCase()
    if (!DOMAIN_PATTERN.test(domain)) {
      return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 })
    }
    const approvedBy = ADMIN_ACTOR
    if (!approvedBy) {
      return NextResponse.json({ error: 'approvedBy is required' }, { status: 400 })
    }

    const existing = await db.allowedDomain.findUnique({ where: { domain } })
    if (existing) {
      return NextResponse.json({ error: 'Domain already approved' }, { status: 409 })
    }

    const created = await db.allowedDomain.create({ data: { domain, approvedBy } })
    await logAudit('DOMAIN_APPROVED', ADMIN_ACTOR, `Approved sender domain: ${domain}`)

    return NextResponse.json(
      {
        domain: {
          id: created.id,
          domain: created.domain,
          approvedBy: created.approvedBy,
          createdAt: created.createdAt.toISOString(),
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/compliance/domains failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
