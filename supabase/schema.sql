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
  display_name text,
  club_name text,
  role text not null default 'organizer' check (role in ('organizer', 'player')),
  created_at timestamptz not null default now()
);

-- Backfills existing rows with 'organizer' via the column default — no
-- behavior change for current organizer accounts.
alter table profiles add column if not exists role text not null default 'organizer' check (role in ('organizer', 'player'));

alter table profiles enable row level security;

drop policy if exists "profiles_select_own" on profiles;
create policy "profiles_select_own" on profiles for select using (auth.uid() = id);

drop policy if exists "profiles_upsert_own" on profiles;
create policy "profiles_upsert_own" on profiles for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

-- Auto-create a profile row whenever someone signs up. Role comes from
-- signUp's options.data.role; defaults to 'organizer' so existing organizer
-- signup calls (which never pass role) are unaffected.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
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
  num_courts integer,
  match_duration_minutes integer not null default 18,
  payment_qr_path text,
  club_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table events add column if not exists match_duration_minutes integer not null default 18;

alter table events enable row level security;

drop policy if exists "events_select_public_or_owner" on events;
create policy "events_select_public_or_owner" on events for select
  using (is_published = true or auth.uid() = organizer_id);

drop policy if exists "events_insert_owner" on events;
create policy "events_insert_owner" on events for insert
  with check (auth.uid() = organizer_id);

drop policy if exists "events_update_owner" on events;
create policy "events_update_owner" on events for update
  using (auth.uid() = organizer_id);

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
  using (exists (select 1 from events e where e.id = umpires.event_id and e.organizer_id = auth.uid()))
  with check (exists (select 1 from events e where e.id = umpires.event_id and e.organizer_id = auth.uid()));

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
  created_at timestamptz not null default now()
);

-- Additive columns for installs that ran an earlier version of this schema.
alter table categories add column if not exists description text;
alter table categories add column if not exists image_path text;
alter table categories add column if not exists estimated_match_minutes integer;

alter table categories enable row level security;

drop policy if exists "categories_select_public_or_owner" on categories;
create policy "categories_select_public_or_owner" on categories for select
  using (
    exists (
      select 1 from events e
      where e.id = categories.event_id
        and (e.is_published = true or e.organizer_id = auth.uid())
    )
  );

drop policy if exists "categories_write_owner" on categories;
create policy "categories_write_owner" on categories for all
  using (exists (select 1 from events e where e.id = categories.event_id and e.organizer_id = auth.uid()))
  with check (exists (select 1 from events e where e.id = categories.event_id and e.organizer_id = auth.uid()));

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

alter table brackets enable row level security;

drop policy if exists "brackets_owner_all" on brackets;
create policy "brackets_owner_all" on brackets for all
  using (exists (select 1 from categories c join events e on e.id = c.event_id where c.id = brackets.category_id and e.organizer_id = auth.uid()))
  with check (exists (select 1 from categories c join events e on e.id = c.event_id where c.id = brackets.category_id and e.organizer_id = auth.uid()));

