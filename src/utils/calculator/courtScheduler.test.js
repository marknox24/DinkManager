import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleTournament } from './courtScheduler.js';
import { combineDateAndTime } from './timeFormat.js';

const MIN = 60000;
const START = combineDateAndTime('2026-06-01', '08:00');

// Minimal item fixture — real (non-projected) match between two teams.
const match = (over) => ({
  key: over.key,
  bracketId: over.bracketId ?? 'A',
  bracketOrder: over.bracketOrder ?? 0,
  roundNumber: over.roundNumber ?? 1,
  matchNumber: over.matchNumber ?? 1,
  teamAId: over.teamAId,
  teamBId: over.teamBId,
  projected: false,
  matchMinutes: over.matchMinutes ?? 20,
  ...over,
});

function allIntervalsForCourt(placedByKey, items) {
  const byCourt = new Map();
  for (const it of items) {
    const p = placedByKey.get(it.key);
    if (p.court == null) continue;
    const list = byCourt.get(p.court) || [];
    list.push(p);
    byCourt.set(p.court, list);
  }
  for (const list of byCourt.values()) list.sort((a, b) => a.startMs - b.startMs);
  return byCourt;
}

test('no two matches sharing a court ever overlap', () => {
  const items = Array.from({ length: 12 }, (_, i) =>
    match({ key: `m${i}`, teamAId: `T${i * 2}`, teamBId: `T${i * 2 + 1}`, matchNumber: i + 1 })
  );
  const { placedByKey } = scheduleTournament({ items, courtCount: 3, startAtMs: START });
  const byCourt = allIntervalsForCourt(placedByKey, items);
  for (const list of byCourt.values()) {
    for (let i = 1; i < list.length; i++) {
      assert.ok(list[i].startMs >= list[i - 1].endMs, `court overlap: ${JSON.stringify(list[i - 1])} vs ${JSON.stringify(list[i])}`);
    }
  }
});

test('no team is ever double-booked, even sharing a token across "matches" from different items', () => {
  // T1 appears in 3 different matches — none of its placements may overlap.
  const items = [
    match({ key: 'm1', teamAId: 'T1', teamBId: 'T2' }),
    match({ key: 'm2', teamAId: 'T1', teamBId: 'T3' }),
    match({ key: 'm3', teamAId: 'T1', teamBId: 'T4' }),
  ];
  const { placedByKey } = scheduleTournament({ items, courtCount: 3, startAtMs: START });
  const t1Intervals = items.map((it) => placedByKey.get(it.key)).sort((a, b) => a.startMs - b.startMs);
  for (let i = 1; i < t1Intervals.length; i++) {
    assert.ok(t1Intervals[i].startMs >= t1Intervals[i - 1].endMs);
  }
});

test('minimum rest is enforced structurally — a team forced onto one court twice waits at least minRestMinutes', () => {
  const items = [match({ key: 'm1', teamAId: 'T1', teamBId: 'T2' }), match({ key: 'm2', teamAId: 'T1', teamBId: 'T3', matchNumber: 2 })];
  const { placedByKey } = scheduleTournament({ items, courtCount: 1, startAtMs: START, minRestMinutes: 15 });
  const m1 = placedByKey.get('m1');
  const m2 = placedByKey.get('m2');
  const gapMinutes = (m2.startMs - m1.endMs) / MIN;
  assert.ok(gapMinutes >= 15, `expected at least 15 minutes rest, got ${gapMinutes}`);
});

test('independent brackets play concurrently — both get a court at the start time, not one after the other', () => {
  const items = [
    match({ key: 'a1', bracketId: 'A', bracketOrder: 0, teamAId: 'A:T1', teamBId: 'A:T2' }),
    match({ key: 'b1', bracketId: 'B', bracketOrder: 1, teamAId: 'B:T1', teamBId: 'B:T2' }),
  ];
  const { placedByKey } = scheduleTournament({ items, courtCount: 2, startAtMs: START });
  const a1 = placedByKey.get('a1');
  const b1 = placedByKey.get('b1');
  assert.equal(a1.startMs, START);
  assert.equal(b1.startMs, START);
  assert.notEqual(a1.court, b1.court);
});

test('a knockout placeholder never starts before every earlier round in its own bracket has finished', () => {
  const items = [
    match({ key: 'r1a', roundNumber: 1, teamAId: 'T1', teamBId: 'T2', matchMinutes: 25 }),
    match({ key: 'r1b', roundNumber: 1, teamAId: 'T3', teamBId: 'T4', matchMinutes: 20 }),
    { key: 'r2', bracketId: 'A', bracketOrder: 0, roundNumber: 2, matchNumber: 3, teamAId: null, teamBId: null, projected: true, matchMinutes: 20 },
  ];
  const { placedByKey } = scheduleTournament({ items, courtCount: 2, startAtMs: START });
  const latestR1End = Math.max(placedByKey.get('r1a').endMs, placedByKey.get('r1b').endMs);
  assert.ok(placedByKey.get('r2').startMs >= latestR1End);
});

