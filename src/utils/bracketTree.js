import { compareMatchCode, teamLabel } from './match.js';
import { expandFirstStageSlots, expandSinglePoolSlots, PLAYOFF_STAGES } from './playoffLadder.js';

// Turns a category's matches into the shape a visual bracket tree can
// render directly — one or more trees (a pure Single Elimination category
// can have several independent brackets; a pool+playoff category always has
// exactly one knockout ladder), each a list of rounds, each round a list of
// matches with real team names where known and placeholder labels
// ("Winner of R1 Match 2") where the match hasn't been generated yet.
//
// Only applies to formats with a knowable bracket shape — Round Robin has
// no tree, and Double Elimination has no losers-bracket data model yet (see
// the comment on bracketTreeApplies below).

// True for the two formats this module currently supports. Double
// Elimination is intentionally excluded: there's no losers-bracket/loser-
// drop data model in the schema yet (brackets.kind is only 'pool'|
// 'playoff'), so there is nothing here to project — building that tree
// needs a real generation algorithm first, not just a different renderer.
export function bracketTreeApplies(category) {
  return category.format === 'Single Elimination' || Boolean(category.playoff_enabled);
}

function stageLabel(roundIndex, totalRounds) {
  const fromEnd = totalRounds - roundIndex;
  if (fromEnd <= 0) return 'Final';
  if (fromEnd === 1) return 'Semi-Final';
  if (fromEnd === 2) return 'Quarter-Final';
  return `Round of ${2 ** (fromEnd + 1)}`;
}

function sideFromMatch(m, side) {
  const team = side === 'a' ? m.team_a : m.team_b;
  if (!team) return null;
  return { label: teamLabel(team), isPlaceholder: false, teamId: side === 'a' ? m.team_a_id : m.team_b_id };
}

function matchNode({ key, matchCode, m, placeholderA, placeholderB }) {
  if (m) {
    return {
      key,
      matchCode: matchCode ?? m.match_code,
      teamA: sideFromMatch(m, 'a'),
      teamB: sideFromMatch(m, 'b'),
      scoreA: m.score_a ?? null,
      scoreB: m.score_b ?? null,
      winnerSide: m.winner_team_id ? (m.winner_team_id === m.team_a_id ? 'a' : 'b') : null,
      status: m.status,
    };
  }
  return {
    key,
    matchCode: matchCode ?? null,
    teamA: placeholderA ? { label: placeholderA, isPlaceholder: true } : null,
    teamB: placeholderB ? { label: placeholderB, isPlaceholder: true } : null,
    scoreA: null,
    scoreB: null,
    winnerSide: null,
    status: 'projected',
  };
}

// Pure, bracket-agnostic elimination shape: pairs `enteringSlots` entrants
// two at a time, carrying an odd leftover straight through as a bye — the
// exact rule planSingleEliminationRound1 already uses for Round 1, applied
// recursively so later rounds stay consistent with it. Byes beyond Round 1
// aren't attributed to a specific team (Round 1 bye-team identity isn't
// recoverable from match rows alone, since a bye produces no row) — a
// known, documented simplification, not an attempt at full accuracy.
function projectShape(enteringSlots, startRound) {
  const rounds = [];
  let slots = enteringSlots;
  let round = startRound;
  while (slots > 1) {
    const matches = Math.floor(slots / 2);
    rounds.push({ round, matches });
    slots = matches + (slots % 2);
    round += 1;
  }
  return rounds;
}

function sortedByCreation(list) {
  return [...list].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || '') || String(a.id).localeCompare(String(b.id)));
}

// Round 1's slots in bracket order: a real match and a bye alternate (one
// real, one bye, one real, one bye, ...) for as long as both remain, so a
// bye recipient faces a REAL contender's winner next round whenever one is
// available, rather than every bye being clustered together to face only
// each other. Byes always outnumber (or tie) real Round 1 matches once any
// bye exists — see the byeCount math in planSingleEliminationRound1 — so
// any leftover byes trail at the end once real matches run out, pairing
// against each other in Round 2. Both the visual tree and real match
// generation (computeReadySingleEliminationMatches) walk this exact same
// order, so they can never disagree about who faces whom.
function interleaveRound1Slots(round1Matches, byeTeams) {
  const slots = [];
  let i = 0;
  let j = 0;
  while (i < round1Matches.length || j < byeTeams.length) {
    if (i < round1Matches.length) slots.push({ kind: 'real', match: round1Matches[i++] });
    if (j < byeTeams.length) slots.push({ kind: 'bye', team: byeTeams[j++] });
  }
  return slots;
}

