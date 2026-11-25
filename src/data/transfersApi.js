import { supabase } from '../lib/supabaseClient';
import { advanceSingleEliminationBracket } from './bracketsApi';
import { compareMatchCode } from '../utils/match';

// Event-day category transfers. See transfer_registration in schema.sql for
// the server side (one transaction) and utils/transfer.js for the planning
// the Transfer popup previews.

const MATCH_TEAMS = 'team_a:team_a_id(id, player1_name, player2_name, transferred_in_at), team_b:team_b_id(id, player1_name, player2_name, transferred_in_at)';

// Every transfer in the event, newest first, each with the matches it added
// (in code order) for the Additional Score Sheets list.
export async function listTransfers(eventId) {
  const { data, error } = await supabase.from('team_transfers').select('*').eq('event_id', eventId).order('created_at', { ascending: false });
  if (error) throw error;
  if (data.length === 0) return [];

  const { data: matches, error: matchErr } = await supabase
    .from('matches')
    .select(`id, transfer_id, bracket_id, match_code, round_number, status, result_type, score_a, score_b, winner_team_id, court, ${MATCH_TEAMS}`)
    .in(
      'transfer_id',
      data.map((t) => t.id)
    );
  if (matchErr) throw matchErr;

  const byTransfer = new Map();
  matches
    .slice()
    .sort((a, b) => compareMatchCode(a.match_code, b.match_code))
    .forEach((m) => {
      if (!byTransfer.has(m.transfer_id)) byTransfer.set(m.transfer_id, []);
      byTransfer.get(m.transfer_id).push(m);
    });
  return data.map((t) => ({ ...t, matches: byTransfer.get(t.id) ?? [] }));
}

// For badges on pages that load transfers alongside their own data: an
// event without the migration (or a staff member who can't read the log)
// just shows no badges instead of failing the page.
export async function listTransfersSafe(eventId) {
  try {
    return await listTransfers(eventId);
  } catch {
    return [];
  }
}

// Where the player stands now: their pool team in the current category (if
// drawn), its bracket letter, their record and open matches, and whether
// anything blocks a transfer (on court, already in the playoffs).
export async function loadTransferSource(registration) {
  const { data: brackets, error: bracketErr } = await supabase
    .from('brackets')
    .select('id, letter, kind')
    .eq('category_id', registration.category_id);
  if (bracketErr) throw bracketErr;
  const pools = brackets.filter((b) => b.kind === 'pool');
  if (pools.length === 0) return { drawn: false, team: null, bracket: null, openMatches: [], played: 0, live: false, inPlayoffs: false };

  const { data: teams, error: teamErr } = await supabase
    .from('teams')
    .select('*')
    .eq('registration_id', registration.id)
    .in(
      'bracket_id',
      pools.map((b) => b.id)
    );
  if (teamErr) throw teamErr;
  const team = teams[0] ?? null;
  if (!team) return { drawn: true, team: null, bracket: null, openMatches: [], played: 0, live: false, inPlayoffs: false };

  const [{ data: matches, error: matchErr }, { data: copies, error: copyErr }] = await Promise.all([
    supabase
      .from('matches')
      .select('id, match_code, round_number, status, team_a_id, team_b_id')
      .or(`team_a_id.eq.${team.id},team_b_id.eq.${team.id}`),
    supabase.from('teams').select('id').eq('source_team_id', team.id).limit(1),
  ]);
  if (matchErr) throw matchErr;
  if (copyErr) throw copyErr;

  return {
    drawn: true,
    team,
    bracket: pools.find((b) => b.id === team.bracket_id) ?? null,
    openMatches: matches.filter((m) => m.status === 'scheduled').sort((a, b) => (a.round_number || 0) - (b.round_number || 0) || compareMatchCode(a.match_code, b.match_code)),
    played: matches.filter((m) => m.status === 'completed').length,
    live: matches.some((m) => m.status === 'in_progress'),
    inPlayoffs: copies.length > 0,
  };
}

// The destination category's pool brackets, their teams and pool matches,
// enough to list eligible brackets and plan the newcomer's matches.
export async function loadTransferDestination(categoryId) {
  const { data: brackets, error: bracketErr } = await supabase
    .from('brackets')
    .select('id, letter, kind, games_per_team')
    .eq('category_id', categoryId)
    .order('letter');
  if (bracketErr) throw bracketErr;
  const pools = brackets.filter((b) => b.kind === 'pool');
  const playoffIds = brackets.filter((b) => b.kind === 'playoff').map((b) => b.id);
  if (pools.length === 0) return { brackets: [], teams: [], matches: [], hasPlayoffs: false };

  const poolIds = pools.map((b) => b.id);
  const [teamsRes, matchesRes, playoffRes] = await Promise.all([
    supabase.from('teams').select('id, bracket_id, player1_name, player2_name, club_name, withdrawn_at, created_at').in('bracket_id', poolIds).order('created_at').order('id'),
    supabase.from('matches').select('id, bracket_id, team_a_id, team_b_id, status, match_code, round_number').in('bracket_id', poolIds),
    playoffIds.length ? supabase.from('matches').select('id').in('bracket_id', playoffIds).limit(1) : Promise.resolve({ data: [], error: null }),
  ]);
  for (const res of [teamsRes, matchesRes, playoffRes]) if (res.error) throw res.error;

  return { brackets: pools, teams: teamsRes.data, matches: matchesRes.data, hasPlayoffs: playoffRes.data.length > 0 };
}

// Applies the transfer. fixtures: planTransferFixtures(...) output.
export async function transferRegistration({ registrationId, toCategoryId, toBracketId, assignment, fixtures, reason }) {
  const { data, error } = await supabase.rpc('transfer_registration', {
    p_registration_id: registrationId,
    p_to_category_id: toCategoryId,
    p_to_bracket_id: toBracketId ?? null,
    p_assignment: assignment,
    p_fixtures: (fixtures ?? []).map((f) => ({ opponent_team_id: f.opponent.id, side: f.side })),
    p_reason: reason || null,
  });
  if (error) throw error;
  // A walkover can complete a Single Elimination round in the old category.
  await Promise.all([...new Set(data.bracket_ids ?? [])].map((bracketId) => advanceSingleEliminationBracket(bracketId)));
  return data;
}

export async function setTransferSheetStatus(transferId, status) {
  const { data, error } = await supabase.rpc('set_transfer_sheet_status', { p_transfer_id: transferId, p_status: status });
  if (error) throw error;
  return data;
}
