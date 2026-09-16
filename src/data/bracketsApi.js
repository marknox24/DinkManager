import { supabase } from '../lib/supabaseClient';
import { generateRoundRobinRounds } from '../utils/scheduling';

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
// show "how many matches remain" and estimate time-to-finish. Pool brackets'
// total assumes round-robin (n*(n-1)/2) — the only scheduling model this app
// implements for pools (hasPlayed prevents any pair from replaying). A
// knockout bracket's total isn't combinatorial — it's just however many
// matches have actually been generated for it so far.
export async function getBracketProgressForCategory(categoryId) {
  const { data: brackets, error: bracketErr } = await supabase.from('brackets').select('id, letter, kind').eq('category_id', categoryId);
  if (bracketErr) throw bracketErr;
  if (brackets.length === 0) return [];
  const bracketIds = brackets.map((b) => b.id);

  const [{ data: teams, error: teamErr }, { data: matches, error: matchErr }] = await Promise.all([
    supabase.from('teams').select('id, bracket_id').in('bracket_id', bracketIds),
    supabase.from('matches').select('id, bracket_id, status').in('bracket_id', bracketIds),
  ]);
  if (teamErr) throw teamErr;
  if (matchErr) throw matchErr;

  return brackets.map((b) => {
    const teamCount = teams.filter((t) => t.bracket_id === b.id).length;
    const bracketMatches = matches.filter((m) => m.bracket_id === b.id);
    const completedCount = bracketMatches.filter((m) => m.status === 'completed').length;
    const totalMatches = b.kind === 'playoff' ? bracketMatches.length : (teamCount * (teamCount - 1)) / 2;
    return { bracket_id: b.id, letter: b.letter, kind: b.kind, teamCount, totalMatches, completedCount, remaining: totalMatches - completedCount };
  });
}

