import test from 'node:test';
import assert from 'node:assert/strict';
import { categoryLadder, deriveLadder, deriveLadderFromPlan, expandFirstStageSlots, priorStageOf, stageMatchCode } from './playoffLadder.js';
import { compareMatchCode } from './match.js';
import { buildBracketTreesForCategory } from './bracketTree.js';
import { buildTimetable } from './timetable.js';

// A category exactly as Supabase returns it — snake_case plan columns, no
// `ladder` of its own. Everything below starts from this shape on purpose:
// that's what useMatchSchedule and the Preview Screen actually hold.
const row = (over = {}) => ({
  id: 'c1',
  name: 'Men A',
  order_index: 0,
  format: 'Round Robin',
  playoff_enabled: true,
  playoff_pool_count: 2,
  playoff_pool_pairs: [['A', 'B']],
  playoff_advance_per_pool: 2,
  playoff_third_place: true,
  ...over,
});
const kinds = (ladder) => ladder.levels.map((l) => l.kind);

test('deriveLadderFromPlan reads a saved plan the same as deriveLadder reads camelCase', () => {
  const plans = [
    row(),
    row({ playoff_third_place: false }),
    row({ playoff_pool_count: 4, playoff_pool_pairs: [['A', 'C'], ['B', 'D']] }),
    row({ playoff_pool_count: 1, playoff_pool_pairs: [], playoff_advance_per_pool: 4 }),
    row({ playoff_advance_per_pool: 1 }),
    row({ playoff_pool_pairs: [] }),
  ];
  for (const plan of plans) {
    const expected = deriveLadder({
      poolCount: plan.playoff_pool_count,
      poolPairs: plan.playoff_pool_pairs,
      advancePerPool: plan.playoff_advance_per_pool,
      thirdPlace: plan.playoff_third_place,
    });
    assert.deepEqual(deriveLadderFromPlan(plan), expected);
  }
});

test('every common saved plan produces the knockout stages it describes', () => {
  assert.deepEqual(kinds(deriveLadderFromPlan(row())), ['semifinal', 'third_place', 'final']);
  assert.deepEqual(kinds(deriveLadderFromPlan(row({ playoff_third_place: false }))), ['semifinal', 'final']);
  assert.deepEqual(kinds(deriveLadderFromPlan(row({ playoff_advance_per_pool: 1 }))), ['final']);
  assert.deepEqual(kinds(deriveLadderFromPlan(row({ playoff_pool_count: 4, playoff_pool_pairs: [['A', 'C'], ['B', 'D']] }))), ['quarterfinal', 'semifinal', 'third_place', 'final']);
  assert.deepEqual(kinds(deriveLadderFromPlan(row({ playoff_pool_count: 1, playoff_pool_pairs: [], playoff_advance_per_pool: 4 }))), ['semifinal', 'third_place', 'final']);
});

test('a saved plan that really is invalid still reports why', () => {
  const ladder = deriveLadderFromPlan(row({ playoff_pool_pairs: [] }));
  assert.equal(ladder.valid, false);
  assert.match(ladder.error, /pool pair/);
});

test('categoryLadder covers the whole Round Robin family, and nothing else', () => {
  assert.equal(categoryLadder(row()).valid, true);
  assert.equal(categoryLadder(row({ format: 'Double Round Robin' })).valid, true);
  assert.equal(categoryLadder(row({ playoff_enabled: false })), null);
  assert.equal(categoryLadder(row({ format: 'Single Elimination' })), null);
  assert.equal(categoryLadder(row({ format: 'Double Elimination' })), null);
  assert.equal(categoryLadder(row({ format: null })), null);
});

// ---------------------------------------------------------------------------
// The original bug, end to end: a raw row through the same steps as
// useMatchSchedule, not a hand-written `ladder` the way older tests pass one.
// ---------------------------------------------------------------------------

