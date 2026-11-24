import test from 'node:test';
import assert from 'node:assert/strict';
import { changedMatchScopes, matchChangeSignature, matchChangeSignatures } from './organizerSync.js';

const row = (over = {}) => ({ id: 'm1', status: 'scheduled', score_a: null, score_b: null, court: null, winner_team_id: null, result_type: 'played', running_since: null, umpire_name: null, ...over });

test('the same matches give the same fingerprint, in any order', () => {
  assert.equal(matchChangeSignature([row(), row({ id: 'm2' })]), matchChangeSignature([row({ id: 'm2' }), row()]));
});

test('everything another organizer can change shows up', () => {
  const base = matchChangeSignature([row()]);
  const changes = [{ status: 'in_progress' }, { score_a: 11 }, { score_b: 7 }, { court: 3 }, { winner_team_id: 't1' }, { result_type: 'forfeit' }, { running_since: '2026-11-02T00:00:00Z' }, { umpire_name: 'Ana' }];
  for (const change of changes) assert.notEqual(matchChangeSignature([row(change)]), base, JSON.stringify(change));
});

test('a new or removed match shows up', () => {
  const one = matchChangeSignature([row()]);
  assert.notEqual(matchChangeSignature([row(), row({ id: 'm2' })]), one);
  assert.notEqual(matchChangeSignature([]), one);
});

test('fields organizers do not change here are ignored, so idle screens stay idle', () => {
  assert.equal(matchChangeSignature([row({ bracket: { category_id: 'a' } })]), matchChangeSignature([row({ bracket: { category_id: 'b' } })]));
});

const inCat = (cat, over = {}) => row({ bracket: { category_id: cat }, ...over });

test('nothing moved: no scopes, so the screen skips its reload', () => {
  const rows = [inCat('a'), inCat('b', { id: 'm2', status: 'in_progress', court: 1 })];
  assert.equal(changedMatchScopes(matchChangeSignatures(rows), matchChangeSignatures(rows.map((r) => ({ ...r })))), null);
});

test('a result in another category names only that category, not the court list', () => {
  const before = [inCat('a'), inCat('b', { id: 'm2' })];
  const after = [inCat('a'), inCat('b', { id: 'm2', court: 4 })];
  const changed = changedMatchScopes(matchChangeSignatures(before), matchChangeSignatures(after));
  assert.deepEqual([...changed.categories], ['b']);
  assert.equal(changed.live, false);
});

test('a match going on or off court flags the court list too', () => {
  const idle = [inCat('a')];
  const playing = [inCat('a', { status: 'in_progress', court: 2 })];
  const done = [inCat('a', { status: 'completed', score_a: 11, score_b: 5, winner_team_id: 't1' })];
  const started = changedMatchScopes(matchChangeSignatures(idle), matchChangeSignatures(playing));
  assert.deepEqual([...started.categories], ['a']);
  assert.equal(started.live, true);
  assert.equal(changedMatchScopes(matchChangeSignatures(playing), matchChangeSignatures(done)).live, true);
});

test('a category whose matches were all deleted still counts as changed', () => {
  const changed = changedMatchScopes(matchChangeSignatures([inCat('a'), inCat('b', { id: 'm2' })]), matchChangeSignatures([inCat('a')]));
  assert.deepEqual([...changed.categories], ['b']);
});
