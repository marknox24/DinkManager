export function teamLabel(team) {
  if (!team) return '—';
  return team.player2_name ? `${team.player1_name} & ${team.player2_name}` : team.player1_name;
}

export function liveElapsedSeconds(match, nowMs) {
  const base = match.accumulated_seconds || 0;
  if (!match.running_since) return base;
  return base + Math.max(0, Math.floor((nowMs - new Date(match.running_since).getTime()) / 1000));
}