const team = (id) => ({ id, player1_name: id, player2_name: null });
const playoffMatch = (over) => ({
  id: over.match_code,
  category_id: 'c1',
  bracket_letter: 'PO',
  round_number: 6,
  status: 'scheduled',
  team_a_id: `${over.match_code}-a`,
  team_b_id: `${over.match_code}-b`,
  team_a: team(`${over.match_code}-a`),
  team_b: team(`${over.match_code}-b`),
  ...over,
});
const semifinals = [playoffMatch({ match_code: 'SF1', playoff_stage: 'semifinal' }), playoffMatch({ match_code: 'SF2', playoff_stage: 'semifinal' })];

test('a pool-plus-playoffs row with generated semifinals builds its bracket tree', () => {
  const category = row();
  const { trees } = buildBracketTreesForCategory({ ...category, ladder: categoryLadder(category) }, semifinals);
  assert.equal(trees.length, 1);
  assert.equal(trees[0].title, 'Playoffs');
  assert.deepEqual(trees[0].rounds.map((r) => r.label), ['Semifinals', 'Championship']);
  assert.deepEqual(trees[0].rounds[0].matches.map((m) => m.status), ['scheduled', 'scheduled']);
  assert.equal(trees[0].rounds[1].matches[0].teamA.label, 'Winner of SF1');
  assert.equal(trees[0].thirdPlace.teamA.label, 'Loser of SF1');
});

test('a pool-plus-playoffs row projects its ungenerated stages into the timetable', () => {
  const category = row();
  const now = new Date(2026, 9, 10, 9, 0, 0).getTime();
  const event = { num_courts: 2, match_duration_minutes: 20, start_date: '2026-10-10', end_date: '2026-10-10', daily_start_time: null };
  const t = buildTimetable({ event, categories: [{ ...category, ladder: categoryLadder(category) }], matches: semifinals, now });
  assert.deepEqual(t.rows.filter((r) => r.projected).map((r) => r.playoff_stage), ['third_place', 'final']);
});

test('a stale playoff flag on a Single Elimination row projects nothing', () => {
  const category = row({ format: 'Single Elimination' });
  const now = new Date(2026, 9, 10, 9, 0, 0).getTime();
  const event = { num_courts: 2, match_duration_minutes: 20, start_date: '2026-10-10', end_date: '2026-10-10', daily_start_time: null };
  const round1 = [playoffMatch({ match_code: 'M1', bracket_letter: 'A', round_number: 1 })];
  const t = buildTimetable({ event, categories: [{ ...category, ladder: categoryLadder(category) }], matches: round1, now });
  assert.equal(t.rows.filter((r) => r.projected).length, 0);
});

// ---------------------------------------------------------------------------
// ROUND OF 16 / ROUND OF 32
// ---------------------------------------------------------------------------

const eightPools = [['A', 'E'], ['B', 'F'], ['C', 'G'], ['D', 'H']];
const sixteenPools = [['A', 'I'], ['B', 'J'], ['C', 'K'], ['D', 'L'], ['E', 'M'], ['F', 'N'], ['G', 'O'], ['H', 'P']];

test('8 pools advancing their top 2 starts at a Round of 16', () => {
  const ladder = deriveLadderFromPlan(row({ playoff_pool_count: 8, playoff_pool_pairs: eightPools }));
  assert.deepEqual(ladder.levels.map((l) => [l.kind, l.matchCount]), [
    ['round_of_16', 8],
    ['quarterfinal', 4],
    ['semifinal', 2],
    ['third_place', 1],
    ['final', 1],
  ]);
});

test('every route to 32 teams starts at a Round of 32', () => {
  const sixteenTopTwo = deriveLadderFromPlan(row({ playoff_pool_count: 16, playoff_pool_pairs: sixteenPools }));
  const eightTopFour = deriveLadderFromPlan(row({ playoff_pool_count: 8, playoff_pool_pairs: eightPools, playoff_advance_per_pool: 4 }));
  assert.deepEqual(kinds(sixteenTopTwo).slice(0, 3), ['round_of_32', 'round_of_16', 'quarterfinal']);
  assert.equal(sixteenTopTwo.levels[0].matchCount, 16);
  assert.deepEqual(kinds(eightTopFour), kinds(sixteenTopTwo));
});

test('16 pools advancing their winner also starts at a Round of 16', () => {
  assert.equal(deriveLadderFromPlan(row({ playoff_pool_count: 16, playoff_pool_pairs: sixteenPools, playoff_advance_per_pool: 1 })).levels[0].kind, 'round_of_16');
});

