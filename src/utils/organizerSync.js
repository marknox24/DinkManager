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
