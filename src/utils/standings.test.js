import test from 'node:test';
import assert from 'node:assert/strict';
import { rankTeams, isTiedAtCut } from './standings.js';

const team = (name, wins, losses, points_for, points_against) => ({ name, wins, losses, points_for, points_against });

test('fewer losses ranks above more losses when wins are equal, even with a worse diff', () => {
  // The reported bug: 2W-1L with +23 diff must not outrank 2W-0L.
  const ranked = rankTeams([team('2W-1L +23', 2, 1, 50, 27), team('2W-0L +5', 2, 0, 25, 20)]);
  assert.equal(ranked[0].name, '2W-0L +5');
  assert.equal(ranked[0].rank, 1);
  assert.equal(ranked[1].name, '2W-1L +23');
  assert.equal(ranked[1].rank, 2);
});

test('wins still outrank losses and diff', () => {
  const ranked = rankTeams([team('2W-0L', 2, 0, 40, 10), team('3W-1L', 3, 1, 30, 29)]);
  assert.equal(ranked[0].name, '3W-1L');
});

test('diff only breaks the tie once wins and losses both match', () => {
  const ranked = rankTeams([team('A', 2, 1, 30, 20), team('B', 2, 1, 40, 25)]);
  assert.equal(ranked[0].name, 'B'); // same wins/losses, B has the bigger diff
});

test('points_for is the final tiebreak when wins, losses, and diff all match', () => {
  const ranked = rankTeams([team('A', 2, 0, 30, 20), team('B', 2, 0, 35, 25)]); // both +10 diff
  assert.equal(ranked[0].name, 'B');
});

test('isTiedAtCut requires matching losses, not just wins/diff/points_for', () => {
  // Same wins, diff, and points_for, but different losses — not a real tie.
  const ranked = [
    { wins: 2, losses: 0, diff: 20, points_for: 30, rank: 1 },
    { wins: 2, losses: 1, diff: 20, points_for: 30, rank: 2 },
  ];
  assert.equal(isTiedAtCut(ranked, 1), false);
});

test('isTiedAtCut is true for a genuine tie on every field', () => {
  const ranked = [
    { wins: 2, losses: 1, diff: 10, points_for: 30, rank: 1 },
    { wins: 2, losses: 1, diff: 10, points_for: 30, rank: 2 },
  ];
  assert.equal(isTiedAtCut(ranked, 1), true);
});
