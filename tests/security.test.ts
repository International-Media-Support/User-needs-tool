import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

/**
 * These tests guard compliance claims that would otherwise rest on code review
 * alone. They are deliberately structural: they assert properties of the source
 * rather than exercising the running app, so they need no database, no network
 * and no secrets.
 */

function readSource(p: string) {
  return readFileSync(join(process.cwd(), p), 'utf8')
}

describe('data minimisation', () => {
  const aiRoutes = ['app/api/analyze/route.ts', 'app/api/ideate/route.ts']

  it.each(aiRoutes)('%s does not write user-submitted content to the database', (route) => {
    const src = readSource(route)
    // The privacy notice and DPIA both state that pasted content is never
    // persisted. These routes should therefore not touch the database client
    // or perform any write at all.
    expect(src).not.toMatch(/from\s+['"]@\/lib\/supabase['"]/)
    expect(src).not.toMatch(/\.insert\(/)
    expect(src).not.toMatch(/\.upsert\(/)
  })

  it('no route stores an email address or name', () => {    // Removed in migration 0005. If either reappears, the privacy notice, DPIA
    // and DSAR procedure all become wrong.
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]
      )
    const files = [...walk('app/api'), ...walk('lib')].filter((f) => f.endsWith('.ts'))
    for (const f of files) {
      const src = readFileSync(f, 'utf8')
      expect(src, `${f} appears to persist an email or name`).not.toMatch(
        /(insert|upsert)\(([\s\S]*?)\b(email|name)\b/
      )
    }
  })
})

describe('base schema', () => {
  it('does not declare email or name on users', () => {
    // The route-level test above catches code that writes these columns. It
    // does not catch a schema that defines them. Migration 0005 drops both,
    // but an environment stood up from schema.sql alone would recreate them
    // and quietly falsify the privacy notice, so guard the schema too.
    const schema = readSource('supabase/schema.sql')
    const usersTable = schema.slice(
      schema.indexOf('create table users'),
      schema.indexOf('create table usage')
    )
    expect(usersTable).not.toMatch(/^\s*email\b/m)
    expect(usersTable).not.toMatch(/^\s*name\b/m)
  })
})

describe('restore verification', () => {
  it('asserts every table and function the migrations create', () => {
    // A table added by a migration but never added to restore-verify.yml is a
    // table whose loss during a restore would go undetected.
    const workflow = readSource('.github/workflows/restore-verify.yml')
    const sqlDir = 'supabase/migrations'
    const sql = [readSource('supabase/schema.sql')]
      .concat(readdirSync(sqlDir).map((f) => readSource(join(sqlDir, f))))
      .join('\n')

    const collect = (re: RegExp): string[] => {
      const found: string[] = []
      let m: RegExpExecArray | null
      while ((m = re.exec(sql)) !== null) {
        if (found.indexOf(m[1]) === -1) found.push(m[1])
      }
      return found
    }

    const tables = collect(/create table (?:if not exists )?(\w+)/g)
    const functions = collect(/create (?:or replace )?function (\w+)/g)

    const missing = tables.concat(functions).filter((n) => !workflow.includes(n)).sort()
    expect(missing, `not asserted by restore-verify.yml: ${missing.join(', ')}`).toEqual([])
  })
})

describe('sentry cannot capture user content', () => {
  // Sentry is the one integration that could quietly undo the "pasted content
  // is never persisted" guarantee, by shipping request bodies to a third
  // party. These tests encode the guarantee rather than trusting the config.

  it('drops the request body, auth header, cookies and query string', async () => {
    const { scrubEvent } = await import('../lib/sentry-scrub')
    const scrubbed = scrubEvent({
      request: {
        method: 'POST',
        url: 'https://app.example.com/api/analyze?code=one-time-handoff-code',
        data: { text: 'SENSITIVE PASTED CONTENT' },
        cookies: { session: 'abc' },
        query_string: 'code=one-time-handoff-code',
        headers: {
          authorization: 'Bearer SESSION-TOKEN',
          cookie: 'session=abc',
          'content-type': 'application/json',
        },
      },
    })

    const serialised = JSON.stringify(scrubbed)
    expect(serialised).not.toContain('SENSITIVE PASTED CONTENT')
    expect(serialised).not.toContain('SESSION-TOKEN')
    expect(serialised).not.toContain('one-time-handoff-code')
    expect(scrubbed.request?.data).toBeUndefined()
    expect(scrubbed.request?.cookies).toBeUndefined()
    // The safe parts survive, or the tracker would be useless.
    expect(scrubbed.request?.url).toBe('https://app.example.com/api/analyze')
    expect(scrubbed.request?.headers?.['content-type']).toBe('application/json')
  })

  it('keeps only the internal user id, never the Moodle identifier', async () => {
    const { scrubEvent } = await import('../lib/sentry-scrub')
    const scrubbed = scrubEvent({
      user: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        username: 'moodle-user-12345',
        email: 'someone@example.org',
        ip_address: '203.0.113.4',
      },
    })
    expect(scrubbed.user).toEqual({ id: '550e8400-e29b-41d4-a716-446655440000' })
  })

  it('drops console breadcrumbs and arbitrary extras', async () => {
    const { scrubEvent } = await import('../lib/sentry-scrub')
    const scrubbed = scrubEvent({
      breadcrumbs: [
        { category: 'console', message: 'analysing: SENSITIVE PASTED CONTENT' },
        { category: 'fetch', data: { url: 'https://x.test/a?token=SECRET' } },
      ],
      extra: { requestBody: 'SENSITIVE PASTED CONTENT' },
    })
    const serialised = JSON.stringify(scrubbed)
    expect(serialised).not.toContain('SENSITIVE PASTED CONTENT')
    expect(serialised).not.toContain('SECRET')
    expect(scrubbed.extra).toBeUndefined()
    expect(scrubbed.breadcrumbs).toHaveLength(1)
  })

  it('never enables session replay, which would record the textarea', () => {
    const client = readSource('sentry.client.config.ts')
    expect(client).toMatch(/replaysSessionSampleRate:\s*0/)
    expect(client).toMatch(/replaysOnErrorSampleRate:\s*0/)
  })

  it('disables PII and local variable capture on every runtime', () => {
    for (const f of ['sentry.server.config.ts', 'sentry.client.config.ts', 'sentry.edge.config.ts']) {
      const src = readSource(f)
      expect(src, `${f} must set sendDefaultPii false`).toMatch(/sendDefaultPii:\s*false/)
      expect(src, `${f} must scrub events`).toContain('scrubEvent')
    }
    expect(readSource('sentry.server.config.ts')).toMatch(/includeLocalVariables:\s*false/)
  })
})

describe('security logging', () => {
  it('never logs tokens or submitted content', () => {
    const src = readSource('lib/log.ts')
    expect(src).not.toMatch(/sessionToken|bearer|\btext\b\s*[,}]/i)
  })

  it('durable counters carry no user identifier', () => {
    // security_events_daily is deliberately non-personal. If a user id were
    // ever added, it would need DSAR handling and an erasure cascade.
    const migration = readSource('supabase/migrations/0006_security_events.sql')
    const table = migration.slice(
      migration.indexOf('create table if not exists security_events_daily'),
      migration.indexOf('alter table security_events_daily')
    )
    expect(table).not.toMatch(/user_id/)

    // The RPC call must pass only event and route.
    const log = readSource('lib/log.ts')
    const call = log.slice(log.indexOf('record_security_event'))
    expect(call).not.toMatch(/userId/)
  })
})

describe('.env.example', () => {
  it('documents every environment variable the code reads', () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]
      )
    const files = [...walk('app'), ...walk('lib')].filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))

    const used = new Set<string>()
    for (const f of files) {
      const src = readFileSync(f, 'utf8')
      const re = /process\.env\.([A-Z0-9_]+)/g
      let m: RegExpExecArray | null
      while ((m = re.exec(src)) !== null) used.add(m[1])
    }

    const example = readSource('.env.example')
    const documented = new Set(
      example
        .split('\n')
        .filter((l) => l.trim() && !l.trim().startsWith('#'))
        .map((l) => l.split('=')[0].trim())
    )

    const missing = Array.from(used).filter((v) => !documented.has(v)).sort()
    expect(missing, `undocumented env vars: ${missing.join(', ')}`).toEqual([])
  })
})
