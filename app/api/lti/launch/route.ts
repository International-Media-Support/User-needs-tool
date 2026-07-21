export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import {
  verifyLtiToken, getOrCreateUser, createSession, createHandoff,
  storeLaunchState, consumeLaunchState,
} from '@/lib/lti'

// Handles BOTH the OIDC login initiation AND the final id_token post.
// Set /api/lti/launch as the Initiate login URL in Moodle.


async function buildAuthRedirect(p: {
  iss: string
  loginHint: string
  clientId: string
  ltiMessageHint?: string
  targetLinkUri?: string
}): Promise<string> {
  // Issue and persist state + nonce so we can validate them on callback.
  const state = randomUUID()
  const nonce = randomUUID()
  await storeLaunchState(state, nonce)

  const url = new URL(`${p.iss}/mod/lti/auth.php`)
  url.searchParams.set('scope', 'openid')
  url.searchParams.set('response_type', 'id_token')
  url.searchParams.set('response_mode', 'form_post')
  url.searchParams.set('prompt', 'none')
  url.searchParams.set('redirect_uri', `${process.env.NEXT_PUBLIC_APP_URL}/api/lti/launch`)
  url.searchParams.set('client_id', p.clientId || process.env.LTI_CLIENT_ID!)
  url.searchParams.set('login_hint', p.loginHint || '')
  url.searchParams.set('nonce', nonce)
  url.searchParams.set('state', state)
  if (p.ltiMessageHint) url.searchParams.set('lti_message_hint', p.ltiMessageHint)
  if (p.targetLinkUri) url.searchParams.set('target_link_uri', p.targetLinkUri)
  return url.toString()
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.formData()
    const idToken = body.get('id_token') as string | null

    // Step 2: Moodle posts back with id_token — complete the launch.
    if (idToken) {
      const returnedState = body.get('state') as string | null
      if (!returnedState) {
        return new NextResponse('Invalid launch (missing state). Please launch from Moodle again.', { status: 400 })
      }

      // Validate state (CSRF) and retrieve the nonce we issued (replay).
      const expectedNonce = await consumeLaunchState(returnedState)
      if (!expectedNonce) {
        return new NextResponse('Invalid or expired launch. Please launch from Moodle again.', { status: 400 })
      }

      let payload
      try {
        payload = await verifyLtiToken(idToken)
      } catch {
        return new NextResponse('LTI authentication failed. Please launch from Moodle again.', { status: 401 })
      }

      if ((payload.nonce as string) !== expectedNonce) {
        return new NextResponse('Launch validation failed. Please launch from Moodle again.', { status: 400 })
      }

      const moodleUserId = payload.sub!
      const email = (payload['email'] as string) || ''
      const name = (payload['name'] as string) || ''

      const userId = await getOrCreateUser(moodleUserId, email, name)
      const sessionToken = await createSession(userId)
      const code = await createHandoff(sessionToken)

      // Redirect into the app (inside the Moodle iframe) with a ONE-TIME,
      // short-lived code, not the session token itself. The client swaps it for
      // the session immediately and strips it from the URL. This avoids
      // third-party cookies, which Safari/iOS block in an embedded iframe.
      const redirectUrl = new URL(process.env.NEXT_PUBLIC_APP_URL!)
      redirectUrl.searchParams.set('code', code)
      return new NextResponse(
        `<html><head><meta http-equiv="refresh" content="0;url=${redirectUrl.toString()}"></head><body>Loading...</body></html>`,
        { status: 200, headers: { 'Content-Type': 'text/html' } }
      )
    }

    // Step 1: login initiation (POST form).
    const iss = body.get('iss') as string | null
    if (!iss) {
      return new NextResponse('Missing iss or id_token', { status: 400 })
    }
    const redirect = await buildAuthRedirect({
      iss,
      loginHint: (body.get('login_hint') as string) || '',
      clientId: (body.get('client_id') as string) || '',
      ltiMessageHint: (body.get('lti_message_hint') as string) || undefined,
      targetLinkUri: (body.get('target_link_uri') as string) || undefined,
    })
    return NextResponse.redirect(redirect)

  } catch (err) {
    console.error('LTI launch error:', err)
    return new NextResponse('LTI authentication failed. Please launch from Moodle again.', { status: 401 })
  }
}

// Some Moodle versions use GET for login initiation.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const iss = params.get('iss')
  if (!iss) {
    return new NextResponse('Missing iss', { status: 400 })
  }
  const redirect = await buildAuthRedirect({
    iss,
    loginHint: params.get('login_hint') || '',
    clientId: params.get('client_id') || '',
    ltiMessageHint: params.get('lti_message_hint') || undefined,
    targetLinkUri: params.get('target_link_uri') || undefined,
  })
  return NextResponse.redirect(redirect)
}
