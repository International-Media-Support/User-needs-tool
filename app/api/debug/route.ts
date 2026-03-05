export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

export async function GET() {
  const raw = process.env.LTI_PRIVATE_KEY || 'NOT SET'
  return NextResponse.json({
    length: raw.length,
    first50: raw.substring(0, 50),
    last50: raw.substring(raw.length - 50),
    hasLiteralNewlines: raw.includes('\n'),
    hasEscapedNewlines: raw.includes('\\n'),
  })
}