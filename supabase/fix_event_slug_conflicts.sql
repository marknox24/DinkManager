-- ============================================================================
-- Event slugs are made unique by the database, not the browser.
--
-- The app checked "is this slug free?" with a SELECT from the browser, but
-- RLS hides other organizers' unpublished events. Every new event starts as
-- "Untitled Tournament" → slug "untitled-tournament", so once ANY organizer
-- had an unpublished draft with that slug, every other organizer's "Start
-- your Free Trial event" failed with
--   duplicate key value violates unique constraint "events_slug_key".
-- Publishing a renamed draft (EventEditorPage) could hit the same thing.
--
-- This trigger runs as the table owner, so it sees every event. If the
-- requested slug is taken by another event it appends a short random
-- suffix (untitled-tournament-k3f9), the same shape the app already uses.
-- Safe to re-run.
-- ============================================================================

create or replace function events_unique_slug()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text := coalesce(nullif(new.slug, ''), 'event');
  v_try int := 0;
begin
  new.slug := v_base;
  while exists (select 1 from events where slug = new.slug and id <> new.id) loop
    v_try := v_try + 1;
    new.slug := v_base || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, case when v_try < 10 then 4 else 8 end);
  end loop;
  return new;
end;
$$;

drop trigger if exists events_unique_slug on events;
create trigger events_unique_slug
  before insert or update of slug on events
  for each row execute function events_unique_slug();

notify pgrst, 'reload schema';
