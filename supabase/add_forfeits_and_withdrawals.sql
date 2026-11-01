-- Run once in the Supabase SQL editor, BEFORE deploying the frontend that
-- ships with it: that frontend sends p_result_type to sync_log_score, so if
-- the frontend goes first, every "Log score" fails until this has run.
-- Safe the other way round, and safe to re-run. Mirrors the FORFEITS AND
-- WITHDRAWALS section of schema.sql, plus sync_finish_match's change.
begin;

-- ----------------------------------------------------------------------------
-- FORFEITS AND WITHDRAWALS
-- ----------------------------------------------------------------------------
-- Closes matches nobody will play, so a no-show can't stop a stage finishing.
-- status stays 'completed' for all of these, so everything that counts
-- finished matches works unchanged. apply_match_result() needs no special
-- case either: a null winner already gives both teams a loss and no win, and
-- a double forfeit's 0-0 adds no points.
--
-- A withdrawal keeps every played result exactly as scored; only the
-- player's remaining matches become forfeits.
alter table matches add column if not exists result_type text not null default 'played';
alter table matches drop constraint if exists matches_result_type_check;
alter table matches add constraint matches_result_type_check check (result_type in ('played', 'forfeit', 'double_forfeit'));
-- No matching "forfeit needs a winner" check: winner_team_id is on delete set
-- null, so deleting a team would violate it. sync_log_score validates that.
alter table matches drop constraint if exists matches_double_forfeit_no_winner_check;
alter table matches add constraint matches_double_forfeit_no_winner_check check (result_type <> 'double_forfeit' or winner_team_id is null);
-- The withdrawn team that caused this forfeit, which is how reinstate_team
-- tells it apart from a result an organizer entered by hand.
alter table matches add column if not exists auto_forfeit_team_id uuid references teams(id) on delete set null;
create index if not exists matches_auto_forfeit_team_id on matches (auto_forfeit_team_id) where auto_forfeit_team_id is not null;

alter table teams add column if not exists withdrawn_at timestamptz;

-- Mirrored by FORFEIT_POINTS in src/utils/forfeit.js.
create or replace function forfeit_points()
returns integer
language sql
immutable
as $$ select 11 $$;

