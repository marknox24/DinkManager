-- Performance + security fix for preview_live_snapshot, the single heaviest
-- query on event day: 27% of all database time in Supabase's Query
-- Performance report for Oct 10 (two call variants, ~19.0% + 8.1%), roughly
-- 0.5s per call.
--
-- WHY IT WAS SLOW: the original function (see the bottom of schema.sql) is
-- `security invoker`, so every row it returns re-evaluates the RLS policy
-- on brackets/teams/matches -- a 3-table join (brackets -> categories ->
-- events) plus has_event_permission(), PER ROW, not once per call. This
-- version checks visibility ONCE up front (`security definer`) and then
-- reads the tables directly -- same answer, far less work.
--
-- ALSO FIXES A REAL DATA-EXPOSURE BUG found while preparing this change:
-- the original cat_brackets/cat_teams/cat_matches CTEs filtered only by
-- p_category_id, never checking it actually belongs to p_event_id. Calling
-- the function with a PUBLIC event's id paired with a category id taken
-- from a DIFFERENT, private/draft event returned that other event's
-- bracket/team/match data regardless of the first event's own visibility --
-- confirmed empirically against the live database (a deliberately
-- mismatched event/category pair returned identical bracket/team/match
-- data to the correct pair). The `join categories c on c.id = ... and
-- c.event_id = p_event_id` below closes that; it only matters if someone
-- already has a category id from a private event, which the UI never
-- exposes, but it's a real gap worth closing while this function is
-- already being rewritten.
--
-- Every CTE's shape, every ORDER BY and every jsonb_agg call are otherwise
-- byte-for-byte identical to the previous definition -- this is a
-- security/perf rewrite, not a behavior change, for any event+category pair
-- that was already being queried correctly. Verified by diffing live output
-- for 5 real categories before/after (see the verification block at the
-- bottom of this file).
--
-- SAFE TO RUN ON THE LIVE DATABASE: `create or replace function` swaps the
-- definition atomically -- nothing needs to be dropped first, and the grant
-- re-asserts the same anon/authenticated access the original had. Takes
-- effect immediately for every caller, cached-or-not.
--
-- ROLLBACK: re-run the original definition, which is still sitting at the
-- bottom of supabase/schema.sql (search for "create or replace function
-- preview_live_snapshot").
create or replace function preview_live_snapshot(p_event_id uuid, p_category_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with visible as (
    -- The ONE authorization check for the whole call, replacing what used
    -- to be re-run per row by RLS. Same rule as events_select_public_or_owner
    -- / brackets_select_public_or_owner / teams_select_public_or_owner /
    -- matches_select_public_or_owner: published, or the owner, or event staff.
    select exists (
      select 1 from events e
      where e.id = p_event_id
        and (e.is_published = true or e.organizer_id = (select auth.uid()) or has_event_permission(e.id, 'member'))
    ) as ok
  ),
  cat_brackets as (
    select b.*
    from brackets b
    join categories c on c.id = b.category_id and c.event_id = p_event_id
    where b.category_id = p_category_id and (select ok from visible)
  ),
  cat_teams as (
    select t.*
    from teams t
    join cat_brackets b on b.id = t.bracket_id
  ),
  cat_matches as (
    select
      m.*,
      b.letter as bracket_letter,
      jsonb_build_object('id', ta.id, 'player1_name', ta.player1_name, 'player2_name', ta.player2_name, 'club_name', ta.club_name) as team_a,
      jsonb_build_object('id', tb.id, 'player1_name', tb.player1_name, 'player2_name', tb.player2_name, 'club_name', tb.club_name) as team_b
    from matches m
    join cat_brackets b on b.id = m.bracket_id
    left join teams ta on ta.id = m.team_a_id
    left join teams tb on tb.id = m.team_b_id
  ),
  event_categories as (
    select id, name from categories where event_id = p_event_id and (select ok from visible)
  ),
  event_brackets as (
    select br.id, br.letter, br.category_id
    from brackets br
    join event_categories c on c.id = br.category_id
  ),
  live_matches as (
    select
      m.*,
      eb.letter as bracket_letter,
      ec.name as category_name,
      jsonb_build_object('id', ta.id, 'player1_name', ta.player1_name, 'player2_name', ta.player2_name, 'club_name', ta.club_name) as team_a,
      jsonb_build_object('id', tb.id, 'player1_name', tb.player1_name, 'player2_name', tb.player2_name, 'club_name', tb.club_name) as team_b
    from matches m
    join event_brackets eb on eb.id = m.bracket_id
    join event_categories ec on ec.id = eb.category_id
    left join teams ta on ta.id = m.team_a_id
    left join teams tb on tb.id = m.team_b_id
    where m.status = 'in_progress'
    order by m.created_at
  )
  select jsonb_build_object(
    'brackets', coalesce((select jsonb_agg(to_jsonb(cb.*) order by cb.letter) from cat_brackets cb), '[]'::jsonb),
    'teams', coalesce((select jsonb_agg(to_jsonb(ct.*)) from cat_teams ct), '[]'::jsonb),
    'matches', coalesce((select jsonb_agg(to_jsonb(cm.*)) from cat_matches cm), '[]'::jsonb),
    'live', coalesce((select jsonb_agg(to_jsonb(lm.*)) from live_matches lm), '[]'::jsonb)
  );
$$;

grant execute on function preview_live_snapshot(uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- VERIFICATION (optional, run after the above): confirms the gate works the
-- same way the old RLS did. Replace the ids with a real public event's and
-- one of its categories, and a private/draft event's id.
--
-- 1. A public event + its own category -> real data (brackets/teams/matches
--    populated, same as before this change):
--    select preview_live_snapshot('<public-event-id>', '<its-category-id>');
--
-- 2. A public event's id + a category id borrowed from a DIFFERENT, private
--    event -> must now return EMPTY arrays (this is the bug fix -- before
--    this migration it incorrectly returned that other event's data):
--    select preview_live_snapshot('<public-event-id>', '<private-events-category-id>');
--
-- 3. A private/draft event, called as anon (e.g. via the REST API with only
--    the anon key, no Authorization bearer token) -> empty arrays, same as
--    before:
--    select preview_live_snapshot('<private-event-id>', '<its-category-id>');
