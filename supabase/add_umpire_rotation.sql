-- Run once in the Supabase SQL editor, BEFORE deploying the frontend that
-- ships with it: the Umpires page and the Start match window read
-- event_umpire_workload(). Both still work without it (no counts, no
-- recommendation), and it's safe to re-run. Mirrors the UMPIRE ROTATION
-- section of schema.sql, plus on_match_recorded, which a rename would
-- otherwise fire for every match the umpire officiated.
begin;

-- ----------------------------------------------------------------------------
-- UMPIRE ROTATION
-- ----------------------------------------------------------------------------
-- How many games each umpire has officiated, counted from the matches every
-- time rather than kept in a counter: a reopened match, an edited result or a
-- replacement umpire then needs nothing undone. A game counts once it's
-- completed and was actually played, credited to the umpire on the match at
-- that point. Forfeits keep the starting umpire's name but nobody officiated
-- a game, so they don't count. Mirrored by workloadFromMatches in
-- src/utils/umpireRotation.js, which the Match List uses offline.
create or replace function event_umpire_workload(p_event_id uuid)
returns table (umpire_name text, completed_count integer, last_finished_at timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select m.umpire_name, count(*)::integer, max(m.finished_at)
  from matches m
  join brackets b on b.id = m.bracket_id
  join categories c on c.id = b.category_id
  where c.event_id = p_event_id
    and m.status = 'completed'
    and m.result_type = 'played'
    and m.umpire_name is not null
  group by m.umpire_name
$$;
revoke all on function event_umpire_workload(uuid) from public, anon;
grant execute on function event_umpire_workload(uuid) to authenticated;

-- Matches store the umpire's name, so renaming an umpire carries their games
-- over to the new name instead of leaving them under one nobody has any more.
create or replace function rename_umpire_on_matches()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update matches m
  set umpire_name = new.name
  from brackets b
  join categories c on c.id = b.category_id
  where b.id = m.bracket_id
    and c.event_id = new.event_id
    and m.umpire_name = old.name;
  return new;
end;
$$;

drop trigger if exists umpires_rename_matches on umpires;
create trigger umpires_rename_matches
  after update of name on umpires
  for each row
  when (old.name is distinct from new.name)
  execute function rename_umpire_on_matches();


-- Only for writes to the columns it reads: an update that sets nothing else
-- (an umpire rename, a timer pause) can't change the result, so it shouldn't
-- reverse and reapply both teams' stats, or lock their rows to do it.
drop trigger if exists on_match_recorded on matches;
create trigger on_match_recorded
  after insert or update of status, score_a, score_b, winner_team_id, team_a_id, team_b_id on matches
  for each row execute function apply_match_result();

commit;
