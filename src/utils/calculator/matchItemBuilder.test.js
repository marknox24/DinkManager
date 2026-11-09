import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBracketItems } from './matchItemBuilder.js';
import { roundRobinShape, singleEliminationShape, groupKnockoutShape, multiPoolRoundRobinShape } from './bracketMath.js';

const rrBracket = (overrides = {}) => ({
  id: 'b1',
  name: 'Open Division',
  format: 'Round Robin',
  teamCount: 6,
  doubleRoundRobin: false,
  thirdPlace: false,
  matchDurationMinutes: null,
  ...overrides,
});

test('round robin items: one non-projected item per match, count matches the formula', () => {
  const { items, warnings } = buildBracketItems(rrBracket(), 20);
  assert.deepEqual(warnings, []);
  const shape = roundRobinShape(6);
  assert.equal(items.length, shape.totalMatches);
  assert.ok(items.every((it) => it.projected === false && it.stage === 'group'));
  assert.ok(items.every((it) => it.matchMinutes === 20));
});

test('double round robin doubles the item count, with the reverse-order second cycle', () => {
  const { items } = buildBracketItems(rrBracket({ doubleRoundRobin: true }), 20);
  const shape = roundRobinShape(6, { double: true });
  assert.equal(items.length, shape.totalMatches);
});

test('a bracket-specific match duration overrides the global default', () => {
  const { items } = buildBracketItems(rrBracket({ matchDurationMinutes: 30 }), 20);
  assert.ok(items.every((it) => it.matchMinutes === 30));
});

test('single elimination (6 teams, no byes consumed into court time): real matches equal n-1, byes are zero-duration and separate', () => {
  const bracket = { id: 'b2', name: 'Elite', format: 'Single Elimination', teamCount: 6, thirdPlace: false, matchDurationMinutes: null };
  const { items } = buildBracketItems(bracket, 20);
  const shape = singleEliminationShape(6);
  const real = items.filter((it) => !it.isBye);
  const byes = items.filter((it) => it.isBye);
  assert.equal(real.length, shape.totalMatches); // 5
  assert.equal(byes.length, shape.byeCount); // 2
  assert.ok(byes.every((it) => it.matchMinutes === 0 && it.teamBId === null));
});

test('single elimination round-1 items are not projected (real matches) and round-2+ items are projected placeholders', () => {
  const bracket = { id: 'b3', name: 'Elite', format: 'Single Elimination', teamCount: 10, thirdPlace: false, matchDurationMinutes: null };
  const { items } = buildBracketItems(bracket, 20);
  const round1 = items.filter((it) => it.roundNumber === 1 && !it.isBye);
  const laterRounds = items.filter((it) => it.roundNumber > 1);
  assert.ok(round1.every((it) => it.projected === false && it.teamAId && it.teamBId));
  assert.ok(laterRounds.every((it) => it.projected === true && it.teamAId === null && it.teamBId === null));
});

test('single elimination with a real semifinal adds exactly one 3rd-place item, tagged isThirdPlace', () => {
  const bracket = { id: 'b4', name: 'Elite', format: 'Single Elimination', teamCount: 20, thirdPlace: true, matchDurationMinutes: null };
  const { items } = buildBracketItems(bracket, 20);
  const shape = singleEliminationShape(20, { thirdPlace: true });
  const real = items.filter((it) => !it.isBye);
  const thirdPlace = items.filter((it) => it.isThirdPlace);
  assert.equal(real.length, shape.totalMatches); // 20 (19 bracket + 1 third place)
  assert.equal(thirdPlace.length, 1);
});

test('a too-small bracket for 3rd place (2 teams) never produces a 3rd-place item', () => {
  const bracket = { id: 'b5', name: 'Elite', format: 'Single Elimination', teamCount: 2, thirdPlace: true, matchDurationMinutes: null };
  const { items } = buildBracketItems(bracket, 20);
  assert.equal(items.filter((it) => it.isThirdPlace).length, 0);
  assert.equal(items.filter((it) => !it.isBye).length, 1);
});

