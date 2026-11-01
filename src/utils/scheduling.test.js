import test from 'node:test';
import assert from 'node:assert/strict';
import { arePoolsReady, planSingleEliminationRound1 } from './scheduling.js';

const bracket = (letter, id = letter) => ({ id, letter });
const teamList = (bracketId, count) => Array.from({ length: count }, (_, i) => ({ id: `${bracketId}-t${i + 1}`, bracket_id: bracketId, created_at: `2026-01-01T00:00:${String(i).padStart(2, '0')}Z` }));

test('a power-of-two team count gets no byes, same as before', () => {
  const b = bracket('A');
  const { rows, byes } = planSingleEliminationRound1([b], teamList('A', 4));
  assert.equal(rows.length, 2);
  assert.equal(byes.length, 0);
  assert.deepEqual(
    rows.map((r) => [r.team_a_id, r.team_b_id]),
    [
      ['A-t1', 'A-t2'],
      ['A-t3', 'A-t4'],
    ]
  );
});

test('20 teams round up to 32 — 4 real Round 1 matches, 12 byes, exactly what a clean 4-player semifinal needs', () => {
  const b = bracket('A');
  const { rows, byes } = planSingleEliminationRound1([b], teamList('A', 20));
  assert.equal(rows.length, 4);
  assert.equal(byes.length, 12);
  assert.ok(rows.every((r) => r.round_number === 1));
  assert.deepEqual(
    rows.map((r) => [r.team_a_id, r.team_b_id]),
    [
      ['A-t1', 'A-t2'],
      ['A-t3', 'A-t4'],
      ['A-t5', 'A-t6'],
      ['A-t7', 'A-t8'],
    ]
  );
  assert.deepEqual(
    byes.map((b2) => b2.team.id),
    teamList('A', 20)
      .slice(8)
      .map((t) => t.id)
  );
});

test('a single leftover team (odd count already near a power of two) still gets exactly one bye', () => {
  const b = bracket('A');
  const { rows, byes } = planSingleEliminationRound1([b], teamList('A', 5));
  assert.equal(rows.length, 1);
  assert.equal(byes.length, 3);
});

test('multiple brackets are planned independently', () => {
  const a = bracket('A');
  const b = bracket('B', 'B');
  const { rows, byes } = planSingleEliminationRound1([a, b], [...teamList('A', 4), ...teamList('B', 3)]);
  assert.equal(rows.filter((r) => r.bracket_id === 'A').length, 2);
  assert.equal(byes.filter((x) => x.bracket.id === 'A').length, 0);
  assert.equal(rows.filter((r) => r.bracket_id === 'B').length, 1);
  assert.equal(byes.filter((x) => x.bracket.id === 'B').length, 1);
});

test('match codes stay a flat per-bracket counter, A1, A2, ... — no gaps from byes', () => {
  const b = bracket('A');
  const { rows } = planSingleEliminationRound1([b], teamList('A', 20));
  assert.deepEqual(
    rows.map((r) => r.match_code),
    ['A1', 'A2', 'A3', 'A4']
  );
});

const poolTeam = (id, over = {}) => ({ id, bracket_id: 'A', ...over });
const poolMatch = (a, b, status = 'completed', over = {}) => ({ bracket_id: 'A', team_a_id: a, team_b_id: b, status, ...over });

test('arePoolsReady: a custom games-per-team pool unlocks with fewer matches than a full round robin', () => {
  const teams = ['t1', 't2', 't3', 't4'].map((id) => poolTeam(id));
  // 2 games each: 4 matches, not the 6 a full round robin would need.
  const matches = [poolMatch('t1', 't2'), poolMatch('t3', 't4'), poolMatch('t1', 't3'), poolMatch('t2', 't4')];
  assert.equal(arePoolsReady(['A'], teams, matches).ok, true);
});

test('arePoolsReady: a removed match does not block the pool', () => {
  const teams = ['t1', 't2', 't3'].map((id) => poolTeam(id));
  assert.equal(arePoolsReady(['A'], teams, [poolMatch('t1', 't2'), poolMatch('t2', 't3')]).ok, true);
});

test('arePoolsReady: a double round robin does not unlock at the halfway point', () => {
  const teams = ['t1', 't2', 't3'].map((id) => poolTeam(id));
  const firstCycle = [poolMatch('t1', 't2'), poolMatch('t1', 't3'), poolMatch('t2', 't3')];
  const secondCycle = [poolMatch('t2', 't1', 'scheduled'), poolMatch('t3', 't1', 'scheduled'), poolMatch('t3', 't2', 'scheduled')];
  assert.equal(arePoolsReady(['A'], teams, [...firstCycle, ...secondCycle]).ok, false);
});

test('arePoolsReady: a canceled match does not hold the pool open', () => {
  const teams = ['t1', 't2', 't3'].map((id) => poolTeam(id));
  const matches = [poolMatch('t1', 't2'), poolMatch('t2', 't3'), poolMatch('t1', 't3', 'canceled')];
  assert.equal(arePoolsReady(['A'], teams, matches).ok, true);
});

test('arePoolsReady: forfeits and double forfeits count as finished', () => {
  const teams = ['t1', 't2', 't3'].map((id) => poolTeam(id));
  const matches = [
    poolMatch('t1', 't2', 'completed', { result_type: 'forfeit', winner_team_id: 't1' }),
    poolMatch('t2', 't3', 'completed', { result_type: 'double_forfeit', winner_team_id: null }),
    poolMatch('t1', 't3'),
  ];
  assert.equal(arePoolsReady(['A'], teams, matches).ok, true);
});

test('arePoolsReady: an unfinished match or an empty pool blocks', () => {
  const teams = ['t1', 't2'].map((id) => poolTeam(id));
  assert.equal(arePoolsReady(['A'], teams, [poolMatch('t1', 't2', 'scheduled')]).ok, false);
  assert.equal(arePoolsReady(['A'], teams, [poolMatch('t1', 't2', 'in_progress')]).ok, false);
  assert.equal(arePoolsReady(['A'], teams, []).ok, false);
});

test('arePoolsReady: every pool has to be finished, not just the first', () => {
  const teams = [poolTeam('t1'), poolTeam('t2'), poolTeam('t3', { bracket_id: 'B' }), poolTeam('t4', { bracket_id: 'B' })];
  const matches = [poolMatch('t1', 't2'), { ...poolMatch('t3', 't4', 'scheduled'), bracket_id: 'B' }];
  assert.equal(arePoolsReady(['A', 'B'], teams, matches).ok, false);
});

test('arePoolsReady: a team with no matches blocks, unless they withdrew', () => {
  const matches = [poolMatch('t1', 't2')];
  const late = [poolTeam('t1'), poolTeam('t2'), poolTeam('late')];
  const result = arePoolsReady(['A'], late, matches);
  assert.equal(result.ok, false);
  assert.match(result.reason, /regenerate/i);

  const withdrawn = [poolTeam('t1'), poolTeam('t2'), poolTeam('late', { withdrawn_at: '2026-11-01T00:00:00Z' })];
  assert.equal(arePoolsReady(['A'], withdrawn, matches).ok, true);
});
