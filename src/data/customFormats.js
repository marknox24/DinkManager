// Match-template formats: a category format whose matches come from a
// template defined here, instead of being derived from the team count alone.
// The label is the category's `format` text, matched exactly.
//
//   rounds     = the matches of each round, each [teamNo, teamNo], where a
//                team number is the team's 1-based position INSIDE ITS OWN
//                bracket (1 = the first team in that bracket, 2 = the
//                second…) — never a number across the whole category. Either
//                an explicit array of rounds, or a function rounds(teamCount)
//                that returns them for a bracket that size.
//   overrides  = optional { <bracket letter>: rounds } for a bracket that
//                should deviate; every other bracket reuses `rounds`.
//
// Every bracket (A, B, C, D…) gets the same sequence. Match numbers are a
// running count of that bracket's matches in template order (A1, A2, A3…), so
// codes never have gaps. A fixed match naming a team the bracket doesn't have
// is skipped; byes from a generator are simply not matches. To add a format,
// add an entry with a new label.

// A full round robin whose Round 1 pairs neighbours (1v2, 3v4, 5v6, …) and
// whose later rounds carry on until every team has met every other team once.
// Circle method on the order [1, 3, 5, …, 6, 4, 2]: the method pairs the two
// ends inward, which makes Round 1 exactly the neighbour pairs; each later
// round is a rotation of it. An odd bracket gets one bye slot (a team number
// past the last real one), so one team rests each round.
export function pairedRoundRobin(teamCount) {
  const n = teamCount % 2 === 0 ? teamCount : teamCount + 1;
  if (n < 2) return [];
  const odds = Array.from({ length: n / 2 }, (_, i) => 2 * i + 1);
  const evens = Array.from({ length: n / 2 }, (_, i) => 2 * (n / 2 - i));
  const ring = [...odds, ...evens];
  const rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const round = [];
    for (let i = 0; i < n / 2; i++) round.push([ring[i], ring[n - 1 - i]].sort((a, b) => a - b));
    rounds.push(round.sort((a, b) => a[0] - b[0]));
    ring.splice(1, 0, ring.pop());
  }
  return rounds;
}

export const CUSTOM_MATCH_FORMATS = {
  'RR:Custom Match 1': {
    // Round 1: Match 1 = Team 1 vs Team 2, Match 2 = Team 3 vs Team 4, …
    rounds: pairedRoundRobin,
    overrides: {},
  },
};

// The template for a category's format text, or null for every ordinary
// format (Round Robin, Single Elimination…).
export function getCustomFormat(format) {
  const key = (format || '').trim();
  return Object.hasOwn(CUSTOM_MATCH_FORMATS, key) ? { label: key, ...CUSTOM_MATCH_FORMATS[key] } : null;
}
