// Shared by the organizer Check-in page and the public self-check-in QR
// flow: finds a player's OTHER approved category registrations in the same
// event, so check-in can prompt "we also found them in X — check them in
// too?" Both callers flatten their registration rows into one common shape
// first: { regId, slot, categoryId, name, checkedIn }.
//
// Identity is name-only (trimmed, case-insensitive exact match) — there is
// no reliable shared id across anonymous registrations (registrations.player_id
// is only set when a player signs in; see supabase/schema.sql), so this is
// necessarily best-effort: it can miss a spelling variant, or match two
// different people who happen to share a name.
function normalizeName(name) {
  return (name || '').trim().toLowerCase();
}

// Raw registration-shaped rows (id, category_id, player_name, player2_name,
// player1_checked_in_at, player2_checked_in_at — the public_checkin_roster
// view's columns) → one entry per player slot, same shape
// CheckInManagePage's own flattenApprovedPlayers already produces.
export function flattenCheckinRows(rows) {
  const entries = [];
  rows.forEach((r) => {
    entries.push({ regId: r.id, slot: 'player1', categoryId: r.category_id, name: r.player_name, checkedIn: Boolean(r.player1_checked_in_at) });
    if (r.player2_name) {
      entries.push({ regId: r.id, slot: 'player2', categoryId: r.category_id, name: r.player2_name, checkedIn: Boolean(r.player2_checked_in_at) });
    }
  });
  return entries;
}

// `entries` are already flattened to one row per player slot (see
// flattenCheckinRows above, or CheckInManagePage's flattenApprovedPlayers,
// which produces the same shape plus extra display fields).
export function findOtherCategoryMatches(entries, { excludeCategoryId, name }) {
  const target = normalizeName(name);
  if (!target) return [];
  return entries.filter((e) => e.categoryId !== excludeCategoryId && !e.checkedIn && normalizeName(e.name) === target);
}
