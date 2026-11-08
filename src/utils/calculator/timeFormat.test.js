import test from 'node:test';
import assert from 'node:assert/strict';
import { combineDateAndTime, addMinutes, minutesBetween, formatClock, formatDurationMinutes } from './timeFormat.js';

test('combineDateAndTime builds the exact local clock time requested', () => {
  const ms = combineDateAndTime('2026-06-01', '08:30');
  const d = new Date(ms);
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 5); // June, 0-indexed
  assert.equal(d.getDate(), 1);
  assert.equal(d.getHours(), 8);
  assert.equal(d.getMinutes(), 30);
});

test('addMinutes and minutesBetween are inverses', () => {
  const start = combineDateAndTime('2026-06-01', '08:00');
  const end = addMinutes(start, 95);
  assert.equal(minutesBetween(start, end), 95);
});

test('formatClock renders a plain AM/PM time with no day suffix when no anchor is given', () => {
  const ms = combineDateAndTime('2026-06-01', '08:05');
  assert.equal(formatClock(ms), '8:05 AM');
});

test('formatClock labels noon and midnight correctly (12-hour wraparound)', () => {
  assert.equal(formatClock(combineDateAndTime('2026-06-01', '12:00')), '12:00 PM');
  assert.equal(formatClock(combineDateAndTime('2026-06-01', '00:00')), '12:00 AM');
});

test('formatClock adds a "(+1 day)" suffix once the schedule crosses midnight past the anchor day', () => {
  const anchor = combineDateAndTime('2026-06-01', '08:00');
  const sameDay = combineDateAndTime('2026-06-01', '23:30');
  const nextDay = combineDateAndTime('2026-06-02', '00:45');
  assert.equal(formatClock(sameDay, anchor), '11:30 PM');
  assert.equal(formatClock(nextDay, anchor), '12:45 AM (+1 day)');
});

test('formatClock pluralizes "days" correctly for a multi-day overrun', () => {
  const anchor = combineDateAndTime('2026-06-01', '08:00');
  const twoDaysLater = combineDateAndTime('2026-06-03', '09:00');
  assert.equal(formatClock(twoDaysLater, anchor), '9:00 AM (+2 days)');
});

test('formatDurationMinutes renders hours and minutes, dropping whichever part is zero', () => {
  assert.equal(formatDurationMinutes(45), '45m');
  assert.equal(formatDurationMinutes(60), '1h');
  assert.equal(formatDurationMinutes(125), '2h 5m');
});

test('formatDurationMinutes never goes negative for a bad input', () => {
  assert.equal(formatDurationMinutes(-10), '0m');
});
