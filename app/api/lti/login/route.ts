export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const iss = params.get('iss')
  const loginHint = params.get('login_hint')
  const targetLinkUri = params.get('target_link_uri')
  const clientId = params.get('client_id')
  const ltiMessageHint = params.get('lti_message_hint')

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

export async function POST(req: NextRequest) {
  const body = await req.formData()
  const iss = body.get('iss') as string
  const loginHint = body.get('login_hint') as string
  const clientId = body.get('client_id') as string
  const ltiMessageHint = body.get('lti_message_hint') as string
  const targetLinkUri = body.get('target_link_uri') as string

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