// One bracket's worth of a pure Single Elimination category — Round 1 is
// whatever real matches exist, interleaved with byes (see
// interleaveRound1Slots); every later round is projected from however many
// Round 1 slots there are (see projectShape) and filled in with real data
// once those matches are generated.
//
// `bracketTeams` (every team row in this bracket, any status) is how byes
// get found: planSingleEliminationRound1 (utils/scheduling.js) pairs teams
// in created_at order and leaves however many teams the bracket's shape
// needs (not just one) unpaired, with no match row at all, so those
// players would otherwise never appear anywhere in the tree. Reproducing
// the exact same ordering here — rather than inventing a different rule —
// means the two can never disagree about who got a bye.
//
// A bye recipient never gets a "vs BYE" box in Round 1 — just their name,
// advancing straight through — and their name shows up immediately in
// whichever Round 2 box they feed into, even before that match has a row
// yet, rather than hiding behind a generic "Winner of..." placeholder.
function buildSingleEliminationTree(bracketLetter, bracketMatches, bracketTeams = []) {
  // A Single Elimination bracket's 3rd-place match (loser of each
  // semifinal) isn't part of the normal round sequence — pull it out
  // before grouping by round_number so it's never mistaken for an extra
  // round, same as buildPlayoffLadderTree already does for its own
  // thirdPlace. See computeReadySingleEliminationMatches for how/when it's
  // created (round_number = final round + 1, a number no real round uses).
  const thirdPlaceMatch = bracketMatches.find((m) => m.playoff_stage === 'third_place');
  const normalMatches = bracketMatches.filter((m) => m.playoff_stage !== 'third_place');

  const round1 = normalMatches.filter((m) => (m.round_number || 1) === 1).sort((a, b) => compareMatchCode(a.match_code, b.match_code));
  if (round1.length === 0) return null;

  const pairedTeamIds = new Set();
  for (const m of round1) {
    if (m.team_a_id) pairedTeamIds.add(m.team_a_id);
    if (m.team_b_id) pairedTeamIds.add(m.team_b_id);
  }
  const byeTeams = sortedByCreation(bracketTeams).filter((t) => !pairedTeamIds.has(t.id));
  const round1Slots = interleaveRound1Slots(round1, byeTeams);
  const round1Count = round1Slots.length;

  // Each Round 1 slot's resolved identity, for feeding Round 2's known-team
  // display below: a bye's own team immediately, a real match's winner
  // once it's completed (or unknown — `team: null` — until then).
  const round1Resolved = round1Slots.map((s) => (s.kind === 'bye' ? { team: s.team } : { team: null }));

  const shape = [{ round: 1, matches: round1Count }, ...projectShape(round1Count, 2)];
  const byRound = new Map();
  for (const m of normalMatches) {
    const r = m.round_number || 1;
    if (!byRound.has(r)) byRound.set(r, []);
    byRound.get(r).push(m);
  }
  for (const list of byRound.values()) list.sort((a, b) => compareMatchCode(a.match_code, b.match_code));

  const totalRounds = shape.length;

  // Round 1: a real match renders as a normal 2-player box; a bye renders
  // as a single advancing name, no "vs BYE" row.
  const round1Matches = round1Slots.map((s, i) =>
    s.kind === 'bye'
      ? {
          key: `${bracketLetter}-r1-bye-${i}`,
          matchCode: null,
          teamA: { label: teamLabel(s.team), isPlaceholder: false, teamId: s.team.id },
          teamB: null,
          scoreA: null,
          scoreB: null,
          winnerSide: 'a',
          status: 'bye',
          isBareBye: true,
        }
      : matchNode({ key: `${bracketLetter}-r1-${i}`, m: s.match })
  );

  const rounds = [{ id: `${bracketLetter}-1`, label: stageLabel(1, totalRounds), matches: round1Matches }];
  let prevResolved = round1Resolved;
  let prevLabel = stageLabel(1, totalRounds);
  for (let round = 2; round <= totalRounds; round++) {
    const real = byRound.get(round) || [];
    const count = shape[round - 1].matches;
    const nextResolved = [];
    const matches = Array.from({ length: count }, (_, i) => {
      const m = real[i];
      if (m) {
        nextResolved.push({ team: null });
        return matchNode({ key: `${bracketLetter}-r${round}-${i}`, m });
      }
      // No real row yet — show whichever side(s) are already known by
      // name (a bye that fed straight into this box) and a generic
      // "Winner of..." placeholder for whichever side(s) still depend on
      // an earlier round's result.
      const sideAt = (prevIndex, posInPrevRound) => {
        const known = prevResolved[prevIndex]?.team;
        if (known) return { label: teamLabel(known), isPlaceholder: false, teamId: known.id };
        return { label: `Winner of ${prevLabel} #${posInPrevRound + 1}`, isPlaceholder: true };
      };
      nextResolved.push({ team: null });
      return {
        key: `${bracketLetter}-r${round}-${i}`,
        matchCode: null,
        teamA: sideAt(i * 2, i * 2),
        teamB: sideAt(i * 2 + 1, i * 2 + 1),
        scoreA: null,
        scoreB: null,
        winnerSide: null,
        status: 'projected',
      };
    });
    rounds.push({ id: `${bracketLetter}-${round}`, label: stageLabel(round, totalRounds), matches });
    prevResolved = nextResolved;
    prevLabel = stageLabel(round, totalRounds);
  }

  // A real 4-player semifinal exists in the projected shape whenever the
  // second-to-last round has exactly 2 matches — show the 3rd-place slot
  // (real once decided, a placeholder before that) only then; a bracket
  // too small to ever have a real semifinal (e.g. 3 entrants) has nothing
  // meaningful to show here.
  const hasRealSemifinal = shape.length >= 2 && shape[shape.length - 2].matches === 2;
  const thirdPlace = thirdPlaceMatch
    ? matchNode({ key: `${bracketLetter}-third`, m: thirdPlaceMatch })
    : hasRealSemifinal
      ? matchNode({ key: `${bracketLetter}-third`, placeholderA: 'Loser of Semi-Final 1', placeholderB: 'Loser of Semi-Final 2' })
      : null;

  return { key: bracketLetter, title: `Bracket ${bracketLetter}`, rounds, thirdPlace };
}

