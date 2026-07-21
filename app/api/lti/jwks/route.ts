export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createPublicKey } from 'crypto'
import { importPKCS8, exportJWK, calculateJwkThumbprint } from 'jose'

// Publishes ONLY the public key. Moodle fetches this to verify messages the
// tool signs. It must never expose private key material.
export async function GET() {
  try {
    const pem = process.env.LTI_PRIVATE_KEY!
    const privateKey = await importPKCS8(pem, 'RS256')
    const publicKey = createPublicKey(privateKey as unknown as Parameters<typeof createPublicKey>[0])
    const jwk = await exportJWK(publicKey)
    jwk.use = 'sig'
    jwk.alg = 'RS256'
    jwk.kid = await calculateJwkThumbprint(jwk)
    return NextResponse.json({ keys: [jwk] })
  } catch (err) {
    console.error('JWKS error:', err)
    return NextResponse.json({ error: 'Unable to build JWKS' }, { status: 500 })
  }
}
