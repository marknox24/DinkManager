-- Run this AFTER supabase/optimize_rls_auth_uid.sql to confirm it actually
-- applied cleanly. Paste into the Supabase SQL editor and run — it returns
-- rows only for problems; an empty result set means every targeted policy
-- is wrapped correctly.

-- 1. The real check: any policy on the six target tables that STILL has a
--    bare auth.uid() (not wrapped in a subquery) in its USING or WITH CHECK
--    clause. pg_policies' qual/with_check columns come back as the
--    compiled expression, so a bare call shows as "auth.uid()" with no
--    "( SELECT" immediately before it — an easy substring match for an
--    already-wrapped one is "(SELECT auth.uid()" (note: Postgres uppercases
--    SELECT when it reprints the expression, so match case-insensitively).
select
  tablename,
  policyname,
  cmd,
  case when qual ~* 'auth\.uid\(\)' and qual !~* '\(\s*select\s+auth\.uid\(\)' then 'unwrapped in USING' end as using_issue,
  case when with_check ~* 'auth\.uid\(\)' and with_check !~* '\(\s*select\s+auth\.uid\(\)' then 'unwrapped in WITH CHECK' end as check_issue
from pg_policies
where tablename in ('events', 'categories', 'brackets', 'teams', 'matches', 'registrations')
  and (
    (qual ~* 'auth\.uid\(\)' and qual !~* '\(\s*select\s+auth\.uid\(\)')
    or (with_check ~* 'auth\.uid\(\)' and with_check !~* '\(\s*select\s+auth\.uid\(\)')
  );

-- 2. Sanity list: every policy the migration touched, so you can eyeball
--    the full "before vs after" expression if the check above isn't empty,
--    or just confirm the full set looks right even if it is.
select tablename, policyname, cmd, qual, with_check
from pg_policies
where tablename in ('events', 'categories', 'brackets', 'teams', 'matches', 'registrations')
  and policyname in (
    'events_select_public_or_owner', 'events_update_owner',
    'categories_select_public_or_owner', 'categories_write_owner',
    'brackets_owner_all', 'brackets_select_public_or_owner',
    'teams_owner_all', 'teams_select_public_or_owner',
    'matches_owner_all', 'matches_select_public_or_owner',
    'registrations_insert_owner', 'registrations_select_owner',
    'registrations_select_own_player', 'registrations_update_owner', 'registrations_delete_owner'
  )
order by tablename, policyname;

-- 3. Behavior smoke test — not SQL to run, but the three things to click
--    through in the app afterward (no query can substitute for this):
--    a. Sign in as an organizer -> Match List -> log a score. Should work
--       exactly as before (same permission, now computed once not per row).
--    b. Sign in as a player -> Player Dashboard. Should still show only
--       that player's own registrations.
--    c. Open a published event's public page signed OUT. Brackets/matches/
--       teams should still render.