// Real bracket progression for one Single Elimination bracket: given its
// current matches (any round, any status, including an existing 3rd-place
// row) and teams, returns every winner-vs-winner pairing that is now fully
// decided but has no match row yet, plus a loser-vs-loser 3rd-place pairing
// once the semifinal resolves — the exact set the caller should insert.
// Pure and bracket-agnostic of persistence; the data layer
// (src/data/bracketsApi.js) is what actually writes these rows after a
// match finishes.
//
// Models each round as an ordered list of slots, each `{ value, loser }`:
// `value` is the team id once that slot is decided (null while pending),
// `loser` is the losing team id ONLY when `value` came from a real,
// completed match — a bye or a still-pending slot has no loser, since
// nobody actually played. Round 1's slots are built by interleaveRound1Slots
// — real match winners (winner_team_id, null if unplayed) alternating with
// bye teams (found exactly as buildSingleEliminationTree finds them, so the
// two can never disagree about slot order) — a bye is decided the instant
// the bracket is drawn, no match needed. To go from round R to R+1, slots pair
// sequentially from the front (0&1, 2&3, ...); an ODD leftover slot has no
// partner and carries straight through, still undecided by anyone, to the
// round AFTER R+1 — this is a real, multi-round bye chain for an unevenly-
// shaped bracket (a non-power-of-two team count drawn under the old rule,
// before byes were rounded up to a full power of two), not a bug: it
// mirrors projectShape's own carry-the-remainder rule, just resolved
// against real teams instead of just a shape. A bracket drawn with the
// current byeCount rule never hits this case — every round is already a
// clean power of two, so the semifinal always has exactly 2 real matches.
//
// A pair only becomes a real match once BOTH its slots are decided; there
// is no column linking a match to the one its winner feeds into, so the
// idempotency check (never recreate a pairing that already has a row) is
// the only available key: round_number + {team_a_id, team_b_id} as a set.
//
// `codeNumber`: the bracket tree's connector lines are drawn purely by
// POSITION — round R's box-pair (2i, 2i+1) is assumed to visually feed
// round R+1's box i — and buildSingleEliminationTree finds "box i of round
// R+1" by sorting that round's matches by match_code. That only lines up
// correctly if match_code order matches position order. It won't if codes
// are just handed out in the order pairings happen to become ready: a bye
// pairing can resolve (and so get inserted, and numbered) before an
// adjacent real match that's still being played, landing a LOWER number on
// a visually-LATER box and pointing every connector at the wrong match. So
// each ready entry carries its own `codeNumber` — position-based, not
// discovery-order-based — for the caller to use when assigning match_code:
// round 1's real matches already consume codes 1..round1.length (assigned
// positionally by planSingleEliminationRound1); round 2 continues right
// after that, position i getting `round1.length + i + 1`; each later round
// continues after the FULL previous round's position count (every round
// after Round 1 is all real matches, no byes, by construction — see the
// byeCount rule above). The Final gets position 0 of its round; 3rd place,
// generated alongside it, is numbered right after.
//
// 3rd place: the step that's about to produce the Final (exactly 2 slots
// left) is the semifinal. When BOTH of those slots have a real `loser` —
// i.e. both semifinalists actually played their way in, rather than one
// arriving via a bye/carry with nobody to send to 3rd — also emit a
// loser-vs-loser pairing tagged `playoff_stage: 'third_place'`, at
// `round_number: finalRound + 1` (a number no real round ever uses, so it
// gets its own Match List section instead of colliding with the Final's).
export function computeReadySingleEliminationMatches(bracketMatches, bracketTeams = []) {
  const byRound = new Map();
  for (const m of bracketMatches) {
    const r = m.round_number || 1;
    if (!byRound.has(r)) byRound.set(r, []);
    byRound.get(r).push(m);
  }
  for (const list of byRound.values()) list.sort((a, b) => compareMatchCode(a.match_code, b.match_code));

  const round1 = byRound.get(1) || [];
  if (round1.length === 0) return [];

  const pairedTeamIds = new Set();
  for (const m of round1) {
    if (m.team_a_id) pairedTeamIds.add(m.team_a_id);
    if (m.team_b_id) pairedTeamIds.add(m.team_b_id);
  }
  const byeTeams = sortedByCreation(bracketTeams).filter((t) => !pairedTeamIds.has(t.id));

  const loserOf = (m) => (m.winner_team_id === m.team_a_id ? m.team_b_id : m.team_a_id);

  let slots = interleaveRound1Slots(round1, byeTeams).map((s) =>
    s.kind === 'bye'
      ? { value: s.team.id, loser: null }
      : { value: s.match.status === 'completed' ? s.match.winner_team_id : null, loser: s.match.status === 'completed' ? loserOf(s.match) : null }
  );

  const ready = [];
  let round = 1;
  let codeOffset = round1.length;
  while (slots.length > 1) {
    const nextRound = round + 1;
    const pairCount = Math.floor(slots.length / 2);
    const nextSlots = [];
    const existingNextRound = byRound.get(nextRound) || [];
    const isSemifinalStep = slots.length === 2;
    for (let i = 0; i < pairCount; i++) {
      const a = slots[i * 2];
      const b = slots[i * 2 + 1];
      if (a.value == null || b.value == null) {
        nextSlots.push({ value: null, loser: null });
        continue;
      }
      const existing = existingNextRound.find(
        (m) => (m.team_a_id === a.value && m.team_b_id === b.value) || (m.team_a_id === b.value && m.team_b_id === a.value)
      );
      if (existing) {
        nextSlots.push({
          value: existing.status === 'completed' ? existing.winner_team_id : null,
          loser: existing.status === 'completed' ? loserOf(existing) : null,
        });
      } else {
        ready.push({ round_number: nextRound, team_a_id: a.value, team_b_id: b.value, codeNumber: codeOffset + i + 1 });
        nextSlots.push({ value: null, loser: null });
      }

      if (isSemifinalStep && a.loser != null && b.loser != null) {
        const thirdPlaceRound = byRound.get(nextRound + 1) || [];
        const thirdPlaceExists = thirdPlaceRound.some(
          (m) => m.playoff_stage === 'third_place' && ((m.team_a_id === a.loser && m.team_b_id === b.loser) || (m.team_a_id === b.loser && m.team_b_id === a.loser))
        );
        if (!thirdPlaceExists) {
          ready.push({ round_number: nextRound + 1, team_a_id: a.loser, team_b_id: b.loser, playoff_stage: 'third_place', codeNumber: codeOffset + pairCount + 1 });
        }
      }
    }
    // A carried-through slot's `loser` must NOT survive the carry — nobody
    // played this round, so whatever they won last round is not "this
    // round's semifinal" and must never resurface as a 3rd-place
    // contender. Only `value` (who they are) carries forward.
    if (slots.length % 2 === 1) nextSlots.push({ value: slots[slots.length - 1].value, loser: null });
    slots = nextSlots;
    round = nextRound;
    codeOffset += pairCount;
  }
  return ready;
}

