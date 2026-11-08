// Public entry point for the Tournament Time Calculator engine:
// runCalculator({ brackets, settings }) -> everything the UI needs to
// render Overview / Court Timeline / Match List / Team Schedule, with no
// further calculation required in a component.
import { buildBracketItems } from './matchItemBuilder.js';
import { scheduleTournament } from './courtScheduler.js';
import { combineDateAndTime, addMinutes } from './timeFormat.js';

const MIN = 60000;

export const DEFAULT_SETTINGS = {
  courtCount: 4,
  startTime: '08:00',
  targetFinishEnabled: false,
  targetFinishTime: '18:00',
  matchDurationMinutes: 20,
  changeoverBufferMinutes: 5,
  minRestMinutes: 15,
  warmupMinutes: 0,
  delayBufferMinutes: 0,
  breaks: [], // [{ id, label, startTime, endTime }]
};

let nextBracketSeq = 1;
export function createEmptyBracket(overrides = {}) {
  const n = nextBracketSeq++;
  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `bracket-${n}`,
    name: `Bracket ${n}`,
    format: 'Round Robin',
    teamCount: 8,
    doubleRoundRobin: false,
    thirdPlace: false,
    splitIntoBrackets: false, // Round Robin only: divide teamCount into independent pools (groupSizes), no knockout
    groupSizes: [4, 4],
    advancePerGroup: 2,
    matchDurationMinutes: null, // null = inherits settings.matchDurationMinutes
    ...overrides,
  };
}

// Field-level validation messages for the Bracket Builder UI — separate
// from matchItemBuilder's own warnings (which are also surfaced, for
// anything validation here doesn't catch, like an unreachable knockout
// ceiling that depends on the engine's own math).
// True when this category's team count comes from per-bracket `groupSizes`
// rather than a single flat `teamCount` — either because the format always
// works that way (Round Robin + Playoffs) or because "split into brackets"
// was turned on for a plain Round Robin.
function usesGroupSizes(bracket) {
  return bracket.format === 'Round Robin + Playoffs' || (bracket.format === 'Round Robin' && bracket.splitIntoBrackets);
}

export function validateBracket(bracket) {
  const errors = {};
  if (!bracket.name || !bracket.name.trim()) errors.name = 'Give this bracket a name.';
  if (usesGroupSizes(bracket)) {
    if (!Array.isArray(bracket.groupSizes) || bracket.groupSizes.length === 0) {
      errors.groupSizes = 'Add at least one bracket.';
    } else if (bracket.groupSizes.some((s) => !Number.isInteger(s) || s < 2)) {
      errors.groupSizes = 'Each bracket needs at least 2 teams.';
    }
    if (bracket.format === 'Round Robin + Playoffs' && (!Number.isInteger(bracket.advancePerGroup) || bracket.advancePerGroup < 1)) {
      errors.advancePerGroup = 'At least 1 team must advance per group.';
    }
  } else if (!Number.isInteger(bracket.teamCount) || bracket.teamCount < 2) {
    errors.teamCount = 'Needs at least 2 teams.';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

function totalTeamsFor(bracket) {
  if (usesGroupSizes(bracket)) {
    return (bracket.groupSizes || []).reduce((sum, s) => sum + s, 0);
  }
  return bracket.teamCount || 0;
}

function breaksToMs(breaks, referenceDate) {
  return (breaks || []).map((b) => ({
    startMs: combineDateAndTime(referenceDate, b.startTime),
    endMs: combineDateAndTime(referenceDate, b.endTime),
  }));
}

export function runCalculator({ brackets, settings }) {
  const referenceDate = settings.date || null;
  const startAtMs = combineDateAndTime(referenceDate, settings.startTime);
  let targetFinishMs = null;
  if (settings.targetFinishEnabled) {
    targetFinishMs = combineDateAndTime(referenceDate, settings.targetFinishTime);
    if (targetFinishMs <= startAtMs) targetFinishMs = addMinutes(targetFinishMs, 24 * 60); // "finish by" rolls to the next day if earlier than start
  }

  const bracketResults = brackets.map((bracket, i) => {
    const { items, warnings, shape } = buildBracketItems(bracket, settings.matchDurationMinutes);
    return { bracketId: bracket.id, name: bracket.name, format: bracket.format, shape, warnings, items: items.map((it) => ({ ...it, bracketOrder: i })) };
  });

  const allItems = bracketResults.flatMap((b) => b.items);
  const breaks = breaksToMs(settings.breaks, referenceDate);

  const schedule = scheduleTournament({
    items: allItems,
    courtCount: settings.courtCount,
    startAtMs,
    changeoverBufferMinutes: settings.changeoverBufferMinutes,
    minRestMinutes: settings.minRestMinutes,
    warmupMinutes: settings.warmupMinutes,
    breaks,
    targetFinishMs,
  });

  const totalTeams = brackets.reduce((sum, b) => sum + totalTeamsFor(b), 0);
  const totalMatches = allItems.filter((it) => !it.isBye).length;
  const delayMs = (settings.delayBufferMinutes || 0) * MIN;

  const bracketWarnings = bracketResults.flatMap((b) => b.warnings);
  const warnings = [...bracketWarnings.map((message) => ({ type: 'bracket_invalid', message })), ...schedule.warnings];

  return {
    brackets: bracketResults,
    items: allItems,
    schedule,
    warnings,
    summary: {
      totalTeams,
      totalMatches,
      courtCount: settings.courtCount,
      startAtMs,
      targetFinishMs,
      finishMs: schedule.finishMs,
      projectedFinishRange: delayMs > 0 ? [schedule.finishMs, schedule.finishMs + delayMs] : [schedule.finishMs, schedule.finishMs],
      feasible: schedule.feasible,
      peakCourtsNeeded: schedule.peakCourtsNeeded,
    },
  };
}
