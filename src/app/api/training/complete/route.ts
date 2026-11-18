import { NextResponse } from 'next/server'
export async function POST() { return NextResponse.json({ error: 'Completion requires passing the follow-up assessment. Open Training to continue.' }, { status: 409 }) }
