import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatReleaseDate, keepRecent, parseChangelog, releaseNoteFromCommit, releaseNotesFromCommits } from './releaseNotes.js';

const c = (sha, message, date = '2026-11-24T05:29:24Z') => ({ sha: sha.padEnd(40, '0'), message, date });

test('reads the title, type and breakdown from Changelog lines', () => {
  const n = releaseNoteFromCommit(
    c(
      'aaaaaaa',
      'Refactor sheets\n\n- dev notes\n\nChangelog: Added score sheet V2\nChangelog-type: feature\nChangelog-detail: Three strips per page\nChangelog-detail: Pick V1 or V2\n\nCo-Authored-By: x'
    )
  );
  assert.deepEqual(n, {
    sha: 'aaaaaaa',
    title: 'Added score sheet V2',
    type: 'Feature',
    details: ['Three strips per page', 'Pick V1 or V2'],
    date: '2026-11-24T05:29:24Z',
  });
});

test('guesses the type when Changelog-type is missing', () => {
  assert.equal(parseChangelog('x\n\nChangelog: Fixed a crash').type, 'Fix');
  assert.equal(parseChangelog('x\n\nChangelog: Faster check-in on busy days').type, 'Performance');
  assert.equal(parseChangelog('x\n\nChangelog: Added a thing').type, 'Feature');
});

test('commits without Changelog lines are internal, unless described in the history', () => {
  assert.equal(releaseNoteFromCommit(c('ddddddd', 'Add Tier 1 verification query')), null);
  assert.equal(releaseNoteFromCommit(c('eeeeeee', 'x\n\nChangelog: skip')), null);
  const historical = releaseNoteFromCommit(c('f6925b2', 'Add score sheet template V2 (rally strip) with a V1/V2 picker'));
  assert.equal(historical.type, 'Feature');
  assert.ok(historical.details.length > 0);
});

test('keeps the newest N visitor-facing updates', () => {
  const notes = releaseNotesFromCommits(
    [c('1111111', 'internal'), c('2222222', 'x\n\nChangelog: Added A'), c('3333333', 'x\n\nChangelog: Added B'), c('4444444', 'x\n\nChangelog: Added C')],
    2
  );
  assert.deepEqual(
    notes.map((n) => n.title),
    ['Added A', 'Added B']
  );
});

test('the full list keeps about 2 months, but never fewer than the newest few', () => {
  const now = Date.parse('2026-11-25T00:00:00Z');
  const day = 24 * 60 * 60 * 1000;
  const notes = [1, 10, 50, 70, 90, 120].map((d, i) => ({ title: `U${i}`, date: new Date(now - d * day).toISOString() }));
  assert.deepEqual(
    keepRecent(notes, { now, min: 2 }).map((n) => n.title),
    ['U0', 'U1', 'U2']
  );
  assert.equal(keepRecent(notes, { now, min: 5 }).length, 5);
});

test('formats dates in Manila time', () => {
  assert.equal(formatReleaseDate('2026-11-24T05:29:24Z'), 'Nov 24, 2026 · 1:29 PM');
  assert.equal(formatReleaseDate('nope'), '');
});
