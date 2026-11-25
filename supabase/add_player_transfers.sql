-- Run once in the Supabase SQL editor, BEFORE deploying the frontend that
-- ships with it: the Transfers page and the Transfer category action call
-- transfer_registration() and read team_transfers. Safe to re-run. Mirrors
-- the PLAYER TRANSFERS section of schema.sql.
begin;

-- ----------------------------------------------------------------------------
-- PLAYER TRANSFERS
-- ----------------------------------------------------------------------------
-- Moves an approved registration (a singles player or a doubles pair) to
-- another category on event day, typically a sandbagger found after the
-- brackets and matchlist exist. The organizer always picks the destination
-- category; only the bracket inside it may be random (picked client-side and
-- shown before confirming).
--
-- Nothing already scheduled is rebuilt: the old pool team is withdrawn
-- (withdraw_team: unplayed matches become walkovers, finished ones keep their
-- scores), and only the transferred player's own matches are appended to the
-- destination bracket, with codes after its highest one and rounds after the
-- category's last round. One function call, one transaction: a failure
-- anywhere leaves nothing half-moved.
-- ----------------------------------------------------------------------------
create table if not exists team_transfers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  registration_id uuid references registrations(id) on delete set null,
  player_label text not null,
  from_category_id uuid references categories(id) on delete set null,
  from_category text,
  from_bracket text,
  from_team_id uuid references teams(id) on delete set null,
  to_category_id uuid references categories(id) on delete set null,
  to_category text,
  to_bracket text,
  to_team_id uuid references teams(id) on delete set null,
  assignment text not null check (assignment in ('manual', 'random', 'undrawn')),
  walkovers integer not null default 0,
  reason text,
  sheet_status text not null default 'pending' check (sheet_status in ('pending', 'prepared', 'ready')),
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  created_at timestamptz not null default now()
);

create index if not exists team_transfers_event_idx on team_transfers (event_id, created_at desc);

alter table team_transfers enable row level security;

-- Written only by the security-definer functions below — no write policies.
drop policy if exists "team_transfers_select_staff" on team_transfers;
create policy "team_transfers_select_staff" on team_transfers for select
  using (exists (
    select 1 from events e
    where e.id = team_transfers.event_id
      and (e.organizer_id = (select auth.uid())
        or has_event_permission(e.id, 'registrations')
        or has_event_permission(e.id, 'brackets')
        or has_event_permission(e.id, 'matchlist'))
  ));

-- The TRANSFERRED badge. transferred_from / transferred_to are display text
-- ("Men's Beginner · Bracket A"), so the badge survives category renames.
alter table teams add column if not exists transferred_in_at timestamptz;
alter table teams add column if not exists transferred_from text;
alter table teams add column if not exists transferred_out_at timestamptz;
alter table teams add column if not exists transferred_to text;

-- Set on the matches a transfer added, which need hand-made score sheets.
alter table matches add column if not exists transfer_id uuid references team_transfers(id) on delete set null;
create index if not exists matches_transfer_idx on matches (transfer_id) where transfer_id is not null;