// Creates brackets + teams from a { letter: [registration, ...] } grouping.
export async function generateBrackets(categoryId, grouping) {
  const letters = Object.keys(grouping).sort();
  const bracketRows = letters.map((letter, i) => ({ category_id: categoryId, letter, order_index: i }));
  const { data: brackets, error: bracketErr } = await supabase.from('brackets').insert(bracketRows).select();
  if (bracketErr) throw bracketErr;

  const teamRows = [];
  brackets.forEach((bracket) => {
    (grouping[bracket.letter] || []).forEach((reg) => {
      teamRows.push({
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

// ---------------------------------------------------------------------------
// TEAMS
// ---------------------------------------------------------------------------
export async function listTeamsForBracket(bracketId) {
  const { data, error } = await supabase.from('teams').select('*').eq('bracket_id', bracketId).order('created_at');
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

export async function pauseMatch(matchId, accumulatedSeconds) {
  const { data, error } = await supabase
    .from('matches')
    .update({ accumulated_seconds: accumulatedSeconds, running_since: null })
    .eq('id', matchId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function resumeMatch(matchId) {
  const { data, error } = await supabase
    .from('matches')
    .update({ running_since: new Date().toISOString() })
    .eq('id', matchId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Reverts a live match back to 'scheduled' rather than deleting it — used
// when the match originated from a generated match list (has a match_code)
// so canceling keeps its fixture/code instead of losing that schedule slot.
export async function cancelLiveMatch(matchId) {
  const { data, error } = await supabase
    .from('matches')
    .update({ status: 'scheduled', started_at: null, running_since: null, accumulated_seconds: 0 })
    .eq('id', matchId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function finishMatch(matchId, { score_a, score_b, winner_team_id, duration_minutes }) {
  const { data, error } = await supabase
    .from('matches')
    .update({
      status: 'completed',
      score_a,
      score_b,
      winner_team_id,
      duration_minutes,
      running_since: null,
      finished_at: new Date().toISOString(),
    })
    .eq('id', matchId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMatch(matchId) {
  const { error } = await supabase.from('matches').delete().eq('id', matchId);
  if (error) throw error;
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

// Full round-robin schedule for every bracket in the category, interleaved
// round-by-round across brackets (Bracket A's round-1 match, then Bracket
// B's, then Bracket C's, then back to A's round 2, ...), coded per bracket
// as letter + running count (A1, A2, ... / B1, B2, ...). "Double Round
// Robin" runs the same cycle twice with home/away reversed the second time.
export async function generateRoundRobinMatchList(categoryId) {
  const { data: category, error: catErr } = await supabase.from('categories').select('format').eq('id', categoryId).single();
  if (catErr) throw catErr;
  const isDouble = /double round robin/i.test(category.format || '');

  // Excludes the knockout bracket (if playoffs have already been generated
  // for this category) — a round-robin regenerate must never sweep it into
  // a pool schedule.
  const { data: brackets, error: bracketErr } = await supabase.from('brackets').select('id, letter').eq('category_id', categoryId).eq('kind', 'pool').order('letter');
  if (bracketErr) throw bracketErr;
  if (brackets.length === 0) throw new Error('No brackets to generate a match list for.');

  const { data: allTeams, error: teamErr } = await supabase
    .from('teams')
    .select('id, bracket_id')
    .in(
      'bracket_id',
      brackets.map((b) => b.id)
    );
  if (teamErr) throw teamErr;

  const bracketSchedules = brackets.map((b) => {
    const teamIds = allTeams.filter((t) => t.bracket_id === b.id).map((t) => t.id);
    let rounds = generateRoundRobinRounds(teamIds);
    if (isDouble) {
      const reversed = rounds.map((round) => round.map(([a, c]) => [c, a]));
      rounds = [...rounds, ...reversed];
    }
    return { bracket: b, rounds, codeCounter: 0 };
  });

  const maxRounds = Math.max(0, ...bracketSchedules.map((s) => s.rounds.length));
  const rows = [];
  for (let r = 0; r < maxRounds; r++) {
    for (const sched of bracketSchedules) {
      const pairs = sched.rounds[r] || [];
      for (const [teamA, teamB] of pairs) {
        sched.codeCounter += 1;
        rows.push({
          bracket_id: sched.bracket.id,
          team_a_id: teamA,
          team_b_id: teamB,
          status: 'scheduled',
          round_number: r + 1,
          match_code: `${sched.bracket.letter}${sched.codeCounter}`,
        });
      }
    }
  }
  if (rows.length === 0) throw new Error('Not enough teams to generate matches.');
  const { data, error } = await supabase.from('matches').insert(rows).select();
  if (error) throw error;
  return data;
}

// Single elimination Round 1 only: pairs teams sequentially per bracket
// (1v2, 3v4, ...); an odd leftover team gets a bye (no Round 1 row) rather
// than an auto-advance record. Round 2+ is played via the existing
// Start-match/Log-score flow on the Brackets page.
export async function generateSingleEliminationRound1(categoryId) {
  const { data: brackets, error: bracketErr } = await supabase.from('brackets').select('id, letter').eq('category_id', categoryId).order('letter');
  if (bracketErr) throw bracketErr;
  if (brackets.length === 0) throw new Error('No brackets to generate a match list for.');

  const { data: allTeams, error: teamErr } = await supabase
    .from('teams')
    .select('id, bracket_id, player1_name, player2_name, created_at')
    .in(
      'bracket_id',
      brackets.map((b) => b.id)
    )
    .order('created_at');
  if (teamErr) throw teamErr;

  const rows = [];
  const byes = [];
  for (const b of brackets) {
    const bracketTeams = allTeams.filter((t) => t.bracket_id === b.id);
    let counter = 0;
    let i = 0;
    for (; i + 1 < bracketTeams.length; i += 2) {
      counter += 1;
      rows.push({
        bracket_id: b.id,
        team_a_id: bracketTeams[i].id,
        team_b_id: bracketTeams[i + 1].id,
        status: 'scheduled',
        round_number: 1,
        match_code: `${b.letter}${counter}`,
      });
    }
    if (i < bracketTeams.length) {
      const bye = bracketTeams[i];
      byes.push({ letter: b.letter, name: bye.player2_name ? `${bye.player1_name} & ${bye.player2_name}` : bye.player1_name });
    }
  }
  if (rows.length === 0) throw new Error('Not enough teams to generate matches.');
  const { data, error } = await supabase.from('matches').insert(rows).select();
  if (error) throw error;
  return { matches: data, byes };
}

// Flips an existing scheduled match to a running live match (no new row) —
// so it immediately shows up in the Brackets page's live-match cards and
// keeps working with the existing pause/resume/finish flow unchanged.
export async function startScheduledMatch(matchId, { court, umpire_name }) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('matches')
    .update({ status: 'in_progress', started_at: now, running_since: now, accumulated_seconds: 0, court, umpire_name })
    .eq('id', matchId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// "Log score directly" equivalent for a pre-scheduled match row.
export async function recordScheduledMatchResult(matchId, { score_a, score_b, winner_team_id, umpire_name }) {
  const { data, error } = await supabase
    .from('matches')
    .update({ status: 'completed', score_a, score_b, winner_team_id, umpire_name, finished_at: new Date().toISOString() })
    .eq('id', matchId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
