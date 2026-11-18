import { NextResponse } from 'next/server'
import { purgeExpired } from '@/lib/retention'
export async function POST() { return NextResponse.json(await purgeExpired(true)) }
