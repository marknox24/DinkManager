// Names get entered every which way (ALL CAPS bulk imports, all-lowercase
// quick adds) — normalize to Title Case wherever a player/team name is
// displayed, regardless of how it was stored.
export function toTitleCase(str) {
  if (!str) return str;
  return str.toLowerCase().replace(/(^|[\s'-])\S/g, (c) => c.toUpperCase());
}

export function teamLabel(team) {
  if (!team) return '—';
  const label = team.player2_name ? `${team.player1_name} & ${team.player2_name}` : team.player1_name;
  return toTitleCase(label);
}

export function liveElapsedSeconds(match, nowMs) {
  const base = match.accumulated_seconds || 0;
  if (!match.running_since) return base;
  return base + Math.max(0, Math.floor((nowMs - new Date(match.running_since).getTime()) / 1000));
}
