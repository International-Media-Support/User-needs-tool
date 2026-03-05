'use client'

import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Loader2, Sparkles, FileText, TrendingUp, Lightbulb } from 'lucide-react'

const USER_NEEDS = [
  { id: 'update', name: 'Update Me', color: '#3b82f6', description: 'Traditional breaking news - what just happened' },
  { id: 'educate', name: 'Educate Me', color: '#8b5cf6', description: 'Helps readers understand topics more deeply' },
  { id: 'perspective', name: 'Give Me Perspective', color: '#ec4899', description: 'Expert analysis and multiple viewpoints' },
  { id: 'divert', name: 'Divert Me', color: '#f59e0b', description: 'Lighter stories that entertain or charm' },
  { id: 'inspire', name: 'Inspire Me', color: '#10b981', description: 'People overcoming challenges, positive change' },
  { id: 'help', name: 'Help Me', color: '#06b6d4', description: 'Practical advice readers can use daily' },
  { id: 'connect', name: 'Connect Me', color: '#ef4444', description: 'Unites people around shared ideas' },
  { id: 'engage', name: 'Keep Me Engaged', color: '#f97316', description: 'Helps readers join ongoing conversations' }
]

function UsageBadge({ remaining, limit }: { remaining: number; limit: number }) {
  const pct = (remaining / limit) * 100
  const color = pct > 50 ? 'bg-green-100 text-green-700' : pct > 20 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
  return (
    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${color}`}>
      {remaining} / {limit} analyses remaining today
    </span>
  )
}

function Analyser({ sessionToken, onUse }: { sessionToken: string; onUse: (remaining: number) => void }) {
  const [text, setText] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const analyzeText = async () => {
    if (!text.trim()) { setError('Please enter some text to analyse'); return }
    setAnalyzing(true); setError(null); setResults(null)

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sessionToken })
      })
      const data = await res.json()

      if (res.status === 429) { setError(data.error); return }
      if (res.status === 401) { setError(data.error); return }
      if (!res.ok) { setError(data.error || 'Something went wrong'); return }

      if (data.remaining !== undefined) onUse(data.remaining)

      const raw = data.content[0].text.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '')
      const parsed = JSON.parse(raw)

      const chartData = USER_NEEDS.map(need => {
        const key = need.id === 'update' ? 'update_me' : need.id === 'educate' ? 'educate_me' :
          need.id === 'perspective' ? 'give_me_perspective' : need.id === 'divert' ? 'divert_me' :
          need.id === 'inspire' ? 'inspire_me' : need.id === 'help' ? 'help_me' :
          need.id === 'connect' ? 'connect_me' : 'keep_me_engaged'
        return { name: need.name, score: (parsed.scores && parsed.scores[key]) || 0, color: need.color }
      })

      setResults({ ...parsed, chartData })
    } catch (err: any) {
      setError(`Analysis failed: ${err.message}`)
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="flex items-center justify-between mb-3">
          <label className="block text-lg font-semibold text-gray-800">Enter Your Content (Any Language)</label>
          {text && (
            <button onClick={() => { setText(''); setResults(null); setError(null) }}
              className="text-sm text-gray-600 hover:text-gray-900 underline">Clear</button>
          )}
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)}
          placeholder="Paste your article, headline, transcript, or any content here..."
          className="w-full h-64 p-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none resize-none text-gray-800" />
        {error && <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
        <button onClick={analyzeText} disabled={analyzing || !text.trim()}
          className="mt-4 px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
          {analyzing ? <><Loader2 className="w-5 h-5 animate-spin" />Analysing...</> : <><Sparkles className="w-5 h-5" />Analyse Content</>}
        </button>
      </div>

      {results && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <span className="font-semibold text-gray-700">Detected Language: </span>
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              {results.language}{results.translated && ' (Translated for analysis)'}
            </span>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-blue-600" />User Needs Distribution
            </h2>
            <p className="text-sm text-gray-600 mb-6 italic">Well defined User Needs Content will score 60%+ on the target need</p>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={results.chartData} layout="vertical" margin={{ left: 120 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis type="category" dataKey="name" width={110} />
                <Tooltip formatter={(v: any) => `${v}%`} contentStyle={{ borderRadius: '8px' }} />
                <Bar dataKey="score" radius={[0, 8, 8, 0]}>
                  {results.chartData.map((entry: any, i: number) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl shadow-xl p-8 text-white">
            <h3 className="text-xl font-bold mb-2">Dominant User Need</h3>
            <p className="text-3xl font-bold">{results.dominant_need}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            {results.comment && (
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Analysis</h3>
                <div className="p-4 bg-gray-50 rounded-xl border-l-4 border-gray-400">
                  <p className="text-gray-700">{results.comment}</p>
                </div>
              </div>
            )}
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Recommendations</h3>
            <p className="text-sm text-gray-600 mb-4">Strengthen your {results.dominant_need} story</p>
            <div className="space-y-3 mb-8">
              {results.primary_recommendations?.map((rec: string, i: number) => (
                <div key={i} className="flex gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">{i + 1}</div>
                  <p className="text-gray-800 flex-1">{rec}</p>
                </div>
              ))}
            </div>
            {results.secondary_recommendations?.length > 0 && (
              <>
                <h4 className="text-lg font-semibold text-gray-800 mb-3">Additional Angles</h4>
                <div className="space-y-3">
                  {results.secondary_recommendations.map((rec: string, i: number) => (
                    <div key={i} className="flex gap-3 p-4 bg-purple-50 rounded-xl border border-purple-100">
                      <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm">+</div>
                      <p className="text-gray-800 flex-1">{rec}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StoryIdeation({ sessionToken, onUse }: { sessionToken: string; onUse: (remaining: number) => void }) {
  const [brief, setBrief] = useState('')
  const [generating, setGenerating] = useState(false)
  const [ideas, setIdeas] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'userNeed' | 'strength'>('strength')

  const generateIdeas = async () => {
    if (!brief.trim()) { setError('Please enter a story brief'); return }
    setGenerating(true); setError(null); setIdeas(null)

    try {
      const res = await fetch('/api/ideate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, sessionToken })
      })
      const data = await res.json()

      if (res.status === 429) { setError(data.error); return }
      if (res.status === 401) { setError(data.error); return }
      if (!res.ok) { setError(data.error || 'Something went wrong'); return }

      if (data.remaining !== undefined) onUse(data.remaining)

      const raw = data.content[0].text.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '')
      setIdeas(JSON.parse(raw))
    } catch (err: any) {
      setError(`Generation failed: ${err.message}`)
    } finally {
      setGenerating(false)
    }
  }

  const getKey = (id: string) =>
    id === 'update' ? 'update_me' : id === 'educate' ? 'educate_me' :
    id === 'perspective' ? 'give_me_perspective' : id === 'divert' ? 'divert_me' :
    id === 'inspire' ? 'inspire_me' : id === 'help' ? 'help_me' :
    id === 'connect' ? 'connect_me' : 'keep_me_engaged'

  const strengthColors: Record<string, string> = {
    high: 'bg-green-50 border-green-200', medium: 'bg-blue-50 border-blue-200', low: 'bg-gray-50 border-gray-200'
  }
  const strengthLabels: Record<string, string> = {
    high: '⭐ Strong Match', medium: '✓ Good Match', low: '○ Possible Angle'
  }
  const strengthBadge: Record<string, string> = {
    high: 'bg-green-100 text-green-700', medium: 'bg-blue-100 text-blue-700', low: 'bg-gray-200 text-gray-600'
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <label className="block text-lg font-semibold text-gray-800 mb-3">Enter Your Story Brief</label>
        <textarea value={brief} onChange={e => setBrief(e.target.value)}
          placeholder="Describe your story topic. E.g. 'Rising electricity costs affecting small businesses in rural areas'"
          className="w-full h-48 p-4 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none resize-none text-gray-800" />
        {error && <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
        <button onClick={generateIdeas} disabled={generating || !brief.trim()}
          className="mt-4 px-8 py-3 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
          {generating ? <><Loader2 className="w-5 h-5 animate-spin" />Generating...</> : <><Lightbulb className="w-5 h-5" />Generate Story Ideas</>}
        </button>
      </div>

      {ideas && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl shadow-xl p-8 text-white">
            <h3 className="text-xl font-bold mb-2">Topic Summary</h3>
            <p className="text-lg">{ideas.topic_summary}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6 flex items-center gap-4">
            <span className="font-semibold text-gray-700">Sort by:</span>
            {(['userNeed', 'strength'] as const).map(opt => (
              <button key={opt} onClick={() => setSortBy(opt)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${sortBy === opt
                  ? opt === 'userNeed' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                {opt === 'userNeed' ? 'User Need' : 'Strength of Match'}
              </button>
            ))}
          </div>

          {sortBy === 'userNeed' ? (
            USER_NEEDS.map(need => {
              const storyIdeas = ideas.ideas[getKey(need.id)] || []
              return (
                <div key={need.id} className="bg-white rounded-2xl shadow-xl p-8">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: need.color }} />
                    <h3 className="text-2xl font-bold text-gray-900">{need.name}</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">{need.description}</p>
                  <div className="space-y-3">
                    {storyIdeas.map((item: any, i: number) => (
                      <div key={i} className={`p-4 rounded-xl border-l-4 ${strengthColors[item.strength]}`} style={{ borderLeftColor: need.color }}>
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-gray-800 flex-1">{item.idea}</p>
                          <span className={`text-xs font-semibold px-2 py-1 rounded ${strengthBadge[item.strength]}`}>{strengthLabels[item.strength]}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          ) : (
            (['high', 'medium', 'low'] as const).map(strength => {
              const allForStrength = USER_NEEDS.flatMap(need =>
                (ideas.ideas[getKey(need.id)] || [])
                  .filter((i: any) => i.strength === strength)
                  .map((i: any) => ({ ...i, need }))
              )
              if (allForStrength.length === 0) return null
              const headers: Record<string, string> = { high: '⭐ Strong Matches', medium: '✓ Good Matches', low: '○ Possible Angles' }
              const dotColors: Record<string, string> = { high: 'bg-green-500', medium: 'bg-blue-500', low: 'bg-gray-500' }
              return (
                <div key={strength} className="bg-white rounded-2xl shadow-xl p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`w-3 h-3 rounded-full ${dotColors[strength]}`} />
                    <h3 className="text-2xl font-bold text-gray-900">{headers[strength]}</h3>
                    <span className="text-gray-500 text-sm">({allForStrength.length} ideas)</span>
                  </div>
                  <div className="space-y-4">
                    {allForStrength.map((item: any, i: number) => (
                      <div key={i} className="p-5 bg-gray-50 rounded-xl border-l-4" style={{ borderLeftColor: item.need.color }}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.need.color }} />
                          <span className="font-semibold text-gray-700">{item.need.name}</span>
                        </div>
                        <p className="text-gray-800 ml-5">{item.idea}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

export default function UserNeedsApp() {
  const [activeTab, setActiveTab] = useState<'analyser' | 'ideation'>('analyser')
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [remaining, setRemaining] = useState<number>(20)
  const [limit] = useState<number>(20)
  const [loadingSession, setLoadingSession] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('session')

    if (token) {
      // LTI session from Moodle
      setSessionToken(token)
      fetch(`/api/usage?session=${token}`)
        .then(r => r.json())
        .then(d => { if (d.remaining !== undefined) setRemaining(d.remaining) })
        .catch(() => {})
      setLoadingSession(false)
    } else {
      // No LTI session — create a guest session automatically
      fetch('/api/dev-session')
        .then(r => r.json())
        .then(async d => {
          if (d.token) {
            setSessionToken(d.token)
            try {
              const u = await fetch(`/api/usage?session=${d.token}`).then(r => r.json())
              if (u.remaining !== undefined) setRemaining(u.remaining)
            } catch {}
          }
        })
        .catch(() => {})
        .finally(() => setLoadingSession(false))
    }
  }, [])

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  // No session = use a shared guest token stored in module scope
  // (LTI will replace this later)
  

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500 p-3 rounded-xl">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">BBC User Needs Tools</h1>
                <p className="text-gray-600">Content Analyser & Story Ideation</p>
              </div>
            </div>
            <UsageBadge remaining={remaining} limit={limit} />
          </div>

          <div className="flex gap-2 border-b border-gray-200 mb-6">
            <button onClick={() => setActiveTab('analyser')}
              className={`px-6 py-3 font-semibold transition-colors flex items-center gap-2 ${activeTab === 'analyser' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-900'}`}>
              <Sparkles className="w-5 h-5" />Content Analyser
            </button>
            <button onClick={() => setActiveTab('ideation')}
              className={`px-6 py-3 font-semibold transition-colors flex items-center gap-2 ${activeTab === 'ideation' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-600 hover:text-gray-900'}`}>
              <Lightbulb className="w-5 h-5" />Story Ideation
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {USER_NEEDS.map(need => (
              <div key={need.id} className="flex items-start gap-2">
                <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: need.color }} />
                <div>
                  <div className="text-sm font-semibold text-gray-800">{need.name}</div>
                  <div className="text-xs text-gray-500">{need.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {sessionToken ? (activeTab === 'analyser'
          ? <Analyser sessionToken={sessionToken} onUse={setRemaining} />
          : <StoryIdeation sessionToken={sessionToken} onUse={setRemaining} />
        ) : (
          <div className="bg-white rounded-2xl shadow-xl p-8 flex items-center justify-center gap-3 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading session...</span>
          </div>
        )}
      </div>
    </div>
  )
}