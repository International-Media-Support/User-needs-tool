import { NextRequest } from 'next/server'

// The session token is sent by the client in the Authorization header
// (Bearer). We avoid cookies because the tool launches inside a Moodle iframe,
// where third-party cookies are blocked by Safari/iOS.
export function getBearerToken(req: NextRequest): string | null {
  const header = req.headers.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match ? match[1] : null
}