test('a scheduled break is never straddled by a match', () => {
  const breakStart = START + 40 * MIN;
  const breakEnd = START + 100 * MIN;
  const items = Array.from({ length: 4 }, (_, i) => match({ key: `m${i}`, teamAId: `T${i}a`, teamBId: `T${i}b`, matchMinutes: 20 }));
  const { placedByKey } = scheduleTournament({ items, courtCount: 1, startAtMs: START, breaks: [{ startMs: breakStart, endMs: breakEnd }] });
  for (const it of items) {
    const p = placedByKey.get(it.key);
    const overlaps = p.startMs < breakEnd && p.endMs > breakStart;
    assert.ok(!overlaps, `match ${it.key} [${p.startMs},${p.endMs}) overlaps the break [${breakStart},${breakEnd})`);
  }
});

test('the court-turnover buffer is reflected between two matches sharing one court', () => {
  const items = [match({ key: 'm1', teamAId: 'T1', teamBId: 'T2' }), match({ key: 'm2', teamAId: 'T3', teamBId: 'T4', matchNumber: 2 })];
  const { placedByKey } = scheduleTournament({ items, courtCount: 1, startAtMs: START, changeoverBufferMinutes: 5 });
  const m1 = placedByKey.get('m1');
  const m2 = placedByKey.get('m2');
  assert.equal(m2.court, m1.court);
  assert.equal((m2.startMs - m1.endMs) / MIN, 5);
});

test('warmup time shifts every match\'s earliest possible start by the same amount', () => {
  const items = [match({ key: 'm1', teamAId: 'T1', teamBId: 'T2' })];
  const { placedByKey } = scheduleTournament({ items, courtCount: 1, startAtMs: START, warmupMinutes: 10 });
  assert.equal(placedByKey.get('m1').startMs, START + 10 * MIN);
});

test('too few courts for peak demand is flagged with a concrete court count, not a vague warning', () => {
  // 3 brackets, all independent, all wanting to start at the same instant — needs 3 courts to avoid a wait.
  const items = ['A', 'B', 'C'].map((id, i) => match({ key: `${id}1`, bracketId: id, bracketOrder: i, teamAId: `${id}:T1`, teamBId: `${id}:T2` }));
  const { warnings, peakCourtsNeeded } = scheduleTournament({ items, courtCount: 1, startAtMs: START });
  assert.equal(peakCourtsNeeded, 3);
  const w = warnings.find((x) => x.type === 'insufficient_courts');
  assert.ok(w);
  assert.equal(w.suggestedCourts, 3);
});

test('a tight target finish time is reported infeasible with a concrete overrun and suggestion, never silently ignored', () => {
  const items = Array.from({ length: 10 }, (_, i) => match({ key: `m${i}`, teamAId: `T${i}a`, teamBId: `T${i}b`, matchMinutes: 30 }));
  const targetFinishMs = START + 20 * MIN; // impossibly tight on purpose
  const { feasible, warnings } = scheduleTournament({ items, courtCount: 1, startAtMs: START, targetFinishMs });
  assert.equal(feasible, false);
  const w = warnings.find((x) => x.type === 'target_finish_exceeded');
  assert.ok(w);
  assert.ok(w.overrunMinutes > 0);
  assert.ok(w.suggestedCourts > 1);
});

test('a generously-courted, on-time schedule reports feasible with no target warning', () => {
  const items = [match({ key: 'm1', teamAId: 'T1', teamBId: 'T2', matchMinutes: 20 })];
  const targetFinishMs = START + 5 * 60 * MIN;
  const { feasible, warnings } = scheduleTournament({ items, courtCount: 4, startAtMs: START, targetFinishMs });
  assert.equal(feasible, true);
  assert.equal(warnings.some((w) => w.type === 'target_finish_exceeded'), false);
});

test('zero-duration bye items occupy no court and cost their team no rest', () => {
  const items = [
    { key: 'bye1', bracketId: 'A', bracketOrder: 0, roundNumber: 1, teamAId: 'A:T5', teamBId: null, projected: false, matchMinutes: 0, isBye: true },
    match({ key: 'm1', teamAId: 'A:T5', teamBId: 'A:T6', matchNumber: 2 }),
  ];
  const { placedByKey } = scheduleTournament({ items, courtCount: 1, startAtMs: START, minRestMinutes: 15 });
  const bye = placedByKey.get('bye1');
  const m1 = placedByKey.get('m1');
  assert.equal(bye.court, null);
  assert.equal(bye.startMs, bye.endMs);
  assert.equal(m1.startMs, START); // not pushed back by the bye's "rest"
});

test('an empty item list schedules cleanly with no warnings and no courts needed', () => {
  const { placedByKey, warnings, feasible, peakCourtsNeeded } = scheduleTournament({ items: [], courtCount: 4, startAtMs: START });
  assert.equal(placedByKey.size, 0);
  assert.deepEqual(warnings, []);
  assert.equal(feasible, true);
  assert.equal(peakCourtsNeeded, 0);
});
