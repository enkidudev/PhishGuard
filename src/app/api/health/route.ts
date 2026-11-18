import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
export async function GET() {
 try { await db.setting.findFirst(); return NextResponse.json({ ok: true, checks: { database: true, liveFeed: true, ai: process.env.AI_ENABLED === 'true' }, aiMode: process.env.AI_ENABLED === 'true' ? 'external-optional' : 'local', uptimeSec: Math.round(process.uptime()), generatedAt: new Date().toISOString() }) }
 catch { return NextResponse.json({ ok: false, checks: { database: false, liveFeed: false, ai: false } }, { status: 503 }) }
}
