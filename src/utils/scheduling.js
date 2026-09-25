// Given the teams currently in a bracket and its existing matches (any
// status — scheduled, in_progress, completed), returns the [teamA, teamB]
// pairs that still need a match to satisfy a full round-robin schedule (one
// meeting per pair, or two — one each way — for double round robin).
// Existing matches are never inspected beyond counting them, so this is
// purely additive: a newly added team shows up as missing every pairing
// against teams already in its bracket, while every pair that was already
// fully scheduled reports zero missing matches regardless of whether those
// matches are still scheduled, live, or already completed with a score.
// Shared by bracketsApi.js's regenerateMatchListForCategory (which turns the
// result into new match rows) and BracketsPage's "Matchlist needs update"
// indicator (which only needs to know whether the list is empty).
export function computeMissingPairs(teamIds, existingMatches, isDouble) {
  const expectedPerPair = isDouble ? 2 : 1;
  const pairCounts = new Map();
  existingMatches.forEach((m) => {
    const key = [m.team_a_id, m.team_b_id].sort().join('|');
    pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
  });
  const missing = [];
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      const key = [teamIds[i], teamIds[j]].sort().join('|');
      const have = pairCounts.get(key) || 0;
      for (let k = have; k < expectedPerPair; k++) {
        // Alternates home/away across the two double-RR meetings, matching
        // generateRoundRobinMatchList's own reversed-second-cycle pattern.
        missing.push(k % 2 === 0 ? [teamIds[i], teamIds[j]] : [teamIds[j], teamIds[i]]);
      }
    }
  }
  return missing;
}

// Circle method: splits teamIds into n-1 rounds (n for odd counts, one bye
// per round) where every team plays each other team exactly once.
export function generateRoundRobinRounds(teamIds) {
  const teams = [...teamIds];
  if (teams.length < 2) return [];
  if (teams.length % 2 !== 0) teams.push(null); // bye slot
  const n = teams.length;
  const rounds = [];
  const arr = [...teams];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a !== null && b !== null) pairs.push([a, b]);
    }
    rounds.push(pairs);
    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop());
    arr.splice(0, arr.length, fixed, ...rest);
  }
  return rounds;
}

// What a bracket of n teams' schedule adds up to — only for before a
// matchlist exists (the Brackets page labels it "expected"); once one is
// generated, matchCounts below is the truth. games = a custom games-per-team
// target (Round Robin only; see planCustomRounds): every team plays it,
// except that when n × games is odd one team plays one more — perTeam is
// the target, perTeamMax the most any team gets.
export function expectedRoundRobin(n, isDouble, games = null) {
  const k = isDouble ? null : effectiveGames(n, games);
  if (k != null) {
    return { total: Math.ceil((n * k) / 2), perTeam: k, perTeamMax: (n * k) % 2 === 1 ? k + 1 : k };
  }
  const cycles = isDouble ? 2 : 1;
  const perTeam = n < 2 ? 0 : (n - 1) * cycles;
  return { total: n < 2 ? 0 : ((n * (n - 1)) / 2) * cycles, perTeam, perTeamMax: perTeam };
}

// Match counts from the actual matchlist, per bracket and per team (a team
// row is one singles player or one doubles pair, so a pair is counted
// once). Canceled matches don't count; every other status does, and only
// 'completed' is completed — so scheduled, live and rescheduled matches are
// all "remaining". A team counts in every match it's team_a or team_b of,
// wherever that match is (a team moved between brackets keeps its played
// matches).
export function matchCounts(matches) {
  const byBracket = new Map();
  const byTeam = new Map();
  const bump = (map, key, completed) => {
    const entry = map.get(key) || { total: 0, completed: 0, remaining: 0 };
    entry.total += 1;
    if (completed) entry.completed += 1;
    else entry.remaining += 1;
    map.set(key, entry);
  };
  matches.forEach((m) => {
    if (m.status === 'canceled') return;
    const completed = m.status === 'completed';
    bump(byBracket, m.bracket_id, completed);
    bump(byTeam, m.team_a_id, completed);
    bump(byTeam, m.team_b_id, completed);
  });
  return { byBracket, byTeam };
}

// The one progress wording used everywhere (Brackets page, Matchlist
// Preview): "3/5" = completed / total, with "3 completed • 2 remaining" (or
// "• Complete") as the secondary/tooltip text. Takes a matchCounts entry.
export function progressLabel({ total = 0, completed = 0, remaining = total - completed } = {}) {
  const done = total > 0 && remaining <= 0;
  return {
    short: `${completed}/${total}`,
    detail: `${completed} completed • ${done ? 'Complete' : `${remaining} remaining`}`,
    secondary: done ? 'Complete' : `${remaining} remaining`,
    done,
  };
}

