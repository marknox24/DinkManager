import { supabase } from '../lib/supabaseClient';
import {
  computeMissingPairs,
  effectiveGames,
  expectedRoundRobin,
  expectedTemplateMatches,
  matchCounts,
  missingTemplatePairs,
  planCustomAdjust,
  planRoundRobin,
  planSingleEliminationRound1,
  planTemplateMatches,
} from '../utils/scheduling';
import { getCustomFormat } from './customFormats';
import { getDeviceId } from '../lib/deviceId';

// ---------------------------------------------------------------------------
// OFFLINE-SYNC-AWARE MATCH WRITES
// ---------------------------------------------------------------------------
// startScheduledMatch/recordScheduledMatchResult/pauseMatch/resumeMatch/
// cancelLiveMatch/finishMatch/deleteMatch below all route through the
// sync_* RPCs (see schema.sql) instead of raw .update()/.delete() calls, so
// the exact same call can either apply immediately (this file's normal
// online use, from both this page and BracketsPage.jsx) or be replayed
// later from OfflineSyncContext's queue after reconnecting — one code path
// for both. The optional trailing `opts` is how a queued replay passes back
// the operation_id/client_ts it was originally queued with (so the RPC's
// dedup check treats a retry as the same operation, not a new one);
// omitted, as every existing online caller does, a fresh id pair is
// generated here exactly as before this change.
function newOperation(opts = {}) {
  return {
    operationId: opts.operationId || crypto.randomUUID(),
    clientTs: opts.clientTs || new Date().toISOString(),
    deviceId: getDeviceId(),
  };
}

// The RPCs return the match's current row plus a status: 'applied' (this
// call's write took effect), 'noop_replay' (this operation_id was already
// applied by an earlier attempt — nothing to do), 'rejected_stale' (a newer
// result from another device already won — see sync_log_score/
// sync_finish_match in schema.sql), or 'rejected_invalid_state' (the
// match's state moved on since this write was queued, e.g. someone else
// already started/canceled it). The latter two throw so callers/the sync
// queue can surface them distinctly from a plain network failure.
function unwrapSyncResult(data) {
  if (data?.status === 'rejected_stale') {
    const err = new Error(data.reason || 'A newer result from another device was kept');
    err.code = 'sync_rejected_stale';
    throw err;
  }
  if (data?.status === 'rejected_invalid_state') {
    const err = new Error('This match already changed state on the server — reload to see its current status.');
    err.code = 'sync_rejected_invalid_state';
    throw err;
  }
  return data?.match ?? null;
}

// ---------------------------------------------------------------------------
// BRACKETS
// ---------------------------------------------------------------------------
export async function listBracketsForCategory(categoryId) {
  const { data, error } = await supabase.from('brackets').select('*').eq('category_id', categoryId).order('order_index');
  if (error) throw error;
  return data;
}

export async function deleteBracketsForCategory(categoryId) {
  const { error } = await supabase.from('brackets').delete().eq('category_id', categoryId);
  if (error) throw error;
}

// Maps registration_id -> "Bracket X" for every category in this event, so
// the Registrations page can show where each approved team ended up.
export async function getBracketAssignmentsForEvent(categoryIds) {
  if (categoryIds.length === 0) return {};
  const { data: brackets, error: bracketErr } = await supabase.from('brackets').select('id, letter, category_id').in('category_id', categoryIds);
  if (bracketErr) throw bracketErr;
  if (brackets.length === 0) return {};

  const bracketMap = new Map(brackets.map((b) => [b.id, b.letter]));
  const { data: teams, error: teamErr } = await supabase
    .from('teams')
    .select('registration_id, bracket_id')
    .in('bracket_id', brackets.map((b) => b.id))
    .not('registration_id', 'is', null);
  if (teamErr) throw teamErr;

  const assignments = {};
  teams.forEach((t) => {
    assignments[t.registration_id] = bracketMap.get(t.bracket_id);
  });
  return assignments;
}

