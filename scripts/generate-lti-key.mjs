// Generates a fresh RS256 key pair for LTI signing.
//
// Usage:
//   node scripts/generate-lti-key.mjs
//
// It prints a PKCS8 private-key PEM. Put the ENTIRE block (including the
// BEGIN/END lines and newlines) into the LTI_PRIVATE_KEY environment variable
// in Vercel. The public key is derived and served automatically at
// /api/lti/jwks, so you never store or paste the public key by hand.
//
// After setting the new key, re-point Moodle at the JWKS URL (or let it
// re-fetch) so it picks up the new key id, and treat any previous key as
// compromised.
import { generateKeyPair, exportPKCS8 } from 'jose'

const { privateKey } = await generateKeyPair('RS256', { extractable: true })
const pem = await exportPKCS8(privateKey)
process.stdout.write(pem)