-- Completes a scheduled match directly (Match List's "Log score" button), or
-- corrects an already-completed one (the edit-score pencil, same handler
-- online). Since this can legitimately re-complete an already-completed row,
-- it can't rely on a simple status guard the way start/pause/resume/cancel
-- do — instead it compares client_ts against the last finish/log_score
-- applied for this match: a newer edit from another device is accepted as a
-- correction, a stale/older one is rejected rather than clobbering a newer
-- result.
--
-- Also records forfeits, so they get the same offline replay and conflict
-- handling. A forfeit's score is set here rather than trusted from the
-- client. It can close a live match too, hence clearing running_since.
drop function if exists sync_log_score(uuid, uuid, uuid, timestamptz, integer, integer, uuid, text);
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
revoke all on function sync_log_score(uuid, uuid, uuid, timestamptz, integer, integer, uuid, text, text) from public, anon;
grant execute on function sync_log_score(uuid, uuid, uuid, timestamptz, integer, integer, uuid, text, text) to authenticated;

-- Same predicate as can_edit_match, for a team rather than a match.
create or replace function can_edit_team(p_team_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from teams t
    join brackets b on b.id = t.bracket_id
    join categories c on c.id = b.category_id
    join events e on e.id = c.event_id
    where t.id = p_team_id
      and (e.organizer_id = auth.uid() or has_event_permission(e.id, 'brackets') or has_event_permission(e.id, 'matchlist'))
      and e.status <> 'finished'
  );
$$;
revoke all on function can_edit_team(uuid) from public, anon;
grant execute on function can_edit_team(uuid) to authenticated;

-- A team's pool row and its playoff copy (teams.source_team_id) are the same
-- player, so withdrawing or reinstating always acts on both.
create or replace function linked_team_ids(p_team_id uuid)
returns uuid[]
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(array_agg(t.id), '{}')
  from teams t
  join teams root on root.id = p_team_id
  where t.id = coalesce(root.source_team_id, root.id) or t.source_team_id = coalesce(root.source_team_id, root.id);
$$;
revoke all on function linked_team_ids(uuid) from public, anon;
grant execute on function linked_team_ids(uuid) to authenticated;

-- Takes a player out of the tournament: marks them withdrawn and closes every
-- match they haven't finished as a forfeit to the opponent, or a double
-- forfeit if the opponent has withdrawn too. Returns the affected brackets so
-- the client can advance any Single Elimination bracket these results
-- unlocked. Online-only: this is a bulk action, not something to replay from
-- the offline queue.
create or replace function withdraw_team(p_team_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
  v_match matches;
  v_opponent uuid;
  v_winner uuid;
  v_closed integer := 0;
  v_brackets uuid[] := '{}';
begin
  if not can_edit_team(p_team_id) then
    raise exception 'You don''t have permission to withdraw this player' using errcode = '42501';
  end if;

  v_ids := linked_team_ids(p_team_id);
  update teams set withdrawn_at = now() where id = any(v_ids) and withdrawn_at is null;

  for v_match in
    select * from matches
    where status in ('scheduled', 'in_progress') and (team_a_id = any(v_ids) or team_b_id = any(v_ids))
    for update
  loop
    v_opponent := case when v_match.team_a_id = any(v_ids) then v_match.team_b_id else v_match.team_a_id end;
    select case when withdrawn_at is null then id end into v_winner from teams where id = v_opponent;

    update matches
    set status = 'completed',
        result_type = case when v_winner is null then 'double_forfeit' else 'forfeit' end,
        score_a = case when v_winner = team_a_id then forfeit_points() else 0 end,
        score_b = case when v_winner = team_b_id then forfeit_points() else 0 end,
        winner_team_id = v_winner,
        auto_forfeit_team_id = case when team_a_id = any(v_ids) then team_a_id else team_b_id end,
        running_since = null,
        finished_at = now()
    where id = v_match.id;

    v_closed := v_closed + 1;
    v_brackets := array_append(v_brackets, v_match.bracket_id);
  end loop;

  -- A bye recipient has no open match, but their bracket still needs advancing.
  select v_brackets || coalesce(array_agg(t.bracket_id), '{}') into v_brackets from teams t where t.id = any(v_ids);

  return jsonb_build_object('closed', v_closed, 'bracket_ids', to_jsonb(v_brackets));
end;
$$;
revoke all on function withdraw_team(uuid) from public, anon;
grant execute on function withdraw_team(uuid) to authenticated;

-- Undoes a mistaken withdrawal. Only touches forfeits withdraw_team created
-- (hand-entered results stay), and refuses once later results depend on the
-- withdrawal: playoffs seeded without this player, or a knockout round built
-- from their forfeit.
create or replace function reinstate_team(p_team_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
  v_category uuid;
  v_match matches;
  v_self uuid;
  v_opponent uuid;
  v_opponent_withdrawn boolean;
  v_reopened integer := 0;
begin
  if not can_edit_team(p_team_id) then
    raise exception 'You don''t have permission to reinstate this player' using errcode = '42501';
  end if;

  v_ids := linked_team_ids(p_team_id);
  select b.category_id into v_category from teams t join brackets b on b.id = t.bracket_id where t.id = p_team_id;

  if exists (select 1 from matches m join brackets b on b.id = m.bracket_id where b.category_id = v_category and b.kind = 'playoff')
    and (
      not exists (select 1 from teams t join brackets b on b.id = t.bracket_id where t.id = any(v_ids) and b.kind = 'playoff')
      or exists (select 1 from matches m join brackets b on b.id = m.bracket_id where m.auto_forfeit_team_id = any(v_ids) and b.kind = 'pool')
    ) then
    raise exception 'Playoffs have already been drawn from these results, so this player can''t be reinstated.' using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from matches m
    join brackets b on b.id = m.bracket_id
    join categories c on c.id = b.category_id
    where m.auto_forfeit_team_id = any(v_ids)
      and (b.kind = 'playoff' or c.format = 'Single Elimination')
      and exists (
        select 1 from matches later
        where later.bracket_id = m.bracket_id and later.round_number > m.round_number
          and (later.team_a_id in (m.team_a_id, m.team_b_id) or later.team_b_id in (m.team_a_id, m.team_b_id))
      )
  ) then
    raise exception 'A later round has already been built from this player''s forfeit, so they can''t be reinstated.' using errcode = 'check_violation';
  end if;

  update teams set withdrawn_at = null where id = any(v_ids);

  for v_match in select * from matches where auto_forfeit_team_id = any(v_ids) for update
  loop
    v_self := v_match.auto_forfeit_team_id;
    v_opponent := case when v_match.team_a_id = v_self then v_match.team_b_id else v_match.team_a_id end;
    select withdrawn_at is not null into v_opponent_withdrawn from teams where id = v_opponent;

    if v_opponent_withdrawn then
      -- The opponent left too, so this match still can't be played.
      update matches
      set result_type = 'forfeit',
          score_a = case when team_a_id = v_self then forfeit_points() else 0 end,
          score_b = case when team_b_id = v_self then forfeit_points() else 0 end,
          winner_team_id = v_self,
          auto_forfeit_team_id = v_opponent
      where id = v_match.id;
    else
      update matches
      set status = 'scheduled', result_type = 'played', auto_forfeit_team_id = null,
          score_a = null, score_b = null, winner_team_id = null, finished_at = null,
          court = null, umpire_name = null, started_at = null, running_since = null, accumulated_seconds = 0
      where id = v_match.id;
    end if;
    v_reopened := v_reopened + 1;
  end loop;

  return jsonb_build_object('reopened', v_reopened);
end;
$$;
revoke all on function reinstate_team(uuid) from public, anon;
grant execute on function reinstate_team(uuid) to authenticated;

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
