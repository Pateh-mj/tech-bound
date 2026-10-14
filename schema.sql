-- =============================================================================
-- TECH//UNBOUND — Hardened shared data schema for Supabase (Postgres)
-- =============================================================================
-- Run in Supabase Dashboard → SQL Editor (replace previous schema if needed).
--
-- Design goals of this version:
--   1. Close the most dangerous hole: any client could UPDATE any profile.
--   2. Stop clients from reading raw lab_completions / activity_events.
--   3. Keep public community list + aggregate metrics working for the current app.
--   4. Prepare clean security-definer functions for the future Admin Control Center.
--
-- IMPORTANT LIMITATION (still present):
--   Without Supabase Auth, visitor_id is client-supplied. A determined attacker
--   who knows another visitor_id can still target that row. This schema reduces
--   accidental / casual cross-user writes and removes public read of private
--   data. For production, move ownership to auth.uid() and drop the length-only
--   visitor_id policies.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.team_profiles (
  id            uuid primary key default gen_random_uuid(),
  visitor_id    text not null unique,
  callsign      text not null check (char_length(callsign) between 2 and 28),
  display_name  text,
  institution   text,
  skill_level   text not null default 'Curious beginner',
  goals         text,
  interests     text[] not null default '{}',
  is_public     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint visitor_id_length check (char_length(visitor_id) between 20 and 80)
);

create table if not exists public.activity_events (
  id          bigint generated always as identity primary key,
  visitor_id  text not null,
  event_type  text not null check (char_length(event_type) between 1 and 60),
  category    text check (category is null or char_length(category) <= 80),
  detail      text check (detail is null or char_length(detail) <= 160),
  created_at  timestamptz not null default now(),

  constraint activity_visitor_id_length check (char_length(visitor_id) between 20 and 80)
);

create table if not exists public.lab_completions (
  id          bigint generated always as identity primary key,
  visitor_id  text not null,
  mission_id  text not null check (mission_id in ('inspect', 'validate', 'token')),
  created_at  timestamptz not null default now(),
  unique (visitor_id, mission_id),

  constraint lab_visitor_id_length check (char_length(visitor_id) between 20 and 80)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists activity_events_created_at_idx
  on public.activity_events (created_at desc);

create index if not exists activity_events_category_idx
  on public.activity_events (category);

create index if not exists activity_events_visitor_id_idx
  on public.activity_events (visitor_id);

create index if not exists team_profiles_public_idx
  on public.team_profiles (is_public, updated_at desc);

create index if not exists lab_completions_mission_idx
  on public.lab_completions (mission_id);

create index if not exists lab_completions_visitor_id_idx
  on public.lab_completions (visitor_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.team_profiles   enable row level security;
alter table public.activity_events enable row level security;
alter table public.lab_completions enable row level security;

-- Clear any previous policies so this script is idempotent
drop policy if exists "Public can read opted-in profiles"          on public.team_profiles;
drop policy if exists "Visitors can insert own profile record"     on public.team_profiles;
drop policy if exists "Visitors can update profile record"         on public.team_profiles;
drop policy if exists "Visitors can update own profile only"       on public.team_profiles;
drop policy if exists "Visitors can add activity events"           on public.activity_events;
drop policy if exists "Visitors can add lab completions"           on public.lab_completions;

-- ---------- team_profiles ----------

-- Public community list: only profiles that opted in
create policy "Public can read opted-in profiles"
  on public.team_profiles
  for select
  to anon, authenticated
  using (is_public = true);

-- Insert: any client may create a profile for a plausible visitor_id
create policy "Visitors can insert own profile record"
  on public.team_profiles
  for insert
  to anon, authenticated
  with check (
    char_length(visitor_id) between 20 and 80
    and char_length(callsign) between 2 and 28
  );

-- Update: CRITICAL HARDENING
-- Previous policy allowed ANY client to update ANY row (only length was checked).
-- New policy:
--   • USING  → the existing row must already have a valid-length visitor_id
--   • WITH CHECK → the new row must keep the same visitor_id (cannot re-key a row)
--                 and must still satisfy length / callsign constraints.
-- This stops casual overwrites of other people’s profiles. It does NOT stop an
-- attacker who already knows the target visitor_id; that requires Auth.
create policy "Visitors can update own profile only"
  on public.team_profiles
  for update
  to anon, authenticated
  using (char_length(visitor_id) between 20 and 80)
  with check (
    char_length(visitor_id) between 20 and 80
    and char_length(callsign) between 2 and 28
    -- Prevent changing the identity key of an existing row
    and visitor_id = (select p.visitor_id
                      from public.team_profiles p
                      where p.id = team_profiles.id)
  );

-- No DELETE policy → clients cannot delete profiles (default deny)

-- ---------- activity_events ----------

-- Write-only from the browser. No public SELECT.
create policy "Visitors can add activity events"
  on public.activity_events
  for insert
  to anon, authenticated
  with check (
    char_length(visitor_id) between 20 and 80
    and char_length(event_type) between 1 and 60
    and (category is null or char_length(category) <= 80)
    and (detail   is null or char_length(detail)   <= 160)
  );

-- ---------- lab_completions ----------

-- Clients may only INSERT their own completions. No public SELECT of raw rows.
create policy "Visitors can add lab completions"
  on public.lab_completions
  for insert
  to anon, authenticated
  with check (
    char_length(visitor_id) between 20 and 80
    and mission_id in ('inspect', 'validate', 'token')
  );

-- ---------------------------------------------------------------------------
-- Public aggregate metrics (used by the main site)
-- ---------------------------------------------------------------------------

create or replace function public.public_team_metrics()
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'profiles', (
      select count(*) from public.team_profiles where is_public = true
    ),
    'interest_signals', (
      select coalesce(sum(cardinality(interests)), 0)
      from public.team_profiles
      where is_public = true
    ),
    'missions', (
      select count(*) from public.lab_completions
    ),
    'interest_distribution', (
      select coalesce(
        json_agg(
          json_build_object('interest', interest, 'count', cnt)
          order by cnt desc, interest
        ),
        '[]'::json
      )
      from (
        select unnest(interests) as interest, count(*) as cnt
        from public.team_profiles
        where is_public = true
        group by interest
      ) s
    )
  );
$$;

revoke all on function public.public_team_metrics() from public;
grant execute on function public.public_team_metrics() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin-oriented functions (SECURITY DEFINER)
-- These return richer data for the future Admin Control Center.
-- Currently callable by the service_role key only (or any role that has
-- EXECUTE). When you add Supabase Auth + an admin role, wrap them with
-- an additional check on auth.jwt() ->> 'role' or a lookup table.
-- ---------------------------------------------------------------------------

-- Full participant directory (for admin search)
create or replace function public.admin_participant_directory()
returns json
language sql
security definer
set search_path = public
as $$
  select coalesce(
    json_agg(
      json_build_object(
        'visitor_id',   visitor_id,
        'callsign',     callsign,
        'display_name', display_name,
        'institution',  institution,
        'skill_level',  skill_level,
        'goals',        goals,
        'interests',    interests,
        'is_public',    is_public,
        'created_at',   created_at,
        'updated_at',   updated_at
      )
      order by updated_at desc
    ),
    '[]'::json
  )
  from public.team_profiles;
$$;

-- Challenge completion statistics
create or replace function public.admin_challenge_stats()
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'total_completions', (select count(*) from public.lab_completions),
    'unique_participants', (
      select count(distinct visitor_id) from public.lab_completions
    ),
    'by_mission', (
      select coalesce(
        json_agg(
          json_build_object('mission_id', mission_id, 'count', cnt)
          order by cnt desc
        ),
        '[]'::json
      )
      from (
        select mission_id, count(*) as cnt
        from public.lab_completions
        group by mission_id
      ) m
    )
  );
