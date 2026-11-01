// The forfeit score. Mirrored by forfeit_points() in schema.sql, which is
// what the server actually stores — this copy only drives optimistic UI and
// the walkover rows the client inserts when a knockout round is built.
export const FORFEIT_POINTS = 11;

export function isDoubleForfeit(match) {
  return match.result_type === 'double_forfeit';
}

// A finished match that can feed the next stage: it has a winner, or it was
// double-forfeited and deliberately has none. A completed row with neither
// (its winner team was deleted) stays undecided.
export function matchIsDecided(match) {
  return match.status === 'completed' && (Boolean(match.winner_team_id) || isDoubleForfeit(match));
}

// True when a later knockout match was built from this one's result, so
// changing it wouldn't change who has already moved on. Goes by the teams
// rather than the round number alone: the Final and the 3rd-place match sit
// in different rounds but neither feeds the other.
export function hasDependentMatch(match, matches) {
  const sides = [match.team_a_id, match.team_b_id];
  return matches.some(
    (o) => o.bracket_id === match.bracket_id && (o.round_number || 0) > (match.round_number || 0) && (sides.includes(o.team_a_id) || sides.includes(o.team_b_id))
  );
}

// The score/winner columns for a forfeit won by `winnerTeamId`, or a double
// forfeit when `winnerTeamId` is null.
export function forfeitResult(teamAId, winnerTeamId) {
  if (!winnerTeamId) return { result_type: 'double_forfeit', score_a: 0, score_b: 0, winner_team_id: null };
  const aWon = winnerTeamId === teamAId;
  return {
    result_type: 'forfeit',
    score_a: aWon ? FORFEIT_POINTS : 0,
    score_b: aWon ? 0 : FORFEIT_POINTS,
    winner_team_id: winnerTeamId,
  };
}

// The row fields for a knockout fixture. matches.team_a_id/team_b_id are NOT
// NULL and the bracket tree expects a row per position after Round 1, so a
// side with nobody left to send (deadA/deadB: the prior match was double-
// forfeited) still gets a team — one of the two who forfeited — and the
// fixture is closed on the spot rather than waiting for a no-show. A
// withdrawn team is treated the same way, which also covers a team whose
// next match didn't exist yet when they withdrew (a bye recipient, or a
// later stage that hadn't been generated).
export function resolveFixture({ teamA, teamB, deadA = false, deadB = false, withdrawnIds = new Set() }) {
  const aOut = deadA || withdrawnIds.has(teamA);
  const bOut = deadB || withdrawnIds.has(teamB);
  const sides = { team_a_id: teamA, team_b_id: teamB };
  if (!aOut && !bOut) return { ...sides, status: 'scheduled' };
  const winner = aOut && bOut ? null : aOut ? teamB : teamA;
  const withdrawn = withdrawnIds.has(teamA) ? teamA : withdrawnIds.has(teamB) ? teamB : null;
  return {
    ...sides,
    status: 'completed',
    ...forfeitResult(teamA, winner),
    // Lets reinstate_team undo this one too.
    ...(withdrawn ? { auto_forfeit_team_id: withdrawn } : {}),
  };
}
