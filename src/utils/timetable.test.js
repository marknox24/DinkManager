import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTimetable } from './timetable.js';

const MIN = 60000;
const NOW = new Date(2026, 9, 10, 9, 0, 0).getTime();
const event = { num_courts: 2, match_duration_minutes: 20, start_date: '2026-10-10', end_date: '2026-10-10', daily_start_time: null };
const cats = [
  { id: 'c1', name: 'Men A', order_index: 0 },
  { id: 'c2', name: 'Women A', order_index: 1 },
];
const team = (id) => ({ id, player1_name: id, player2_name: null });
let n = 0;
const match = (over) => {
  n += 1;
  return {
    id: `m${n}`,
    category_id: 'c1',
    bracket_letter: 'A',
    match_code: `A${n}`,
    round_number: 1,
    status: 'scheduled',
    team_a_id: `a${n}`,
    team_b_id: `b${n}`,
    team_a: team(`a${n}`),
    team_b: team(`b${n}`),
    created_at: `2026-10-01T00:00:${String(n).padStart(2, '0')}Z`,
    ...over,
  };
};
const run = (matches, over = {}) => buildTimetable({ event, categories: cats, matches, now: NOW, ...over });
const byId = (t, id) => t.rows.find((r) => r.id === id);

test('fills courts in order and shares them across categories', () => {
  n = 0;
  const ms = [match({}), match({}), match({}), match({ category_id: 'c2' })];
  const t = run(ms);
  assert.equal(byId(t, 'm1').startMs, NOW);
  assert.equal(byId(t, 'm2').startMs, NOW);
  assert.equal(byId(t, 'm3').startMs, NOW + 20 * MIN);
  assert.equal(byId(t, 'm4').startMs, NOW + 20 * MIN); // category 2 queues behind category 1
  assert.equal(byId(t, 'm1').status, 'next');
  assert.equal(byId(t, 'm2').status, 'next');
  assert.equal(byId(t, 'm3').status, 'scheduled');
});

test('a live match mid-play holds its court and shifts the queue', () => {
  n = 0;
  const live = match({ status: 'in_progress', court: 1, accumulated_seconds: 10 * 60, running_since: new Date(NOW).toISOString(), started_at: new Date(NOW - 10 * MIN).toISOString() });
  const t = run([live, match({}), match({})]);
  assert.equal(byId(t, 'm1').status, 'live');
  assert.equal(byId(t, 'm1').endMs, NOW + 10 * MIN);
  assert.equal(byId(t, 'm2').startMs, NOW); // court 2 is free
  assert.equal(byId(t, 'm3').startMs, NOW + 10 * MIN); // court 1 frees in 10 min
});

test('an overrunning live match gets the floor, not zero', () => {
  n = 0;
  const live = match({ status: 'in_progress', court: 1, accumulated_seconds: 40 * 60, running_since: new Date(NOW).toISOString() });
  const t = run([live]);
  assert.equal(byId(t, 'm1').runningLong, true);
  assert.equal(byId(t, 'm1').endMs, NOW + 5 * MIN);
});

test('a paused match still occupies its court', () => {
  n = 0;
  const live = match({ status: 'in_progress', court: 1, accumulated_seconds: 5 * 60, running_since: null });
  const t = run([live, match({}), match({}), match({})]);
  assert.equal(byId(t, 'm1').paused, true);
  assert.equal(byId(t, 'm3').startMs, NOW + 15 * MIN);
  assert.equal(byId(t, 'm4').startMs, NOW + 20 * MIN);
});

test('a team cannot start before its previous match ends', () => {
  n = 0;
  const a = match({ team_a_id: 'x', team_b_id: 'y' });
  const b = match({ team_a_id: 'x', team_b_id: 'z' });
  const t = run([a, b]);
  assert.equal(byId(t, 'm2').startMs, NOW + 20 * MIN);
});

test('finished matches with real durations make estimates shorter', () => {
  n = 0;
  const done = [1, 2, 3].map(() => match({ status: 'completed', duration_minutes: 10, finished_at: new Date(NOW - MIN).toISOString() }));
  const t = run([...done, match({}), match({}), match({})]);
  assert.equal(byId(t, 'm6').startMs, NOW + 10 * MIN);
});

test('unplayed knockout stages are projected after pool play', () => {
  n = 0;
  const playoffCats = [{ id: 'c1', name: 'Men A', order_index: 0, playoff_enabled: true, ladder: { valid: true, levels: [{ kind: 'semifinal', matchCount: 2 }, { kind: 'final', matchCount: 1 }] } }];
  const t = buildTimetable({ event, categories: playoffCats, matches: [match({}), match({})], now: NOW });
  const projected = t.rows.filter((r) => r.projected);
  assert.equal(projected.length, 3);
  assert.equal(projected[0].playoff_stage, 'semifinal');
  assert.equal(projected[0].startMs, NOW + 20 * MIN); // waits for pool matches
  assert.equal(projected[2].playoff_stage, 'final');
  assert.equal(projected[2].startMs, NOW + 40 * MIN);
});

test('planned start time anchors a not-yet-started day', () => {
  n = 0;
  const t = run([match({})], { event: { ...event, daily_start_time: '10:30:00' } });
  assert.equal(byId(t, 'm1').startMs, new Date(2026, 9, 10, 10, 30).getTime());
  assert.equal(t.summary.behindMinutes, 0);
});

test('without a planned start, estimates anchor to now and no delay is shown', () => {
  n = 0;
  const t = run([match({})]);
  assert.equal(byId(t, 'm1').startMs, NOW);
  assert.equal(t.summary.behindMinutes, null);
});

test('running late past the planned start reports a delay', () => {
  n = 0;
  const t = run([match({}), match({}), match({})], { event: { ...event, daily_start_time: '08:30:00' } });
  assert.equal(byId(t, 'm1').delayMinutes, 30);
  assert.equal(byId(t, 'm1').delayed, true);
  assert.equal(t.summary.behindMinutes, 30);
});

test('canceled matches are ignored', () => {
  n = 0;
  const t = run([match({ status: 'canceled' }), match({})]);
  assert.equal(t.rows.length, 1);
});

test('a match left in progress from an earlier day does not create a phantom delay', () => {
  n = 0;
  const stale = match({ status: 'in_progress', court: 1, accumulated_seconds: 60, running_since: null, started_at: new Date(NOW - 20 * 60 * MIN).toISOString() });
  const t = run([stale, match({}), match({})]);
  assert.equal(t.summary.behindMinutes, null);
});
