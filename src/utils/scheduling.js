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
