import test from 'node:test';
import assert from 'node:assert/strict';
import { flattenCheckinRows, findOtherCategoryMatches } from './checkin.js';

test('flattenCheckinRows produces one entry for a singles row', () => {
  const entries = flattenCheckinRows([{ id: 'r1', category_id: 'cA', player_name: 'Jasper Susada', player2_name: null, player1_checked_in_at: null, player2_checked_in_at: null }]);
  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0], { regId: 'r1', slot: 'player1', categoryId: 'cA', name: 'Jasper Susada', checkedIn: false });
});

test('flattenCheckinRows produces two entries for a doubles row', () => {
  const entries = flattenCheckinRows([
    { id: 'r1', category_id: 'cA', player_name: 'Jasper Susada', player2_name: 'Zeth Mansing', player1_checked_in_at: '2026-10-06T10:00:00Z', player2_checked_in_at: null },
  ]);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].slot, 'player1');
  assert.equal(entries[0].checkedIn, true);
  assert.equal(entries[1].slot, 'player2');
  assert.equal(entries[1].name, 'Zeth Mansing');
  assert.equal(entries[1].checkedIn, false);
});

const entry = (over) => ({ regId: 'r', slot: 'player1', categoryId: 'cA', name: 'Jasper Susada', checkedIn: false, ...over });

test('finds a same-name match in a different category', () => {
  const matches = findOtherCategoryMatches([entry({ regId: 'r2', categoryId: 'cB' })], { excludeCategoryId: 'cA', name: 'Jasper Susada' });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].categoryId, 'cB');
});

test('name matching is case- and whitespace-insensitive', () => {
  const matches = findOtherCategoryMatches([entry({ regId: 'r2', categoryId: 'cB', name: '  JASPER susada  ' })], { excludeCategoryId: 'cA', name: 'Jasper Susada' });
  assert.equal(matches.length, 1);
});

test('excludes entries in the same category', () => {
  const matches = findOtherCategoryMatches([entry({ regId: 'r2', categoryId: 'cA' })], { excludeCategoryId: 'cA', name: 'Jasper Susada' });
  assert.equal(matches.length, 0);
});

test('excludes entries already checked in', () => {
  const matches = findOtherCategoryMatches([entry({ regId: 'r2', categoryId: 'cB', checkedIn: true })], { excludeCategoryId: 'cA', name: 'Jasper Susada' });
  assert.equal(matches.length, 0);
});

test('excludes non-matching names', () => {
  const matches = findOtherCategoryMatches([entry({ regId: 'r2', categoryId: 'cB', name: 'Someone Else' })], { excludeCategoryId: 'cA', name: 'Jasper Susada' });
  assert.equal(matches.length, 0);
});

test('matches via either slot', () => {
  const entries = [
    entry({ regId: 'r2', slot: 'player1', categoryId: 'cB', name: 'Someone Else' }),
    entry({ regId: 'r2', slot: 'player2', categoryId: 'cB', name: 'Jasper Susada' }),
  ];
  const matches = findOtherCategoryMatches(entries, { excludeCategoryId: 'cA', name: 'Jasper Susada' });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].slot, 'player2');
});

test('returns nothing for a blank name', () => {
  const matches = findOtherCategoryMatches([entry({ regId: 'r2', categoryId: 'cB' })], { excludeCategoryId: 'cA', name: '' });
  assert.equal(matches.length, 0);
});
