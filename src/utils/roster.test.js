import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countPlayers, filterRoster, groupRoster, initials, rosterSummary } from './roster.js';

const pair = (player_name, player2_name, extra = {}) => ({ player_name, player2_name, category_id: 'a', club_name: null, ...extra });
const solo = (player_name, extra = {}) => pair(player_name, null, extra);

test('countPlayers counts both partners in a doubles entry', () => {
  assert.equal(countPlayers([pair('Ana', 'Ben'), solo('Cy')]), 3);
});

test('rosterSummary describes singles, doubles and a mix of the two', () => {
  assert.equal(rosterSummary([solo('Ana')]), '1 player');
  assert.equal(rosterSummary([solo('Ana'), solo('Ben')]), '2 players');
  assert.equal(rosterSummary([pair('Ana', 'Ben')]), '2 players in 1 team');
  assert.equal(rosterSummary([pair('Ana', 'Ben'), pair('Cy', 'Di')]), '4 players in 2 teams');
  assert.equal(rosterSummary([pair('Ana', 'Ben'), solo('Cy')]), '3 players in 2 entries');
});

test('initials use the first and last word, and cope with odd names', () => {
  assert.equal(initials('Ana Cruz'), 'AC');
  assert.equal(initials('Maria de la Cruz'), 'MC');
  assert.equal(initials('Cher'), 'C');
  assert.equal(initials('  ana   cruz '), 'AC');
  assert.equal(initials(''), '');
  assert.equal(initials(null), '');
});

test('filterRoster finds a partner, a club, and ignores case and accents', () => {
  const rows = [pair('Ana Cruz', 'Ben Reyes', { club_name: 'Makati Dink Club' }), solo('Leo Peña', { club_name: 'Cebu Paddlers' })];
  assert.deepEqual(filterRoster(rows, 'reyes'), [rows[0]]);
  assert.deepEqual(filterRoster(rows, 'CEBU'), [rows[1]]);
  assert.deepEqual(filterRoster(rows, 'pena'), [rows[1]]);
  assert.deepEqual(filterRoster(rows, 'ana makati'), [rows[0]]);
  assert.deepEqual(filterRoster(rows, 'ana cebu'), []);
  assert.deepEqual(filterRoster(rows, '   '), rows);
});

test('groupRoster keeps division order, skips empty divisions, and sorts names', () => {
  const categories = [{ id: 'b' }, { id: 'a' }, { id: 'c' }];
  const rows = [solo('Zed', { category_id: 'a' }), solo('Ana', { category_id: 'a' }), solo('Cy', { category_id: 'b' })];
  const groups = groupRoster(rows, categories);
  assert.deepEqual(
    groups.map((g) => g.category.id),
    ['b', 'a']
  );
  assert.deepEqual(
    groups[1].rows.map((r) => r.player_name),
    ['Ana', 'Zed']
  );
});

test('groupRoster leaves the rows it was given in their original order', () => {
  const rows = [solo('Zed'), solo('Ana')];
  groupRoster(rows, [{ id: 'a' }]);
  assert.equal(rows[0].player_name, 'Zed');
});