// True once a team has lost a completed match inside its own bracket — a
// bye or an unplayed match never counts, only an actual result with someone
// else's name on `winner_team_id`.
function teamIsEliminated(teamId, bracketMatches) {
  return bracketMatches.some((m) => m.status === 'completed' && m.winner_team_id && m.winner_team_id !== teamId && (m.team_a_id === teamId || m.team_b_id === teamId));
}

// Every registered team in a Single Elimination category, grouped by
// bracket in seed order — independent of whether the organizer has drawn
// Round 1 yet, and independent of whether a given team shows up in any
// match row (a bye never does). This is the direct fix for "players should
// be able to see every participant": the tree above only ever shows teams
// once matches exist to put them in; this list never waits for that.
// `categoryMatches` (optional) is how each entrant's `status` is known —
// 'eliminated' once they've lost a completed match in their own bracket,
// 'alive' otherwise — so the roster can mark players as they crash out
// without ever removing anyone from the list.
function buildEntrantList(categoryTeams, categoryMatches = []) {
  const byBracket = new Map();
  for (const t of categoryTeams) {
    if (!byBracket.has(t.bracket_letter)) byBracket.set(t.bracket_letter, []);
    byBracket.get(t.bracket_letter).push(t);
  }
  const matchesByBracket = new Map();
  for (const m of categoryMatches) {
    if (!matchesByBracket.has(m.bracket_letter)) matchesByBracket.set(m.bracket_letter, []);
    matchesByBracket.get(m.bracket_letter).push(m);
  }
  return [...byBracket.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, teamsInBracket]) => ({
      bracketLetter: letter,
      teams: sortedByCreation(teamsInBracket).map((t, i) => ({
        seed: i + 1,
        label: teamLabel(t),
        id: t.id,
        status: teamIsEliminated(t.id, matchesByBracket.get(letter) || []) ? 'eliminated' : 'alive',
      })),
    }));
}