-- p_to_bracket_id: required when the destination has pool brackets, null when
-- it hasn't been drawn yet (the player then simply joins the draw).
-- p_assignment: 'manual' or 'random', for the log only.
-- p_fixtures: [{"opponent_team_id": ..., "side": "a"|"b"}], the new team's
-- matches as planned client-side (planTransferFixtures). Ignored while the
-- destination has no matchlist yet: generating it later includes them.
create or replace function transfer_registration(
  p_registration_id uuid,
  p_to_category_id uuid,
  p_to_bracket_id uuid default null,
  p_assignment text default 'manual',
  p_fixtures jsonb default '[]'::jsonb,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg registrations%rowtype;
  v_from_cat categories%rowtype;
  v_to_cat categories%rowtype;
  v_event events%rowtype;
  v_label text;
  v_old teams%rowtype;
  v_old_letter text;
  v_old_count integer;
  v_to brackets%rowtype;
  v_has_pools boolean;
  v_generated boolean;
  v_active integer;
  v_transfer uuid;
  v_team uuid;
  v_from_text text;
  v_to_text text;
  v_walkovers text[] := '{}';
  v_withdraw jsonb := jsonb_build_object('bracket_ids', '[]'::jsonb);
  v_new_codes text[] := '{}';
  v_fixture jsonb;
  v_opp teams%rowtype;
  v_next_code integer;
  v_round integer;
  v_max_per_opponent integer;
  v_code text;
  v_side text;
  v_email text := (select email from auth.users where id = auth.uid());
begin
  if p_assignment not in ('manual', 'random') then
    raise exception 'Unknown bracket assignment: %', p_assignment;
  end if;
  if p_fixtures is not null and jsonb_typeof(p_fixtures) <> 'array' then
    raise exception 'Fixtures must be a list';
  end if;

  select * into v_reg from registrations where id = p_registration_id for update;
  if not found then
    raise exception 'Registration not found';
  end if;
  v_label := v_reg.player_name || coalesce(' & ' || nullif(btrim(v_reg.player2_name), ''), '');
  if v_reg.status <> 'approved' then
    raise exception 'Only approved players can be transferred. Edit the registration to move % instead.', v_label using errcode = 'check_violation';
  end if;
  if v_reg.category_id = p_to_category_id then
    raise exception '% is already in this category', v_label using errcode = 'check_violation';
  end if;

  select * into v_from_cat from categories where id = v_reg.category_id;
  select * into v_to_cat from categories where id = p_to_category_id;
  if not found or v_to_cat.event_id <> v_reg.event_id then
    raise exception 'The destination category must be in the same event' using errcode = 'check_violation';
  end if;
  if v_to_cat.match_type is distinct from v_from_cat.match_type then
    raise exception 'A % entry can only move to another % category.', lower(coalesce(v_from_cat.match_type, 'singles')), lower(coalesce(v_from_cat.match_type, 'singles'))
      using errcode = 'check_violation';
  end if;

  v_event := bracket_edit_event(v_from_cat.id);
  perform bracket_edit_event(v_to_cat.id);

  -- The player's current pool team, if the old category has been drawn.
  select count(*) into v_old_count
  from teams t join brackets b on b.id = t.bracket_id
  where t.registration_id = v_reg.id and b.category_id = v_from_cat.id and b.kind = 'pool';
  if v_old_count > 1 then
    raise exception '% is in more than one bracket. Fix that before transferring.', v_label using errcode = 'check_violation';
  end if;
  if v_old_count = 1 then
    select t.* into v_old
    from teams t join brackets b on b.id = t.bracket_id
    where t.registration_id = v_reg.id and b.category_id = v_from_cat.id and b.kind = 'pool'
    for update of t;
    select letter into v_old_letter from brackets where id = v_old.bracket_id;

    if v_old.withdrawn_at is not null then
      raise exception '% has withdrawn. Reinstate them first if they''re still playing.', v_label using errcode = 'check_violation';
    end if;
    if exists (select 1 from teams where source_team_id = v_old.id) then
      raise exception '% is already in the % playoffs and can''t be transferred.', v_label, v_from_cat.name using errcode = 'check_violation';
    end if;
    if exists (select 1 from matches where status = 'in_progress' and (team_a_id = v_old.id or team_b_id = v_old.id)) then
      raise exception '% is on court right now. Finish or cancel that match first.', v_label using errcode = 'check_violation';
    end if;
  end if;

  -- Destination checks.
  v_has_pools := exists (select 1 from brackets where category_id = v_to_cat.id and kind = 'pool');
  if v_has_pools then
    if p_to_bracket_id is null then
      raise exception 'Pick a bracket in %', v_to_cat.name using errcode = 'check_violation';
    end if;
    select * into v_to from brackets where id = p_to_bracket_id;
    if not found or v_to.category_id <> v_to_cat.id or v_to.kind <> 'pool' then
      raise exception 'Pick a pool bracket in %', v_to_cat.name using errcode = 'check_violation';
    end if;
    if coalesce(v_to_cat.format, '') !~* 'round robin' then
      raise exception 'Transfers into a drawn bracket work for Round Robin categories only. % uses %.', v_to_cat.name, coalesce(v_to_cat.format, 'another format')
        using errcode = 'check_violation';
    end if;
    if exists (select 1 from matches m join brackets b on b.id = m.bracket_id where b.category_id = v_to_cat.id and b.kind = 'playoff') then
      raise exception 'Playoffs have already started in %, so no one can join its brackets now.', v_to_cat.name using errcode = 'check_violation';
    end if;
    select count(*) into v_active from teams where bracket_id = v_to.id and withdrawn_at is null;
    if v_to_cat.max_teams_per_bracket is not null and v_active >= v_to_cat.max_teams_per_bracket then
      raise exception 'Bracket % is full (max % teams per bracket).', v_to.letter, v_to_cat.max_teams_per_bracket using errcode = 'check_violation';
    end if;
    v_generated := exists (select 1 from matches m join brackets b on b.id = m.bracket_id where b.category_id = v_to_cat.id and b.kind = 'pool');
  elsif p_to_bracket_id is not null then
    raise exception '% hasn''t been drawn yet, so there''s no bracket to pick.', v_to_cat.name using errcode = 'check_violation';
  end if;

  v_from_text := v_from_cat.name || coalesce(' · Bracket ' || v_old_letter, '');
  v_to_text := v_to_cat.name || case when v_has_pools then ' · Bracket ' || v_to.letter else '' end;

  -- Leave the old pool: unplayed matches become walkovers, finished ones stay.
  if v_old_count = 1 then
    select coalesce(array_agg(match_code order by round_number, match_code), '{}') into v_walkovers
    from matches where status = 'scheduled' and (team_a_id = v_old.id or team_b_id = v_old.id);
    v_withdraw := withdraw_team(v_old.id);
    update teams
    set transferred_out_at = now(), transferred_to = v_to_text, registration_id = null
    where id = v_old.id;
  end if;

  -- Fires the duplicate-name and plan-limit triggers for the destination.
  update registrations set category_id = v_to_cat.id where id = v_reg.id;

  insert into team_transfers (
    event_id, registration_id, player_label,
    from_category_id, from_category, from_bracket, from_team_id,
    to_category_id, to_category, to_bracket,
    assignment, walkovers, reason, actor_id, actor_email
  ) values (
    v_event.id, v_reg.id, v_label,
    v_from_cat.id, v_from_cat.name, v_old_letter, v_old.id,
    v_to_cat.id, v_to_cat.name, case when v_has_pools then v_to.letter end,
    case when v_has_pools then p_assignment else 'undrawn' end,
    coalesce(array_length(v_walkovers, 1), 0), nullif(btrim(p_reason), ''), auth.uid(), v_email
  ) returning id into v_transfer;

  if v_has_pools then
    -- created_at now(): last in the bracket's team order (Team N+1).
    insert into teams (bracket_id, registration_id, player1_name, player2_name, club_name, transferred_in_at, transferred_from)
    values (v_to.id, v_reg.id, v_reg.player_name, nullif(btrim(v_reg.player2_name), ''), v_reg.club_name, now(), v_from_text)
    returning id into v_team;
    update team_transfers set to_team_id = v_team where id = v_transfer;

    if v_generated then
      select coalesce(max(nullif(regexp_replace(coalesce(match_code, ''), '\D', '', 'g'), '')::integer), 0) into v_next_code
      from matches where bracket_id = v_to.id;
      select coalesce(max(m.round_number), 0) into v_round
      from matches m join brackets b on b.id = m.bracket_id
      where b.category_id = v_to_cat.id and b.kind = 'pool';
      v_max_per_opponent := case when v_to_cat.format ~* 'double round robin' then 2 else 1 end;

      for v_fixture in select * from jsonb_array_elements(coalesce(p_fixtures, '[]'::jsonb)) loop
        select * into v_opp from teams where id = nullif(v_fixture->>'opponent_team_id', '')::uuid;
        if not found or v_opp.bracket_id <> v_to.id or v_opp.withdrawn_at is not null or v_opp.id = v_team then
          raise exception 'New matches can only be against active players in Bracket %. Reload and try again.', v_to.letter using errcode = 'check_violation';
        end if;
        if (select count(*) from matches where transfer_id = v_transfer and (team_a_id = v_opp.id or team_b_id = v_opp.id)) >= v_max_per_opponent then
          raise exception 'Too many new matches against %', v_opp.player1_name || coalesce(' & ' || v_opp.player2_name, '') using errcode = 'check_violation';
        end if;
        v_side := coalesce(v_fixture->>'side', 'a');
        v_next_code := v_next_code + 1;
        v_round := v_round + 1;
        v_code := v_to.letter || v_next_code;
        insert into matches (bracket_id, team_a_id, team_b_id, status, round_number, match_code, transfer_id)
        values (
          v_to.id,
          case when v_side = 'b' then v_opp.id else v_team end,
          case when v_side = 'b' then v_team else v_opp.id end,
          'scheduled', v_round, v_code, v_transfer
        );
        v_new_codes := array_append(v_new_codes, v_code);
      end loop;
    end if;
  end if;

  insert into activity_log (event_id, message)
  values (v_event.id, v_label || ' was transferred from ' || v_from_text || ' to ' || v_to_text);

  return jsonb_build_object(
    'transfer_id', v_transfer,
    'team_id', v_team,
    'new_codes', to_jsonb(v_new_codes),
    'walkover_codes', to_jsonb(v_walkovers),
    'bracket_ids', coalesce(v_withdraw->'bracket_ids', '[]'::jsonb)
  );
end;
$$;

revoke all on function transfer_registration(uuid, uuid, uuid, text, jsonb, text) from public, anon;
grant execute on function transfer_registration(uuid, uuid, uuid, text, jsonb, text) to authenticated;

-- Score sheet preparation status on the Transfers page.
create or replace function set_transfer_sheet_status(p_transfer_id uuid, p_status text)
returns team_transfers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event events%rowtype;
  v_row team_transfers%rowtype;
begin
  if p_status not in ('pending', 'prepared', 'ready') then
    raise exception 'Unknown score sheet status: %', p_status;
  end if;
  select e.* into v_event from team_transfers tt join events e on e.id = tt.event_id where tt.id = p_transfer_id;
  if not found then
    raise exception 'Transfer not found';
  end if;
  if not (v_event.organizer_id = auth.uid() or has_event_permission(v_event.id, 'brackets') or has_event_permission(v_event.id, 'matchlist')) then
    raise exception 'You don''t have permission to update score sheets for this event' using errcode = '42501';
  end if;
  if v_event.status = 'finished' then
    raise exception 'This event is finished and locked.' using errcode = 'check_violation';
  end if;
  update team_transfers set sheet_status = p_status where id = p_transfer_id returning * into v_row;
  return v_row;
end;
$$;

revoke all on function set_transfer_sheet_status(uuid, text) from public, anon;
grant execute on function set_transfer_sheet_status(uuid, text) to authenticated;

-- reinstate_team, now refusing a team that was transferred out: the player
-- already has a team in their new category.
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

  if exists (select 1 from teams where id = any(v_ids) and transferred_out_at is not null) then
    raise exception 'This player was transferred to another category, so they can''t be reinstated here.' using errcode = 'check_violation';
  end if;

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

commit;

notify pgrst, 'reload schema';
