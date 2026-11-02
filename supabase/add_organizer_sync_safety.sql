-- Run once in the Supabase SQL editor, BEFORE deploying the frontend that
-- ships with it: that frontend's Generate and bracket advancement rely on the
-- two unique indexes below, and fail until they exist. Safe the other way
-- round, and safe to re-run. If an index can't be created because duplicates
-- already exist, the whole script stops and changes nothing.
begin;

-- See the comment on these in schema.sql.
create unique index if not exists matches_bracket_code_uniq on matches (bracket_id, match_code);
create unique index if not exists brackets_category_letter_uniq on brackets (category_id, letter);

create or replace function sync_start_match(
  p_operation_id uuid, p_device_id uuid, p_match_id uuid, p_client_ts timestamptz,
  p_court integer, p_umpire_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row_count int;
  v_match matches;
  v_event uuid;
begin
  insert into sync_operations (operation_id, device_id, match_id, operation_type, client_ts)
  values (p_operation_id, p_device_id, p_match_id, 'start', p_client_ts)
  on conflict (operation_id) do nothing;
  get diagnostics v_row_count = row_count;
  if v_row_count = 0 then
    select * into v_match from matches where id = p_match_id;
    return jsonb_build_object('status', 'noop_replay', 'match', to_jsonb(v_match));
  end if;

  if not can_edit_match(p_match_id) then
    raise exception 'not authorized to edit this match';
  end if;

  -- Courts are picked from a list on each organizer's own screen, so two of
  -- them can choose the same free court at the same moment. The lock makes
  -- those two take turns, so the second one sees the first one's match.
  if p_court is not null then
    select c.event_id into v_event
    from matches m join brackets b on b.id = m.bracket_id join categories c on c.id = b.category_id
    where m.id = p_match_id;

    perform pg_advisory_xact_lock(hashtextextended('court:' || v_event || ':' || p_court, 0));

    if exists (
      select 1 from matches m join brackets b on b.id = m.bracket_id join categories c on c.id = b.category_id
      where c.event_id = v_event and m.court = p_court and m.status = 'in_progress' and m.id <> p_match_id
    ) then
      select * into v_match from matches where id = p_match_id;
      return jsonb_build_object('status', 'rejected_invalid_state', 'match', to_jsonb(v_match), 'reason', 'Court ' || p_court || ' is already in use — pick another court.');
    end if;
  end if;

  update matches
  set status = 'in_progress', started_at = now(), running_since = now(), accumulated_seconds = 0,
      court = p_court, umpire_name = p_umpire_name
  where id = p_match_id and status = 'scheduled'
  returning * into v_match;

  if v_match.id is null then
    select * into v_match from matches where id = p_match_id;
    return jsonb_build_object('status', 'rejected_invalid_state', 'match', to_jsonb(v_match));
  end if;

  return jsonb_build_object('status', 'applied', 'match', to_jsonb(v_match));
end;
$$;

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

  select max(client_ts) into v_last_client_ts
  from sync_operations
  where match_id = p_match_id and operation_type in ('finish', 'log_score') and operation_id <> p_operation_id;

  if v_last_client_ts is not null and v_last_client_ts > p_client_ts then
    select * into v_match from matches where id = p_match_id;
    return jsonb_build_object('status', 'rejected_stale', 'match', to_jsonb(v_match), 'reason', 'A newer result from another device was kept');
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

  select max(client_ts) into v_last_client_ts
  from sync_operations
  where match_id = p_match_id and operation_type in ('finish', 'log_score') and operation_id <> p_operation_id;

  if v_last_client_ts is not null and v_last_client_ts > p_client_ts then
    select * into v_match from matches where id = p_match_id;
    return jsonb_build_object('status', 'rejected_stale', 'match', to_jsonb(v_match), 'reason', 'A newer result from another device was kept');
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

commit;
