export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { resolveSession, checkAndIncrementUsage } from '@/lib/lti'

const IMS_DEFINITIONS = `1. Update Me - Traditional breaking news journalism. Answers: What just happened? Sticks to WHO, WHAT, WHEN, WHERE. Formats: breaking news stories, news briefs, live blogs, flash alerts, news roundups.

2. Educate Me - Helps readers understand topics deeply. Explains HOW/WHY it works and broader implications. Formats: explainers, Q&As, glossaries, listicles, timelines, infographics. Must assume no prior knowledge.

3. Give Me Perspective - EXPERT ANALYSIS (not journalist opinions unless they're experts). Multiple viewpoints to help readers form opinions. Formats: analysis articles, pro/con comparisons, expert roundups, impact analysis.

4. Divert Me - Lighter stories that entertain, charm, or make people smile. Human interest features, feel-good news, photo galleries, amusing events. NOT fluff - necessary relief from heavy news.

5. Inspire Me - People overcoming challenges, positive change despite difficulties. UPLIFT and MOTIVATE. Formats: personal triumph stories, solutions journalism, community success stories, innovation profiles.

6. Help Me - SERVICE JOURNALISM. Practical advice readers can use immediately. Step-by-step guides, checklists, troubleshooting. Must be specific with URLs, amounts, times, prices.

7. Connect Me - ACTION-DRIVEN with emotional element. CONSTRUCTIVE JOURNALISM - not just "could do" but "should do". Call-to-action articles, volunteer recruitment, community pride stories.

8. Keep Me Engaged - Helps readers participate in ongoing conversations. Shows what others are saying. Social media reaction roundups, vox pops, user-generated content, meme explanations.`

const SYSTEM_PROMPT = `You are an expert in the BBC User Needs Model (IMS Learn definitions):

${IMS_DEFINITIONS}

Detect language. If not English, translate first then analyze.

Return JSON only (no markdown):
{
  "language": "detected language",
  "translated": true/false,
  "scores": {
    "update_me": 0-100,
    "educate_me": 0-100,
    "give_me_perspective": 0-100,
    "divert_me": 0-100,
    "inspire_me": 0-100,
    "help_me": 0-100,
    "connect_me": 0-100,
    "keep_me_engaged": 0-100
  },
  "dominant_need": "Update Me",
  "comment": "One brief contextual comment about the content's current approach",
  "primary_recommendations": ["suggestion 1", "suggestion 2", "suggestion 3"],
  "secondary_recommendations": ["optional suggestion 1", "optional suggestion 2"]
}

primary_recommendations: 3-5 specific actionable suggestions to strengthen the dominant user need.
secondary_recommendations: 0-2 optional suggestions for incorporating other complementary user needs.`

export async function POST(req: NextRequest) {
  try {
    const { text, sessionToken } = await req.json()

    if (!text || !sessionToken) {
      return NextResponse.json({ error: 'Missing text or session' }, { status: 400 })
    }

    const userId = await resolveSession(sessionToken)
    if (!userId) {
      return NextResponse.json({ error: 'Invalid or expired session. Please re-launch from Moodle.' }, { status: 401 })
    }

    const { allowed, remaining } = await checkAndIncrementUsage(userId, 'analyser')
    if (!allowed) {
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
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: text }]
      })
    })

    const data = await response.json()
    return NextResponse.json({ ...data, remaining })

  } catch (err) {
    console.error('Analyze error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}