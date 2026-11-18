import { NextResponse } from 'next/server'
export async function POST() { return NextResponse.json({ error: 'Random outcomes are disabled. Use the Test Inbox for attributable interactions; npm run demo:reset restores the labelled fixture.' }, { status: 410 }) }
