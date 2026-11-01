import test from 'node:test';
import assert from 'node:assert/strict';
import { FORFEIT_POINTS, forfeitResult, hasDependentMatch, isDoubleForfeit, matchIsDecided, resolveFixture } from './forfeit.js';

test('forfeitResult: the winner gets the forfeit score on their own side', () => {
  assert.deepEqual(forfeitResult('a', 'a'), { result_type: 'forfeit', score_a: FORFEIT_POINTS, score_b: 0, winner_team_id: 'a' });
  assert.deepEqual(forfeitResult('a', 'b'), { result_type: 'forfeit', score_a: 0, score_b: FORFEIT_POINTS, winner_team_id: 'b' });
});

test('forfeitResult: no winner is a 0-0 double forfeit', () => {
  assert.deepEqual(forfeitResult('a', null), { result_type: 'double_forfeit', score_a: 0, score_b: 0, winner_team_id: null });
});

test('matchIsDecided: needs completion and either a winner or a double forfeit', () => {
  assert.equal(matchIsDecided({ status: 'completed', winner_team_id: 'a', result_type: 'played' }), true);
  assert.equal(matchIsDecided({ status: 'completed', winner_team_id: null, result_type: 'double_forfeit' }), true);
  assert.equal(matchIsDecided({ status: 'scheduled', winner_team_id: null, result_type: 'played' }), false);
  assert.equal(matchIsDecided({ status: 'completed', winner_team_id: null, result_type: 'played' }), false);
  assert.equal(isDoubleForfeit({ result_type: 'forfeit' }), false);
});

test('hasDependentMatch: a semifinal feeds the Final and 3rd place, which feed nothing', () => {
  const row = (id, round, a, b, bracket = 'PO') => ({ id, bracket_id: bracket, round_number: round, team_a_id: a, team_b_id: b });
  const sf1 = row('sf1', 6, 'a', 'b');
  const sf2 = row('sf2', 6, 'c', 'd');
  const third = row('third', 7, 'b', 'd');
  const final = row('final', 8, 'a', 'c');
  const all = [sf1, sf2, third, final];
  assert.equal(hasDependentMatch(sf1, all), true);
  assert.equal(hasDependentMatch(sf2, [sf1, sf2, third]), true);
  assert.equal(hasDependentMatch(third, all), false);
  assert.equal(hasDependentMatch(final, all), false);
});

test('hasDependentMatch: Single Elimination puts 3rd place after the Final, which still does not lock it', () => {
  const row = (id, round, a, b) => ({ id, bracket_id: 'A', round_number: round, team_a_id: a, team_b_id: b });
  const final = row('final', 2, 'a', 'c');
  const third = row('third', 3, 'b', 'd');
  assert.equal(hasDependentMatch(final, [final, third]), false);
});

test('hasDependentMatch: nothing built yet, or a match in another bracket, does not lock', () => {
  const row = (id, bracket, round, a, b) => ({ id, bracket_id: bracket, round_number: round, team_a_id: a, team_b_id: b });
  const m = row('m', 'A', 1, 'a', 'b');
  assert.equal(hasDependentMatch(m, [m]), false);
  assert.equal(hasDependentMatch(m, [m, row('x', 'B', 2, 'a', 'z')]), false);
});

test('resolveFixture: two available teams get a normal scheduled match', () => {
  assert.deepEqual(resolveFixture({ teamA: 'a', teamB: 'b' }), { team_a_id: 'a', team_b_id: 'b', status: 'scheduled' });
});

test('resolveFixture: a dead side loses by walkover, on either side', () => {
  assert.deepEqual(resolveFixture({ teamA: 'a', teamB: 'b', deadB: true }), {
    team_a_id: 'a',
    team_b_id: 'b',
    status: 'completed',
    result_type: 'forfeit',
    score_a: FORFEIT_POINTS,
    score_b: 0,
    winner_team_id: 'a',
  });
  const r = resolveFixture({ teamA: 'a', teamB: 'b', deadA: true });
  assert.equal(r.winner_team_id, 'b');
  assert.equal(r.score_b, FORFEIT_POINTS);
});

test('resolveFixture: a withdrawn team loses by walkover', () => {
  const r = resolveFixture({ teamA: 'a', teamB: 'b', withdrawnIds: new Set(['a']) });
  assert.equal(r.status, 'completed');
  assert.equal(r.result_type, 'forfeit');
  assert.equal(r.winner_team_id, 'b');
  assert.equal(r.auto_forfeit_team_id, 'a');
});

test('resolveFixture: both sides out is a double forfeit with no winner', () => {
  for (const args of [
    { deadA: true, deadB: true },
    { deadA: true, withdrawnIds: new Set(['b']) },
    { withdrawnIds: new Set(['a', 'b']) },
  ]) {
    const r = resolveFixture({ teamA: 'a', teamB: 'b', ...args });
    assert.equal(r.status, 'completed');
    assert.equal(r.result_type, 'double_forfeit');
    assert.equal(r.winner_team_id, null);
    assert.equal(r.score_a, 0);
    assert.equal(r.score_b, 0);
  }
});