-- Anyone can read brackets for a published event (players checking their
-- own bracket assignment) — mirrors categories_select_public_or_owner.
drop policy if exists "brackets_select_public_or_owner" on brackets;
create policy "brackets_select_public_or_owner" on brackets for select
  using (
    exists (
      select 1 from categories c join events e on e.id = c.event_id
      where c.id = brackets.category_id and (e.is_published = true or e.organizer_id = auth.uid())
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

alter table teams enable row level security;

drop policy if exists "teams_owner_all" on teams;
create policy "teams_owner_all" on teams for all
  using (exists (select 1 from brackets b join categories c on c.id = b.category_id join events e on e.id = c.event_id where b.id = teams.bracket_id and e.organizer_id = auth.uid()))
  with check (exists (select 1 from brackets b join categories c on c.id = b.category_id join events e on e.id = c.event_id where b.id = teams.bracket_id and e.organizer_id = auth.uid()));

-- Anyone can read teams for a published event (players checking their own
-- W/L record) — mirrors categories_select_public_or_owner.
drop policy if exists "teams_select_public_or_owner" on teams;
create policy "teams_select_public_or_owner" on teams for select
  using (
    exists (
      select 1 from brackets b join categories c on c.id = b.category_id join events e on e.id = c.event_id
      where b.id = teams.bracket_id and (e.is_published = true or e.organizer_id = auth.uid())
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
alter table matches alter column score_a drop not null;
alter table matches alter column score_b drop not null;

-- Widen the status check for installs that created this table before the
-- Match List feature (auto-generated matches start out 'scheduled').
alter table matches drop constraint if exists matches_status_check;
alter table matches add constraint matches_status_check check (status in ('scheduled', 'in_progress', 'completed', 'canceled'));

alter table matches enable row level security;

drop policy if exists "matches_owner_all" on matches;
create policy "matches_owner_all" on matches for all
  using (exists (select 1 from brackets b join categories c on c.id = b.category_id join events e on e.id = c.event_id where b.id = matches.bracket_id and e.organizer_id = auth.uid()))
  with check (exists (select 1 from brackets b join categories c on c.id = b.category_id join events e on e.id = c.event_id where b.id = matches.bracket_id and e.organizer_id = auth.uid()));

-- Keep team win/loss/points in sync exactly once, the moment a match
-- transitions into 'completed' (whether inserted that way directly, or
-- updated from 'in_progress' after a live match is finished).
create or replace function apply_match_result()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status <> 'completed' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'completed' then
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
        and (e.is_published = true or e.organizer_id = auth.uid())
    )
  );

drop policy if exists "reg_fields_write_owner" on registration_fields;
create policy "reg_fields_write_owner" on registration_fields for all
  using (exists (select 1 from events e where e.id = registration_fields.event_id and e.organizer_id = auth.uid()))
  with check (exists (select 1 from events e where e.id = registration_fields.event_id and e.organizer_id = auth.uid()));

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
  with check (exists (select 1 from events e where e.id = registrations.event_id and e.organizer_id = auth.uid()));

-- Only the organizer can read the player list (protects names/emails).
drop policy if exists "registrations_select_owner" on registrations;
create policy "registrations_select_owner" on registrations for select
  using (exists (select 1 from events e where e.id = registrations.event_id and e.organizer_id = auth.uid()));

-- A signed-in player can read their own registrations (player dashboard).
drop policy if exists "registrations_select_own_player" on registrations;
create policy "registrations_select_own_player" on registrations for select
  using (auth.uid() = player_id);

drop policy if exists "registrations_update_owner" on registrations;
create policy "registrations_update_owner" on registrations for update
  using (exists (select 1 from events e where e.id = registrations.event_id and e.organizer_id = auth.uid()));

drop policy if exists "registrations_delete_owner" on registrations;
create policy "registrations_delete_owner" on registrations for delete
  using (exists (select 1 from events e where e.id = registrations.event_id and e.organizer_id = auth.uid()));

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
  using (exists (select 1 from events e where e.id = activity_log.event_id and e.organizer_id = auth.uid()));

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
-- STORAGE  (payment QR images + registration file uploads)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('event-media', 'event-media', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('registration-uploads', 'registration-uploads', false)
on conflict (id) do nothing;

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
      where e.id::text = (storage.foldername(name))[1]
        and e.organizer_id = auth.uid()
    )
  );

drop policy if exists "event_media_owner_delete" on storage.objects;
create policy "event_media_owner_delete" on storage.objects for delete
  using (
    bucket_id = 'event-media'
    and exists (
      select 1 from events e
      where e.id::text = (storage.foldername(name))[1]
        and e.organizer_id = auth.uid()
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
      where e.id::text = (storage.foldername(name))[1]
        and e.is_published = true
    )
  );

drop policy if exists "reg_uploads_owner_read" on storage.objects;
create policy "reg_uploads_owner_read" on storage.objects for select
  using (
    bucket_id = 'registration-uploads'
    and exists (
      select 1 from events e
      where e.id::text = (storage.foldername(name))[1]
        and e.organizer_id = auth.uid()
    )
  );

drop policy if exists "reg_uploads_owner_delete" on storage.objects;
create policy "reg_uploads_owner_delete" on storage.objects for delete
  using (
    bucket_id = 'registration-uploads'
    and exists (
      select 1 from events e
      where e.id::text = (storage.foldername(name))[1]
        and e.organizer_id = auth.uid()
    )
  );
