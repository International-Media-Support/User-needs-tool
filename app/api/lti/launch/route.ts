import { NextRequest, NextResponse } from 'next/server'
import { verifyLtiToken, getOrCreateUser, createSession } from '@/lib/lti'

export async function POST(req: NextRequest) {
  try {
    const body = await req.formData()
    const idToken = body.get('id_token') as string

    if (!idToken) {
      return new NextResponse('Missing id_token', { status: 400 })
    }

    const payload = await verifyLtiToken(idToken)

    const moodleUserId = payload.sub!
    const email = (payload['email'] as string) || ''
    const name = (payload['name'] as string) || ''

    const userId = await getOrCreateUser(moodleUserId, email, name)
    const sessionToken = await createSession(userId)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL!
    const redirectUrl = new URL(appUrl)
    redirectUrl.searchParams.set('session', sessionToken)

    return NextResponse.redirect(redirectUrl.toString())

  } catch (err) {
    console.error('LTI launch error:', err)
    return new NextResponse('LTI authentication failed. Please try launching from Moodle again.', { status: 401 })
  }
}