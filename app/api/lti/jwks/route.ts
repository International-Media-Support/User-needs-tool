import { NextResponse } from 'next/server'
import { exportJWK, importPKCS8, calculateJwkThumbprint } from 'jose'

export async function GET() {
  try {
    const rawKey = process.env.LTI_PRIVATE_KEY!.replace(/\\n/g, '\n')
    const privateKey = await importPKCS8(rawKey, 'RS256')
    const jwk = await exportJWK(privateKey)

    jwk.use = 'sig'
    jwk.alg = 'RS256'
    jwk.kid = await calculateJwkThumbprint(jwk)

    return NextResponse.json({ keys: [jwk] })

  } catch (err) {
    console.error('JWKS error:', err)
    return NextResponse.json({ error: 'Failed to generate JWKS' }, { status: 500 })
  }
}