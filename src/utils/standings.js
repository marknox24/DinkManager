// Shared pool-play standings ranker — was duplicated byte-for-byte in
// BracketsPage.jsx and PreviewDisplayPage.jsx. Sort order is load-bearing
// (already on screen everywhere pool standings render) and must not change:
// wins desc, then losses asc, then point-diff desc, then points_for desc.
// Win/loss record always outranks point differential — a team with fewer
// losses is never passed by a team with a worse record just because it ran
// up a bigger score. Point diff (and then points_for) only decides it once
// wins AND losses both match (teams can be level on wins but not losses —
// byes, or a pool that isn't finished yet).
export function rankTeams(teams) {
  const enriched = teams.map((t) => ({ ...t, diff: t.points_for - t.points_against }));
  enriched.sort((a, b) => {
    if (a.wins !== b.wins) return b.wins - a.wins;
    if (a.losses !== b.losses) return a.losses - b.losses;
    if (a.diff !== b.diff) return b.diff - a.diff;
    return b.points_for - a.points_for;
  });
  return enriched.map((t, i) => ({ ...t, rank: i + 1 }));
}

// True when the team at `rank` and the team right after it are tied on every
// field rankTeams sorts by — used to refuse advancing a playoff cutoff that
// hasn't actually been decided, rather than picking one by insertion order.
export function isTiedAtCut(rankedTeams, rank) {
  const a = rankedTeams.find((t) => t.rank === rank);
  const b = rankedTeams.find((t) => t.rank === rank + 1);
  if (!a || !b) return false;
  return a.wins === b.wins && a.losses === b.losses && a.diff === b.diff && a.points_for === b.points_for;
}
