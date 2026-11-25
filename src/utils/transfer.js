import { effectiveGames } from './scheduling.js';

// Planning for an event-day category transfer (a sandbagger moved up after
// the brackets and matchlist exist). Pure, so the Transfer popup can preview
// exactly what transfer_registration() in schema.sql will do, and so it runs
// under node --test. The server re-checks everything here.

// Only a Round Robin bracket can take one more team without rebuilding: the
// newcomer just plays the others. Single Elimination and match templates
// ("RR:…", numbered team positions) can't.
export function canJoinDrawnBracket(format) {
  return /round robin/i.test(format || '');
}

// The destination's pool brackets in letter order, each with its active
// (not withdrawn) team count and whether it's at the category's capacity.
export function eligibleBrackets(brackets, teams, capacity) {
  return brackets
    .filter((b) => (b.kind ?? 'pool') === 'pool')
    .slice()
    .sort((a, b) => a.letter.localeCompare(b.letter))
    .map((b) => {
      const count = teams.filter((t) => t.bracket_id === b.id && !t.withdrawn_at).length;
      return { ...b, count, full: capacity != null && count >= capacity };
    });
}

// Random Bracket Assignment: one of the smallest brackets that still has
// room, so a random pick never makes the brackets lopsided. Null when every
// bracket is full.
export function pickRandomBracket(eligible, rng = Math.random) {
  const open = eligible.filter((b) => !b.full);
  if (open.length === 0) return null;
  const fewest = Math.min(...open.map((b) => b.count));
  const smallest = open.filter((b) => b.count === fewest);
  return smallest[Math.min(smallest.length - 1, Math.floor(rng() * smallest.length))];
}

// The transferred team's new matches: [{ opponent, side }], side 'a' when the
// newcomer is listed first. Same rules as the matchlist generator:
// - Round Robin: one match against every active team in the bracket.
// - Double Round Robin: two, the second with sides swapped.
// - A games-per-team target (bracket value, else the category's; 0 = full):
//   that many opponents, the ones with the fewest games first, so the
//   bracket stays as even as it can.
// opponents: active teams in bracket order. matchCounts: { teamId: games }.
export function planTransferFixtures({ opponents, isDouble = false, gamesTarget = null, matchCounts = {} }) {
  if (opponents.length === 0) return [];
  if (isDouble) {
    return [...opponents.map((opponent) => ({ opponent, side: 'a' })), ...opponents.map((opponent) => ({ opponent, side: 'b' }))];
  }
  const k = effectiveGames(opponents.length + 1, gamesTarget);
  let chosen = opponents;
  if (k != null) {
    const order = new Map(opponents.map((t, i) => [t.id, i]));
    const picked = new Set(
      opponents
        .slice()
        .sort((a, b) => (matchCounts[a.id] ?? 0) - (matchCounts[b.id] ?? 0) || order.get(a.id) - order.get(b.id))
        .slice(0, k)
        .map((t) => t.id)
    );
    chosen = opponents.filter((t) => picked.has(t.id));
  }
  // Alternate sides so the newcomer isn't always listed first.
  return chosen.map((opponent, i) => ({ opponent, side: i % 2 === 0 ? 'a' : 'b' }));
}

// Why a transfer can't go ahead, in the organizer's words. Mirrors the checks
// in transfer_registration(), so Confirm is disabled before the server has to
// refuse. Every argument is optional: pass what's known so far.
export function transferBlockers({
  registration,
  sourceCategory,
  sourceTeam,
  sourceLive = false,
  sourceInPlayoffs = false,
  destCategory,
  destHasPools = false,
  destHasPlayoffs = false,
  bracket,
} = {}) {
  const reasons = [];
  if (registration && registration.status !== 'approved') reasons.push('Only approved players can be transferred.');
  if (sourceTeam?.withdrawn_at) reasons.push('This player has withdrawn. Reinstate them first if they’re still playing.');
  if (sourceInPlayoffs) reasons.push('Already in the playoffs, so they can’t be transferred.');
  if (sourceLive) reasons.push('On court right now. Finish or cancel that match first.');
  if (destCategory && sourceCategory) {
    if (destCategory.id === sourceCategory.id) reasons.push('Pick a different category.');
    if ((destCategory.match_type ?? null) !== (sourceCategory.match_type ?? null)) {
      reasons.push(`A ${(sourceCategory.match_type || 'singles').toLowerCase()} entry can only move to another ${(sourceCategory.match_type || 'singles').toLowerCase()} category.`);
    }
  }
  if (destCategory && destHasPools) {
    if (!canJoinDrawnBracket(destCategory.format)) {
      reasons.push(`${destCategory.name} uses ${destCategory.format || 'another format'}. Transfers into a drawn bracket work for Round Robin only.`);
    }
    if (destHasPlayoffs) reasons.push(`Playoffs have already started in ${destCategory.name}.`);
    if (bracket?.full) reasons.push(`Bracket ${bracket.letter} is full.`);
  }
  return reasons;
}
