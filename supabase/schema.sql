-- Users table (populated on first LTI login)
-- Pseudonymous by design. No email or name is collected: neither served either
-- stated purpose (enforcing the daily limit, per-user feature analysis), and
-- migration 0005 dropped them. Do not reintroduce them without revising the
-- privacy notice, the DPIA and the DSAR procedure. A test in tests/ fails if
-- either column reappears here.
create table users (
  id uuid primary key default gen_random_uuid(),
  moodle_user_id text unique not null,
  created_at timestamptz default now()
);

-- Usage tracking
create table usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  used_at timestamptz default now(),
  feature text check (feature in ('analyser', 'ideation'))
);

-- Index for fast daily count queries
create index idx_usage_user_date on usage(user_id, used_at);

-- LTI sessions (short-lived, maps launch token → user)
create table lti_sessions (
  token text primary key,
  user_id uuid references users(id),
  expires_at timestamptz default now() + interval '1 hour'
);

-- Row Level Security
alter table users enable row level security;
alter table usage enable row level security;
alter table lti_sessions enable row level security;

-- Only service_role can read/write (all access goes through your API)
create policy "service only" on users for all using (false);
create policy "service only" on usage for all using (false);
create policy "service only" on lti_sessions for all using (false);