// Per-bracket team/match counts for a category, so the Brackets page can
// show "how many matches remain" and estimate time-to-finish. Once a
// bracket has a generated matchlist, its total is the real number of
// matches in it (canceled ones excluded — see matchCounts), so moves, added
// players and regenerations are reflected exactly. Before that, a pool
// bracket shows the round-robin expectation (expected: true) — the only
// scheduling model this app implements for pools. A knockout bracket's
// total is always just the matches generated for it so far.
export async function getBracketProgressForCategory(categoryId) {
  const [{ data: category, error: catErr }, { data: brackets, error: bracketErr }] = await Promise.all([
    supabase.from('categories').select('format, games_per_team').eq('id', categoryId).single(),
    supabase.from('brackets').select('id, letter, kind, games_per_team').eq('category_id', categoryId),
  ]);
  if (catErr) throw catErr;
  if (bracketErr) throw bracketErr;
  if (brackets.length === 0) return [];
  const isDouble = /double round robin/i.test(category.format || '');
  const isRoundRobin = /round robin/i.test(category.format || '');
  const template = getCustomFormat(category.format);
  const bracketIds = brackets.map((b) => b.id);

  const [{ data: teams, error: teamErr }, { data: matches, error: matchErr }] = await Promise.all([
    supabase.from('teams').select('id, bracket_id').in('bracket_id', bracketIds),
    supabase.from('matches').select('id, bracket_id, team_a_id, team_b_id, status').in('bracket_id', bracketIds),
  ]);
  if (teamErr) throw teamErr;
  if (matchErr) throw matchErr;

  const { byBracket } = matchCounts(matches);
  return brackets.map((b) => {
    const teamCount = teams.filter((t) => t.bracket_id === b.id).length;
    const actual = byBracket.get(b.id);
    const expected = !actual && b.kind !== 'playoff';
    const games = isRoundRobin ? (b.games_per_team ?? category.games_per_team) : null;
    const expectedTotal = template ? expectedTemplateMatches(template, b.letter, teamCount) : expectedRoundRobin(teamCount, isDouble, games).total;
    const totalMatches = actual ? actual.total : expected ? expectedTotal : 0;
    const completedCount = actual ? actual.completed : 0;
    return { bracket_id: b.id, letter: b.letter, kind: b.kind, teamCount, totalMatches, completedCount, remaining: totalMatches - completedCount, expected };
  });
}

// Creates brackets + teams from a { letter: [registration, ...] } grouping.
export async function generateBrackets(categoryId, grouping) {
  const letters = Object.keys(grouping).sort();
  const bracketRows = letters.map((letter, i) => ({ category_id: categoryId, letter, order_index: i }));
  const { data: brackets, error: bracketErr } = await supabase.from('brackets').insert(bracketRows).select();
  if (bracketErr) throw bracketErr;

  const teamRows = [];
  // One INSERT stamps every row with the same created_at, which would leave a
  // bracket's team order (created_at, then id) to the random uuids. Spacing
  // the stamps by a millisecond in draw order makes "Team 1, Team 2…" — what
  // match-template formats like "RR:Custom Match 1" number teams by — the
  // order the randomizer placed them.
  const drawStart = Date.now();
  let drawn = 0;
  brackets.forEach((bracket) => {
    (grouping[bracket.letter] || []).forEach((reg) => {
      teamRows.push({
        created_at: new Date(drawStart + drawn++).toISOString(),
        bracket_id: bracket.id,
        registration_id: reg.id,
        player1_name: reg.player_name,
        player2_name: reg.player2_name || null,
        club_name: reg.club_name || null,
      });
    });
  });
  if (teamRows.length > 0) {
    const { error: teamErr } = await supabase.from('teams').insert(teamRows);
    if (teamErr) throw teamErr;
  }
  return brackets;
}

