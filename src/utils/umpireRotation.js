// How many games each umpire has officiated, for sharing the work out
// fairly. Workload rows are what event_umpire_workload() returns (UMPIRE
// ROTATION in schema.sql): { umpire_name, completed_count, last_finished_at }.

// A game counts once it's completed and was actually played, credited to the
// umpire on the match at that point. Forfeits keep the starting umpire's name
// but nobody officiated a game. Same rule as event_umpire_workload().
export function officiatedGame(match) {
  return match.status === 'completed' && (match.result_type ?? 'played') === 'played' && !!match.umpire_name;
}

// The offline stand-in for event_umpire_workload(), from cached matches.
export function workloadFromMatches(matches) {
  const byName = new Map();
  for (const match of matches) {
    if (!officiatedGame(match)) continue;
    const row = byName.get(match.umpire_name) || { umpire_name: match.umpire_name, completed_count: 0, last_finished_at: null };
    row.completed_count += 1;
    if (match.finished_at && (!row.last_finished_at || timeOf(match.finished_at) > timeOf(row.last_finished_at))) {
      row.last_finished_at = match.finished_at;
    }
    byName.set(match.umpire_name, row);
  }
  return [...byName.values()];
}

// Timestamps come back from Postgres as "+00:00" and from the device as "Z",
// so compare them as times rather than as strings.
function timeOf(timestamp) {
  return timestamp ? Date.parse(timestamp) : 0;
}

function workloadByName(workload) {
  return new Map((workload || []).map((row) => [row.umpire_name, row]));
}

const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

// The Umpires page: everyone in the pool, fewest games first. `fewest` marks
// the umpires who are behind, and only while the pool isn't level, since a
// highlight on everyone means nothing. Names on matches that are no longer in
// the pool come back as `removed`, so the totals still add up.
export function umpireRotation(umpires, workload, liveMatches = []) {
  const counts = workloadByName(workload);
  const onCourt = new Set(liveMatches.map((match) => match.umpire_name).filter(Boolean));
  const row = (name, umpire) => ({ umpire, name, count: counts.get(name)?.completed_count ?? 0, onCourt: onCourt.has(name) });

  const pool = umpires.map((umpire) => row(umpire.name, umpire));
  const poolNames = new Set(umpires.map((umpire) => umpire.name));
  const gone = (workload || []).filter((w) => !poolNames.has(w.umpire_name) && w.completed_count > 0).map((w) => row(w.umpire_name, null));

  const poolCounts = pool.map((r) => r.count);
  const fewest = poolCounts.length > 0 ? Math.min(...poolCounts) : 0;
  const most = poolCounts.length > 0 ? Math.max(...poolCounts) : 0;
  const busiest = Math.max(0, most, ...gone.map((r) => r.count));
  const level = fewest === most;
  const poolGames = poolCounts.reduce((sum, count) => sum + count, 0);

  const finish = (r) => ({ ...r, share: busiest > 0 ? r.count / busiest : 0, fewest: !!r.umpire && !level && r.count === fewest });
  const order = (a, b) => a.count - b.count || byName(a, b);

  return {
    rows: pool.sort(order).map(finish),
    removed: gone.sort(order).map(finish),
    totals: {
      umpires: umpires.length,
      games: poolGames + gone.reduce((sum, r) => sum + r.count, 0),
      average: umpires.length > 0 ? poolGames / umpires.length : 0,
      fewest,
      most,
    },
  };
}

// The Start match list: the free umpires in the order they should be picked.
// Fewest games first; on a tie, whoever has rested longest (never officiated
// before anyone who has), then the pool's own order. The first one is the
// recommendation.
export function rankUmpires(available, workload) {
  const counts = workloadByName(workload);
  const ranked = available.map((umpire, index) => {
    const w = counts.get(umpire.name);
    return { umpire, index, count: w?.completed_count ?? 0, lastFinishedAt: w?.last_finished_at ?? null };
  });
  ranked.sort((a, b) => a.count - b.count || timeOf(a.lastFinishedAt) - timeOf(b.lastFinishedAt) || a.index - b.index);
  const busiest = Math.max(0, ...ranked.map((r) => r.count));
  return ranked.map(({ index: _index, ...r }) => ({ ...r, share: busiest > 0 ? r.count / busiest : 0 }));
}

export function gamesLabel(count) {
  return `${count} game${count === 1 ? '' : 's'}`;
}
