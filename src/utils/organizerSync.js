// A compact fingerprint of what organizers can change about a list of matches:
// same rows in, same string out, whatever order they arrive in. Two fingerprints
// differing is the signal that another organizer did something worth reloading
// for (see useOrganizerLiveSync). Fields left out of the rows can't trigger one.
export function matchChangeSignature(rows) {
  return rows
    .map((m) => [m.id, m.status, m.score_a, m.score_b, m.court, m.winner_team_id, m.result_type, m.running_since, m.umpire_name].join('|'))
    .sort()
    .join('\n');
}

// The same fingerprint split by category, plus one for the matches on court
// right now, so a screen can tell which of its views another organizer's
// change actually touched and reload only those.
export function matchChangeSignatures(rows) {
  const byCategory = new Map();
  rows.forEach((m) => {
    const id = m.bracket?.category_id ?? '';
    if (!byCategory.has(id)) byCategory.set(id, []);
    byCategory.get(id).push(m);
  });
  return {
    categories: new Map([...byCategory].map(([id, list]) => [id, matchChangeSignature(list)])),
    live: matchChangeSignature(rows.filter((m) => m.status === 'in_progress')),
  };
}

// What moved between two matchChangeSignatures results: the ids of the
// categories whose matches changed, and whether anything about the matches
// on court did (one starting or ending counts). null when nothing moved.
export function changedMatchScopes(prev, next) {
  const categories = new Set();
  new Set([...prev.categories.keys(), ...next.categories.keys()]).forEach((id) => {
    if (prev.categories.get(id) !== next.categories.get(id)) categories.add(id);
  });
  const live = prev.live !== next.live;
  return categories.size > 0 || live ? { categories, live } : null;
}
