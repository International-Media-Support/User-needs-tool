export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { resolveSession, checkRateLimit, checkAndIncrementUsage } from '@/lib/lti'
import { getBearerToken } from '@/lib/session'
import { logSecurityEvent } from '@/lib/log'

const RATE_LIMIT = 10           // requests
const RATE_WINDOW_SECONDS = 60  // per minute, per user
const MAX_BRIEF_CHARS = 5000

const IMS_DEFINITIONS = `1. Update Me - Traditional breaking news journalism. Answers: What just happened? Sticks to WHO, WHAT, WHEN, WHERE. Formats: breaking news stories, news briefs, live blogs, flash alerts, news roundups.

2. Educate Me - Helps readers understand topics deeply. Explains HOW/WHY it works and broader implications. Formats: explainers, Q&As, glossaries, listicles, timelines, infographics. Must assume no prior knowledge.

3. Give Me Perspective - EXPERT ANALYSIS (not journalist opinions unless they're experts). Multiple viewpoints to help readers form opinions. Formats: analysis articles, pro/con comparisons, expert roundups, impact analysis.

4. Divert Me - Lighter stories that entertain, charm, or make people smile. Human interest features, feel-good news, photo galleries, amusing events. NOT fluff - necessary relief from heavy news.

5. Inspire Me - People overcoming challenges, positive change despite difficulties. UPLIFT and MOTIVATE. Formats: personal triumph stories, solutions journalism, community success stories, innovation profiles.

6. Help Me - SERVICE JOURNALISM. Practical advice readers can use immediately. Step-by-step guides, checklists, troubleshooting. Must be specific with URLs, amounts, times, prices.

7. Connect Me - ACTION-DRIVEN with emotional element. CONSTRUCTIVE JOURNALISM - not just "could do" but "should do". Call-to-action articles, volunteer recruitment, community pride stories.

8. Keep Me Engaged - Helps readers participate in ongoing conversations. Shows what others are saying. Social media reaction roundups, vox pops, user-generated content, meme explanations.`

const SYSTEM_PROMPT = `You are an expert editorial consultant specializing in the BBC User Needs Model.

${IMS_DEFINITIONS}

Generate 2-3 story ideas for EACH of the 8 user needs.

Return JSON only (no markdown):
{
  "topic_summary": "1-sentence summary",
  "ideas": {
    "update_me": [{"idea": "pitch", "strength": "high/medium/low"}, ...],
    "educate_me": [...],
    "give_me_perspective": [...],
    "divert_me": [...],
    "inspire_me": [...],
    "help_me": [...],
    "connect_me": [...],
    "keep_me_engaged": [...]
  }
}

Rate strength based on: how naturally topic fits need, how compelling, likelihood to resonate. Order ideas: high first, then medium, then low.`

export async function POST(req: NextRequest) {
  try {
    const { brief } = await req.json()

    if (!brief || typeof brief !== 'string') {
      return NextResponse.json({ error: 'Missing brief' }, { status: 400 })
    }
    if (brief.length > MAX_BRIEF_CHARS) {
      return NextResponse.json({ error: `Brief too long (max ${MAX_BRIEF_CHARS} characters).` }, { status: 400 })
    }

    const sessionToken = getBearerToken(req)
    if (!sessionToken) {
      await logSecurityEvent('auth_no_token', { route: 'ideate', status: 401 })
      return NextResponse.json({ error: 'No session. Please re-launch from Moodle.' }, { status: 401 })
    }

    const userId = await resolveSession(sessionToken)
    if (!userId) {
      await logSecurityEvent('auth_invalid_session', { route: 'ideate', status: 401 })
      return NextResponse.json({ error: 'Invalid or expired session. Please re-launch from Moodle.' }, { status: 401 })
    }

    const withinRate = await checkRateLimit(`ideation:${userId}`, RATE_LIMIT, RATE_WINDOW_SECONDS)
    if (!withinRate) {
      await logSecurityEvent('rate_limited', { route: 'ideate', userId, status: 429 })
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment and try again.' },
        { status: 429 }
      )
    }

    const { allowed, remaining } = await checkAndIncrementUsage(userId, 'ideation')
    if (!allowed) {
      await logSecurityEvent('usage_limit_reached', { route: 'ideate', userId, status: 429 })
      return NextResponse.json(
        { error: 'You have used all 20 analyses for today. Come back tomorrow!' },
        { status: 429 }
      )
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 3000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Story Brief: ${brief}` }]
      })
    })

    const data = await response.json()
    return NextResponse.json({ ...data, remaining })

  } catch (err) {
    console.error('Ideate error:', err)
    await logSecurityEvent('upstream_error', { route: 'ideate', status: 500 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}