export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { exportJWK, importPKCS8, calculateJwkThumbprint } from 'jose'

export async function GET() {
  try {
    const pem = process.env.LTI_PRIVATE_KEY!
    const privateKey = await importPKCS8(pem, 'RS256')
    const jwk = await exportJWK(privateKey)
    jwk.use = 'sig'
    jwk.alg = 'RS256'
    jwk.kid = await calculateJwkThumbprint(jwk)
    return NextResponse.json({ keys: [jwk] })
  } catch (err: any) {
    return NextResponse.json({ 
      error: err.message,
      code: err.code,
      type: err.constructor?.name
    }, { status: 500 })
  }
}