// Legend for a match's status as stored in the database. There is no
// "postponed" status: canceling a live match resets it to 'scheduled' (it
// stays on the schedule), so it shows as upcoming.
export const MATCH_STATUS = {
  completed: { icon: '✓', label: 'Completed' },
  scheduled: { icon: '○', label: 'Upcoming' },
  in_progress: { icon: '▶', label: 'Live' },
  canceled: { icon: '✕', label: 'Cancelled' },
};

// The full round-robin schedule for a category's pool brackets, exactly as
// generateRoundRobinMatchList (bracketsApi.js) inserts it — the Matchlist
// Preview renders this same plan, so what's previewed is what's generated.
// Rounds per bracket use the circle method (a double round robin runs the
// cycle again with home/away reversed), interleaved round by round across
// brackets (A's round 1, B's round 1, ..., then A's round 2, ...), coded per
// bracket A1, A2, ... brackets: [{ id, letter }] in letter order;
// teamsByBracket: bracket id -> team ids, in created_at order;
// gamesByBracket: bracket id -> custom games-per-team target, or null/absent
// for a full round robin (planCustomRounds builds the reduced schedule).
export function planRoundRobin(brackets, teamsByBracket, isDouble, gamesByBracket = {}) {
  const schedules = brackets.map((b) => {
    const teamIds = teamsByBracket[b.id] || [];
    const k = isDouble ? null : effectiveGames(teamIds.length, gamesByBracket[b.id]);
    let rounds = k != null ? planCustomRounds(teamIds, k) : generateRoundRobinRounds(teamIds);
    if (isDouble) {
      const reversed = rounds.map((round) => round.map(([a, c]) => [c, a]));
      rounds = [...rounds, ...reversed];
    }
    return { bracket: b, rounds, codeCounter: 0 };
  });

  const maxRounds = Math.max(0, ...schedules.map((s) => s.rounds.length));
  const rows = [];
  for (let r = 0; r < maxRounds; r++) {
    for (const sched of schedules) {
      for (const [teamA, teamB] of sched.rounds[r] || []) {
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
  return rows;
}

// Single elimination Round 1 exactly as generateSingleEliminationRound1
// pairs it: teams in created_at order, 1v2, 3v4, ...; an odd team out gets a
// bye. teams: [{ id, bracket_id, ... }] already in created_at order.
export function planSingleEliminationRound1(brackets, teams) {
  const rows = [];
  const byes = [];
  for (const b of brackets) {
    const bracketTeams = teams.filter((t) => t.bracket_id === b.id);
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
    if (i < bracketTeams.length) byes.push({ bracket: b, team: bracketTeams[i] });
  }
  return { rows, byes };
}

// ---------------------------------------------------------------------------
// CUSTOM GAMES PER TEAM  (a reduced round robin: each team plays a target
// number of games instead of everyone. Round Robin categories only — see
// categories/brackets.games_per_team in schema.sql.)
// Rules, in priority order: never repeat a matchup; keep every team as
// close to the target as mathematically possible (all exactly k, or — when
// teams × k is odd — one team at k+1); spread opponents evenly; produce a
// valid schedule (no team twice in a round).
// ---------------------------------------------------------------------------

const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

// null = full round robin: no target, 0 (a bracket explicitly set to Full
// while its category has a custom default), or a target that's already
// everyone.
export function effectiveGames(teamCount, target) {
  if (target == null || target <= 0 || teamCount < 2 || target >= teamCount - 1) return null;
  return Math.max(1, target);
}

function countsFor(teamIds, edges) {
  const counts = new Map(teamIds.map((t) => [t, 0]));
  edges.forEach((e) => {
    if (counts.has(e.a)) counts.set(e.a, counts.get(e.a) + 1);
    if (counts.has(e.b)) counts.set(e.b, counts.get(e.b) + 1);
  });
  return counts;
}

// Adds matchups until every team has at least k games. edges: the bracket's
// current matchups [{ a, b, removable }] — removable = still unplayed, so it
// may be swapped out. Returns { added: [[a, b]], removed: [edge] }.
//   1. Pair two under-target teams that haven't met (lowest counts first).
//   2. If the under-target teams have all met each other, swap: drop a
//      removable x–y and add u–x + v–y (keeps everyone else's count).
//   3. Only when a single team is left short (teams × k odd) does it play an
//      at-target team, which then ends on k+1.
export function balanceTopUp(teamIds, edges, k) {
  const live = edges.filter((e) => e.a !== e.b);
  const played = new Set(live.map((e) => pairKey(e.a, e.b)));
  const counts = countsFor(teamIds, live);
  const order = new Map(teamIds.map((t, i) => [t, i]));
  const byCount = (x, y) => counts.get(x) - counts.get(y) || order.get(x) - order.get(y);
  const added = [];
  const removed = [];
  const addEdge = (a, b) => {
    const edge = { a, b, removable: true, added: true };
    live.push(edge);
    played.add(pairKey(a, b));
    counts.set(a, counts.get(a) + 1);
    counts.set(b, counts.get(b) + 1);
    added.push(edge);
  };
  const removeEdge = (edge) => {
    live.splice(live.indexOf(edge), 1);
    played.delete(pairKey(edge.a, edge.b));
    counts.set(edge.a, counts.get(edge.a) - 1);
    counts.set(edge.b, counts.get(edge.b) - 1);
    const i = added.indexOf(edge);
    if (i >= 0) added.splice(i, 1);
    else removed.push(edge);
  };

  for (let guard = 0; guard < teamIds.length * teamIds.length * 4; guard++) {
    const short = teamIds.filter((t) => counts.get(t) < k).sort(byCount);
    if (short.length === 0) break;
    const u = short[0];

    const v = short.slice(1).find((x) => !played.has(pairKey(u, x)));
    if (v) {
      addEdge(u, v);
      continue;
    }

    let swapped = false;
    for (const w of short.slice(1)) {
      const candidate = live.find(
        (e) =>
          e.removable &&
          ![e.a, e.b].includes(u) &&
          ![e.a, e.b].includes(w) &&
          ((!played.has(pairKey(u, e.a)) && !played.has(pairKey(w, e.b))) || (!played.has(pairKey(u, e.b)) && !played.has(pairKey(w, e.a))))
      );
      if (candidate) {
        const [x, y] = !played.has(pairKey(u, candidate.a)) && !played.has(pairKey(w, candidate.b)) ? [candidate.a, candidate.b] : [candidate.b, candidate.a];
        removeEdge(candidate);
        addEdge(u, x);
        addEdge(w, y);
        swapped = true;
        break;
      }
    }
    if (swapped) continue;

    const partner = teamIds.filter((t) => t !== u && !played.has(pairKey(u, t))).sort(byCount)[0];
    if (!partner) break; // u has already played everyone
    addEdge(u, partner);
  }
  return { added: added.map((e) => [e.a, e.b]), removed };
}

// Lowering the target: drops removable (unplayed) matchups, but only where
// BOTH teams are above k — the biggest combined excess first — so no team
// is pushed under the target to trim another. Returns the removed edges.
export function balanceTrim(teamIds, edges, k) {
  const live = [...edges];
  const counts = countsFor(teamIds, live);
  const removed = [];
  for (;;) {
    const candidates = live.filter((e) => e.removable && counts.get(e.a) > k && counts.get(e.b) > k);
    if (candidates.length === 0) break;
    candidates.sort((x, y) => counts.get(y.a) + counts.get(y.b) - (counts.get(x.a) + counts.get(x.b)));
    const edge = candidates[0];
    live.splice(live.indexOf(edge), 1);
    counts.set(edge.a, counts.get(edge.a) - 1);
    counts.set(edge.b, counts.get(edge.b) - 1);
    removed.push(edge);
  }
  return removed;
}

// A fresh custom schedule for one bracket, as rounds of [a, b] pairs. Starts
// from the circle method's first k rounds — whole rounds of distinct pairs,
// so opponents rotate evenly (not "the first N matches" of a full list) —
// then tops up the teams that had byes in those rounds. Added matches go in
// the earliest round where both teams are free, else a new round.
export function planCustomRounds(teamIds, k) {
  const full = generateRoundRobinRounds(teamIds);
  if (effectiveGames(teamIds.length, k) == null) return full;
  const rounds = full.slice(0, k).map((round) => [...round]);
  const edges = rounds.flatMap((round, r) => round.map(([a, b]) => ({ a, b, removable: true, round: r })));
  const { added, removed } = balanceTopUp(teamIds, edges, k);
  removed.forEach((e) => {
    rounds[e.round] = rounds[e.round].filter(([a, b]) => !(a === e.a && b === e.b));
  });
  added.forEach(([a, b]) => {
    let r = rounds.findIndex((round) => !round.some(([x, y]) => x === a || y === a || x === b || y === b));
    if (r === -1) {
      rounds.push([]);
      r = rounds.length - 1;
    }
    rounds[r].push([a, b]);
  });
  return rounds.filter((round) => round.length > 0);
}

// What Regenerate should change in a custom bracket's existing matchlist to
// reach target k: { add: [[a, b]], remove: [matchId] }. matches: the
// bracket's non-canceled matches; only unplayed ones (scheduled, no score,
// no court, not started) are ever removed. Drives both the "Matchlist needs
// regeneration" check and Regenerate itself, so they always agree.
export function planCustomAdjust(teamIds, matches, k) {
  const inBracket = new Set(teamIds);
  const edges = matches
    .filter((m) => m.status !== 'canceled' && inBracket.has(m.team_a_id) && inBracket.has(m.team_b_id))
    .map((m) => ({
      a: m.team_a_id,
      b: m.team_b_id,
      id: m.id,
      removable: m.status === 'scheduled' && m.score_a == null && m.score_b == null && m.court == null && !m.started_at,
    }));
  const trimmed = balanceTrim(teamIds, edges, k);
  const kept = edges.filter((e) => !trimmed.includes(e));
  const { added, removed } = balanceTopUp(teamIds, kept, k);
  return { add: added, remove: [...trimmed, ...removed].map((e) => e.id) };
}

// ---------------------------------------------------------------------------
// MATCH TEMPLATE FORMATS  (see src/data/customFormats.js — e.g. "RR:Custom
// Match 1": every bracket plays the same fixed sequence, with team numbers
// taken from the team's position inside its own bracket.)
// ---------------------------------------------------------------------------

// One bracket's rounds from a template: [{ number, matches: [{ matchNo, a,
// b }] }], with a/b = the bracket's own team ids. template.rounds is either
// explicit rounds or a function of the bracket's team count (see
// customFormats.js). matchNo is a running count of the bracket's real
// matches in template order, so codes have no gaps. A fixed match naming a
// team number the bracket doesn't have is skipped and reported in `skipped`
// (with its position in the template); a match naming a generator's bye slot
// (a number past teamCount + 1) is just a bye and isn't reported. A pair
// listed twice keeps only its first match. teamIds must be in the bracket's
// team order.
export function planTemplateRounds(template, letter, teamIds) {
  const source = template.overrides?.[letter] ?? template.rounds;
  const rounds = typeof source === 'function' ? source(teamIds.length) : source;
  const generated = typeof source === 'function';
  const seen = new Set();
  const skipped = [];
  let matchNo = 0;
  let slot = 0;
  const planned = rounds.map((round, r) => {
    const matches = [];
    round.forEach(([x, y]) => {
      slot += 1;
      const a = teamIds[x - 1];
      const b = teamIds[y - 1];
      if (!a || !b) {
        if (!generated) skipped.push({ matchNo: slot, needs: Math.max(x, y), teamNumbers: [x, y] });
        return;
      }
      const key = pairKey(a, b);
      if (a === b || seen.has(key)) return;
      seen.add(key);
      matchNo += 1;
      matches.push({ matchNo, a, b });
    });
    return { number: r + 1, matches };
  });
  return { rounds: planned, skipped };
}

// The rows to insert for a whole category from a template — every bracket
// reuses the template, interleaved round by round across brackets (A's
// round-1 matches, then B's, …) and coded <Letter><matchNo>, so a four
// bracket category's Round 1 reads A1, A2, B1, B2, C1, C2, D1, D2.
export function planTemplateMatches(template, brackets, teamsByBracket) {
  const perBracket = brackets.map((b) => ({ bracket: b, ...planTemplateRounds(template, b.letter, teamsByBracket[b.id] || []) }));
  const maxRounds = Math.max(0, ...perBracket.map((p) => p.rounds.length));
  const rows = [];
  for (let r = 0; r < maxRounds; r++) {
    for (const { bracket, rounds } of perBracket) {
      for (const m of rounds[r]?.matches ?? []) {
        rows.push({
          bracket_id: bracket.id,
          team_a_id: m.a,
          team_b_id: m.b,
          status: 'scheduled',
          round_number: r + 1,
          match_code: `${bracket.letter}${m.matchNo}`,
        });
      }
    }
  }
  return { rows, skippedByBracket: Object.fromEntries(perBracket.map((p) => [p.bracket.id, p.skipped])) };
}

// How many matches a template gives a bracket of this many teams — the
// "expected" figure shown before a matchlist is generated.
export function expectedTemplateMatches(template, letter, teamCount) {
  const { rounds } = planTemplateRounds(template, letter, Array.from({ length: teamCount }, (_, i) => `t${i}`));
  return rounds.reduce((sum, r) => sum + r.matches.length, 0);
}

// What Regenerate should add to a template bracket's existing matchlist:
// the template matches whose pair isn't already there (any status other
// than canceled). Existing matches are never changed or removed here.
export function missingTemplatePairs(template, letter, teamIds, existingMatches) {
  const have = new Set(existingMatches.filter((m) => m.status !== 'canceled').map((m) => pairKey(m.team_a_id, m.team_b_id)));
  const { rounds } = planTemplateRounds(template, letter, teamIds);
  return rounds.flatMap((round) => round.matches.filter((m) => !have.has(pairKey(m.a, m.b))).map((m) => ({ ...m, round: round.number })));
}
