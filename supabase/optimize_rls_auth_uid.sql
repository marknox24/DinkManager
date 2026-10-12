-- Wraps auth.uid() as (select auth.uid()) in the RLS policies on the
-- organizer-scoring hot path (events, categories, brackets, teams, matches,
-- registrations). Same fix already proven in optimize_preview_snapshot.sql
-- (see that file's `(select auth.uid())` at the matching spot), just
-- applied to the regular table-level policies every other authenticated
-- query goes through, not only the one RPC.
--
-- WHY THIS MATTERS HERE SPECIFICALLY: a bare `auth.uid()` inside a USING/
-- WITH CHECK clause is a "volatile-looking" function call from Postgres'
-- planner's point of view, so it gets re-evaluated on every row a policy
-- scans. Wrapping it as `(select auth.uid())` turns it into a scalar
-- subquery the planner can hoist into an InitPlan and compute ONCE per
-- statement. For a single-row update (e.g. one match's score) this is
-- negligible. It stops being negligible on the organizer side: a "Finish
-- match" click reloads brackets/teams/matches/progress across an entire
-- category in one burst (11-26 queries per click, see MatchListPage.jsx /
-- BracketsPage.jsx), and BracketsPage's loadAllBracketDetails scans
-- teams+matches PER POOL BRACKET in a loop — so the per-row cost of an
-- unwrapped auth.uid() is paid many times over on exactly the queries that
-- already fire most often and in the largest bursts. Confirmed via grep:
-- auth.uid() appears 93 times across schema.sql, zero wrapped, before this
-- file.
--
-- SCOPE: only the policies on tables the live-scoring and check-in/
-- registration desk actually touch under load (events, categories,
-- brackets, teams, matches, registrations). Low-traffic tables (profiles,
-- event_staff, umpires, sponsors, expenses, earnings, activity_log,
-- subscription_requests, event_change_requests) are deliberately left
-- alone — same security semantics either way, just no capacity benefit
-- today, and every policy touched here is one more thing to review.
--
-- SAFE TO RUN ON THE LIVE DATABASE: `drop policy if exists` + `create
-- policy` is the same pattern schema.sql already uses everywhere, and a
-- `select auth.uid()` wrapper does not change what rows are
-- visible/writable, only when the comparison value is computed. No grants
-- are touched (drop/create policy doesn't affect table-level grants).
--
-- ROLLBACK: re-run the original policy definitions from schema.sql at the
-- line numbers noted in each comment below.

-- ---------------------------------------------------------------------------
-- EVENTS  (schema.sql:360-361, :411-412)
-- ---------------------------------------------------------------------------
drop policy if exists "events_select_public_or_owner" on events;
create policy "events_select_public_or_owner" on events for select
  using (is_published = true or (select auth.uid()) = organizer_id or has_event_permission(id, 'member') or is_admin_user());

-- ALTER POLICY, not drop+create: this policy's WITH CHECK clause is long
-- (a dozen-plus lines enforcing the plan/entitlement freeze and the 48h
-- post-event date/status lock — see schema.sql:416-444) and has no
-- auth.uid() reference to fix. Only USING needs to change, so this leaves
-- WITH CHECK completely untouched rather than risking a transcription
-- error retyping it.
alter policy "events_update_owner" on events
  using ((select auth.uid()) = organizer_id or has_event_permission(id, 'settings') or has_event_permission(id, 'edit_event'));

-- ---------------------------------------------------------------------------
-- CATEGORIES  (schema.sql:518-530)
-- ---------------------------------------------------------------------------
drop policy if exists "categories_select_public_or_owner" on categories;
create policy "categories_select_public_or_owner" on categories for select
  using (
    exists (
      select 1 from events e
      where e.id = categories.event_id
        and (e.is_published = true or e.organizer_id = (select auth.uid()) or has_event_permission(e.id, 'member'))
    )
  );

drop policy if exists "categories_write_owner" on categories;
create policy "categories_write_owner" on categories for all
  using (exists (select 1 from events e where e.id = categories.event_id and (e.organizer_id = (select auth.uid()) or has_event_permission(e.id, 'edit_event'))))
  with check (exists (select 1 from events e where e.id = categories.event_id and (e.organizer_id = (select auth.uid()) or has_event_permission(e.id, 'edit_event'))));

-- ---------------------------------------------------------------------------
-- BRACKETS  (schema.sql:579-591 + trailing "and ... status" clause)
-- ---------------------------------------------------------------------------
drop policy if exists "brackets_owner_all" on brackets;
create policy "brackets_owner_all" on brackets for all
  using (exists (select 1 from categories c join events e on e.id = c.event_id where c.id = brackets.category_id and (e.organizer_id = (select auth.uid()) or has_event_permission(e.id, 'redraw_brackets')) and e.status <> 'finished'))
  with check (exists (select 1 from categories c join events e on e.id = c.event_id where c.id = brackets.category_id and (e.organizer_id = (select auth.uid()) or has_event_permission(e.id, 'redraw_brackets')) and e.status <> 'finished'));

drop policy if exists "brackets_select_public_or_owner" on brackets;
create policy "brackets_select_public_or_owner" on brackets for select
  using (
    exists (
      select 1 from categories c join events e on e.id = c.event_id
      where c.id = brackets.category_id and (e.is_published = true or e.organizer_id = (select auth.uid()) or has_event_permission(e.id, 'member'))
    )
  );

-- ---------------------------------------------------------------------------
-- TEAMS  (schema.sql:634-646)
-- ---------------------------------------------------------------------------
drop policy if exists "teams_owner_all" on teams;
create policy "teams_owner_all" on teams for all
  using (exists (select 1 from brackets b join categories c on c.id = b.category_id join events e on e.id = c.event_id where b.id = teams.bracket_id and (e.organizer_id = (select auth.uid()) or has_event_permission(e.id, 'redraw_brackets')) and e.status <> 'finished'))
  with check (exists (select 1 from brackets b join categories c on c.id = b.category_id join events e on e.id = c.event_id where b.id = teams.bracket_id and (e.organizer_id = (select auth.uid()) or has_event_permission(e.id, 'redraw_brackets')) and e.status <> 'finished'));

drop policy if exists "teams_select_public_or_owner" on teams;
create policy "teams_select_public_or_owner" on teams for select
  using (
    exists (
      select 1 from brackets b join categories c on c.id = b.category_id join events e on e.id = c.event_id
      where b.id = teams.bracket_id and (e.is_published = true or e.organizer_id = (select auth.uid()) or has_event_permission(e.id, 'member'))
    )
  );

-- ---------------------------------------------------------------------------
-- MATCHES  (schema.sql:709-726) — the single highest-traffic table here:
-- written on every start/pause/resume/cancel/finish/score action.
-- ---------------------------------------------------------------------------
drop policy if exists "matches_owner_all" on matches;
create policy "matches_owner_all" on matches for all
  using (exists (select 1 from brackets b join categories c on c.id = b.category_id join events e on e.id = c.event_id where b.id = matches.bracket_id and (e.organizer_id = (select auth.uid()) or has_event_permission(e.id, 'brackets') or has_event_permission(e.id, 'matchlist')) and e.status <> 'finished'))
  with check (exists (select 1 from brackets b join categories c on c.id = b.category_id join events e on e.id = c.event_id where b.id = matches.bracket_id and (e.organizer_id = (select auth.uid()) or has_event_permission(e.id, 'brackets') or has_event_permission(e.id, 'matchlist')) and e.status <> 'finished'));

drop policy if exists "matches_select_public_or_owner" on matches;
create policy "matches_select_public_or_owner" on matches for select
  using (
    exists (
      select 1 from brackets b join categories c on c.id = b.category_id join events e on e.id = c.event_id
      where b.id = matches.bracket_id and (e.is_published = true or e.organizer_id = (select auth.uid()) or has_event_permission(e.id, 'member'))
    )
  );

-- ---------------------------------------------------------------------------
-- REGISTRATIONS  (schema.sql:1234-1255) — the check-in/registration desk's
-- hot path, a second concurrent load source on the same event day.
-- registrations_select_own_player (schema.sql:1246-1247, the player
-- dashboard's own-registrations read) is included too: same one-line fix,
-- zero extra risk, and with 1000 players potentially checking their own
-- registrations around the same event day it's worth the same treatment
-- even though it wasn't on the organizer-scoring path specifically.
-- ---------------------------------------------------------------------------
drop policy if exists "registrations_insert_owner" on registrations;
create policy "registrations_insert_owner" on registrations for insert
  with check (exists (select 1 from events e where e.id = registrations.event_id and (e.organizer_id = (select auth.uid()) or has_event_permission(e.id, 'registrations')) and e.status <> 'finished'));

drop policy if exists "registrations_select_owner" on registrations;
create policy "registrations_select_owner" on registrations for select
  using (exists (select 1 from events e where e.id = registrations.event_id and (e.organizer_id = (select auth.uid()) or has_event_permission(e.id, 'registrations') or has_event_permission(e.id, 'checkin') or has_event_permission(e.id, 'brackets'))));

drop policy if exists "registrations_select_own_player" on registrations;
create policy "registrations_select_own_player" on registrations for select
  using ((select auth.uid()) = player_id);

drop policy if exists "registrations_update_owner" on registrations;
create policy "registrations_update_owner" on registrations for update
  using (exists (select 1 from events e where e.id = registrations.event_id and (e.organizer_id = (select auth.uid()) or has_event_permission(e.id, 'registrations') or has_event_permission(e.id, 'checkin')) and e.status <> 'finished'));

drop policy if exists "registrations_delete_owner" on registrations;
create policy "registrations_delete_owner" on registrations for delete
  using (exists (select 1 from events e where e.id = registrations.event_id and (e.organizer_id = (select auth.uid()) or has_event_permission(e.id, 'registrations')) and e.status <> 'finished'));

-- ---------------------------------------------------------------------------
-- VERIFICATION (optional, run after the above)
-- ---------------------------------------------------------------------------
-- 1. Confirm every policy above now shows "(select auth.uid())" instead of
--    a bare "auth.uid()" in its definition:
--    select policyname, qual, with_check from pg_policies
--    where tablename in ('events','categories','brackets','teams','matches','registrations')
--    order by tablename, policyname;
--
-- 2. Behavior check (same rows visible/writable as before this file):
--    sign in as an organizer and confirm Match List, Brackets, and
--    Registrations still load and accept score updates normally; sign in
--    as a player and confirm the player dashboard still shows their own
--    registrations; load a public event page signed out and confirm
--    brackets/matches/teams still render for a published event.
