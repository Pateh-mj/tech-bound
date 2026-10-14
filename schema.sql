-- TECH//UNBOUND shared data schema for Supabase (Postgres)
-- Run in Supabase Dashboard > SQL Editor.
-- Public browser access is intentionally limited by RLS policies.
-- Do not add service_role keys to the website.

create extension if not exists pgcrypto;

create table if not exists public.team_profiles (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null unique,
  callsign text not null check (char_length(callsign) between 2 and 28),
  display_name text,
  institution text,
  skill_level text not null default 'Curious beginner',
  goals text,
  interests text[] not null default '{}',
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_events (
  id bigint generated always as identity primary key,
  visitor_id text not null,
  event_type text not null check (char_length(event_type) <= 60),
  category text,
  detail text,
  created_at timestamptz not null default now()
);

create table if not exists public.lab_completions (
  id bigint generated always as identity primary key,
  visitor_id text not null,
  mission_id text not null check (mission_id in ('inspect','validate','token')),
  created_at timestamptz not null default now(),
  unique(visitor_id, mission_id)
);

create index if not exists activity_events_created_at_idx on public.activity_events(created_at desc);
create index if not exists activity_events_category_idx on public.activity_events(category);
create index if not exists team_profiles_public_idx on public.team_profiles(is_public, updated_at desc);

alter table public.team_profiles enable row level security;
alter table public.activity_events enable row level security;
alter table public.lab_completions enable row level security;

-- Profiles: anyone with the public anon key can read only profiles whose owners opted in.
drop policy if exists "Public can read opted-in profiles" on public.team_profiles;
create policy "Public can read opted-in profiles"
on public.team_profiles for select to anon, authenticated
using (is_public = true);

-- A browser visitor can create/update a profile keyed to a random client-generated visitor ID.
-- NOTE: without authentication, visitor_id is not an identity proof. This is suitable for a
-- low-stakes team prototype, not for confidential profiles or hostile public deployment.
drop policy if exists "Visitors can insert own profile record" on public.team_profiles;
create policy "Visitors can insert own profile record"
on public.team_profiles for insert to anon, authenticated
with check (char_length(visitor_id) between 20 and 80);

drop policy if exists "Visitors can update profile record" on public.team_profiles;
create policy "Visitors can update profile record"
on public.team_profiles for update to anon, authenticated
using (char_length(visitor_id) between 20 and 80)
with check (char_length(visitor_id) between 20 and 80);

-- Event logs are write-only from the browser. Do not grant public select on raw events.
drop policy if exists "Visitors can add activity events" on public.activity_events;
create policy "Visitors can add activity events"
on public.activity_events for insert to anon, authenticated
with check (
  char_length(visitor_id) between 20 and 80
  and char_length(event_type) between 1 and 60
  and (category is null or char_length(category) <= 80)
  and (detail is null or char_length(detail) <= 160)
);

drop policy if exists "Visitors can add lab completions" on public.lab_completions;
create policy "Visitors can add lab completions"
on public.lab_completions for insert to anon, authenticated
with check (
  char_length(visitor_id) between 20 and 80
  and mission_id in ('inspect','validate','token')
);

-- Aggregate analytics only: expose counts, never raw visitor activity.
create or replace function public.public_team_metrics()
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'profiles', (select count(*) from public.team_profiles where is_public = true),
    'interest_signals', (select coalesce(sum(cardinality(interests)),0) from public.team_profiles where is_public = true),
    'missions', (select count(*) from public.lab_completions),
    'interest_distribution', (
      select coalesce(json_agg(json_build_object('interest', interest, 'count', cnt) order by cnt desc, interest), '[]'::json)
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

-- Grant only the operations used by the frontend.
grant select, insert, update on public.team_profiles to anon, authenticated;
grant insert on public.activity_events to anon, authenticated;
grant insert, select on public.lab_completions to anon, authenticated;
grant usage, select on sequence public.activity_events_id_seq to anon, authenticated;
grant usage, select on sequence public.lab_completions_id_seq to anon, authenticated;
