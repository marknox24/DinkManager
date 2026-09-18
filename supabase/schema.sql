-- ============================================================================
-- DinkManager platform schema
-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query).
-- Safe to re-run: uses "create table if not exists" and drops/recreates policies.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- PROFILES  (one row per organizer, mirrors auth.users)
-- ----------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  club_name text,
  role text not null default 'organizer' check (role in ('organizer', 'player')),
  is_admin boolean not null default false,
  -- Trial/temporary-access accounts issued via the admin panel. Both null
  -- (the default) means unrestricted, permanent access — every self-serve
  -- signup is untouched by these.
  access_expires_at timestamptz,
  max_events integer,
  created_at timestamptz not null default now()
);

-- Backfills existing rows with 'organizer' via the column default — no
-- behavior change for current organizer accounts.
alter table profiles add column if not exists role text not null default 'organizer' check (role in ('organizer', 'player'));
alter table profiles add column if not exists email text;
alter table profiles add column if not exists is_admin boolean not null default false;
alter table profiles add column if not exists access_expires_at timestamptz;
alter table profiles add column if not exists max_events integer;

alter table profiles enable row level security;

drop policy if exists "profiles_select_own" on profiles;
create policy "profiles_select_own" on profiles for select using (auth.uid() = id);

-- Lets an admin account (is_admin = true) list every profile, so the admin
-- panel can show issued trial accounts. Ordinary users still only see their
-- own row via profiles_select_own above (select policies are OR'd together).
--
-- The is_admin check has to go through a security-definer function rather
-- than a plain "exists (select ... from profiles)" subquery — a subquery
-- against profiles inside a profiles policy re-triggers every select policy
-- on profiles (including this one) for that inner query, causing Postgres
-- to report "infinite recursion detected in policy for relation profiles".
-- A security-definer function's body runs with RLS bypassed, so the inner
-- lookup never re-enters policy evaluation.
create or replace function is_admin_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

drop policy if exists "profiles_select_admin" on profiles;
create policy "profiles_select_admin" on profiles for select
  using (is_admin_user());

drop policy if exists "profiles_upsert_own" on profiles;
create policy "profiles_upsert_own" on profiles for insert with check (auth.uid() = id);

-- with check pins is_admin/access_expires_at/max_events to their existing
-- values — without it, Postgres reuses "auth.uid() = id" as the check (same
-- gap as events_update_owner above), which places no restriction on WHICH
-- columns a self-update may change. Every signed-in user could otherwise set
-- is_admin = true on their own row via a raw client call and grant
-- themselves admin, or clear their own trial access_expires_at/max_events.
-- role is deliberately left updatable — it's already constrained to
-- 'organizer'/'player' by the column's own check constraint, and the OAuth
-- signup role-correction in AuthContext.jsx relies on being able to set it.
drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- p2.id = profiles.id (not the bare "id") — an unqualified "id" here
    -- resolves to p2's own column (the subquery's nearest FROM-list table),
    -- turning the filter into "p2.id = p2.id" (always true). That made
    -- every one of these three subqueries return every row in the whole
    -- table instead of one, and Postgres errors "more than one row
    -- returned by a subquery used as an expression" on ANY profile update
    -- — this silently broke every profile save from the moment the
    -- previous (unqualified) version of this policy went live.
    and is_admin = (select p2.is_admin from profiles p2 where p2.id = profiles.id)
    and access_expires_at is not distinct from (select p2.access_expires_at from profiles p2 where p2.id = profiles.id)
    and max_events is not distinct from (select p2.max_events from profiles p2 where p2.id = profiles.id)
    -- plan is set only by approve-subscription-request (service role) —
    -- pinned here for the same reason as the three checks above, so a
    -- direct client-side update can't self-upgrade an account's tier.
    and plan = (select p2.plan from profiles p2 where p2.id = profiles.id)
  );

-- Auto-create a profile row whenever someone signs up. Role comes from
-- signUp's options.data.role; defaults to 'organizer' so existing organizer
-- signup calls (which never pass role) are unaffected.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'display_name',
    coalesce(new.raw_user_meta_data ->> 'role', 'organizer')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ----------------------------------------------------------------------------
-- EVENTS
-- ----------------------------------------------------------------------------
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  name text not null,
  status text not null default 'upcoming' check (status in ('upcoming', 'ongoing', 'finished', 'cancelled', 'rescheduled')),
  is_published boolean not null default false,
  location_address text,
  start_date date,
  end_date date,
  organizer_name text,
  contacts jsonb not null default '[]', -- [{type:'phone'|'email'|'website', value:text}]
  description text,
  rules text,
  venue_guidelines text,
  schedule text,
  faq text,
  -- General, tournament-wide info — distinct from categories.qualification,
  -- which is per-division eligibility criteria.
  registration_open_date date,
  registration_close_date date,
  prize_pool text,
  cancellation_policy text,
  refund_policy text,
  announcements text,
  num_courts integer,
  court_type text check (court_type in ('indoor', 'outdoor', 'mixed')) default null,
  match_duration_minutes integer not null default 18,
  payment_qr_path text,
  club_name text,
  cover_photo_path text,
  -- Display currency for Accounting/Sponsors money amounts (Intl.NumberFormat
  -- ISO code). Independent of categories.fee_currency, which is set per
  -- category on the registration form — this is a single event-wide default.
  currency text not null default 'USD',
  -- When true, the Accounting page's Total earnings figure folds in
  -- sponsors.amount alongside registration and manual earnings.
  include_sponsors_in_earnings boolean not null default false,
  -- 'private' hides the event from the public /tournaments browse list; it
  -- stays reachable at /e/:slug for a *public* event, or only via its
  -- share_token (/t/:token) once private — getPublicEventBySlug filters on
  -- visibility='public' so a private event's plain slug link cleanly
  -- 404s. This is an unlisted-link model (like a YouTube unlisted video),
  -- not per-user access control — RLS still grants any is_published=true
  -- row to anon regardless of visibility, since gating that too would mean
  -- touching every dependent table's policy (categories/registrations/
  -- brackets/teams/matches) for marginal extra protection.
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  -- Random (crypto.randomUUID()), generated client-side the first time an
  -- event is switched to private; stays stable across public<->private
  -- toggles so a previously-shared link keeps working, unless the organizer
  -- explicitly rotates it via "Generate new link".
  share_token text unique,
  -- Randomizer preference, set once in Settings rather than re-chosen on
  -- every draw: off means the Randomizer tries to spread players from the
  -- same club across different brackets (its long-standing default
  -- behavior); on lets clubmates land in the same bracket.
  randomizer_allow_same_club boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table events add column if not exists match_duration_minutes integer not null default 18;
