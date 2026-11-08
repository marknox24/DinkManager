-- Run once in the Supabase SQL editor, BEFORE deploying the frontend that
-- ships with it: that frontend's Clear result button calls
-- sync_clear_result(). Safe the other way round, and safe to re-run. Mirrors
-- the CLEAR A RESULT section of schema.sql, plus sync_finish_match and
-- sync_log_score, which now also treat a clear as part of a match's history.
begin;

create or replace function stale_reason(p_newer_type text)
returns text
language sql
immutable
as $$
  select case when p_newer_type = 'clear_result'
    then 'This result was cleared on another device after it was saved here.'
    else 'A newer result from another device was kept' end
$$;

create or replace function sync_finish_match(
  p_operation_id uuid, p_device_id uuid, p_match_id uuid, p_client_ts timestamptz,
  p_score_a integer, p_score_b integer, p_winner_team_id uuid, p_duration_minutes integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row_count int;
  v_match matches;
  v_last_client_ts timestamptz;
  v_last_type text;
begin
  insert into sync_operations (operation_id, device_id, match_id, operation_type, client_ts)
  values (p_operation_id, p_device_id, p_match_id, 'finish', p_client_ts)
  on conflict (operation_id) do nothing;
  get diagnostics v_row_count = row_count;
  if v_row_count = 0 then
    select * into v_match from matches where id = p_match_id;
    return jsonb_build_object('status', 'noop_replay', 'match', to_jsonb(v_match));
  end if;

  if not can_edit_match(p_match_id) then
    raise exception 'not authorized to edit this match';
  end if;

  -- Two organizers can submit this match at the same moment. Taking the row
  -- first makes them take turns, so the check below sees the other's result
  -- and the newest one wins, whichever request happened to arrive last.
  perform 1 from matches where id = p_match_id for update;

  select client_ts, operation_type into v_last_client_ts, v_last_type
  from sync_operations
  where match_id = p_match_id and operation_type in ('finish', 'log_score', 'clear_result') and operation_id <> p_operation_id
  order by client_ts desc
  limit 1;

  if v_last_client_ts is not null and v_last_client_ts > p_client_ts then
    select * into v_match from matches where id = p_match_id;
    return jsonb_build_object('status', 'rejected_stale', 'match', to_jsonb(v_match), 'reason', stale_reason(v_last_type));
  end if;

  update matches
  set status = 'completed', result_type = 'played', auto_forfeit_team_id = null,
      score_a = p_score_a, score_b = p_score_b, winner_team_id = p_winner_team_id,
      duration_minutes = p_duration_minutes, running_since = null, finished_at = now()
  where id = p_match_id
  returning * into v_match;

  return jsonb_build_object('status', 'applied', 'match', to_jsonb(v_match));
end;
$$;
revoke all on function sync_finish_match(uuid, uuid, uuid, timestamptz, integer, integer, uuid, integer) from public, anon;
grant execute on function sync_finish_match(uuid, uuid, uuid, timestamptz, integer, integer, uuid, integer) to authenticated;

create or replace function sync_log_score(
  p_operation_id uuid, p_device_id uuid, p_match_id uuid, p_client_ts timestamptz,
  p_score_a integer, p_score_b integer, p_winner_team_id uuid, p_umpire_name text,
  p_result_type text default 'played'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row_count int;
  v_match matches;
  v_last_client_ts timestamptz;
  v_last_type text;
  v_score_a integer := p_score_a;
  v_score_b integer := p_score_b;
  v_winner uuid := p_winner_team_id;
begin
  insert into sync_operations (operation_id, device_id, match_id, operation_type, client_ts)
  values (p_operation_id, p_device_id, p_match_id, 'log_score', p_client_ts)
  on conflict (operation_id) do nothing;
  get diagnostics v_row_count = row_count;
  if v_row_count = 0 then
    select * into v_match from matches where id = p_match_id;
    return jsonb_build_object('status', 'noop_replay', 'match', to_jsonb(v_match));
  end if;

  if not can_edit_match(p_match_id) then
    raise exception 'not authorized to edit this match';
  end if;

  -- Two organizers can submit this match at the same moment. Taking the row
  -- first makes them take turns, so the check below sees the other's result
  -- and the newest one wins, whichever request happened to arrive last.
  perform 1 from matches where id = p_match_id for update;

  select client_ts, operation_type into v_last_client_ts, v_last_type
  from sync_operations
  where match_id = p_match_id and operation_type in ('finish', 'log_score', 'clear_result') and operation_id <> p_operation_id
  order by client_ts desc
  limit 1;

  if v_last_client_ts is not null and v_last_client_ts > p_client_ts then
    select * into v_match from matches where id = p_match_id;
    return jsonb_build_object('status', 'rejected_stale', 'match', to_jsonb(v_match), 'reason', stale_reason(v_last_type));
  end if;

  select * into v_match from matches where id = p_match_id;
  if p_result_type = 'forfeit' then
    if p_winner_team_id is null or p_winner_team_id not in (v_match.team_a_id, v_match.team_b_id) then
      raise exception 'A forfeit needs one of the two teams as its winner' using errcode = 'check_violation';
    end if;
    v_score_a := case when p_winner_team_id = v_match.team_a_id then forfeit_points() else 0 end;
    v_score_b := case when p_winner_team_id = v_match.team_b_id then forfeit_points() else 0 end;
  elsif p_result_type = 'double_forfeit' then
    v_score_a := 0;
    v_score_b := 0;
    v_winner := null;
  elsif p_result_type <> 'played' then
    raise exception 'Unknown result type' using errcode = 'check_violation';
  end if;

  update matches
  set status = 'completed', result_type = p_result_type, auto_forfeit_team_id = null,
      score_a = v_score_a, score_b = v_score_b, winner_team_id = v_winner,
      umpire_name = coalesce(p_umpire_name, umpire_name), running_since = null, finished_at = now()
  where id = p_match_id
  returning * into v_match;

  return jsonb_build_object('status', 'applied', 'match', to_jsonb(v_match));
end;
$$;
revoke all on function sync_log_score(uuid, uuid, uuid, timestamptz, integer, integer, uuid, text, text) from public, anon;
grant execute on function sync_log_score(uuid, uuid, uuid, timestamptz, integer, integer, uuid, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- CLEAR A RESULT
-- ----------------------------------------------------------------------------
-- Undoes a score logged by mistake: the match goes back to scheduled as if it
-- had never been played, and apply_match_result() takes the result back out of
-- both teams' standings. Edit score can't do this, since a result needs a
-- winner.
--
-- Takes part in the same newer-wins handling as sync_finish_match and
-- sync_log_score: an older result replayed from an offline device can't bring
-- back a match that was cleared after it, and an older clear can't wipe a
-- newer result.
--
-- Refused when something was already built on this result:
-- - a later knockout round drawn from it (Single Elimination or a playoff
--   stage);
-- - playoffs drawn from the pool it belongs to;
-- - a forfeit created by a withdrawal, which reinstate_team undoes instead.
create or replace function sync_clear_result(
  p_operation_id uuid, p_device_id uuid, p_match_id uuid, p_client_ts timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row_count int;
  v_match matches;
  v_bracket brackets;
  v_format text;
  v_last_client_ts timestamptz;
  v_last_type text;
  v_reason text;
begin
  insert into sync_operations (operation_id, device_id, match_id, operation_type, client_ts)
  values (p_operation_id, p_device_id, p_match_id, 'clear_result', p_client_ts)
  on conflict (operation_id) do nothing;
  get diagnostics v_row_count = row_count;
  if v_row_count = 0 then
    select * into v_match from matches where id = p_match_id;
    return jsonb_build_object('status', 'noop_replay', 'match', to_jsonb(v_match));
  end if;

  if not can_edit_match(p_match_id) then
    raise exception 'not authorized to edit this match';
  end if;

  select * into v_match from matches where id = p_match_id for update;

  select client_ts, operation_type into v_last_client_ts, v_last_type
  from sync_operations
  where match_id = p_match_id and operation_type in ('finish', 'log_score', 'clear_result') and operation_id <> p_operation_id
  order by client_ts desc
  limit 1;

  if v_last_client_ts is not null and v_last_client_ts > p_client_ts then
    return jsonb_build_object('status', 'rejected_stale', 'match', to_jsonb(v_match), 'reason', stale_reason(v_last_type));
  end if;

  select * into v_bracket from brackets where id = v_match.bracket_id;
  select format into v_format from categories where id = v_bracket.category_id;

  if v_match.status <> 'completed' then
    v_reason := 'This match has no result to clear.';
  elsif v_match.auto_forfeit_team_id is not null then
    v_reason := 'This forfeit came from a withdrawal. Reinstate the player on the Brackets page to undo it.';
  elsif (v_bracket.kind = 'playoff' or v_format ilike '%single elimination%')
    and exists (
      select 1 from matches o
      where o.bracket_id = v_match.bracket_id and o.id <> v_match.id
        and coalesce(o.round_number, 0) > coalesce(v_match.round_number, 0)
        and (o.team_a_id in (v_match.team_a_id, v_match.team_b_id) or o.team_b_id in (v_match.team_a_id, v_match.team_b_id))
    ) then
    v_reason := 'A later round was already drawn from this result.';
  elsif v_bracket.kind = 'pool' and v_format not ilike '%single elimination%'
    and exists (
      select 1 from matches o join brackets ob on ob.id = o.bracket_id
      where ob.category_id = v_bracket.category_id and ob.kind = 'playoff'
    ) then
    v_reason := 'Playoffs were already drawn from these pool results.';
  end if;

  if v_reason is not null then
    return jsonb_build_object('status', 'rejected_invalid_state', 'match', to_jsonb(v_match), 'reason', v_reason);
  end if;

  update matches
  set status = 'scheduled', result_type = 'played', auto_forfeit_team_id = null,
      score_a = null, score_b = null, winner_team_id = null, finished_at = null, duration_minutes = null,
      court = null, umpire_name = null, started_at = null, running_since = null, accumulated_seconds = 0
  where id = p_match_id
  returning * into v_match;

  return jsonb_build_object('status', 'applied', 'match', to_jsonb(v_match));
end;
$$;
revoke all on function sync_clear_result(uuid, uuid, uuid, timestamptz) from public, anon;
grant execute on function sync_clear_result(uuid, uuid, uuid, timestamptz) to authenticated;

commit;
