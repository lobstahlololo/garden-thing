# Setting up Supabase for MicroGrow

A single free Supabase project, four SQL statements, two environment
variables, and your single-page gardening app becomes a per-user app.
No build step required.

## Why Supabase

- Postgres + auth + row-level security in one platform.
- The free tier (500 MB DB, 50 000 monthly active users) is plenty for a
  single-user gardening app.
- The **anon key is intentionally public** — it ships inside the page you
  receive. Security is enforced by **row-level security policies** in the
  database, not by hiding the key. That is the correct mental model.

## 1 · Create the project

1. Sign in at [supabase.com/dashboard](https://supabase.com/dashboard)
   (free).
2. **New Project**.
3. Pick a region close to your users (London, Frankfurt, Singapore,
   Sydney, …). Free tier gives one region per project; pick once.
4. Wait ~2 minutes for provisioning.

## 2 · Tweak Auth settings

In your project dashboard:

**Authentication → Providers → Email**
- Keep "Enable Email provider" ✅.
- "Confirm email" — keep **ON** for production. Turn **OFF** only for
  local development so you can skip the email-confirmation step while
  iterating. The app works in both modes; the dashboard tells you which
  mode each user is in.

**Authentication → URL Configuration → Site URL**
- Add the preview URL Freebuff shows for this repo (typically
  `*.freebuff.app` or your custom domain). Default to whatever the
  preview gives you.

## 3 · Run the four SQL statements

**SQL Editor → New query.** Paste and run the SQL block from
`supabase_schema.sql` at the repo root (or copy it from the appendix
below). The script creates four tables, indexes, RLS policies, and a
trigger that auto-creates a `profiles` row whenever a new user signs up.

Tables created:

| Table | Purpose | RLS scope |
|---|---|---|
| `profiles` | one row per user; last_location_query + frost-date overrides | `auth.uid() = user_id` |
| `yard_profiles` | named yards (topography / infra / soil); day-1 only the `is_default` row is used | `auth.uid() = user_id` |
| `query_history` | append-only log of every location the user has queried | `auth.uid() = user_id` |
| `custom_crops` | user-defined crops that slot into the planting table | `auth.uid() = user_id` |

Run them **in order**. The script ends with `select 'microgrow schema ok';`
so you can confirm in the run output that everything succeeded.

## 4 · Copy the two API values

In your project dashboard:

**Project Settings → API** shows:

- **Project URL** — looks like `https://abcdefghijkl.supabase.co`.
- **Project API keys → `anon` `public`** — a JWT starting with
  `eyJhbGciOi…`.

You **do not** need the `service_role` key. Never paste that one into the
client.

## 5 · Inject them into Freebuff

Open the Freebuff **API Keys** UI for this repo. Add the two keys with
these exact names:

| Freebuff key name | Value |
|---|---|
| `SUPABASE_URL` | the Project URL from step 4 |
| `SUPABASE_ANON_KEY` | the anon JWT from step 4 |

Freebuff's preview substitutes them at request time. **Restart the
preview** so both meta tags in the HTML page pick up the new values.

## 6 · Verify the wiring

In the Freebuff preview:

1. The auth card (top of the sidebar) should show `Email` + `Password`
   fields, a primary `Sign up` button, and a secondary `Sign in`
   button. Two links underneath: `Forgot password?` and `Resend
   confirmation email?`.
2. Sign up with any email + a ≥ 6-char password.
3. If `Confirm email` is **ON** in your project: the card flips to a
   "Check your inbox" panel within a second of success. Click the link
   in the confirmation email; the app returns with the user signed in.
   If **OFF**: the card flips straight to the "Signed in as
   you@…" panel.
4. Type a location, change a dropdown or two.
5. **Refresh the page.** If you are still signed in (you should be)
   the dropdowns should match what you set, and the location input
   should be pre-filled with your last query.
6. Sign out from the auth card. The dropdowns reset to the in-page
   defaults; the saved-profile UI panels disappear.

If any of those fail, look at the browser console — `microgrowAuth`,
`microgrowSync` and `[sync]` log lines dump enough info to pinpoint
which check failed (missing config? missing lib? RLS denying?

## Where the data lives

```
┌────── your browser ──────┐                  ┌── Supabase ──┐
│ Auth card UI            │ ← signIn/signUp  │ auth.users    │
│   supabase.auth.*       │ ←── HTTPS, anon key in  ────┤
│                         │                  ├─ profiles           │
│ window.state            │ ← hydrate on SIGNED_IN → ┤ (RLS own row)  │
│   microgrowMutate()  ───┼─ debounce write ────────→ ├─ yard_profiles   │
│   microgrowSync.*     ───┼────query_history         ├─ (RLS own row)  │
│                         │                          ├─ custom_crops     │
└─────────────────────────┘                          │ (RLS own row)  │
```

## Adding more user data later

The schema is intentionally minimal. Adding a `notes` column or a
`frost_date_overrides` table is just an `ALTER TABLE` plus adding the
newly relevant fields to `state` and one more queue entry in
`sync.js` (`saveBaselineOverride` already exists as a hook for
frost-date overrides — wire it up whenever the UI is added). RLS
policies don't change as you add columns.

## Appendix · the SQL

```sql
-- 1) profiles · 1:1 with auth.users
create table public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  display_name text,
  last_location_query text,
  baseline_last_frost date,
  baseline_first_frost date,
  updated_at timestamptz default now()
);

-- 2) yard_profiles · 1:N per user (named yards, future-proof; today UI uses is_default row only)
create table public.yard_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null default 'My Yard',
  topography text not null,
  infrastructure text not null,
  soil text not null,
  is_default boolean default false,
  created_at timestamptz default now()
);
create index on public.yard_profiles (user_id, is_default);

-- 3) query_history · append-only log
create table public.query_history (
  id bigserial primary key,
  user_id uuid not null references auth.users on delete cascade,
  queried_at timestamptz default now(),
  raw_query text not null,
  resolved_label text,
  latitude double precision,
  longitude double precision
);
create index on public.query_history (user_id, queried_at desc);

-- 4) custom_crops · user-defined plug-in entries for the planting table
create table public.custom_crops (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  emoji text,
  kind text not null,
  offset_days int not null,
  created_at timestamptz default now()
);

-- Row-level security
alter table public.profiles       enable row level security;
alter table public.yard_profiles  enable row level security;
alter table public.query_history  enable row level security;
alter table public.custom_crops   enable row level security;

create policy "own profiles"      on public.profiles      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own yard_profiles" on public.yard_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own query_history" on public.query_history for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own custom_crops"  on public.custom_crops  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Auto-create a profile row whenever a new auth.user signs up
create function public.handle_new_user() returns trigger
  language plpgsql security definer as $$
begin
  insert into public.profiles (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

select 'microgrow schema ok';
```
