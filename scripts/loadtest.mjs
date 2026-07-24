// Light load test against a deployed instance.
//
//   node scripts/loadtest.mjs https://your-app.vercel.app [concurrency] [seconds]
//   node scripts/loadtest.mjs https://your-app.vercel.app 20 30
//
// WHAT IT DOES NOT DO, on purpose: it never calls the analyser or ideation
// features with a valid session. Those call the Anthropic API, so load testing
// them would bill real money and consume the per-user daily cap. There is no
// safe way to load test them without a spend cap in place first.
//
// WHAT IT DOES TEST is the path that actually falls over first under load:
//
//   /api/health   -> Vercel routing, function cold start, and a real query
//                    against the Supabase connection pool
//   /api/analyze  -> unauthenticated POST. Exercises routing, the session
//                    lookup against the database, and the security-event
//                    counter write, then returns 401. No AI call, no spend.
//
// Both are database-backed, so this is a genuine test of the Supabase free-tier
// connection ceiling, which is the documented first bottleneck. Anything past
// that ceiling is a Supabase plan question, not an application one.
//
// Run it against a preview deployment where possible. Running it against
// production will inflate the security-event counters for that day, which is
// harmless but will look like an anomaly to anyone reading the table later.

const [, , baseUrl, concArg, secsArg] = process.argv

if (!baseUrl || !baseUrl.startsWith('http')) {
  console.error('Usage: node scripts/loadtest.mjs <base-url> [concurrency] [seconds]')
  process.exit(1)
}

const origin = baseUrl.replace(/\/$/, '')
const concurrency = Number(concArg ?? 10)
const durationSec = Number(secsArg ?? 20)

const targets = [
  { name: 'GET  /api/health', expect: 200, run: () => fetch(`${origin}/api/health`) },
  {
    name: 'POST /api/analyze (unauthenticated)',
    expect: 401,
    run: () =>
      fetch(`${origin}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'loadtest' }),
      }),
  },
]

function percentile(sorted, p) {
  if (sorted.length === 0) return 0
  const i = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[i]
}

async function measure(target) {
  const latencies = []
  let ok = 0
  let wrongStatus = 0
  let failed = 0
  const deadline = Date.now() + durationSec * 1000

  async function worker() {
    while (Date.now() < deadline) {
      const started = performance.now()
      try {
        const res = await target.run()
        latencies.push(performance.now() - started)
        if (res.status === target.expect) ok++
        else wrongStatus++
      } catch {
        latencies.push(performance.now() - started)
        failed++
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker))

  const sorted = latencies.slice().sort((a, b) => a - b)
  const total = latencies.length
  return {
    name: target.name,
    total,
    rps: (total / durationSec).toFixed(1),
    ok,
    wrongStatus,
    failed,
    p50: percentile(sorted, 50).toFixed(0),
    p95: percentile(sorted, 95).toFixed(0),
    p99: percentile(sorted, 99).toFixed(0),
    max: (sorted[sorted.length - 1] ?? 0).toFixed(0),
  }
}

console.log(`Target:      ${origin}`)
console.log(`Concurrency: ${concurrency}`)
console.log(`Duration:    ${durationSec}s per endpoint\n`)

let anyProblem = false

for (const target of targets) {
  const r = await measure(target)
  console.log(r.name)
  console.log(`  requests   ${r.total} (${r.rps}/s)`)
  console.log(`  expected   ${r.ok}   unexpected status ${r.wrongStatus}   errors ${r.failed}`)
  console.log(`  latency ms p50 ${r.p50}  p95 ${r.p95}  p99 ${r.p99}  max ${r.max}\n`)
  if (r.wrongStatus > 0 || r.failed > 0) anyProblem = true
}

console.log('Record the p95 figures and the concurrency they were measured at')
console.log('in docs/runbook.md under capacity ceilings. Re-run before any')
console.log('launch event, and after any change to session handling.')

if (anyProblem) {
  console.log('\nSome requests did not return the expected status. Investigate')
  console.log('before treating these numbers as a baseline.')
  process.exit(1)
}
