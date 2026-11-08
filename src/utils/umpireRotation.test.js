import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gamesLabel, rankUmpires, umpireRotation, workloadFromMatches } from './umpireRotation.js';

const match = (umpire_name, extra = {}) => ({ umpire_name, status: 'completed', result_type: 'played', finished_at: '2026-11-08T01:00:00+00:00', ...extra });
const ump = (name, id = name) => ({ id, name });
const work = (umpire_name, completed_count, last_finished_at = null) => ({ umpire_name, completed_count, last_finished_at });

test('workloadFromMatches only credits played, completed games with an umpire', () => {
  const rows = workloadFromMatches([
    match('Ana'),
    match('Ana', { finished_at: '2026-11-08T03:00:00Z' }),
    match('Ben'),
    match('Ben', { status: 'in_progress' }),
    match('Ben', { status: 'scheduled' }),
    match('Ben', { status: 'canceled' }),
    match('Ben', { result_type: 'forfeit' }),
    match('Ben', { result_type: 'double_forfeit' }),
    match(null),
  ]);
  assert.deepEqual(rows, [work('Ana', 2, '2026-11-08T03:00:00Z'), work('Ben', 1, '2026-11-08T01:00:00+00:00')]);
});

test('workloadFromMatches treats an older row with no result_type as played', () => {
  const { result_type: _r, ...legacy } = match('Ana');
  assert.equal(workloadFromMatches([legacy])[0].completed_count, 1);
});

test('umpireRotation sorts fewest first and adds up the totals', () => {
  const { rows, totals } = umpireRotation([ump('Cy'), ump('Ana'), ump('Ben')], [work('Ana', 4), work('Ben', 1)]);
  assert.deepEqual(
    rows.map((r) => [r.name, r.count]),
    [
      ['Cy', 0],
      ['Ben', 1],
      ['Ana', 4],
    ]
  );
  assert.deepEqual(totals, { umpires: 3, games: 5, average: 5 / 3, fewest: 0, most: 4 });
  assert.deepEqual(
    rows.map((r) => r.share),
    [0, 0.25, 1]
  );
});

test('umpireRotation highlights everyone tied for fewest, but not a level pool', () => {
  const uneven = umpireRotation([ump('Ana'), ump('Ben'), ump('Cy')], [work('Ana', 2), work('Ben', 2), work('Cy', 3)]);
  assert.deepEqual(
    uneven.rows.map((r) => [r.name, r.fewest]),
    [
      ['Ana', true],
      ['Ben', true],
      ['Cy', false],
    ]
  );
  const level = umpireRotation([ump('Ana'), ump('Ben')], [work('Ana', 2), work('Ben', 2)]);
  assert.ok(level.rows.every((r) => !r.fewest));
});

test('umpireRotation keeps games of umpires no longer in the pool', () => {
  const { rows, removed, totals } = umpireRotation([ump('Ana')], [work('Ana', 1), work('Old Name', 3)]);
  assert.equal(rows.length, 1);
  assert.deepEqual(
    removed.map((r) => [r.name, r.count, r.fewest]),
    [['Old Name', 3, false]]
  );
  assert.equal(totals.games, 4);
  assert.equal(totals.most, 1);
  assert.equal(rows[0].share, 1 / 3);
});

test('umpireRotation marks who is on court', () => {
  const { rows } = umpireRotation([ump('Ana'), ump('Ben')], [], [{ umpire_name: 'Ben' }, { umpire_name: null }]);
  assert.deepEqual(
    rows.map((r) => [r.name, r.onCourt]),
    [
      ['Ana', false],
      ['Ben', true],
    ]
  );
});

test('umpireRotation copes with an empty pool', () => {
  assert.deepEqual(umpireRotation([], []).totals, { umpires: 0, games: 0, average: 0, fewest: 0, most: 0 });
});

test('rankUmpires puts the fewest games first', () => {
  const ranked = rankUmpires([ump('Ana'), ump('Ben'), ump('Cy')], [work('Ana', 3), work('Ben', 1), work('Cy', 2)]);
  assert.deepEqual(
    ranked.map((r) => r.umpire.name),
    ['Ben', 'Cy', 'Ana']
  );
  assert.equal(ranked[2].share, 1);
});

test('rankUmpires breaks a tie by who has rested longest, then pool order', () => {
  const ranked = rankUmpires(
    [ump('Ana'), ump('Ben'), ump('Cy'), ump('Di')],
    [work('Ana', 1, '2026-11-08T05:00:00+00:00'), work('Ben', 1, '2026-11-08T02:00:00Z'), work('Cy', 1, '2026-11-08T04:00:00+00:00')]
  );
  assert.deepEqual(
    ranked.map((r) => r.umpire.name),
    ['Di', 'Ben', 'Cy', 'Ana']
  );
  const fresh = rankUmpires([ump('Zed'), ump('Amy')], []);
  assert.deepEqual(
    fresh.map((r) => r.umpire.name),
    ['Zed', 'Amy']
  );
});

test('gamesLabel', () => {
  assert.equal(gamesLabel(0), '0 games');
  assert.equal(gamesLabel(1), '1 game');
  assert.equal(gamesLabel(4), '4 games');
});
