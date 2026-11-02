import test from 'node:test';
import assert from 'node:assert/strict';
import { matchChangeSignature } from './organizerSync.js';

const row = (over = {}) => ({ id: 'm1', status: 'scheduled', score_a: null, score_b: null, court: null, winner_team_id: null, result_type: 'played', running_since: null, ...over });

test('the same matches give the same fingerprint, in any order', () => {
  assert.equal(matchChangeSignature([row(), row({ id: 'm2' })]), matchChangeSignature([row({ id: 'm2' }), row()]));
});

test('everything another organizer can change shows up', () => {
  const base = matchChangeSignature([row()]);
  const changes = [{ status: 'in_progress' }, { score_a: 11 }, { score_b: 7 }, { court: 3 }, { winner_team_id: 't1' }, { result_type: 'forfeit' }, { running_since: '2026-11-02T00:00:00Z' }];
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
