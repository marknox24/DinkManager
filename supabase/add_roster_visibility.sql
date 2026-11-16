-- Run once in the Supabase SQL editor, BEFORE deploying the frontend that
-- ships with it: the organizer's "Show registered players" switch saves
-- show_public_roster, and can't until this column exists. (The public page
-- treats a missing value as "on", so nothing breaks if the frontend goes
-- first; only the switch fails to save.) Safe to re-run. Mirrors the
-- public_event_roster section of schema.sql.
begin;

-- ----------------------------------------------------------------------------
-- ROSTER VISIBILITY
-- ----------------------------------------------------------------------------
-- The organizer's "Show registered players" switch (event Settings >
-- General). On by default, so existing events keep their Who's playing list.
-- Off, public_event_roster() returns nothing at all, so names are unreachable
-- rather than just hidden by the page.
alter table events add column if not exists show_public_roster boolean not null default true;

create or replace function public_event_roster(p_event_id uuid, p_category_id uuid default null)
returns table (
  id uuid,
  category_id uuid,
  player_name text,
  player2_name text,
  club_name text,
  status text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select r.id, r.category_id, r.player_name, r.player2_name, r.club_name, r.status, r.created_at
  from registrations r
  join events e on e.id = r.event_id
  where e.id = p_event_id
    and e.is_published = true
    and e.show_public_roster
    and r.status <> 'denied'
    and (p_category_id is null or r.category_id = p_category_id)
  order by r.created_at desc;
$$;

grant execute on function public_event_roster(uuid, uuid) to anon, authenticated;

commit;
