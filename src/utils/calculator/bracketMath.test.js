import test from 'node:test';
import assert from 'node:assert/strict';
import { roundRobinShape, singleEliminationShape, groupKnockoutShape, multiPoolRoundRobinShape } from './bracketMath.js';

// --- Round Robin -----------------------------------------------------------

for (const n of [2, 4, 8, 12, 16]) {
  test(`round robin totalMatches for ${n} teams is n*(n-1)/2`, () => {
    const shape = roundRobinShape(n);
    assert.equal(shape.valid, true);
    assert.equal(shape.totalMatches, (n * (n - 1)) / 2);
  });
}

test('round robin rejects fewer than 2 teams without throwing', () => {
  assert.equal(roundRobinShape(1).valid, false);
  assert.equal(roundRobinShape(0).valid, false);
});

test('double round robin doubles both the match count and the round count', () => {
  const single = roundRobinShape(6);
  const double = roundRobinShape(6, { double: true });
  assert.equal(double.totalMatches, single.totalMatches * 2);
  assert.equal(double.roundCount, single.roundCount * 2);
});

// --- Single Elimination -----------------------------------------------------

test('a power-of-two team count (8) has zero byes and n-1 matches', () => {
  const shape = singleEliminationShape(8);
  assert.equal(shape.byeCount, 0);
  assert.equal(shape.totalMatches, 7);
  assert.equal(shape.rounds.map((r) => r.matches).join(','), '4,2,1');
  assert.deepEqual(
    shape.rounds.map((r) => r.label),
    ['Quarter-Final', 'Semi-Final', 'Final']
  );
});

// Every non-power-of-two case below was hand-verified against the exact
// byeCount/round-shape formula the real app's bracketTree.js uses (see
// this session's bracketTree.test.js for the same 20-team expectation).
for (const [n, byeCount, rounds] of [
  [5, 3, [1, 2, 1]],
  [6, 2, [2, 2, 1]],
  [7, 1, [3, 2, 1]],
  [10, 6, [2, 4, 2, 1]],
  [12, 4, [4, 4, 2, 1]],
  [20, 12, [4, 8, 4, 2, 1]],
]) {
  test(`single elimination for ${n} teams: ${byeCount} byes, totalMatches always n-1`, () => {
    const shape = singleEliminationShape(n);
    assert.equal(shape.byeCount, byeCount);
    assert.equal(shape.totalMatches, n - 1);
    assert.deepEqual(
      shape.rounds.map((r) => r.matches),
      rounds
    );
  });
}

test('2 teams: a single match with no real semifinal, so 3rd place is never added even if requested', () => {
  const shape = singleEliminationShape(2, { thirdPlace: true });
  assert.equal(shape.totalMatches, 1);
  assert.equal(shape.hasThirdPlace, false);
});

test('3 teams: one bye, a 2-player final — still no real semifinal to lose a 3rd-place match from', () => {
  const shape = singleEliminationShape(3, { thirdPlace: true });
  assert.equal(shape.totalMatches, 2);
  assert.equal(shape.hasThirdPlace, false);
});

test('20 teams with a real 4-player semifinal: 3rd place adds exactly one match, never two', () => {
  const withThird = singleEliminationShape(20, { thirdPlace: true });
  const withoutThird = singleEliminationShape(20, { thirdPlace: false });
  assert.equal(withThird.hasThirdPlace, true);
  assert.equal(withThird.totalMatches, withoutThird.totalMatches + 1);
  assert.equal(withThird.totalMatches, 20);
});

test('single elimination rejects fewer than 2 teams without throwing', () => {
  assert.equal(singleEliminationShape(1).valid, false);
  assert.equal(singleEliminationShape(0).valid, false);
});

// --- Group stage + knockout --------------------------------------------------

test('uneven group sizes sum the real per-group round-robin count, not an assumed equal split', () => {
  // 13 teams in 4 groups of [4,3,3,3]: 6 + 3 + 3 + 3 = 15 group matches.
  const shape = groupKnockoutShape({ groupSizes: [4, 3, 3, 3], advancePerGroup: 2 });
  assert.equal(shape.valid, true);
  assert.equal(shape.groupMatches, 15);
});

test('4 groups advancing top 2 each produces a quarterfinal-rooted knockout bracket, no double counting', () => {
  const shape = groupKnockoutShape({ groupSizes: [4, 4, 4, 4], advancePerGroup: 2, thirdPlace: true });
  assert.equal(shape.valid, true);
  assert.equal(shape.groupMatches, 24); // 4 groups x expectedRoundRobin(4) = 4x6
  // 4 pool pairs x 2 advancing = 8 teams -> QF(4) + SF(2) + 3rd(1) + Final(1) = 8
  assert.equal(shape.knockoutMatches, 8);
  assert.equal(shape.totalMatches, 32);
});