// The knockout ladder a pool-play category crosses over into — same shape
// deriveLadder/generateStageMatches already use, just rendered as a tree
// instead of the vertical timeline the Playoff Stages editor shows
// organizers. `ladder` is deriveLadder(readPlan(category)) — computed by
// the caller so this module takes plain data, not a live category row.
function buildPlayoffLadderTree({ ladder, poolPairs, poolCount, advancePerPool, matches }) {
  if (!ladder?.valid || ladder.levels.length === 0) return null;
  const poMatches = matches.filter((m) => m.bracket_letter === 'PO' && m.status !== 'canceled');
  const byStage = new Map();
  for (const m of poMatches) {
    if (!byStage.has(m.playoff_stage)) byStage.set(m.playoff_stage, []);
    byStage.get(m.playoff_stage).push(m);
  }
  for (const list of byStage.values()) list.sort((a, b) => compareMatchCode(a.match_code, b.match_code));

  const firstSlots = poolCount === 1 ? expandSinglePoolSlots('A', advancePerPool) : expandFirstStageSlots(poolPairs, advancePerPool);
  const slotLabel = (slot) => `Pool ${slot.letter} · Rank ${slot.rank}`;

  const rounds = ladder.levels
    .filter((level) => level.kind !== 'third_place') // rendered as a side note, not a tree column — see thirdPlaceRow below
    .map((level, levelIndex) => {
      const real = byStage.get(level.kind) || [];
      const isFirst = levelIndex === 0;
      const matches = Array.from({ length: level.matchCount }, (_, i) => {
        const m = real[i];
        let placeholderA = null;
        let placeholderB = null;
        if (!m) {
          if (isFirst) {
            placeholderA = firstSlots[i * 2] ? slotLabel(firstSlots[i * 2].a) : null;
            placeholderB = firstSlots[i * 2] ? slotLabel(firstSlots[i * 2].b) : null;
          } else {
            const prevLabel = PLAYOFF_STAGES[ladder.levels[levelIndex - 1].kind]?.short || 'Prev';
            placeholderA = `Winner of ${prevLabel}${i * 2 + 1}`;
            placeholderB = `Winner of ${prevLabel}${i * 2 + 2}`;
          }
        }
        return matchNode({ key: `po-${level.kind}-${i}`, m, placeholderA, placeholderB });
      });
      return { id: `po-${level.kind}`, label: PLAYOFF_STAGES[level.kind]?.label || level.kind, matches };
    });

  const thirdPlaceLevel = ladder.levels.find((l) => l.kind === 'third_place');
  const thirdPlace = thirdPlaceLevel ? matchNode({ key: 'po-third', m: (byStage.get('third_place') || [])[0] }) : null;

  return { key: 'PO', title: 'Playoffs', rounds, thirdPlace };
}

