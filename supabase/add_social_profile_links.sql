-- Run once in the Supabase SQL editor, BEFORE deploying the frontend that
-- ships with it: the registration form saves player_social_url and
-- player2_social_url, so if the frontend goes first every sign-up fails until
-- this has run. Safe to re-run. Mirrors the SOCIAL PROFILE LINKS section of
-- schema.sql.
begin;

-- ----------------------------------------------------------------------------
-- SOCIAL PROFILE LINKS
-- ----------------------------------------------------------------------------
-- Each player's Facebook or other social media profile, so the organizer can
-- look into a player's history. Private like the rest of a registration:
-- public_event_roster() never returns them. player2_social_url is null for
-- singles. src/utils/socialProfile.js tidies and checks them on the form.
alter table registrations add column if not exists player_social_url text;
alter table registrations add column if not exists player2_social_url text;
alter table registrations drop constraint if exists registrations_social_url_length;
alter table registrations add constraint registrations_social_url_length
  check (char_length(coalesce(player_social_url, '')) <= 500 and char_length(coalesce(player2_social_url, '')) <= 500);
-- Only web links: the organizer opens these, and a javascript: or data: link
-- would run in their signed-in session.
alter table registrations drop constraint if exists registrations_social_url_web;
alter table registrations add constraint registrations_social_url_web
  check ((player_social_url is null or player_social_url ~* '^https?://') and (player2_social_url is null or player2_social_url ~* '^https?://'));

-- Event setting: players must give a link for every player on the entry.
alter table events add column if not exists require_social_profile boolean not null default false;

-- The form enforces the setting too, but it can be working from a cached copy
-- of the event that predates the switch, so this is the real gate for player
-- sign-ups. Organizers and registration staff adding entries themselves (manual
-- add, Excel import) aren't held to it: they may not have the links.
create or replace function enforce_social_profile_requirement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from events e
    where e.id = new.event_id and e.require_social_profile
      and e.organizer_id is distinct from auth.uid()
      and not has_event_permission(e.id, 'registrations')
  ) and (
    nullif(btrim(new.player_social_url), '') is null
    or (nullif(btrim(new.player2_name), '') is not null and nullif(btrim(new.player2_social_url), '') is null)
  ) then
    raise exception 'This event asks for a public Facebook or social media profile link for each player.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists registrations_require_social_profile on registrations;
create trigger registrations_require_social_profile
  before insert on registrations
  for each row execute function enforce_social_profile_requirement();

commit;
