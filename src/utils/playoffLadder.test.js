import test from 'node:test';
import assert from 'node:assert/strict';
import { categoryLadder, deriveLadder, deriveLadderFromPlan } from './playoffLadder.js';
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