test('team counts a knockout cannot use are refused with the numbers that would work', () => {
  const tooMany = deriveLadderFromPlan(row({ playoff_pool_count: 16, playoff_pool_pairs: sixteenPools, playoff_advance_per_pool: 4 }));
  assert.equal(tooMany.valid, false);
  assert.match(tooMany.error, /64 teams advancing.*2, 4, 8, 16 or 32/);
  const sixPools = deriveLadderFromPlan(row({ playoff_pool_count: 6, playoff_pool_pairs: [['A', 'D'], ['B', 'E'], ['C', 'F']] }));
  assert.equal(sixPools.valid, false);
  assert.match(sixPools.error, /12 teams advancing/);
});

test('each stage is fed by the one before it in that ladder', () => {
  const ladderKinds = new Set(['round_of_32', 'round_of_16', 'quarterfinal', 'semifinal', 'third_place', 'final']);
  assert.equal(priorStageOf('round_of_32', ladderKinds), null);
  assert.equal(priorStageOf('round_of_16', ladderKinds), 'round_of_32');
  assert.equal(priorStageOf('quarterfinal', ladderKinds), 'round_of_16');
  assert.equal(priorStageOf('semifinal', ladderKinds), 'quarterfinal');
  assert.equal(priorStageOf('final', ladderKinds), 'semifinal');
  assert.equal(priorStageOf('third_place', ladderKinds), 'semifinal');
});

test('stages a smaller ladder skips are skipped when finding what feeds a stage', () => {
  const r16Start = new Set(['round_of_16', 'quarterfinal', 'semifinal', 'final']);
  assert.equal(priorStageOf('round_of_16', r16Start), null);
  const qfStart = new Set(['quarterfinal', 'semifinal', 'final']);
  assert.equal(priorStageOf('quarterfinal', qfStart), null);
  assert.equal(priorStageOf('semifinal', new Set(['semifinal', 'final'])), null);
  assert.equal(priorStageOf('final', new Set(['final'])), null);
});

test('match codes keep the round number apart from the match number', () => {
  assert.equal(stageMatchCode('round_of_16', 3), 'R16-3');
  assert.equal(stageMatchCode('round_of_32', 16), 'R32-16');
  assert.equal(stageMatchCode('quarterfinal', 2), 'QF2');
  assert.equal(stageMatchCode('third_place', 1), '3RD');
  assert.equal(stageMatchCode('final', 1), 'F');
});

test('Round of 32 codes sort numerically, so winners pair with their neighbour', () => {
  const codes = Array.from({ length: 16 }, (_, i) => stageMatchCode('round_of_32', i + 1));
  const shuffled = [...codes].sort(); // text order, which is what the database would return
  assert.notDeepEqual(shuffled, codes);
  assert.deepEqual([...shuffled].sort(compareMatchCode), codes);
});

test('a pool pair lands in opposite halves of a Round of 16, so they cannot rematch before the Final', () => {
  const slots = expandFirstStageSlots(eightPools, 2);
  assert.equal(slots.length, 8);
  const half = (letter) => slots.map((s, i) => ([s.a.letter, s.b.letter].includes(letter) ? (i < 4 ? 'top' : 'bottom') : null)).filter(Boolean);
  assert.deepEqual(half('A'), ['top', 'bottom']);
  assert.deepEqual(half('E'), ['top', 'bottom']);
});

test('a Round of 16 row builds a full tree of placeholders with matching codes', () => {
  const category = row({ playoff_pool_count: 8, playoff_pool_pairs: eightPools });
  const { trees } = buildBracketTreesForCategory({ ...category, ladder: categoryLadder(category) }, []);
  const [r16, quarters] = trees[0].rounds;
  assert.equal(r16.label, 'Round of 16');
  assert.equal(r16.matches.length, 8);
  assert.equal(r16.matches[2].matchCode, 'R16-3');
  assert.equal(r16.matches[1].teamA.label, 'Pool B · Rank 1');
  assert.equal(quarters.matches[1].teamA.label, 'Winner of R16-3');
});