// Single-row equivalent of generateBrackets' bulk insert — used by "Add
// Player to Bracket" to drop one already-approved registration into an
// existing bracket without touching anything else (no regeneration, no
// re-draw of the other teams already in it). `registration` is a row from
// listRegistrations/eventsApi (player_name/player2_name/club_name), and one
// row here covers a doubles pair exactly like generateBrackets does — there
// is no per-player row, ever.
//
// Re-checks "not already assigned" against the live table right before
// inserting (not just whatever the caller's UI last fetched) since this is
// the one guard that actually matters for data integrity — a stale client
// list could otherwise let the same registration end up on two different
// teams.
export async function addPlayerToBracket(bracketId, registration) {
  const { data: existing, error: existingErr } = await supabase
    .from('teams')
    .select('id, bracket_id, brackets(letter)')
    .eq('registration_id', registration.id)
    .maybeSingle();
  if (existingErr) throw existingErr;
  if (existing) {
    const err = new Error(`Player is already assigned to Bracket ${existing.brackets?.letter ?? ''}.`.trim());
    err.code = 'already_assigned';
    throw err;
  }

  const { data, error } = await supabase
    .from('teams')
    .insert({
      bracket_id: bracketId,
      registration_id: registration.id,
      player1_name: registration.player_name,
      player2_name: registration.player2_name || null,
      club_name: registration.club_name || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// BRACKET BALANCING  (see "BRACKET BALANCING" in schema.sql — every rule is
// enforced there: same category, pool brackets only, max size, not on
// court, registered team, event editable.)
// ---------------------------------------------------------------------------

// moves: [{ team_id, to_bracket_id }] — applied all-or-nothing. action is
// 'moved' (the Move dialog / drag-and-drop) or 'balanced' (Balance
// Brackets), for the change history. Returns { letter: teamCount }.
export async function moveBracketTeams(categoryId, moves, action = 'moved') {
  const { data, error } = await supabase.rpc('move_bracket_teams', { p_category_id: categoryId, p_moves: moves, p_action: action });
  if (error) throw error;
  return data;
}

// After the Randomizer draws a category: pre-fills the max bracket size
// with the even size and logs the draw. Returns the new max.
export async function recordBracketRandomization(categoryId, again) {
  const { data, error } = await supabase.rpc('record_bracket_randomization', { p_category_id: categoryId, p_again: again });
  if (error) throw error;
  return data;
}

// max = null removes the limit.
export async function setBracketCapacity(categoryId, max) {
  const { error } = await supabase.rpc('set_bracket_capacity', { p_category_id: categoryId, p_max: max });
  if (error) throw error;
}

export async function listBracketChanges(categoryId, limit = 20) {
  const { data, error } = await supabase
    .from('bracket_changes')
    .select('*')
    .eq('category_id', categoryId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// TEAMS
// ---------------------------------------------------------------------------
export async function listTeamsForBracket(bracketId) {
  const { data, error } = await supabase.from('teams').select('*').eq('bracket_id', bracketId).order('created_at').order('id');
  if (error) throw error;
  return data;
}

export async function listTeamsForCategory(categoryId, brackets) {
  const bracketIds = brackets.map((b) => b.id);
  if (bracketIds.length === 0) return [];
  const { data, error } = await supabase.from('teams').select('*').in('bracket_id', bracketIds);
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// MATCHES
// ---------------------------------------------------------------------------
export async function listMatchesForBracket(bracketId) {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('bracket_id', bracketId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// Every live match across the whole event — not just the currently viewed
// bracket — so the "on court now" cards stay visible no matter which
// category/bracket tab the organizer has open. Carries team names and a
// category/bracket label straight from the query so cards can render
// without cross-referencing whatever bracket happens to be active.
export async function listLiveMatchesForEvent(eventId) {
  const { data: cats, error: catErr } = await supabase.from('categories').select('id, name').eq('event_id', eventId);
  if (catErr) throw catErr;
  if (cats.length === 0) return [];
  const catNameById = new Map(cats.map((c) => [c.id, c.name]));

  const { data: brackets, error: bracketErr } = await supabase
    .from('brackets')
    .select('id, letter, category_id')
    .in('category_id', cats.map((c) => c.id));
  if (bracketErr) throw bracketErr;
  if (brackets.length === 0) return [];
  const bracketById = new Map(brackets.map((b) => [b.id, b]));

  const { data: matches, error: matchErr } = await supabase
    .from('matches')
    .select(
      '*, team_a:team_a_id(id, player1_name, player2_name, club_name), team_b:team_b_id(id, player1_name, player2_name, club_name)'
    )
    .eq('status', 'in_progress')
    .in(
      'bracket_id',
      brackets.map((b) => b.id)
    )
    .order('created_at');
  if (matchErr) throw matchErr;

  return matches.map((m) => {
    const bracket = bracketById.get(m.bracket_id);
    return {
      ...m,
      bracket_letter: bracket?.letter,
      category_name: bracket ? catNameById.get(bracket.category_id) : undefined,
    };
  });
}

export async function recordMatch(payload) {
  const { data, error } = await supabase
    .from('matches')
    .insert({ ...payload, status: 'completed', finished_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Starts a live match on a court — no score yet, just a running timer.
export async function startMatch({ bracket_id, team_a_id, team_b_id, court, umpire_name }) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('matches')
    .insert({
      bracket_id,
      team_a_id,
      team_b_id,
      court: court || null,
      umpire_name: umpire_name || null,
      status: 'in_progress',
      started_at: now,
      running_since: now,
      accumulated_seconds: 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function pauseMatch(matchId, accumulatedSeconds, opts) {
  const { operationId, clientTs, deviceId } = newOperation(opts);
  const { data, error } = await supabase.rpc('sync_pause_match', {
    p_operation_id: operationId,
    p_device_id: deviceId,
    p_match_id: matchId,
    p_client_ts: clientTs,
    p_accumulated_seconds: accumulatedSeconds,
  });
  if (error) throw error;
  return unwrapSyncResult(data);
}

export async function resumeMatch(matchId, opts) {
  const { operationId, clientTs, deviceId } = newOperation(opts);
  const { data, error } = await supabase.rpc('sync_resume_match', {
    p_operation_id: operationId,
    p_device_id: deviceId,
    p_match_id: matchId,
    p_client_ts: clientTs,
  });
  if (error) throw error;
  return unwrapSyncResult(data);
}

// Reverts a live match back to 'scheduled' rather than deleting it — used
// when the match originated from a generated match list (has a match_code)
// so canceling keeps its fixture/code instead of losing that schedule slot.
export async function cancelLiveMatch(matchId, opts) {
  const { operationId, clientTs, deviceId } = newOperation(opts);
  const { data, error } = await supabase.rpc('sync_cancel_match', {
    p_operation_id: operationId,
    p_device_id: deviceId,
    p_match_id: matchId,
    p_client_ts: clientTs,
  });
  if (error) throw error;
  return unwrapSyncResult(data);
}

export async function finishMatch(matchId, { score_a, score_b, winner_team_id, duration_minutes }, opts) {
  const { operationId, clientTs, deviceId } = newOperation(opts);
  const { data, error } = await supabase.rpc('sync_finish_match', {
    p_operation_id: operationId,
    p_device_id: deviceId,
    p_match_id: matchId,
    p_client_ts: clientTs,
    p_score_a: score_a,
    p_score_b: score_b,
    p_winner_team_id: winner_team_id,
    p_duration_minutes: duration_minutes,
  });
  if (error) throw error;
  return unwrapSyncResult(data);
}

export async function deleteMatch(matchId, opts) {
  const { operationId, clientTs, deviceId } = newOperation(opts);
  const { data, error } = await supabase.rpc('sync_remove_match', {
    p_operation_id: operationId,
    p_device_id: deviceId,
    p_match_id: matchId,
    p_client_ts: clientTs,
  });
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// MATCH LIST  (auto-generated schedules)
// ---------------------------------------------------------------------------

// "A9" < "A10" as plain strings sort the wrong way round ('1' < '9') — once
// a bracket accumulates 10+ matches (5+ teams), a plain localeCompare on
// match_code silently reorders the tail of the schedule. Splits off the
// trailing digits and compares those numerically instead, falling back to a
// plain string compare for anything without a numeric suffix.
function compareMatchCode(codeA, codeB) {
  const a = codeA || '';
  const b = codeB || '';
  const numA = a.match(/\d+$/)?.[0];
  const numB = b.match(/\d+$/)?.[0];
  if (numA && numB) {
    const prefixCompare = a.slice(0, a.length - numA.length).localeCompare(b.slice(0, b.length - numB.length));
    return prefixCompare || Number(numA) - Number(numB);
  }
  return a.localeCompare(b);
}

// Every match across every bracket in a category, any status, with team
// names embedded and a bracket_letter for grouping — sorted to reconstruct
// the exact round-by-round, cross-bracket-interleaved generation order. This
// is the single source of truth for "match list order" — the Match List
// page and the Round Robin printable score sheets both read this same
// function/order rather than each doing their own sort, so they can never
// drift apart.
export async function listMatchesForCategory(categoryId) {
  const { data: brackets, error: bracketErr } = await supabase.from('brackets').select('id, letter').eq('category_id', categoryId).order('letter');
  if (bracketErr) throw bracketErr;
  if (brackets.length === 0) return [];
  const bracketById = new Map(brackets.map((b) => [b.id, b]));

  const { data: matches, error } = await supabase
    .from('matches')
    .select(
      '*, team_a:team_a_id(id, player1_name, player2_name, club_name), team_b:team_b_id(id, player1_name, player2_name, club_name)'
    )
    .in(
      'bracket_id',
      brackets.map((b) => b.id)
    );
  if (error) throw error;

  return matches
    .map((m) => ({ ...m, bracket_letter: bracketById.get(m.bracket_id)?.letter }))
    .sort(
      (a, b) =>
        (a.round_number || 0) - (b.round_number || 0) ||
        a.bracket_letter.localeCompare(b.bracket_letter) ||
        compareMatchCode(a.match_code, b.match_code)
    );
}

// Loads what a category's matchlist is generated from — its pool brackets
// (letter order) and their teams (created_at, then id, so the schedule is
// deterministic) — and plans it with the same pure planners the Matchlist
// Preview shows (planRoundRobin / planSingleEliminationRound1 in
// utils/scheduling.js). So Preview and Generate can never disagree: both go
// through this one function.
export async function planMatchListForCategory(categoryId) {
  const { data: category, error: catErr } = await supabase.from('categories').select('format, games_per_team').eq('id', categoryId).single();
  if (catErr) throw catErr;
  const format = category.format || '';
  const isDouble = /double round robin/i.test(format);

  // Excludes the knockout bracket (if playoffs have already been generated
  // for this category) — a pool schedule must never sweep it in.
  const { data: brackets, error: bracketErr } = await supabase
    .from('brackets')
    .select('id, letter, games_per_team')
    .eq('category_id', categoryId)
    .eq('kind', 'pool')
    .order('letter');
  if (bracketErr) throw bracketErr;
  if (brackets.length === 0) throw new Error('No brackets to generate a match list for.');

  const { data: teams, error: teamErr } = await supabase
    .from('teams')
    .select('id, bracket_id, player1_name, player2_name, club_name, created_at')
    .in(
      'bracket_id',
      brackets.map((b) => b.id)
    )
    .order('created_at')
    .order('id');
  if (teamErr) throw teamErr;

  // A match-template format ("RR:Custom Match 1"): every bracket plays the
  // same fixed sequence, Team N = the team's position inside its bracket.
  const template = getCustomFormat(format);
  if (template) {
    const teamsByBracket = {};
    brackets.forEach((b) => {
      teamsByBracket[b.id] = teams.filter((t) => t.bracket_id === b.id).map((t) => t.id);
    });
    const { rows, skippedByBracket } = planTemplateMatches(template, brackets, teamsByBracket);
    return { kind: 'template', template, isDouble: false, brackets, teams, teamsByBracket, skippedByBracket, gamesByBracket: {}, rows, byes: [] };
  }

  if (/round robin/i.test(format)) {
    const teamsByBracket = {};
    // Effective custom games-per-team target per bracket (null = full):
    // the bracket's own setting, else the category's. Never for Double RR.
    const gamesByBracket = {};
    brackets.forEach((b) => {
      teamsByBracket[b.id] = teams.filter((t) => t.bracket_id === b.id).map((t) => t.id);
      gamesByBracket[b.id] = isDouble ? null : effectiveGames(teamsByBracket[b.id].length, b.games_per_team ?? category.games_per_team);
    });
    return {
      kind: 'round_robin',
      isDouble,
      brackets,
      teams,
      gamesByBracket,
      rows: planRoundRobin(brackets, teamsByBracket, isDouble, gamesByBracket),
      byes: [],
    };
  }
  const { rows, byes } = planSingleEliminationRound1(brackets, teams);
  return { kind: 'single_elimination', isDouble: false, brackets, teams, gamesByBracket: {}, rows, byes };
}

// Full round-robin schedule for every pool bracket in the category — see
// planRoundRobin for the round/interleave/coding rules ("Double Round Robin"
// runs the cycle twice with home/away reversed the second time).
export async function generateRoundRobinMatchList(categoryId) {
  const { rows } = await planMatchListForCategory(categoryId);
  if (rows.length === 0) throw new Error('Not enough teams to generate matches.');
  const { data, error } = await supabase.from('matches').insert(rows).select();
  if (error) throw error;
  return data;
}

// Brings one category's round-robin matchlist in line with its current
// bracket assignments, after "Add Player to Bracket" or a bracket move:
//   1. Removes scheduled matches that no longer make sense because one of
//      their teams moved to another bracket — but only ones never started
//      or scored (prune_stale_scheduled_matches in schema.sql).
//   2. Adds every pair of teams in each pool bracket that doesn't already
//      have its expected number of matches (one meeting, or two for Double
//      Round Robin — see computeMissingPairs), as one new round per bracket.
// Every match that was started, scored or completed is left completely
// untouched — played matches of a moved team stay as history in their
// original bracket. Other categories are never affected.
//
// A bracket with a custom games-per-team target (Round Robin only) is
// instead adjusted towards that target with planCustomAdjust: extra
// balanced matchups when the target went up, and — when it went down —
// removal of unplayed matches only (remove_unplayed_matches in schema.sql
// skips anything started or scored), never a repeat matchup.
export async function regenerateMatchListForCategory(categoryId) {
  const { data: category, error: catErr } = await supabase.from('categories').select('format, games_per_team').eq('id', categoryId).single();
  if (catErr) throw catErr;
  const template = getCustomFormat(category.format);
  if (!template && !/round robin/i.test(category.format || '')) {
    throw new Error('Regenerating the matchlist is only supported for Round Robin categories right now.');
  }
  const isDouble = /double round robin/i.test(category.format || '');

  const { data: pruned, error: pruneErr } = await supabase.rpc('prune_stale_scheduled_matches', { p_category_id: categoryId });
  if (pruneErr) throw pruneErr;

  const { data: brackets, error: bracketErr } = await supabase
    .from('brackets')
    .select('id, letter, games_per_team')
    .eq('category_id', categoryId)
    .eq('kind', 'pool')
    .order('letter');
  if (bracketErr) throw bracketErr;
  if (brackets.length === 0) throw new Error('No brackets to regenerate a match list for.');
  const bracketIds = brackets.map((b) => b.id);

  const [{ data: allTeams, error: teamErr }, { data: existingMatches, error: matchErr }] = await Promise.all([
    supabase.from('teams').select('id, bracket_id').in('bracket_id', bracketIds).order('created_at').order('id'),
    supabase
      .from('matches')
      .select('id, bracket_id, team_a_id, team_b_id, round_number, match_code, status, score_a, score_b, court, started_at')
      .in('bracket_id', bracketIds),
  ]);
  if (teamErr) throw teamErr;
  if (matchErr) throw matchErr;

  const rows = [];
  const toRemove = [];
  for (const bracket of brackets) {
    const teamIds = allTeams.filter((t) => t.bracket_id === bracket.id).map((t) => t.id);
    const bracketMatches = existingMatches.filter((m) => m.bracket_id === bracket.id);
    const games = isDouble || template ? null : effectiveGames(teamIds.length, bracket.games_per_team ?? category.games_per_team);

    let newPairs;
    if (template) {
      // A template bracket only ever gains its missing template matches;
      // nothing is removed except stale unplayed ones (pruned above). They
      // keep their template round and code (B2 is always Team 3 vs Team 4)
      // unless that code is already taken by another match.
      const taken = new Set(bracketMatches.map((m) => m.match_code));
      let highest = bracketMatches.reduce((max, m) => Math.max(max, parseInt((m.match_code || '').match(/\d+$/)?.[0] || '0', 10)), 0);
      missingTemplatePairs(template, bracket.letter, teamIds, bracketMatches).forEach((m) => {
        let code = `${bracket.letter}${m.matchNo}`;
        if (taken.has(code)) code = `${bracket.letter}${(highest += 1)}`;
        taken.add(code);
        rows.push({ bracket_id: bracket.id, team_a_id: m.a, team_b_id: m.b, status: 'scheduled', round_number: m.round, match_code: code });
      });
      continue;
    } else if (games != null) {
      const { add, remove } = planCustomAdjust(teamIds, bracketMatches, games);
      toRemove.push(...remove);
      newPairs = add;
    } else {
      newPairs = computeMissingPairs(teamIds, bracketMatches, isDouble);
    }
    if (newPairs.length === 0) continue;

    const maxRound = bracketMatches.reduce((max, m) => Math.max(max, m.round_number || 0), 0);
    let codeCounter = bracketMatches.reduce((max, m) => {
      const num = parseInt((m.match_code || '').match(/\d+$/)?.[0] || '0', 10);
      return Math.max(max, num);
    }, 0);

    // New matches go in new rounds after the existing ones, each in the
    // first new round where neither team is already playing.
    const newRounds = [];
    newPairs.forEach(([teamA, teamB]) => {
      let r = newRounds.findIndex((busy) => !busy.has(teamA) && !busy.has(teamB));
      if (r === -1) {
        newRounds.push(new Set());
        r = newRounds.length - 1;
      }
      newRounds[r].add(teamA).add(teamB);
      codeCounter += 1;
      rows.push({
        bracket_id: bracket.id,
        team_a_id: teamA,
        team_b_id: teamB,
        status: 'scheduled',
        round_number: maxRound + 1 + r,
        match_code: `${bracket.letter}${codeCounter}`,
      });
    });
  }

  let trimmed = 0;
  if (toRemove.length > 0) {
    const { data: removedCount, error: removeErr } = await supabase.rpc('remove_unplayed_matches', { p_category_id: categoryId, p_match_ids: toRemove });
    if (removeErr) throw removeErr;
    trimmed = removedCount;
  }

  if (rows.length === 0) {
    if (pruned + trimmed > 0) return { added: 0, removed: pruned + trimmed };
    throw new Error('No changes are needed — every team already has its full schedule.');
  }
  const { data, error } = await supabase.from('matches').insert(rows).select();
  if (error) throw error;
  return { added: data.length, removed: pruned + trimmed };
}

// Custom games per team (Round Robin categories only). bracketId null sets
// the category default for all its brackets and clears their overrides;
// games null means Full Round Robin.
export async function setGamesPerTeam(categoryId, bracketId, games) {
  const { error } = await supabase.rpc('set_games_per_team', { p_category_id: categoryId, p_bracket_id: bracketId, p_games: games });
  if (error) throw error;
}

// Single elimination Round 1 only: pairs teams sequentially per bracket
// (1v2, 3v4, ...); an odd leftover team gets a bye (no Round 1 row) rather
// than an auto-advance record. Round 2+ is played via the existing
// Start-match/Log-score flow on the Brackets page.
export async function generateSingleEliminationRound1(categoryId) {
  const { rows, byes } = await planMatchListForCategory(categoryId);
  if (rows.length === 0) throw new Error('Not enough teams to generate matches.');
  const { data, error } = await supabase.from('matches').insert(rows).select();
  if (error) throw error;
  return {
    matches: data,
    byes: byes.map(({ bracket, team }) => ({ letter: bracket.letter, name: team.player2_name ? `${team.player1_name} & ${team.player2_name}` : team.player1_name })),
  };
}

// Flips an existing scheduled match to a running live match (no new row) —
// so it immediately shows up in the Brackets page's live-match cards and
// keeps working with the existing pause/resume/finish flow unchanged.
export async function startScheduledMatch(matchId, { court, umpire_name }, opts) {
  const { operationId, clientTs, deviceId } = newOperation(opts);
  const { data, error } = await supabase.rpc('sync_start_match', {
    p_operation_id: operationId,
    p_device_id: deviceId,
    p_match_id: matchId,
    p_client_ts: clientTs,
    p_court: court ?? null,
    p_umpire_name: umpire_name ?? null,
  });
  if (error) throw error;
  return unwrapSyncResult(data);
}

// "Log score directly" equivalent for a pre-scheduled match row — also
// reused by the Match List "edit score" pencil to correct an already-
// completed match, so unlike start/pause/resume/cancel this can't rely on a
// simple status guard; see sync_log_score in schema.sql for the newer-wins
// conflict handling that covers that case instead.
export async function recordScheduledMatchResult(matchId, { score_a, score_b, winner_team_id, umpire_name }, opts) {
  const { operationId, clientTs, deviceId } = newOperation(opts);
  const { data, error } = await supabase.rpc('sync_log_score', {
    p_operation_id: operationId,
    p_device_id: deviceId,
    p_match_id: matchId,
    p_client_ts: clientTs,
    p_score_a: score_a,
    p_score_b: score_b,
    p_winner_team_id: winner_team_id,
    p_umpire_name: umpire_name ?? null,
  });
  if (error) throw error;
  return unwrapSyncResult(data);
}
