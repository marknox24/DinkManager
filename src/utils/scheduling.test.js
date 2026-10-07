import test from 'node:test';
import assert from 'node:assert/strict';
import { planSingleEliminationRound1 } from './scheduling.js';

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
