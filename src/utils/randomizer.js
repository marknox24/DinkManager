export function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function bracketLetter(index) {
  return String.fromCharCode(65 + index); // A, B, C, ...
}

// Distributes registrations across `numBrackets` brackets. By default,
// spreads players from the same club across different brackets as much as
// possible; pass { allowSameClub: true } to ignore club_name entirely and
// deal a plain shuffle instead (organizer opted into allowing clubmates to
// land in the same bracket).
// Returns { A: [reg, ...], B: [reg, ...], ... }.
export function drawBrackets(registrations, numBrackets, { allowSameClub = false } = {}) {
  const n = Math.max(1, Math.min(numBrackets, registrations.length || 1));

  let clubGroups;
  if (allowSameClub) {
    // No club grouping at all — every registration is its own "group" of
    // one, so dealing them round-robin below is just a plain shuffle.
    clubGroups = shuffle(registrations).map((reg) => [reg]);
  } else {
    const byClub = new Map();
    registrations.forEach((reg) => {
      const key = (reg.club_name || '').trim().toLowerCase() || `__solo_${reg.id}`;
      if (!byClub.has(key)) byClub.set(key, []);
      byClub.get(key).push(reg);
    });
    // Shuffle within each club group, then shuffle the order clubs are dealt in.
    clubGroups = shuffle(Array.from(byClub.values()).map((group) => shuffle(group)));
  }

  const buckets = Array.from({ length: n }, () => []);
  let cursor = 0;
  clubGroups.forEach((group) => {
    group.forEach((reg) => {
      buckets[cursor % n].push(reg);
      cursor += 1;
    });
  });

  const grouping = {};
  buckets.forEach((teams, i) => {
    grouping[bracketLetter(i)] = teams;
  });
  return grouping;
}

// Suggests a bracket count aiming for ~5 teams per bracket.
export function suggestBracketCount(teamCount) {
  return Math.max(1, Math.round(teamCount / 5));
}

// Flattens a { A: [reg, ...], B: [...] } grouping into a shuffled reveal
// order — teams are called out in mixed order across brackets, not grouped,
// so a live draw doesn't spoil itself by finishing one bracket at a time.
export function flattenDrawOrder(grouping) {
  const all = [];
  Object.entries(grouping).forEach(([letter, regs]) => {
    regs.forEach((reg) => all.push({ reg, letter }));
  });
  return shuffle(all);
}

// Total time budget for a live draw, and how long each pick's "chase" runs.
export function drawTimings(teamCount) {
  const totalMs = 30000;
  const perPickMs = Math.min(3200, Math.max(700, Math.floor(totalMs / Math.max(1, teamCount))));
  const chaseMs = Math.min(1400, Math.max(350, Math.floor(perPickMs * 0.55)));
  return { perPickMs, chaseMs, landingMs: Math.max(150, perPickMs - chaseMs) };
}
