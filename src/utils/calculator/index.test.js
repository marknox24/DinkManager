import test from 'node:test';
import assert from 'node:assert/strict';
import { runCalculator, createEmptyBracket, validateBracket, DEFAULT_SETTINGS } from './index.js';
import { roundRobinShape, singleEliminationShape, groupKnockoutShape, multiPoolRoundRobinShape } from './bracketMath.js';

const settings = (overrides = {}) => ({ ...DEFAULT_SETTINGS, date: '2026-06-01', courtCount: 6, ...overrides });

const bracketA = () => ({ id: 'A', name: 'Beginner RR', format: 'Round Robin', teamCount: 6, doubleRoundRobin: false, thirdPlace: false, matchDurationMinutes: null });
const bracketB = () => ({ id: 'B', name: 'Advanced Single Elim', format: 'Single Elimination', teamCount: 10, thirdPlace: true, matchDurationMinutes: null });
const bracketC = () => ({ id: 'C', name: 'Mixed Groups', format: 'Round Robin + Playoffs', groupSizes: [4, 4, 4, 4], advancePerGroup: 2, thirdPlace: false, matchDurationMinutes: null });

test('three concurrent brackets: grand total equals the sum of each bracket\'s independently-verified total — no double counting across brackets', () => {
  const result = runCalculator({ brackets: [bracketA(), bracketB(), bracketC()], settings: settings() });
  const expectedA = roundRobinShape(6).totalMatches;
  const expectedB = singleEliminationShape(10, { thirdPlace: true }).totalMatches;
  const expectedC = groupKnockoutShape({ groupSizes: [4, 4, 4, 4], advancePerGroup: 2, thirdPlace: false }).totalMatches;
  assert.equal(expectedA, 15);
  assert.equal(expectedB, 10);
  assert.equal(expectedC, 31);
  assert.equal(result.summary.totalMatches, expectedA + expectedB + expectedC);
});

test('total teams sums every bracket, including group-stage brackets by their actual group sizes', () => {
  const result = runCalculator({ brackets: [bracketA(), bracketB(), bracketC()], settings: settings() });
  assert.equal(result.summary.totalTeams, 6 + 10 + 16);
});

test('no bracket-level validation warnings for a fully valid 3-bracket configuration', () => {
  const result = runCalculator({ brackets: [bracketA(), bracketB(), bracketC()], settings: settings() });
  assert.deepEqual(
    result.warnings.filter((w) => w.type === 'bracket_invalid'),
    []
  );
});

test('a single invalid bracket is excluded with a clear warning, without breaking the other brackets\' schedule', () => {
  const broken = { id: 'X', name: 'Broken', format: 'Round Robin', teamCount: 0 };
  const result = runCalculator({ brackets: [bracketA(), broken], settings: settings() });
  const expectedA = roundRobinShape(6).totalMatches;
  assert.equal(result.summary.totalMatches, expectedA);
  assert.equal(result.warnings.filter((w) => w.type === 'bracket_invalid').length, 1);
});

test('an empty bracket list produces a clean, feasible, zero-match result instead of throwing', () => {
  const result = runCalculator({ brackets: [], settings: settings() });
  assert.equal(result.summary.totalMatches, 0);
  assert.equal(result.summary.feasible, true);
});

test('a positive delay buffer widens the projected finish into a range; zero collapses it to a single point', () => {
  const withBuffer = runCalculator({ brackets: [bracketA()], settings: settings({ delayBufferMinutes: 30 }) });
  const withoutBuffer = runCalculator({ brackets: [bracketA()], settings: settings({ delayBufferMinutes: 0 }) });
  const [lo, hi] = withBuffer.summary.projectedFinishRange;
  assert.equal(hi - lo, 30 * 60000);
  assert.equal(withoutBuffer.summary.projectedFinishRange[0], withoutBuffer.summary.projectedFinishRange[1]);
});

test('createEmptyBracket returns a valid, uniquely-identified default bracket every call', () => {
  const b1 = createEmptyBracket();
  const b2 = createEmptyBracket();
  assert.notEqual(b1.id, b2.id);
  assert.equal(validateBracket(b1).valid, true);
});

test('validateBracket flags a blank name', () => {
  const { valid, errors } = validateBracket({ ...createEmptyBracket(), name: '  ' });
  assert.equal(valid, false);
  assert.ok(errors.name);
});

test('validateBracket flags a group-stage bracket with no groups configured', () => {
  const { valid, errors } = validateBracket({ ...createEmptyBracket(), format: 'Round Robin + Playoffs', groupSizes: [] });
  assert.equal(valid, false);
  assert.ok(errors.groupSizes);
});

test('a split round robin (Novice Men: 20 teams as 4 brackets of 5) totals teams and matches with no knockout', () => {
  const novice = {
    id: 'N',
    name: 'Novice Men',
    format: 'Round Robin',
    splitIntoBrackets: true,
    groupSizes: [5, 5, 5, 5],
    doubleRoundRobin: false,
    thirdPlace: false,
    matchDurationMinutes: null,
  };
  const result = runCalculator({ brackets: [novice], settings: settings() });
  const expected = multiPoolRoundRobinShape({ groupSizes: [5, 5, 5, 5] });
  assert.equal(result.summary.totalTeams, 20);
  assert.equal(result.summary.totalMatches, expected.totalMatches); // 40
  assert.deepEqual(
    result.warnings.filter((w) => w.type === 'bracket_invalid'),
    []
  );
});

test('a split round robin alongside other formats sums independently — no double counting across brackets', () => {
  const novice = { id: 'N', name: 'Novice Men', format: 'Round Robin', splitIntoBrackets: true, groupSizes: [5, 5, 5, 5], doubleRoundRobin: false, thirdPlace: false, matchDurationMinutes: null };
  const result = runCalculator({ brackets: [bracketA(), novice], settings: settings() });
  const expectedA = roundRobinShape(6).totalMatches;
  const expectedN = multiPoolRoundRobinShape({ groupSizes: [5, 5, 5, 5] }).totalMatches;
  assert.equal(result.summary.totalMatches, expectedA + expectedN);
  assert.equal(result.summary.totalTeams, 6 + 20);
});

test('validateBracket flags a split round robin with no brackets configured, same rule as the group-stage format', () => {
  const { valid, errors } = validateBracket({ ...createEmptyBracket(), format: 'Round Robin', splitIntoBrackets: true, groupSizes: [] });
  assert.equal(valid, false);
  assert.ok(errors.groupSizes);
});

test('validateBracket does not require advancePerGroup for a split round robin (there is no knockout)', () => {
  const { valid, errors } = validateBracket({
    ...createEmptyBracket(),
    format: 'Round Robin',
    splitIntoBrackets: true,
    groupSizes: [5, 5],
    advancePerGroup: null,
  });
  assert.equal(valid, true);
  assert.equal(errors.advancePerGroup, undefined);
});