test('group stage + knockout: group item count matches uneven per-group round robin sums, knockout matches the ladder', () => {
  const bracket = {
    id: 'b6',
    name: 'Mixed Doubles',
    format: 'Round Robin + Playoffs',
    groupSizes: [4, 3, 3, 3],
    advancePerGroup: 2,
    thirdPlace: false,
    matchDurationMinutes: null,
  };
  const { items } = buildBracketItems(bracket, 20);
  const shape = groupKnockoutShape({ groupSizes: [4, 3, 3, 3], advancePerGroup: 2, thirdPlace: false });
  assert.equal(shape.valid, true);
  const groupItems = items.filter((it) => it.stage === 'group');
  const knockoutItems = items.filter((it) => it.stage === 'knockout');
  assert.equal(groupItems.length, shape.groupMatches);
  assert.equal(knockoutItems.length, shape.knockoutMatches);
  assert.ok(groupItems.every((it) => it.projected === false));
  assert.ok(knockoutItems.every((it) => it.projected === true));
});

test('knockout items in a group bracket are numbered to round after every group round, so the dependency gate waits for the whole group stage', () => {
  const bracket = {
    id: 'b7',
    name: 'Mixed Doubles',
    format: 'Round Robin + Playoffs',
    groupSizes: [4, 4],
    advancePerGroup: 2,
    thirdPlace: true,
    matchDurationMinutes: null,
  };
  const { items } = buildBracketItems(bracket, 20);
  const maxGroupRound = Math.max(...items.filter((it) => it.stage === 'group').map((it) => it.roundNumber));
  const knockout = items.filter((it) => it.stage === 'knockout');
  assert.ok(knockout.every((it) => it.roundNumber > maxGroupRound));
});

test('split round robin: 20 teams as 4 brackets of 5, no knockout, matches the pure pool-sum formula', () => {
  const bracket = {
    id: 'b8',
    name: 'Novice Men',
    format: 'Round Robin',
    splitIntoBrackets: true,
    groupSizes: [5, 5, 5, 5],
    doubleRoundRobin: false,
    matchDurationMinutes: null,
  };
  const { items, warnings } = buildBracketItems(bracket, 20);
  assert.deepEqual(warnings, []);
  const shape = multiPoolRoundRobinShape({ groupSizes: [5, 5, 5, 5] });
  assert.equal(items.length, shape.totalMatches); // 40
  assert.ok(items.every((it) => it.stage === 'group' && it.projected === false));
  assert.ok(items.every((it) => !it.isBye));
  // Each team plays exactly 4 matches (n-1 within its own 5-team bracket).
  const perTeamCounts = new Map();
  items.forEach((it) => {
    perTeamCounts.set(it.teamAId, (perTeamCounts.get(it.teamAId) || 0) + 1);
    perTeamCounts.set(it.teamBId, (perTeamCounts.get(it.teamBId) || 0) + 1);
  });
  assert.ok([...perTeamCounts.values()].every((n) => n === 4));
});

test('split round robin brackets are independent — same round number across brackets, labeled Bracket A/B/...', () => {
  const bracket = {
    id: 'b9',
    name: 'Novice Men',
    format: 'Round Robin',
    splitIntoBrackets: true,
    groupSizes: [4, 4],
    doubleRoundRobin: false,
    matchDurationMinutes: null,
  };
  const { items } = buildBracketItems(bracket, 20);
  const bracketA = items.filter((it) => it.matchLabel.startsWith('Bracket A'));
  const bracketB = items.filter((it) => it.matchLabel.startsWith('Bracket B'));
  assert.equal(bracketA.length, roundRobinShape(4).totalMatches);
  assert.equal(bracketB.length, roundRobinShape(4).totalMatches);
  // Round 1 of bracket B is NOT offset past bracket A's rounds — they're independent pools.
  assert.ok(bracketB.some((it) => it.roundNumber === 1));
});