// categories: category rows, each optionally carrying `ladder` (the caller
// computes deriveLadder(readPlan(category)) for playoff_enabled ones — same
// convention utils/timetable.js already uses for the same reason: keep this
// file free of Supabase imports beyond the pure helpers it borrows from
// data/playoffApi.js).
// matches: every match in the event, same shape listScheduleMatchesForEvent
// / listMatchesForCategory already produce (team_a/team_b embedded,
// bracket_letter, category_id, playoff_stage).
// teams: every team in the event, same shape listTeamsForEvent produces
// (bracket_letter, category_id attached the same way as matches above).
// Optional — omitting it only loses bye visibility and the entrant list,
// the tree itself still builds from matches alone.
export function buildBracketTreesForCategory(category, matches, teams = []) {
  if (!bracketTreeApplies(category)) return { applicable: false, trees: [], entrants: [] };
  // `category_id` is a synthetic field some callers attach (e.g.
  // listScheduleMatchesForEvent, for an event-wide list spanning every
  // category) — the matches/teams tables themselves have no such column,
  // only bracket_id. A caller that already scoped its query to one category
  // (the Preview Screen's listMatchesForCategory/snapshot) never attaches
  // it, so a missing category_id is treated as "already this category"
  // rather than filtered out.
  const belongsToCategory = (row) => row.category_id == null || row.category_id === category.id;
  const categoryMatches = matches.filter((m) => belongsToCategory(m) && m.status !== 'canceled');
  const categoryTeams = teams.filter(belongsToCategory);

  // A category switched to Single Elimination after once having pool play +
  // playoffs configured can still carry a stale playoff_enabled flag (the
  // editor hides that section for this format, but doesn't clear the field)
  // — without this guard it would render the leftover "Playoffs" ladder
  // tree instead of its real Single Elimination bracket.
  if (category.playoff_enabled && category.ladder?.valid && category.format !== 'Single Elimination') {
    const tree = buildPlayoffLadderTree({
      ladder: category.ladder,
      poolPairs: category.playoff_pool_pairs || [],
      poolCount: category.playoff_pool_count,
      advancePerPool: category.playoff_advance_per_pool,
      matches: categoryMatches,
    });
    // Entrants aren't shown for playoff-ladder categories — their full
    // roster is already visible via the pool standings table and the
    // Registered Players tab (see the plan's non-goals).
    return { applicable: true, trees: tree ? [tree] : [], entrants: [] };
  }

  if (category.format === 'Single Elimination') {
    const letters = [...new Set(categoryMatches.map((m) => m.bracket_letter))].sort();
    const trees = letters
      .map((letter) => buildSingleEliminationTree(letter, categoryMatches.filter((m) => m.bracket_letter === letter), categoryTeams.filter((t) => t.bracket_letter === letter)))
      .filter(Boolean);
    return { applicable: true, trees, entrants: buildEntrantList(categoryTeams, categoryMatches) };
  }

  return { applicable: false, trees: [], entrants: [] };
}
