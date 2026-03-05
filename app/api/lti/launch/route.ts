export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { verifyLtiToken, getOrCreateUser, createSession } from '@/lib/lti'

// Handles BOTH the OIDC login initiation AND the final id_token post
// This works when Moodle has /api/lti/launch set as the Initiate login URL

export async function POST(req: NextRequest) {
  try {
    const body = await req.formData()
    const idToken = body.get('id_token') as string

    // Step 2: Moodle posts back with id_token — complete the launch
    if (idToken) {
      let payload
      try {
        payload = await verifyLtiToken(idToken)
      } catch (verifyErr: any) {
        return new NextResponse(
          `Token verification failed: ${verifyErr.message} | JWKS URL: ${process.env.LTI_PLATFORM_JWKS_URL} | Issuer: ${process.env.LTI_PLATFORM_ISSUER} | ClientID: ${process.env.LTI_CLIENT_ID}`,
          { status: 401 }
        )
      }
      const moodleUserId = payload.sub!
      const email = (payload['email'] as string) || ''
      const name = (payload['name'] as string) || ''

      const userId = await getOrCreateUser(moodleUserId, email, name)
      const sessionToken = await createSession(userId)

      const appUrl = process.env.NEXT_PUBLIC_APP_URL!
      const redirectUrl = new URL(appUrl)
      redirectUrl.searchParams.set('session', sessionToken)
      return NextResponse.redirect(redirectUrl.toString())
    }

    // Step 1: Moodle hits this as the login initiation URL
    // Redirect to Moodle's auth endpoint to get the id_token
    const iss = body.get('iss') as string
    const loginHint = body.get('login_hint') as string
    const clientId = body.get('client_id') as string
    const ltiMessageHint = body.get('lti_message_hint') as string
    const targetLinkUri = body.get('target_link_uri') as string

    if (!iss) {
      return new NextResponse('Missing iss or id_token', { status: 400 })
    }

    const moodleAuthUrl = new URL(`${iss}/mod/lti/auth.php`)
    moodleAuthUrl.searchParams.set('scope', 'openid')
    moodleAuthUrl.searchParams.set('response_type', 'id_token')
    moodleAuthUrl.searchParams.set('response_mode', 'form_post')
    moodleAuthUrl.searchParams.set('prompt', 'none')
    moodleAuthUrl.searchParams.set('redirect_uri', `${process.env.NEXT_PUBLIC_APP_URL}/api/lti/launch`)
    moodleAuthUrl.searchParams.set('client_id', clientId || process.env.LTI_CLIENT_ID!)
    moodleAuthUrl.searchParams.set('login_hint', loginHint || '')
    moodleAuthUrl.searchParams.set('nonce', Math.random().toString(36).slice(2))
    moodleAuthUrl.searchParams.set('state', Math.random().toString(36).slice(2))
    if (ltiMessageHint) moodleAuthUrl.searchParams.set('lti_message_hint', ltiMessageHint)
    if (targetLinkUri) moodleAuthUrl.searchParams.set('target_link_uri', targetLinkUri)

    return NextResponse.redirect(moodleAuthUrl.toString())

  } catch (err: any) {
    console.error('LTI launch error:', err)
    // Show the actual error message so we can debug
    return new NextResponse(
      `LTI authentication failed: ${err.message || JSON.stringify(err)}`,
      { status: 401 }
    )
  }
}

// Handle GET requests too (some Moodle versions use GET for login initiation)
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const iss = params.get('iss')
  const loginHint = params.get('login_hint')
  const clientId = params.get('client_id')
  const ltiMessageHint = params.get('lti_message_hint')
  const targetLinkUri = params.get('target_link_uri')

  if (!iss) {
    return new NextResponse('Missing iss', { status: 400 })
  }

  const moodleAuthUrl = new URL(`${iss}/mod/lti/auth.php`)
  moodleAuthUrl.searchParams.set('scope', 'openid')
  moodleAuthUrl.searchParams.set('response_type', 'id_token')
  moodleAuthUrl.searchParams.set('response_mode', 'form_post')
  moodleAuthUrl.searchParams.set('prompt', 'none')
  moodleAuthUrl.searchParams.set('redirect_uri', `${process.env.NEXT_PUBLIC_APP_URL}/api/lti/launch`)
  moodleAuthUrl.searchParams.set('client_id', clientId || process.env.LTI_CLIENT_ID!)
  moodleAuthUrl.searchParams.set('login_hint', loginHint || '')
  moodleAuthUrl.searchParams.set('nonce', Math.random().toString(36).slice(2))
  moodleAuthUrl.searchParams.set('state', Math.random().toString(36).slice(2))
  if (ltiMessageHint) moodleAuthUrl.searchParams.set('lti_message_hint', ltiMessageHint)
  if (targetLinkUri) moodleAuthUrl.searchParams.set('target_link_uri', targetLinkUri)

  return NextResponse.redirect(moodleAuthUrl.toString())
}