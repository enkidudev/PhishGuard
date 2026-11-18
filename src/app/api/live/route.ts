import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { purgeExpired } from '@/lib/retention'
export async function GET() {
 await purgeExpired()
 const events = await db.trackedEvent.findMany({ take: 30, orderBy: { createdAt: 'desc' }, include: { enrollment: { include: { campaign: { include: { template: true } } } } } })
 return NextResponse.json({ events: events.map(e => ({ id: e.id, type: e.type, participant: 'Authorized participant', campaign: e.enrollment.campaign.name, template: e.enrollment.campaign.template.name, createdAt: e.createdAt.toISOString() })) })
}