test('2 groups advancing top 1 each skips straight to a final, no semifinal to award 3rd place from', () => {
  const shape = groupKnockoutShape({ groupSizes: [5, 5], advancePerGroup: 1, thirdPlace: true });
  assert.equal(shape.valid, true);
  assert.equal(shape.knockoutLevels.length, 1);
  assert.equal(shape.knockoutLevels[0].kind, 'final');
  assert.equal(shape.knockoutMatches, 1);
});

test('4 groups advancing 4 each produces a round-of-16-rooted knockout bracket, within the supported ceiling', () => {
  // 2 pool pairs x top 4 = 16 teams advancing -> Round of 16(8) + QF(4) + SF(2) + Final(1) = 15
  const shape = groupKnockoutShape({ groupSizes: [6, 6, 6, 6], advancePerGroup: 4 });
  assert.equal(shape.valid, true);
  assert.equal(shape.knockoutMatches, 15);
});

test('a config that exceeds the knockout ceiling (beyond Round of 32) is clearly labeled invalid, not silently wrong', () => {
  // 2 pool pairs x top 16 = 32 teams advancing exactly fills Round of 32, so
  // bump to top 20 each (40 teams, not even a power of two) to go past it.
  // Group-stage count must still be reported.
  const shape = groupKnockoutShape({ groupSizes: [20, 20, 20, 20], advancePerGroup: 20 });
  assert.equal(shape.valid, false);
  assert.ok(shape.error);
  assert.ok(shape.groupMatches > 0);
  assert.equal(shape.knockoutMatches, 0);
});

test('3 groups cannot be evenly crossed into a knockout bracket — flagged, not forced', () => {
  const shape = groupKnockoutShape({ groupSizes: [4, 4, 4], advancePerGroup: 2 });
  assert.equal(shape.valid, false);
  assert.match(shape.error, /3 groups/);
  assert.ok(shape.groupMatches > 0);
});

test('group knockout rejects a group with fewer than 2 teams, and zero teams advancing, without throwing', () => {
  assert.equal(groupKnockoutShape({ groupSizes: [1, 4], advancePerGroup: 2 }).valid, false);
  assert.equal(groupKnockoutShape({ groupSizes: [4, 4], advancePerGroup: 0 }).valid, false);
});

// --- Multi-pool round robin (independent brackets, no knockout) -------------

test('20 teams split into 4 brackets of 5: 10 matches per bracket, 40 total, each team plays 4', () => {
  const shape = multiPoolRoundRobinShape({ groupSizes: [5, 5, 5, 5] });
  assert.equal(shape.valid, true);
  assert.equal(shape.poolCount, 4);
  assert.deepEqual(shape.poolMatches, [10, 10, 10, 10]);
  assert.equal(shape.totalMatches, 40);
  // Each team plays every other team in its own 5-team bracket once: n-1 = 4.
  assert.equal(roundRobinShape(5).perTeam, 4);
});

test('uneven bracket sizes sum the real per-bracket round-robin count, not an assumed equal split', () => {
  const shape = multiPoolRoundRobinShape({ groupSizes: [6, 5, 5, 4] });
  assert.equal(shape.valid, true);
  assert.deepEqual(shape.poolMatches, [15, 10, 10, 6]);
  assert.equal(shape.totalMatches, 41);
});

test('multi-pool round robin produces no knockout — totalMatches is only the pool matches', () => {
  const shape = multiPoolRoundRobinShape({ groupSizes: [4, 4] });
  assert.equal(shape.totalMatches, roundRobinShape(4).totalMatches * 2);
  assert.equal('knockoutMatches' in shape, false);
});

test('double round robin doubles every pool\'s match count', () => {
  const single = multiPoolRoundRobinShape({ groupSizes: [5, 5] });
  const double = multiPoolRoundRobinShape({ groupSizes: [5, 5], double: true });
  assert.equal(double.totalMatches, single.totalMatches * 2);
});

test('multi-pool round robin rejects an empty list and a bracket with fewer than 2 teams, without throwing', () => {
  assert.equal(multiPoolRoundRobinShape({ groupSizes: [] }).valid, false);
  assert.equal(multiPoolRoundRobinShape({ groupSizes: [1, 5] }).valid, false);
});