alter table events add column if not exists cover_photo_path text;
alter table events add column if not exists currency text not null default 'USD';
alter table events add column if not exists include_sponsors_in_earnings boolean not null default false;
alter table events add column if not exists visibility text not null default 'public';
alter table events drop constraint if exists events_visibility_check;
alter table events add constraint events_visibility_check check (visibility in ('public', 'private'));
alter table events add column if not exists share_token text unique;
alter table events add column if not exists randomizer_allow_same_club boolean not null default false;
alter table events add column if not exists court_type text;
alter table events drop constraint if exists events_court_type_check;
alter table events add constraint events_court_type_check check (court_type in ('indoor', 'outdoor', 'mixed'));
alter table events add column if not exists registration_open_date date;
alter table events add column if not exists registration_close_date date;
alter table events add column if not exists prize_pool text;
alter table events add column if not exists cancellation_policy text;
alter table events add column if not exists refund_policy text;
alter table events add column if not exists announcements text;

-- ----------------------------------------------------------------------------
-- EVENT STAFF  ("table committee" helper accounts, invited by the organizer
-- and scoped to one event each with their own per-feature on/off toggles —
-- distinct from admin-issued trial accounts in profiles.access_expires_at.
-- Many-to-many by design: one person can be invited onto several events,
-- each with an independent permission set, via the (event_id, user_id)
-- unique pair below.
-- ----------------------------------------------------------------------------
create table if not exists event_staff (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  -- "Operational" toggles — default on, since a helper is presumed to need
  -- them to actually run the event day-to-day.
  can_overview boolean not null default true,
  can_registrations boolean not null default true,
  can_checkin boolean not null default true,
  can_brackets boolean not null default true,
  can_matchlist boolean not null default true,
  can_preview boolean not null default true,
  can_umpires boolean not null default true,
  -- "Sensitive" toggles — default off; the organizer opts a helper into
  -- these explicitly rather than having to opt them out.
  can_redraw_brackets boolean not null default false,
  can_sponsors boolean not null default false,
  can_accounting boolean not null default false,
  can_settings boolean not null default false,
  can_edit_event boolean not null default false,
  -- null = permanent access (matches profiles.access_expires_at's existing
  -- convention). Set when the organizer issues a temporary login; cleared
  -- back to null by a plain email invite or an explicit "Make permanent".
  access_expires_at timestamptz,
  invited_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

alter table event_staff add column if not exists access_expires_at timestamptz;

create index if not exists event_staff_user_idx on event_staff (user_id);

alter table event_staff enable row level security;

-- Organizer manages their own event's staff list (invite/edit toggles/remove).
drop policy if exists "event_staff_owner_all" on event_staff;
create policy "event_staff_owner_all" on event_staff for all
  using (exists (select 1 from events e where e.id = event_staff.event_id and e.organizer_id = auth.uid()))
  with check (exists (select 1 from events e where e.id = event_staff.event_id and e.organizer_id = auth.uid()));

-- A staff member can read their own permission row (to know what they can
-- see) but never modify it — no with check, select only.
drop policy if exists "event_staff_select_self" on event_staff;
create policy "event_staff_select_self" on event_staff for select
  using (user_id = auth.uid());

-- Central permission check reused by every widened owner policy below.
-- 'member' just means "has some staff row on this event" (base access, e.g.
-- to see the event name/read categories) regardless of individual toggles.
--
-- This has to be security definer for the same reason is_admin_user() above
-- is: events' own select policy (right below) calls this function, and this
-- function reads event_staff, whose own owner-management policy (above)
-- reads events — that's a mutual cycle across two tables, which Postgres
-- rejects as recursive RLS evaluation exactly like a direct self-reference
-- would. A security-definer body reads event_staff with RLS bypassed,
-- breaking the cycle.
--
-- The access_expires_at check below is what actually enforces a temporary
-- login's validity window — every other table's RLS funnels through this
-- one function, so gating it here alone is sufficient everywhere (no other
-- policy needs to know about expiry). event_staff_owner_all/select_self are
-- deliberately NOT gated by this function — an expired helper still needs
-- to read their own row so the UI can explain why they're locked out.
create or replace function has_event_permission(p_event_id uuid, p_permission text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from event_staff s
    where s.event_id = p_event_id
      and s.user_id = auth.uid()
      and (s.access_expires_at is null or s.access_expires_at > now())
      and case p_permission
        when 'member' then true
        when 'overview' then s.can_overview
        when 'registrations' then s.can_registrations
        when 'checkin' then s.can_checkin
        when 'brackets' then s.can_brackets
        when 'redraw_brackets' then s.can_redraw_brackets
        when 'matchlist' then s.can_matchlist
        when 'preview' then s.can_preview
        when 'umpires' then s.can_umpires
        when 'sponsors' then s.can_sponsors
        when 'accounting' then s.can_accounting
        when 'settings' then s.can_settings
        when 'edit_event' then s.can_edit_event
        else false
      end
  );
$$;

revoke execute on function has_event_permission(uuid, text) from anon;

alter table events enable row level security;

drop policy if exists "events_select_public_or_owner" on events;
create policy "events_select_public_or_owner" on events for select
  using (is_published = true or auth.uid() = organizer_id or has_event_permission(id, 'member'));

-- Trial accounts (profiles.access_expires_at / max_events set by the admin
-- panel) are blocked from creating events past their expiry, or beyond
-- their event limit, at the database level — not just in the UI. Regular
-- accounts have both fields null, so the exists() below always matches for
-- them (no behavior change).
drop policy if exists "events_insert_owner" on events;
create policy "events_insert_owner" on events for insert
  with check (
    auth.uid() = organizer_id
    and exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and (p.access_expires_at is null or p.access_expires_at > now())
        and (
          p.max_events is null
          or (select count(*) from events ev where ev.organizer_id = auth.uid()) < p.max_events
        )
    )
  );

-- with check pins organizer_id to its existing value on every update. Without
-- this, Postgres reuses the using clause as the check by default — and since
-- that clause is itself "auth.uid() = organizer_id", a staff account with
-- only 'settings' or 'edit_event' could set organizer_id to their own id in
-- the same UPDATE and trivially satisfy that check, hijacking ownership of
-- the event. No feature transfers ownership today, so organizer_id is simply
-- immutable via this policy — even for the real owner.
drop policy if exists "events_update_owner" on events;
create policy "events_update_owner" on events for update
  using (auth.uid() = organizer_id or has_event_permission(id, 'settings') or has_event_permission(id, 'edit_event'))
  -- e2.id = events.id (not the bare "id") — see the identical note on
  -- profiles_update_own above; the unqualified form made this subquery
  -- return every row in the events table and broke every event update.
  with check (organizer_id = (select e2.organizer_id from events e2 where e2.id = events.id));

drop policy if exists "events_delete_owner" on events;
create policy "events_delete_owner" on events for delete
  using (auth.uid() = organizer_id);

-- ----------------------------------------------------------------------------
-- UMPIRES  (per-event officiating pool, organizer-managed)
-- ----------------------------------------------------------------------------
create table if not exists umpires (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table umpires enable row level security;

drop policy if exists "umpires_owner_all" on umpires;
create policy "umpires_owner_all" on umpires for all
  using (exists (select 1 from events e where e.id = umpires.event_id and (e.organizer_id = auth.uid() or has_event_permission(e.id, 'umpires'))))
  with check (exists (select 1 from events e where e.id = umpires.event_id and (e.organizer_id = auth.uid() or has_event_permission(e.id, 'umpires'))));

-- ----------------------------------------------------------------------------
-- CATEGORIES
-- ----------------------------------------------------------------------------
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  match_type text not null default 'Singles',
  format text not null default 'Round Robin',
  fee_amount numeric(10, 2) not null default 0,
  fee_currency text not null default 'USD',
  max_slots integer,
  prize_champion text,
  prize_runner_up text,
  prize_second_runner_up text,
  description text,
  image_path text,
  estimated_match_minutes integer,
  order_index integer not null default 0,
  -- Per-division eligibility criteria, distinct from events.* (which is
  -- tournament-wide). qualification is an organizer-defined list of
  -- {label, value} rows (DUPR requirement, age, gender, club/location
  -- restriction, prior-podium restriction, partner/team requirement, etc.)
  -- rendered as a checklist on the player-facing category detail view.
  qualification jsonb not null default '[]',
  qualification_notes text,
  disqualification_notes text,
  created_at timestamptz not null default now()
);

-- Additive columns for installs that ran an earlier version of this schema.
alter table categories add column if not exists description text;
alter table categories add column if not exists image_path text;
alter table categories add column if not exists estimated_match_minutes integer;
alter table categories add column if not exists qualification jsonb not null default '[]';
alter table categories add column if not exists qualification_notes text;
alter table categories add column if not exists disqualification_notes text;

alter table categories enable row level security;

drop policy if exists "categories_select_public_or_owner" on categories;
create policy "categories_select_public_or_owner" on categories for select
  using (
    exists (
      select 1 from events e
      where e.id = categories.event_id
        and (e.is_published = true or e.organizer_id = auth.uid() or has_event_permission(e.id, 'member'))
    )
  );

drop policy if exists "categories_write_owner" on categories;
create policy "categories_write_owner" on categories for all
  using (exists (select 1 from events e where e.id = categories.event_id and (e.organizer_id = auth.uid() or has_event_permission(e.id, 'edit_event'))))
  with check (exists (select 1 from events e where e.id = categories.event_id and (e.organizer_id = auth.uid() or has_event_permission(e.id, 'edit_event'))));

-- ----------------------------------------------------------------------------
-- PLAYOFF PLAN  (per category: how pool play feeds a knockout ladder)
-- Columns on categories, not a separate table — the plan is set at event-setup
-- time in the Categories step, so it inherits categories_write_owner's
-- 'edit_event' gate above, same as every other planning-time decision here.
-- No new RLS policies needed. Pool pairs are stored by LETTER, not bracket
-- id: the plan is written before any bracket row exists, and a Redraw
-- replaces every bracket id while pool letters stay stable.
-- ----------------------------------------------------------------------------
alter table categories add column if not exists playoff_enabled boolean not null default false;
alter table categories add column if not exists playoff_pool_count integer;
alter table categories add column if not exists playoff_advance_per_pool integer not null default 2;
alter table categories add column if not exists playoff_pool_pairs jsonb not null default '[]';
alter table categories add column if not exists playoff_third_place boolean not null default true;

-- ----------------------------------------------------------------------------
-- BRACKETS, TEAMS & MATCHES  (drawn by the randomizer from approved players)
-- ----------------------------------------------------------------------------
create table if not exists brackets (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  letter text not null,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

-- One extra 'playoff' bracket per category holds the whole knockout ladder
-- generated from the playoff plan above (letter='PO'). Pool brackets default
-- to kind='pool', so generateBrackets() (the Randomizer's save path) needs
-- no change at all.
alter table brackets add column if not exists kind text not null default 'pool';
alter table brackets drop constraint if exists brackets_kind_check;
alter table brackets add constraint brackets_kind_check check (kind in ('pool', 'playoff'));

alter table brackets enable row level security;

-- Deliberately gated on 'redraw_brackets', not 'brackets' — this is what
-- actually stops a staff account from redrawing: they can SELECT brackets
-- (via brackets_select_public_or_owner below, gated on plain membership)
-- but can never INSERT/DELETE here unless explicitly granted redraw rights.
-- Match-day scoring doesn't need this policy at all — it only writes to
-- matches, and the resulting win/loss/points update to teams happens via
-- apply_match_result()'s security-definer trigger, which bypasses RLS.
drop policy if exists "brackets_owner_all" on brackets;
create policy "brackets_owner_all" on brackets for all
  using (exists (select 1 from categories c join events e on e.id = c.event_id where c.id = brackets.category_id and (e.organizer_id = auth.uid() or has_event_permission(e.id, 'redraw_brackets'))))
  with check (exists (select 1 from categories c join events e on e.id = c.event_id where c.id = brackets.category_id and (e.organizer_id = auth.uid() or has_event_permission(e.id, 'redraw_brackets'))));

-- Anyone can read brackets for a published event (players checking their
-- own bracket assignment) — mirrors categories_select_public_or_owner.
drop policy if exists "brackets_select_public_or_owner" on brackets;
create policy "brackets_select_public_or_owner" on brackets for select
  using (
    exists (
      select 1 from categories c join events e on e.id = c.event_id
      where c.id = brackets.category_id and (e.is_published = true or e.organizer_id = auth.uid() or has_event_permission(e.id, 'member'))
    )
  );

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  bracket_id uuid not null references brackets(id) on delete cascade,
  registration_id uuid references registrations(id) on delete set null,
  player1_name text not null,
  player2_name text,
  club_name text,
  wins integer not null default 0,
  losses integer not null default 0,
  points_for integer not null default 0,
  points_against integer not null default 0,
  created_at timestamptz not null default now()
);

-- A playoff-stage team row is a FRESH row (wins/losses start at 0, not
-- inherited from pool play) chained back to the pool (or prior-stage) team
-- it advanced from. registration_id stays null on these rows on purpose —
-- getBracketAssignmentsForEvent() and playerApi's player-facing queries key
-- off registration_id, and would otherwise overwrite a player's pool badge/
-- record with their knockout one.
alter table teams add column if not exists source_team_id uuid references teams(id) on delete set null;
alter table teams add column if not exists seed_label text;
-- Deliberately NOT a partial index (no "where source_team_id is not null") —
-- Postgres won't let an upsert's ON CONFLICT target infer a partial index,
-- so generateStageMatches()'s upsert would fail with "no unique or exclusion
-- constraint matching the ON CONFLICT specification". A plain unique index
-- is safe here regardless: standard SQL treats every NULL as distinct from
-- every other NULL, so the many pool-team rows that never set source_team_id
-- never collide with each other under this constraint.
create unique index if not exists teams_bracket_source_uniq
  on teams (bracket_id, source_team_id);

alter table teams enable row level security;

-- Same redraw gate as brackets_owner_all above — staff never get direct
-- write access to teams either way (apply_match_result() writes wins/
-- losses/points for them via security definer, see matches below).
drop policy if exists "teams_owner_all" on teams;
create policy "teams_owner_all" on teams for all
  using (exists (select 1 from brackets b join categories c on c.id = b.category_id join events e on e.id = c.event_id where b.id = teams.bracket_id and (e.organizer_id = auth.uid() or has_event_permission(e.id, 'redraw_brackets'))))
  with check (exists (select 1 from brackets b join categories c on c.id = b.category_id join events e on e.id = c.event_id where b.id = teams.bracket_id and (e.organizer_id = auth.uid() or has_event_permission(e.id, 'redraw_brackets'))));

-- Anyone can read teams for a published event (players checking their own
-- W/L record) — mirrors categories_select_public_or_owner.
drop policy if exists "teams_select_public_or_owner" on teams;
create policy "teams_select_public_or_owner" on teams for select
  using (
    exists (
      select 1 from brackets b join categories c on c.id = b.category_id join events e on e.id = c.event_id
      where b.id = teams.bracket_id and (e.is_published = true or e.organizer_id = auth.uid() or has_event_permission(e.id, 'member'))
    )
  );

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  bracket_id uuid not null references brackets(id) on delete cascade,
  team_a_id uuid not null references teams(id) on delete cascade,
  team_b_id uuid not null references teams(id) on delete cascade,
  score_a integer,
  score_b integer,
  winner_team_id uuid references teams(id) on delete set null,
  court integer,
  umpire_name text,
  duration_minutes integer,
  status text not null default 'completed' check (status in ('scheduled', 'in_progress', 'completed', 'canceled')),
  started_at timestamptz,
  running_since timestamptz,
  accumulated_seconds integer not null default 0,
  match_code text,
  round_number integer,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

-- Additive columns + relaxed constraints for installs that ran an earlier
-- version of this schema, back when every match row was already-completed.
alter table matches add column if not exists status text not null default 'completed' check (status in ('scheduled', 'in_progress', 'completed', 'canceled'));
alter table matches add column if not exists started_at timestamptz;
alter table matches add column if not exists running_since timestamptz;
alter table matches add column if not exists accumulated_seconds integer not null default 0;
alter table matches add column if not exists match_code text;
alter table matches add column if not exists round_number integer;
-- Set on completion (finishMatch / recordScheduledMatchResult / recordMatch) so
-- the Preview Screen can order "recent winners" by actual completion time
-- instead of row-insertion time (created_at predates a scheduled match's play).
alter table matches add column if not exists finished_at timestamptz;

-- Which knockout level a match belongs to; null for every pool match.
alter table matches add column if not exists playoff_stage text;
alter table matches drop constraint if exists matches_playoff_stage_check;
alter table matches add constraint matches_playoff_stage_check
  check (playoff_stage is null or playoff_stage in ('quarterfinal', 'semifinal', 'third_place', 'final'));
alter table matches alter column score_a drop not null;
alter table matches alter column score_b drop not null;

-- Widen the status check for installs that created this table before the
-- Match List feature (auto-generated matches start out 'scheduled').
alter table matches drop constraint if exists matches_status_check;
alter table matches add constraint matches_status_check check (status in ('scheduled', 'in_progress', 'completed', 'canceled'));

alter table matches enable row level security;

-- Not gated on 'redraw_brackets' like brackets/teams — scoring a live match
-- only ever writes here, and win/loss/points propagate to teams via the
-- apply_match_result() security-definer trigger below regardless of the
-- scorer's own teams RLS grants.
drop policy if exists "matches_owner_all" on matches;
create policy "matches_owner_all" on matches for all
  using (exists (select 1 from brackets b join categories c on c.id = b.category_id join events e on e.id = c.event_id where b.id = matches.bracket_id and (e.organizer_id = auth.uid() or has_event_permission(e.id, 'brackets') or has_event_permission(e.id, 'matchlist'))))
  with check (exists (select 1 from brackets b join categories c on c.id = b.category_id join events e on e.id = c.event_id where b.id = matches.bracket_id and (e.organizer_id = auth.uid() or has_event_permission(e.id, 'brackets') or has_event_permission(e.id, 'matchlist'))));

-- Anyone can read matches for a published event (Preview Screen is a public
-- spectator display, viewable without signing in) — mirrors
-- teams_select_public_or_owner / brackets_select_public_or_owner.
drop policy if exists "matches_select_public_or_owner" on matches;
create policy "matches_select_public_or_owner" on matches for select
  using (
    exists (
      select 1 from brackets b join categories c on c.id = b.category_id join events e on e.id = c.event_id
      where b.id = matches.bracket_id and (e.is_published = true or e.organizer_id = auth.uid() or has_event_permission(e.id, 'member'))
    )
  );

-- Keep team win/loss/points in sync with a match's current result. Reverses
-- the previously-applied result first whenever this row was already
-- 'completed' before this update — covers both editing an already-completed
-- score (e.g. via MatchListPage's Log Score edit flow) and reverting a
-- completed match back to a non-completed status — then (re-)applies the new
-- result if the row is completed now. Without the reversal step, editing a
-- completed score silently left stale wins/losses/points behind, which the
-- playoff knockout stages depend on being correct to advance the right teams.
create or replace function apply_match_result()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.status = 'completed' then
    update teams set
      wins = wins - case when id = old.winner_team_id then 1 else 0 end,
      losses = losses - case when id = old.winner_team_id then 0 else 1 end,
      points_for = points_for - case when id = old.team_a_id then old.score_a else old.score_b end,
      points_against = points_against - case when id = old.team_a_id then old.score_b else old.score_a end
    where id in (old.team_a_id, old.team_b_id);
  end if;

  if new.status <> 'completed' then
    return new;
  end if;

  update teams set
    wins = wins + case when id = new.winner_team_id then 1 else 0 end,
    losses = losses + case when id = new.winner_team_id then 0 else 1 end,
    points_for = points_for + case when id = new.team_a_id then new.score_a else new.score_b end,
    points_against = points_against + case when id = new.team_a_id then new.score_b else new.score_a end
  where id in (new.team_a_id, new.team_b_id);
  return new;
end;
$$;

drop trigger if exists on_match_recorded on matches;
create trigger on_match_recorded
  after insert or update on matches
  for each row execute function apply_match_result();

-- ----------------------------------------------------------------------------
-- REGISTRATION FIELDS  (organizer-defined extra questions per event)
-- ----------------------------------------------------------------------------
create table if not exists registration_fields (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  label text not null,
  field_type text not null default 'text' check (field_type in ('text', 'url', 'file')),
  required boolean not null default false,
  order_index integer not null default 0
);

alter table registration_fields enable row level security;

drop policy if exists "reg_fields_select_public_or_owner" on registration_fields;
create policy "reg_fields_select_public_or_owner" on registration_fields for select
  using (
    exists (
      select 1 from events e
      where e.id = registration_fields.event_id
        and (e.is_published = true or e.organizer_id = auth.uid() or has_event_permission(e.id, 'member'))
    )
  );

drop policy if exists "reg_fields_write_owner" on registration_fields;
create policy "reg_fields_write_owner" on registration_fields for all
  using (exists (select 1 from events e where e.id = registration_fields.event_id and (e.organizer_id = auth.uid() or has_event_permission(e.id, 'edit_event'))))
  with check (exists (select 1 from events e where e.id = registration_fields.event_id and (e.organizer_id = auth.uid() or has_event_permission(e.id, 'edit_event'))));

-- ----------------------------------------------------------------------------
-- REGISTRATIONS  (player sign-ups — contains PII, kept private to the owner)
-- ----------------------------------------------------------------------------
create table if not exists registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  player_name text not null,
  player2_name text, -- set when the category's match type is a doubles format
  player_email text,
  phone text,
  address text,
  club_name text,
  question_to_organizer text,
  custom_field_values jsonb not null default '{}',
  photo_path text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied', 'waitlisted')),
  created_at timestamptz not null default now()
);

-- Additive columns for installs that ran an earlier version of this schema.
alter table registrations add column if not exists player2_name text;
alter table registrations add column if not exists phone text;
alter table registrations add column if not exists address text;
alter table registrations add column if not exists photo_path text;

-- Links a registration to the signed-in player who submitted it. Nullable —
-- anonymous registration remains fully supported; this only adds tracking
-- for players who choose to sign in.
alter table registrations add column if not exists player_id uuid references auth.users(id) on delete set null;

-- Event-day check-in (QR scan -> pick category -> pick name), set by an
-- anonymous player, not the organizer. Both null until scanned; a doubles
-- team needs both before it counts as "checked in".
alter table registrations add column if not exists player1_checked_in_at timestamptz;
alter table registrations add column if not exists player2_checked_in_at timestamptz;

-- Manual/bulk-imported registrations (organizer-entered) skip email for speed.
alter table registrations alter column player_email drop not null;

alter table registrations enable row level security;

-- Anyone can submit a registration to a published, open event. A signed-in
-- submitter may only attach their OWN id, never someone else's.
drop policy if exists "registrations_insert_public" on registrations;
create policy "registrations_insert_public" on registrations for insert
  with check (
    exists (select 1 from events e where e.id = registrations.event_id and e.is_published = true)
    and (player_id is null or player_id = auth.uid())
  );

-- Lets the organizer insert registrations directly (manual add + Excel
-- import) regardless of is_published — additive alongside the policy above
-- (permissive insert policies OR together).
drop policy if exists "registrations_insert_owner" on registrations;
create policy "registrations_insert_owner" on registrations for insert
  with check (exists (select 1 from events e where e.id = registrations.event_id and (e.organizer_id = auth.uid() or has_event_permission(e.id, 'registrations'))));

-- Only the organizer (or a staff member granted Registrations, Check-in, or
-- Brackets — Check-in needs the roster, Brackets reads it for the
-- randomizer) can read the player list (protects names/emails).
drop policy if exists "registrations_select_owner" on registrations;
create policy "registrations_select_owner" on registrations for select
  using (exists (select 1 from events e where e.id = registrations.event_id and (e.organizer_id = auth.uid() or has_event_permission(e.id, 'registrations') or has_event_permission(e.id, 'checkin') or has_event_permission(e.id, 'brackets'))));

-- A signed-in player can read their own registrations (player dashboard).
drop policy if exists "registrations_select_own_player" on registrations;
create policy "registrations_select_own_player" on registrations for select
  using (auth.uid() = player_id);

drop policy if exists "registrations_update_owner" on registrations;
create policy "registrations_update_owner" on registrations for update
  using (exists (select 1 from events e where e.id = registrations.event_id and (e.organizer_id = auth.uid() or has_event_permission(e.id, 'registrations') or has_event_permission(e.id, 'checkin'))));

drop policy if exists "registrations_delete_owner" on registrations;
create policy "registrations_delete_owner" on registrations for delete
  using (exists (select 1 from events e where e.id = registrations.event_id and (e.organizer_id = auth.uid() or has_event_permission(e.id, 'registrations'))));

-- Public (anonymous) event-day check-in. RLS is row-level only — without
-- narrowing anon's UPDATE grant down to just these two columns first, this
-- policy would let a crafted request rewrite player_name/status/etc. on any
-- matching row. anon's default table-wide UPDATE grant (from Supabase's
-- schema-level defaults) is revoked and re-granted for only the two
-- checked_in_at columns; this doesn't touch the `authenticated` role, so the
-- organizer's own registrations_update_owner policy is unaffected.
revoke update on registrations from anon;
grant update (player1_checked_in_at, player2_checked_in_at) on registrations to anon;

-- Postgres RLS requires a row to also satisfy an applicable SELECT policy
-- before an UPDATE can find/target it — an UPDATE policy's own USING clause
-- isn't sufficient on its own (confirmed via EXPLAIN against the live DB:
-- without this, the check-in UPDATE silently matched zero rows). anon's
-- default table-wide SELECT grant (also from Supabase's schema-level
-- defaults) is narrowed to only the columns public_checkin_roster already
-- exposes — email/phone/address/photo_path/etc. stay completely
-- inaccessible to anon at the column-privilege level, so this new policy
-- can't be turned into a PII leak via a raw REST request.
revoke select on registrations from anon;
grant select (id, event_id, category_id, player_name, player2_name, status, player1_checked_in_at, player2_checked_in_at) on registrations to anon;

-- SECURITY: both policies below are scoped `to anon` deliberately — this
-- pair exists only for the anonymous, no-login player self-check-in flow
-- (CheckInPage.jsx). A Postgres RLS policy with no `to <role>` clause
-- defaults to PUBLIC, i.e. every role including `authenticated` — without
-- `to anon` here, ANY signed-in user on the entire platform (any player, or
-- any staffer/expired-temporary-staffer of a totally unrelated event) could
-- read or check in every approved registration's full PII for every
-- published event, completely bypassing has_event_permission() and the
-- organizer_id checks on registrations_select_owner/_update_owner above.
-- Authenticated staff never needed these two policies anyway — checkin
-- permission already grants full access via registrations_select_owner /
-- registrations_update_owner.
drop policy if exists "registrations_public_checkin_select" on registrations;
create policy "registrations_public_checkin_select" on registrations for select
  to anon
  using (
    status = 'approved'
    and exists (select 1 from events e where e.id = registrations.event_id and e.is_published = true)
  );

drop policy if exists "registrations_public_checkin_update" on registrations;
create policy "registrations_public_checkin_update" on registrations for update
  to anon
  using (
    status = 'approved'
    and exists (select 1 from events e where e.id = registrations.event_id and e.is_published = true)
  )
  with check (
    status = 'approved'
    and exists (select 1 from events e where e.id = registrations.event_id and e.is_published = true)
  );

-- Public, PII-free slot counts per category (used on the public event page).
create or replace view public_category_counts as
select
  c.id as category_id,
  c.event_id,
  count(*) filter (where r.status in ('pending', 'approved')) as active_count,
  count(*) filter (where r.status = 'approved') as approved_count
from categories c
left join registrations r on r.category_id = c.id
group by c.id, c.event_id;

grant select on public_category_counts to anon, authenticated;

-- Public, PII-free roster for the check-in page's name search — deliberately
-- excludes email/phone/address/photo/custom fields; only what's needed to
-- find yourself in a list and see check-in status.
create or replace view public_checkin_roster as
select
  r.id,
  r.event_id,
  r.category_id,
  r.player_name,
  r.player2_name,
  r.player1_checked_in_at,
  r.player2_checked_in_at
from registrations r
join events e on e.id = r.event_id
where e.is_published = true and r.status = 'approved';

grant select on public_checkin_roster to anon, authenticated;

-- ----------------------------------------------------------------------------
-- ACTIVITY LOG  (organizer-facing feed; written by triggers, read by owner)
-- ----------------------------------------------------------------------------
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

alter table activity_log enable row level security;

drop policy if exists "activity_select_owner" on activity_log;
create policy "activity_select_owner" on activity_log for select
  using (exists (select 1 from events e where e.id = activity_log.event_id and (e.organizer_id = auth.uid() or has_event_permission(e.id, 'registrations'))));

create or replace function log_registration_activity()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  cat_name text;
begin
  select name into cat_name from categories where id = new.category_id;
  insert into activity_log (event_id, message)
  values (new.event_id, new.player_name || ' registered for ' || coalesce(cat_name, 'a category'));
  return new;
end;
$$;

drop trigger if exists on_registration_created on registrations;
create trigger on_registration_created
  after insert on registrations
  for each row execute function log_registration_activity();

create or replace function log_registration_status_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into activity_log (event_id, message)
    values (new.event_id, new.player_name || ' was ' ||
      case new.status
        when 'approved' then 'approved'
        when 'denied' then 'denied'
        when 'waitlisted' then 'moved to the waiting list'
        else new.status
      end);
  end if;
  return new;
end;
$$;

drop trigger if exists on_registration_status_change on registrations;
create trigger on_registration_status_change
  after update on registrations
  for each row execute function log_registration_status_change();

-- ----------------------------------------------------------------------------
-- SPONSORS  (shown on the Preview Screen; organizer-managed, never public)
-- ----------------------------------------------------------------------------
create table if not exists sponsors (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  tier text not null default 'bronze' check (tier in ('bronze', 'silver', 'gold', 'regular')),
  amount numeric(10, 2) not null default 0,
  logo_path text,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

-- Widen the tier check for installs that created this table before "regular"
-- (a no-medal tier) was added, mirroring the matches_status_check pattern.
alter table sponsors drop constraint if exists sponsors_tier_check;
alter table sponsors add constraint sponsors_tier_check check (tier in ('bronze', 'silver', 'gold', 'regular'));

alter table sponsors enable row level security;

-- Write access is gated on the Sponsors toggle specifically; a separate
-- base-membership select policy below keeps sponsor logos visible to any
-- staff member (e.g. whoever runs Preview) even without that toggle — no
-- sponsor wants their branding to vanish because the person running
-- check-in isn't the one managing sponsor contracts.
drop policy if exists "sponsors_owner_all" on sponsors;
create policy "sponsors_owner_all" on sponsors for all
  using (exists (select 1 from events e where e.id = sponsors.event_id and (e.organizer_id = auth.uid() or has_event_permission(e.id, 'sponsors'))))
  with check (exists (select 1 from events e where e.id = sponsors.event_id and (e.organizer_id = auth.uid() or has_event_permission(e.id, 'sponsors'))));

drop policy if exists "sponsors_select_staff_member" on sponsors;
create policy "sponsors_select_staff_member" on sponsors for select
  using (exists (select 1 from events e where e.id = sponsors.event_id and has_event_permission(e.id, 'member')));

-- The Preview Screen (PreviewDisplayPage, /events/:eventId/preview/:categoryId)
-- is deliberately public — spectators and players land on it with no session
-- at all straight from a QR/check-in flow, same as the venue TV itself. The
-- two policies above only ever match a signed-in organizer/staff member, so
-- without this, sponsor logos silently never rendered for the actual anonymous
-- audience that page exists for. Scoped to published events only, matching
-- every other spectator-facing table (categories/registrations/brackets/etc).
drop policy if exists "sponsors_select_public" on sponsors;
create policy "sponsors_select_public" on sponsors for select
  using (exists (select 1 from events e where e.id = sponsors.event_id and e.is_published = true));

-- ----------------------------------------------------------------------------
-- ACCOUNTING  (expenses + manual earnings; registration-fee earnings are
-- computed on the fly from categories.fee_amount x approved registrations,
-- not stored here)
-- ----------------------------------------------------------------------------
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  category text,
  amount numeric(10, 2) not null default 0,
  expense_date date not null default current_date,
  receipt_path text,
  notes text,
  created_at timestamptz not null default now()
);

alter table expenses enable row level security;

drop policy if exists "expenses_owner_all" on expenses;
create policy "expenses_owner_all" on expenses for all
  using (exists (select 1 from events e where e.id = expenses.event_id and (e.organizer_id = auth.uid() or has_event_permission(e.id, 'accounting'))))
  with check (exists (select 1 from events e where e.id = expenses.event_id and (e.organizer_id = auth.uid() or has_event_permission(e.id, 'accounting'))));

create table if not exists earnings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  amount numeric(10, 2) not null default 0,
  earning_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

alter table earnings enable row level security;

drop policy if exists "earnings_owner_all" on earnings;
create policy "earnings_owner_all" on earnings for all
  using (exists (select 1 from events e where e.id = earnings.event_id and (e.organizer_id = auth.uid() or has_event_permission(e.id, 'accounting'))))
  with check (exists (select 1 from events e where e.id = earnings.event_id and (e.organizer_id = auth.uid() or has_event_permission(e.id, 'accounting'))));

-- ----------------------------------------------------------------------------
-- STORAGE  (payment QR images + registration file uploads + receipts)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('event-media', 'event-media', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('registration-uploads', 'registration-uploads', false)
on conflict (id) do nothing;

-- Expense receipts: financial documents, kept private (unlike event-media)
-- since there's no reason for anyone but the organizer to ever see them.
insert into storage.buckets (id, name, public)
values ('event-receipts', 'event-receipts', false)
on conflict (id) do nothing;

drop policy if exists "event_receipts_owner_all" on storage.objects;
create policy "event_receipts_owner_all" on storage.objects for all
  using (
    bucket_id = 'event-receipts'
    and exists (
      select 1 from events e
      where e.id::text = (storage.foldername(storage.objects.name))[1]
        and (e.organizer_id = auth.uid() or has_event_permission(e.id, 'accounting'))
    )
  )
  with check (
    bucket_id = 'event-receipts'
    and exists (
      select 1 from events e
      where e.id::text = (storage.foldername(storage.objects.name))[1]
        and (e.organizer_id = auth.uid() or has_event_permission(e.id, 'accounting'))
    )
  );

-- event-media: public read; only the owning organizer can write, keyed by
-- objects stored under `${event_id}/...`.
drop policy if exists "event_media_public_read" on storage.objects;
create policy "event_media_public_read" on storage.objects for select
  using (bucket_id = 'event-media');

drop policy if exists "event_media_owner_write" on storage.objects;
create policy "event_media_owner_write" on storage.objects for insert
  with check (
    bucket_id = 'event-media'
    and exists (
      select 1 from events e
      where e.id::text = (storage.foldername(storage.objects.name))[1]
        and (e.organizer_id = auth.uid() or has_event_permission(e.id, 'sponsors') or has_event_permission(e.id, 'edit_event'))
    )
  );

drop policy if exists "event_media_owner_delete" on storage.objects;
create policy "event_media_owner_delete" on storage.objects for delete
  using (
    bucket_id = 'event-media'
    and exists (
      select 1 from events e
      where e.id::text = (storage.foldername(storage.objects.name))[1]
        and (e.organizer_id = auth.uid() or has_event_permission(e.id, 'sponsors') or has_event_permission(e.id, 'edit_event'))
    )
  );

-- registration-uploads: anyone can upload (players attaching proof-of-payment
-- etc. during registration); only the owning organizer can read/delete.
drop policy if exists "reg_uploads_public_insert" on storage.objects;
create policy "reg_uploads_public_insert" on storage.objects for insert
  with check (
    bucket_id = 'registration-uploads'
    and exists (
      select 1 from events e
      where e.id::text = (storage.foldername(storage.objects.name))[1]
        and e.is_published = true
    )
  );

drop policy if exists "reg_uploads_owner_read" on storage.objects;
create policy "reg_uploads_owner_read" on storage.objects for select
  using (
    bucket_id = 'registration-uploads'
    and exists (
      select 1 from events e
      where e.id::text = (storage.foldername(storage.objects.name))[1]
        and (e.organizer_id = auth.uid() or has_event_permission(e.id, 'registrations'))
    )
  );

drop policy if exists "reg_uploads_owner_delete" on storage.objects;
create policy "reg_uploads_owner_delete" on storage.objects for delete
  using (
    bucket_id = 'registration-uploads'
    and exists (
      select 1 from events e
      where e.id::text = (storage.foldername(storage.objects.name))[1]
        and (e.organizer_id = auth.uid() or has_event_permission(e.id, 'registrations'))
    )
  );

-- ----------------------------------------------------------------------------
-- EXPIRED TEMPORARY LOGIN CLEANUP
-- has_event_permission() already blocks an expired temporary helper from
-- doing anything the moment their window passes — this is purely about
-- reclaiming the storage afterward, on a schedule, rather than leaving
-- expired rows/accounts to accumulate forever.
-- ----------------------------------------------------------------------------
create extension if not exists pg_cron;

create or replace function cleanup_expired_event_staff()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- A temporary login is a single-purpose synthetic account (see
  -- generateUsername() client-side) — once its one event_staff row expires
  -- and it isn't an organizer or valid/staff anywhere else, deleting the
  -- auth.users row reclaims the whole account: profiles and every
  -- event_staff row for that user cascade-delete with it (both reference
  -- auth.users(id) on delete cascade).
  delete from auth.users u
  where exists (
    select 1 from event_staff s
    where s.user_id = u.id and s.access_expires_at is not null and s.access_expires_at < now()
  )
  and not exists (select 1 from events e where e.organizer_id = u.id)
  and not exists (
    select 1 from event_staff s2
    where s2.user_id = u.id and (s2.access_expires_at is null or s2.access_expires_at >= now())
  );

  -- Anyone who kept their account (an organizer, or still valid/staff
  -- elsewhere) just has the specific expired membership row dropped instead
  -- of their whole account.
  delete from event_staff where access_expires_at is not null and access_expires_at < now();
end;
$$;

select cron.unschedule('cleanup-expired-event-staff') where exists (select 1 from cron.job where jobname = 'cleanup-expired-event-staff');
select cron.schedule('cleanup-expired-event-staff', '0 * * * *', 'select cleanup_expired_event_staff();');

-- ----------------------------------------------------------------------------
-- EVENT PLAN TIERS  (self-declared by the organizer at event-setup time;
-- drives the category/player/court caps below and in the client). NOT tied
-- to subscription_requests.plan below — a human already reviews the payment
-- screenshot before approving a request, so there is no credit-ledger
-- binding one specific approval to one specific event. Keep these numbers
-- hand-synced with src/data/plans.js and the categories_insert_owner CASE
-- below — Postgres/edge functions can't import a JS module.
-- ----------------------------------------------------------------------------
alter table events add column if not exists plan text not null default 'free';
alter table events drop constraint if exists events_plan_check;
alter table events add constraint events_plan_check check (plan in ('free', 'starter', 'pro', 'business'));

-- ----------------------------------------------------------------------------
-- APP SETTINGS  (platform-wide, single row — currently just the one payment
-- QR image the product owner uploads once for the manual/QR subscription
-- flow below).
-- ----------------------------------------------------------------------------
create table if not exists app_settings (
  id boolean primary key default true,
  payment_qr_path text,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id)
);

insert into app_settings (id) values (true) on conflict (id) do nothing;

alter table app_settings enable row level security;

drop policy if exists "app_settings_select_public" on app_settings;
create policy "app_settings_select_public" on app_settings for select using (true);

drop policy if exists "app_settings_update_admin" on app_settings;
create policy "app_settings_update_admin" on app_settings for update
  using (is_admin_user())
  with check (is_admin_user());

-- ----------------------------------------------------------------------------
-- SUBSCRIPTION REQUESTS  (manual/QR payment flow — no Stripe. A prospective
-- customer picks a plan, is shown the platform's one payment QR from
-- app_settings, and submits their email + a screenshot proving payment, with
-- no account required. An admin reviews the screenshot from /admin/customers
-- and approves/rejects. Approving grants +1 to profiles.max_events on the
-- matching account (inviting the email if it has none yet) via the
-- approve-subscription-request edge function — see that file. The chosen
-- plan here is never written onto a specific event; the organizer separately
-- self-declares a plan per event (events.plan above) when they create it.
-- ----------------------------------------------------------------------------
create table if not exists subscription_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  plan text not null check (plan in ('starter', 'pro', 'business')),
  screenshot_path text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table subscription_requests enable row level security;

-- Pinning status/resolved_at here stops a crafted anonymous insert from
-- self-approving or backdating resolution — same defensive spirit as
-- registrations_insert_public's WITH CHECK elsewhere in this file.
drop policy if exists "subscription_requests_insert_public" on subscription_requests;
create policy "subscription_requests_insert_public" on subscription_requests for insert
  with check (status = 'pending' and resolved_at is null);

drop policy if exists "subscription_requests_select_admin" on subscription_requests;
create policy "subscription_requests_select_admin" on subscription_requests for select
  using (is_admin_user());

-- Covers the Reject action (a plain client-side update); Approve goes
-- through the service-role edge function instead since it also has to touch
-- auth.users/profiles, which this policy alone can't do.
drop policy if exists "subscription_requests_update_admin" on subscription_requests;
create policy "subscription_requests_update_admin" on subscription_requests for update
  using (is_admin_user())
  with check (is_admin_user());

-- ----------------------------------------------------------------------------
-- STORAGE  (subscription payment proofs + the platform payment QR)
-- ----------------------------------------------------------------------------

-- subscription-proofs: anonymous visitors upload their payment screenshot
-- when submitting a subscription request; only an admin can read it back.
-- Mirrors registration-uploads' public-insert/owner-read shape, but "owner"
-- here means is_admin_user() instead of the event's organizer, and there's
-- no event to scope the insert against (any visitor filling out the
-- subscribe form may upload one proof file to any path).
insert into storage.buckets (id, name, public)
values ('subscription-proofs', 'subscription-proofs', false)
on conflict (id) do nothing;

drop policy if exists "subscription_proofs_public_insert" on storage.objects;
create policy "subscription_proofs_public_insert" on storage.objects for insert
  with check (bucket_id = 'subscription-proofs');

drop policy if exists "subscription_proofs_admin_read" on storage.objects;
create policy "subscription_proofs_admin_read" on storage.objects for select
  using (bucket_id = 'subscription-proofs' and is_admin_user());

drop policy if exists "subscription_proofs_admin_delete" on storage.objects;
create policy "subscription_proofs_admin_delete" on storage.objects for delete
  using (bucket_id = 'subscription-proofs' and is_admin_user());

-- The platform payment QR lives in the existing public event-media bucket
-- (under a reserved 'platform/' path) so it's viewable by anonymous visitors
-- via the same event_media_public_read policy already in place — it just
-- needs its own admin-only write policy, since event_media_owner_write is
-- scoped to a real event's organizer/staff and 'platform' isn't a real event.
drop policy if exists "event_media_admin_write" on storage.objects;
create policy "event_media_admin_write" on storage.objects for insert
  with check (
    bucket_id = 'event-media'
    and (storage.foldername(storage.objects.name))[1] = 'platform'
    and is_admin_user()
  );

-- ----------------------------------------------------------------------------
-- CATEGORY CAP PER EVENT PLAN  (defense-in-depth, mirroring how
-- events_insert_owner above already enforces max_events at the DB level,
-- not just in the UI). categories_write_owner was a single "for all" policy
-- — Postgres OR's multiple permissive policies for the same command
-- together, so a second "for insert" policy alongside it would do nothing;
-- the original's WITH CHECK (which knows nothing about the cap) would still
-- let the insert through on its own. It has to be split into per-command
-- policies instead, the same way events_insert_owner/_update_owner/
-- _delete_owner already are split for the identical reason.
-- ----------------------------------------------------------------------------
drop policy if exists "categories_write_owner" on categories;

-- A raw "select count(*) from categories" inside a categories policy makes
-- Postgres re-evaluate categories' own SELECT policy while the INSERT policy
-- is still being evaluated, which Postgres's RLS planner always rejects as
-- "infinite recursion detected in policy for relation categories" — even
-- though the count query itself doesn't actually recurse. The fix is the
-- same one is_admin_user()/has_event_permission() already use elsewhere in
-- this file: do the self-referencing count in a security-definer function,
-- which runs with RLS bypassed and so never re-triggers categories' policies.
create or replace function category_count_for_event(p_event_id uuid)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::integer from categories where event_id = p_event_id;
$$;

drop policy if exists "categories_insert_owner" on categories;
create policy "categories_insert_owner" on categories for insert
  with check (
    exists (
      select 1 from events e
      where e.id = categories.event_id
        and (e.organizer_id = auth.uid() or has_event_permission(e.id, 'edit_event'))
        and (
          -- null (business tier) = unlimited; parenthesized explicitly per
          -- the operator-precedence warning already left twice in this file
          -- (profiles_update_own, events_update_owner) — "a and b is null or
          -- c" silently parses as "(a and b is null) or c", not what's meant.
          (case e.plan when 'free' then 1 when 'starter' then 5 when 'pro' then 10 else null end) is null
          or category_count_for_event(e.id)
             < (case e.plan when 'free' then 1 when 'starter' then 5 when 'pro' then 10 else null end)
        )
    )
  );

drop policy if exists "categories_update_owner" on categories;
create policy "categories_update_owner" on categories for update
  using (exists (select 1 from events e where e.id = categories.event_id and (e.organizer_id = auth.uid() or has_event_permission(e.id, 'edit_event'))))
  with check (exists (select 1 from events e where e.id = categories.event_id and (e.organizer_id = auth.uid() or has_event_permission(e.id, 'edit_event'))));

drop policy if exists "categories_delete_owner" on categories;
create policy "categories_delete_owner" on categories for delete
  using (exists (select 1 from events e where e.id = categories.event_id and (e.organizer_id = auth.uid() or has_event_permission(e.id, 'edit_event'))));

-- ----------------------------------------------------------------------------
-- PUBLIC EVENT DISCOVERY  (excludes trial-account organizers, so the public
-- "Browse tournaments" page and a player's dashboard only ever surface real
-- organizers' events, not test events created during an admin-issued trial).
-- events_select_published above already lets anyone SELECT a published
-- event row — this is a further narrowing on top of that, not a visibility
-- grant — but it needs profiles.access_expires_at, which a player/anonymous
-- visitor can't read directly (profiles_select_own restricts that table to
-- the row's own owner or an admin). A plain client-side join is therefore
-- impossible for non-admin callers; this has to run server-side as a
-- security-definer function, same reason as is_admin_user()/
-- has_event_permission() above.
-- ----------------------------------------------------------------------------
create or replace function public_published_events()
returns table (
  id uuid,
  slug text,
  name text,
  status text,
  cover_photo_path text,
  location_address text,
  start_date date,
  end_date date
)
language sql
security definer
set search_path = public
stable
as $$
  select e.id, e.slug, e.name, e.status, e.cover_photo_path, e.location_address, e.start_date, e.end_date
  from events e
  join profiles p on p.id = e.organizer_id
  where e.is_published = true
    and e.visibility = 'public'
    and e.status <> 'cancelled'
    and p.access_expires_at is null
  order by e.start_date asc nulls last;
$$;

grant execute on function public_published_events() to anon, authenticated;

-- ----------------------------------------------------------------------------
-- ORGANIZER SUBSCRIBED PLAN  (what an organizer is currently subscribed to,
-- set by approve-subscription-request on approval — see that file). Distinct
-- from events.plan: this is the account-level "current tier," while
-- events.plan is a per-event snapshot of this value taken at event-creation
-- time in src/data/eventsApi.js's createEvent(). Same enum as events.plan.
-- ----------------------------------------------------------------------------
alter table profiles add column if not exists plan text not null default 'free';
alter table profiles drop constraint if exists profiles_plan_check;
alter table profiles add constraint profiles_plan_check check (plan in ('free', 'starter', 'pro', 'business'));
