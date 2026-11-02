// Shapes public_event_roster rows for the Who's playing section. A row is one
// registration: a player in singles, a pair in doubles.

const normalize = (text) =>
  (text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function teamMembers(row) {
  return [row.player_name, row.player2_name].filter(Boolean);
}

export function countPlayers(rows) {
  return rows.reduce((sum, row) => sum + teamMembers(row).length, 0);
}

export function initials(name) {
  const words = (name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const first = Array.from(words[0])[0];
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] : '';
  return `${first}${last}`.toUpperCase();
}

export function rosterSummary(rows) {
  const players = countPlayers(rows);
  const playerLabel = `${players} player${players === 1 ? '' : 's'}`;
  const doubles = rows.filter((row) => row.player2_name).length;
  if (doubles === 0) return playerLabel;
  const noun = doubles < rows.length ? 'entries' : rows.length === 1 ? 'team' : 'teams';
  return `${playerLabel} in ${rows.length} ${noun}`;
}

// Every word has to appear somewhere in the names or the club, so "ana makati"
// finds Ana from the Makati club. Accents are ignored: a search for "Pena"
// should find "Peña".
export function filterRoster(rows, query) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return rows;
  return rows.filter((row) => {
    const haystack = normalize([...teamMembers(row), row.club_name].join(' '));
    return terms.every((term) => haystack.includes(term));
  });
}

// One group per division that has anyone in it, in the organizer's division
// order, with names alphabetical so a player can be found by scanning.
export function groupRoster(rows, categories) {
  return categories
    .map((category) => ({
      category,
      rows: rows.filter((row) => row.category_id === category.id).sort((a, b) => a.player_name.localeCompare(b.player_name)),
    }))
    .filter((group) => group.rows.length > 0);
}