test('a plain Round Robin bracket ignores groupSizes unless splitIntoBrackets is on', () => {
  const { items } = buildBracketItems(rrBracket({ groupSizes: [2, 2, 2] }), 20);
  const shape = roundRobinShape(6);
  assert.equal(items.length, shape.totalMatches); // uses teamCount, not groupSizes
});

test('a blank bracket name produces no items and a clear warning instead of throwing', () => {
  const { items, warnings } = buildBracketItems(rrBracket({ name: '  ' }), 20);
  assert.deepEqual(items, []);
  assert.equal(warnings.length, 1);
});

test('an invalid team count (0 or 1) produces no items and surfaces the bracket name in the warning', () => {
  const { items, warnings } = buildBracketItems(rrBracket({ teamCount: 1 }), 20);
  assert.deepEqual(items, []);
  assert.match(warnings[0], /Open Division/);
});

test('an unsupported format string is rejected explicitly, never silently treated as another format', () => {
  const { items, warnings } = buildBracketItems(rrBracket({ format: 'Swiss' }), 20);
  assert.deepEqual(items, []);
  assert.match(warnings[0], /unsupported format/);
});

// --- Playoffs as a Round Robin switch ---------------------------------------

test('round robin with playoffs on and groups split: same group + knockout result as the legacy format', () => {
  const switched = buildBracketItems(rrBracket({ teamCount: 16, splitIntoBrackets: true, groupSizes: [4, 4, 4, 4], playoffs: true, advancePerGroup: 2 }), 20);
  const legacy = buildBracketItems(rrBracket({ format: 'Round Robin + Playoffs', groupSizes: [4, 4, 4, 4], advancePerGroup: 2 }), 20);
  assert.deepEqual(switched.warnings, []);
  assert.equal(switched.items.length, legacy.items.length);
  assert.equal(switched.items.filter((it) => it.stage === 'knockout').length, 7); // QF 4 + SF 2 + F 1
});

test('round robin with playoffs on and one group: the whole field is one group seeding its own top 4', () => {
  const { items, warnings } = buildBracketItems(rrBracket({ teamCount: 8, playoffs: true, advancePerGroup: 4 }), 20);
  assert.deepEqual(warnings, []);
  assert.equal(items.filter((it) => it.stage === 'group').length, roundRobinShape(8).totalMatches);
  assert.equal(items.filter((it) => it.stage === 'knockout').length, 3); // SF 2 + F 1
});

test('double round robin with playoffs doubles the group stage, not the knockout', () => {
  const single = buildBracketItems(rrBracket({ teamCount: 8, splitIntoBrackets: true, groupSizes: [4, 4], playoffs: true, advancePerGroup: 2 }), 20);
  const double = buildBracketItems(rrBracket({ teamCount: 8, splitIntoBrackets: true, groupSizes: [4, 4], playoffs: true, advancePerGroup: 2, doubleRoundRobin: true }), 20);
  const groups = (r) => r.items.filter((it) => it.stage === 'group').length;
  const knockout = (r) => r.items.filter((it) => it.stage === 'knockout').length;
  assert.equal(groups(double), groups(single) * 2);
  assert.equal(knockout(double), knockout(single));
});

test('playoffs switch is ignored for single elimination', () => {
  const bracket = { id: 'b9', name: 'Elite', format: 'Single Elimination', teamCount: 8, thirdPlace: false, playoffs: true, matchDurationMinutes: null };
  const { items } = buildBracketItems(bracket, 20);
  assert.ok(items.every((it) => it.stage !== 'group'));
  assert.equal(items.filter((it) => !it.isBye).length, 7);
});

test('advancing more teams than the smallest group holds is flagged, not scheduled', () => {
  const { items, warnings } = buildBracketItems(rrBracket({ teamCount: 7, splitIntoBrackets: true, groupSizes: [4, 3], playoffs: true, advancePerGroup: 4 }), 20);
  assert.equal(items.length, 0);
  assert.match(warnings[0], /Group B has only 3 teams/);
});
