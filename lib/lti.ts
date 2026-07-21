import { createRemoteJWKSet, jwtVerify } from 'jose'
import { supabase } from './supabase'
import { v4 as uuidv4 } from 'uuid'

// Lazy — only created when verifyLtiToken is actually called (not at module load)
let JWKS: ReturnType<typeof createRemoteJWKSet> | null = null

function getJWKS() {
  if (!JWKS) {
    JWKS = createRemoteJWKSet(new URL(process.env.LTI_PLATFORM_JWKS_URL!))
  }
  return JWKS
}

export async function verifyLtiToken(idToken: string) {
  const { payload } = await jwtVerify(idToken, getJWKS(), {
    issuer: process.env.LTI_PLATFORM_ISSUER,
    audience: process.env.LTI_CLIENT_ID,
  })
  return payload
}

// --- OIDC login state (CSRF + replay protection) ---
// state and nonce are issued during login initiation and validated on the
// launch callback. Stored server-side, one-time use, short-lived.
export async function storeLaunchState(state: string, nonce: string) {
  await supabase.from('lti_launch_state').insert({ state, nonce })
}

export async function consumeLaunchState(state: string): Promise<string | null> {
  const { data } = await supabase
    .from('lti_launch_state')
    .select('nonce, expires_at')
    .eq('state', state)
    .single()

  // One-time use: always delete, whether valid or not.
  await supabase.from('lti_launch_state').delete().eq('state', state)

  if (!data) return null
  if (new Date(data.expires_at) < new Date()) return null
  return data.nonce as string
}

// --- One-time launch handoff (iframe-safe session delivery) ---
// The launch redirect carries a single-use, short-lived code instead of the
// session token. The client swaps it here for the real session.
export async function createHandoff(sessionToken: string): Promise<string> {
  const code = uuidv4()
  await supabase.from('lti_handoff').insert({ code, session_token: sessionToken })
  return code
}

export async function consumeHandoff(code: string): Promise<string | null> {
  const { data } = await supabase
    .from('lti_handoff')
    .select('session_token, expires_at')
    .eq('code', code)
    .single()

  // One-time use: always delete.
  await supabase.from('lti_handoff').delete().eq('code', code)

  if (!data) return null
  if (new Date(data.expires_at) < new Date()) return null
  return data.session_token as string
}

export async function getOrCreateUser(moodleUserId: string, email: string, name: string) {
  const { data, error } = await supabase
    .from('users')
    .upsert(
      { moodle_user_id: moodleUserId, email, name },
      { onConflict: 'moodle_user_id' }
    )
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

export async function createSession(userId: string): Promise<string> {
  const token = uuidv4()
  await supabase.from('lti_sessions').insert({
    token,
    user_id: userId,
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
  })
  return token
}

export async function resolveSession(token: string): Promise<string | null> {
  const { data } = await supabase
    .from('lti_sessions')
    .select('user_id, expires_at')
    .eq('token', token)
    .single()

  if (!data) return null
  if (new Date(data.expires_at) < new Date()) return null
  return data.user_id
}

export async function checkUsage(userId: string): Promise<number> {
  const limit = parseInt(process.env.DAILY_LIMIT || '20')
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const { count } = await supabase
    .from('usage')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('used_at', startOfDay.toISOString())

  return limit - (count || 0)
}

export async function checkAndIncrementUsage(
  userId: string,
  feature: 'analyser' | 'ideation'
): Promise<{ allowed: boolean; remaining: number }> {
  const limit = parseInt(process.env.DAILY_LIMIT || '20')

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const { count } = await supabase
    .from('usage')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('used_at', startOfDay.toISOString())

  const used = count || 0

  if (used >= limit) {
    return { allowed: false, remaining: 0 }
  }

  await supabase.from('usage').insert({ user_id: userId, feature })
  return { allowed: true, remaining: limit - used - 1 }
}