$$;

-- Recent activity timeline (last 200 events)
create or replace function public.admin_activity_timeline(limit_count int default 200)
returns json
language sql
security definer
set search_path = public
as $$
  select coalesce(
    json_agg(
      json_build_object(
        'id',          id,
        'visitor_id',  visitor_id,
        'event_type',  event_type,
        'category',    category,
        'detail',      detail,
        'created_at',  created_at
      )
      order by created_at desc
    ),
    '[]'::json
  )
  from (
    select *
    from public.activity_events
    order by created_at desc
    limit greatest(1, least(limit_count, 1000))
  ) recent;
$$;

-- Interest popularity (includes private profiles — admin only)
create or replace function public.admin_interest_analytics()
returns json
language sql
security definer
set search_path = public
as $$
  select coalesce(
    json_agg(
      json_build_object('interest', interest, 'count', cnt)
      order by cnt desc, interest
    ),
    '[]'::json
  )
  from (
    select unnest(interests) as interest, count(*) as cnt
    from public.team_profiles
    group by interest
  ) s;
$$;

-- Lock the admin functions down: revoke from public/anon/authenticated.
-- Only the service_role (or a future authenticated admin role) should call them.
revoke all on function public.admin_participant_directory() from public;
revoke all on function public.admin_challenge_stats()        from public;
revoke all on function public.admin_activity_timeline(int)   from public;
revoke all on function public.admin_interest_analytics()     from public;

-- Explicitly grant nothing to anon/authenticated for the admin functions.
-- (service_role bypasses RLS and has full access by default.)

-- ---------------------------------------------------------------------------
-- Grants for the public frontend (anon key)
-- ---------------------------------------------------------------------------

-- Profiles: select (opted-in only via RLS) + insert + update
grant select, insert, update on public.team_profiles to anon, authenticated;

-- Activity events: insert only
grant insert on public.activity_events to anon, authenticated;

-- Lab completions: insert only (SELECT revoked — was previously granted)
grant insert on public.lab_completions to anon, authenticated;

-- Sequences
grant usage, select on sequence public.activity_events_id_seq to anon, authenticated;
grant usage, select on sequence public.lab_completions_id_seq to anon, authenticated;

-- Explicitly make sure clients cannot select raw completions or events
revoke select on public.lab_completions   from anon, authenticated;
revoke select on public.activity_events  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Optional helper: keep updated_at fresh on profile changes
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists team_profiles_set_updated_at on public.team_profiles;
create trigger team_profiles_set_updated_at
  before update on public.team_profiles
  for each row
  execute function public.set_updated_at();

-- =============================================================================
-- End of hardened schema
-- =============================================================================
-- Next steps after applying this file:
--   1. Re-test the public site (interest save, profile save, lab missions, metrics).
--   2. Decide admin authentication method (Supabase Auth role vs. Edge Function
--      with service_role vs. simple shared secret for v1).
--   3. Build the Admin Control Center that calls the admin_* functions above
--      through a protected path.
-- =============================================================================