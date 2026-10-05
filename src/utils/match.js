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

// "A9" < "A10" as plain strings sort the wrong way round ('1' < '9') — once
// a bracket accumulates 10+ matches (5+ teams), a plain localeCompare on
// match_code silently reorders the tail of the schedule. Splits off the
// trailing digits and compares those numerically instead, falling back to a
// plain string compare for anything without a numeric suffix.
export function compareMatchCode(codeA, codeB) {
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
