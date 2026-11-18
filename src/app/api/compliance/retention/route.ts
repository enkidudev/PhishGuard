import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ADMIN_ACTOR, logAudit } from '@/lib/audit'
import { asBoolean, asNumber, asRecord, buildRetentionDetail } from '@/app/api/_lib/shared'

export const dynamic = 'force-dynamic'

export async function PATCH(request: Request) {
  try {
    const raw: unknown = await request.json().catch(() => null)
    const body = asRecord(raw)
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const days = asNumber(body.defaultRetentionDays)
    if (days === undefined || !Number.isInteger(days) || days < 7 || days > 365) {
      return NextResponse.json(
        { error: 'defaultRetentionDays must be an integer between 7 and 365' },
        { status: 400 }
      )
    }
    const autoPurge = asBoolean(body.autoPurge)
    if (autoPurge === undefined) {
      return NextResponse.json({ error: 'autoPurge must be a boolean' }, { status: 400 })
    }

    await db.setting.upsert({
      where: { key: 'defaultRetentionDays' },
      update: { value: String(days) },
      create: { key: 'defaultRetentionDays', value: String(days) },
    })
    await db.setting.upsert({
      where: { key: 'autoPurge' },
      update: { value: autoPurge ? 'true' : 'false' },
      create: { key: 'autoPurge', value: autoPurge ? 'true' : 'false' },
    })

    await logAudit(
      'RETENTION_POLICY',
      ADMIN_ACTOR,
      `Default retention set to ${days} days, auto-purge ${autoPurge ? 'enabled' : 'disabled'}`
    )

    const retention = await buildRetentionDetail()
    return NextResponse.json({ retention })
  } catch (error) {
    console.error('PATCH /api/compliance/retention failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
