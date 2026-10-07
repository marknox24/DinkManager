import { compareMatchCode, liveElapsedSeconds } from './match.js';
import { usableCourts } from './courts.js';

// Estimated tournament timetable — a pure projection of the matches that
// already exist (no stored schedule, no I/O). Every poll re-runs it against
// the current rows, so a match starting/finishing/pausing or a court-count
// change shifts the estimates on the next recompute.
//
// Courts are shared across categories: live matches pin their court until
// they're expected to end, then the remaining queue (category order →
// round → bracket → match code) is assigned greedily to the earliest-free
// court. Umpire capacity is not modelled.

const MIN = 60000;
const DEFAULT_MATCH_MINUTES = 18;
// A live match that has run past its expected length is assumed to need a
// few more minutes rather than ending this instant.
const OVERRUN_FLOOR_MINUTES = 5;
const MIN_SAMPLES = 3;
export const DELAYED_THRESHOLD_MINUTES = 5;

function nominalMinutes(category, event) {
  return category?.estimated_match_minutes || event?.match_duration_minutes || DEFAULT_MATCH_MINUTES;
}

// Average real duration of a category's finished matches once there are
// enough of them — makes estimates self-correct when play runs long/short.
function learnedMinutes(matches) {
  const samples = matches.filter((m) => m.status === 'completed' && m.duration_minutes > 0).map((m) => m.duration_minutes);
  if (samples.length < MIN_SAMPLES) return null;
  return samples.reduce((a, b) => a + b, 0) / samples.length;
}

function localDayStart(ms) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function parseYmd(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

// The earliest a category assigned to a specific tournament day can start —
// that day's local midnight, or its planned clock time when a daily start
// time is set. A category with no day assignment has no floor at all (null),
// preserving the original single-day behavior exactly.
function dayFloorMs(ymd, dailyStartTime) {
  if (!ymd) return null;
  const day = parseYmd(ymd);
  if (!dailyStartTime) return day;
  const [hh, mm] = dailyStartTime.split(':').map(Number);
  return day + (hh * 60 + (mm || 0)) * MIN;
}

// The planned first-match time for "today" (or the first event day when the
// event hasn't started yet). Null when no daily start time is set or the
// event's dates have passed.
export function plannedStartMs(event, nowMs) {
  const time = event?.daily_start_time;
  if (!time) return null;
  const [hh, mm] = time.split(':').map(Number);
  const today = localDayStart(nowMs);
  const first = event.start_date ? parseYmd(event.start_date) : today;
  const last = event.end_date ? parseYmd(event.end_date) : first;
  if (today > last) return null;
  const day = Math.max(today, first);
  return day + (hh * 60 + (mm || 0)) * MIN;
}

function queueOrder(a, b) {
  return (
    a.categoryOrder - b.categoryOrder ||
    a.roundNumber - b.roundNumber ||
    (a.bracketLetter || '').localeCompare(b.bracketLetter || '') ||
    compareMatchCode(a.matchCode, b.matchCode) ||
    (a.createdAt || '').localeCompare(b.createdAt || '')
  );
}

// Greedy in-order assignment onto `courtCount` courts. `items` are already
// sorted; `courtFree` seeds each court's free-at time (mutated); `teamFree`
// maps team id → ms. Returns Map(key → { startMs, endMs, court }).
function simulate(items, courtFree, teamFree, minutesFor) {
  const placed = new Map();
  const roundEnds = new Map(); // categoryId → Map(round → latest end)
  for (const item of items) {
    let slot = 0;
    for (let i = 1; i < courtFree.length; i++) if (courtFree[i] < courtFree[slot]) slot = i;
    let start = courtFree[slot];
    if (item.teamAId) start = Math.max(start, teamFree.get(item.teamAId) || 0);
    if (item.teamBId) start = Math.max(start, teamFree.get(item.teamBId) || 0);
    // A category assigned to a specific tournament day can't start before
    // that day begins, even if its court/teams were free earlier.
    if (item.dayFloorMs != null) start = Math.max(start, item.dayFloorMs);
    const ends = roundEnds.get(item.categoryId) || new Map();
    // A projected knockout stage can't begin until every earlier round of
    // its category has finished (stage matches within a round run in parallel).
    if (item.projected) {
      for (const [round, endMs] of ends) if (round < item.roundNumber) start = Math.max(start, endMs);
    }
    const end = start + minutesFor(item) * MIN;
    courtFree[slot] = end;
    if (item.teamAId) teamFree.set(item.teamAId, end);
    if (item.teamBId) teamFree.set(item.teamBId, end);
    ends.set(item.roundNumber, Math.max(ends.get(item.roundNumber) || 0, end));
    roundEnds.set(item.categoryId, ends);
    placed.set(item.key, { startMs: start, endMs: end, court: slot + 1 });
  }
  return placed;
}

// categories: rows from `categories`, each optionally carrying `ladder`
// (the result of deriveLadder(readPlan(category)), computed by the caller so
// this file stays free of Supabase imports).
// matches: every match in the event with `bracket_letter`, `category_id`,
// `team_a`/`team_b`.
export function buildTimetable({ event, categories, matches, now = Date.now() }) {
  const courtCount = Math.max(1, usableCourts(event));
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const todayStart = localDayStart(now);

  const matchesByCategory = new Map();
  for (const m of matches) {
    if (m.status === 'canceled' || !categoryById.has(m.category_id)) continue;
    if (!matchesByCategory.has(m.category_id)) matchesByCategory.set(m.category_id, []);
    matchesByCategory.get(m.category_id).push(m);
  }

  const perMatch = new Map();
  const nominal = new Map();
  const dayFloorByCategory = new Map();
  for (const c of categories) {
    nominal.set(c.id, nominalMinutes(c, event));
    perMatch.set(c.id, learnedMinutes(matchesByCategory.get(c.id) || []) ?? nominal.get(c.id));
    dayFloorByCategory.set(c.id, dayFloorMs(c.scheduled_date, event?.daily_start_time));
  }

  const items = [];
  for (const c of categories) {
    const catMatches = matchesByCategory.get(c.id) || [];
    let maxRound = 0;
    for (const m of catMatches) {
      maxRound = Math.max(maxRound, m.round_number || 0);
      items.push({
        key: m.id,
        id: m.id,
        projected: false,
        match: m,
        status: m.status,
        categoryId: c.id,
        categoryName: c.name,
        categoryOrder: c.order_index ?? 0,
        roundNumber: m.round_number || 0,
        bracketLetter: m.bracket_letter,
        matchCode: m.match_code,
        playoffStage: m.playoff_stage || null,
        dayFloorMs: dayFloorByCategory.get(c.id),
        createdAt: m.created_at,
        teamAId: m.team_a_id,
        teamBId: m.team_b_id,
        teamA: m.team_a || null,
        teamB: m.team_b || null,
      });
    }
    // Knockout stages that haven't been generated yet are projected after
    // the category's real matches, so the tail of the day isn't invisible.
    const ladder = c.ladder;
    if (catMatches.length > 0 && c.playoff_enabled && ladder?.valid) {
      const present = new Set(catMatches.map((m) => m.playoff_stage).filter(Boolean));
      let round = maxRound;
      ladder.levels.forEach((level, levelIndex) => {
        if (present.has(level.kind)) return;
        round += 1;
        for (let n = 1; n <= level.matchCount; n++) {
          items.push({
            key: `proj-${c.id}-${level.kind}-${n}`,
            id: null,
            projected: true,
            match: null,
            status: 'scheduled',
            categoryId: c.id,
            categoryName: c.name,
            categoryOrder: c.order_index ?? 0,
            roundNumber: round,
            bracketLetter: 'PO',
            matchCode: `${levelIndex}-${String(n).padStart(2, '0')}`,
            playoffStage: level.kind,
            stageIndex: n,
            stageMatchCount: level.matchCount,
            dayFloorMs: dayFloorByCategory.get(c.id),
            createdAt: '',
            teamAId: null,
            teamBId: null,
            teamA: null,
            teamB: null,
          });
        }
      });
    }
  }
  items.sort(queueOrder);

  const finishedMs = (m) => new Date(m.finished_at || m.started_at || m.created_at).getTime();
  const completed = items.filter((i) => i.status === 'completed');
  const live = items.filter((i) => i.status === 'in_progress');
  const queued = items.filter((i) => i.status === 'scheduled');

  // ---- Baseline: what the day looked like at its planned pace ----------
  const planned = plannedStartMs(event, now);
  // Only today's play counts toward the baseline — a match left "in
  // progress" from an earlier day would otherwise drag the anchor back by
  // hours and report a huge phantom delay.
  const startedToday = (i) => i.match?.started_at && new Date(i.match.started_at).getTime() >= todayStart;
  const todaysItems = items.filter((i) => (i.status === 'completed' ? finishedMs(i.match) >= todayStart : !i.match?.started_at || startedToday(i)));
  const startedTimes = todaysItems.filter(startedToday).map((i) => new Date(i.match.started_at).getTime());
  const baseAnchor = planned ?? (startedTimes.length ? Math.min(...startedTimes) : null);
  const baseline = baseAnchor == null ? null : simulate(todaysItems, new Array(courtCount).fill(baseAnchor), new Map(), (i) => nominal.get(i.categoryId));

  // ---- Live estimate ------------------------------------------------------
  const anchor = planned != null ? Math.max(now, planned) : now;
  const courtFree = new Array(courtCount).fill(anchor);
  const teamFree = new Map();
  const rowsByKey = new Map();

  for (const i of live) {
    const m = i.match;
    const minutes = perMatch.get(i.categoryId);
    const remaining = minutes - liveElapsedSeconds(m, now) / 60;
    const floor = Math.min(OVERRUN_FLOOR_MINUTES, minutes);
    const endMs = now + Math.max(remaining, floor) * MIN;
    const slot = m.court >= 1 && m.court <= courtCount ? m.court - 1 : courtFree.indexOf(Math.min(...courtFree));
    courtFree[slot] = Math.max(courtFree[slot], endMs);
    if (i.teamAId) teamFree.set(i.teamAId, endMs);
    if (i.teamBId) teamFree.set(i.teamBId, endMs);
    const startMs = m.started_at ? new Date(m.started_at).getTime() : now - liveElapsedSeconds(m, now) * 1000;
    rowsByKey.set(i.key, {
      status: 'live',
      paused: !m.running_since,
      runningLong: remaining <= 0,
      court: m.court ?? null,
      courtEstimated: false,
      startMs,
      endMs,
    });
  }

  const placed = simulate(queued, courtFree, teamFree, (i) => perMatch.get(i.categoryId));
  const nextForCourt = new Set();
  for (const i of queued) {
    const p = placed.get(i.key);
    if (!nextForCourt.has(p.court)) {
      nextForCourt.add(p.court);
      rowsByKey.set(i.key, { status: 'next', court: p.court, courtEstimated: true, startMs: p.startMs, endMs: p.endMs, isNext: true });
    } else {
      rowsByKey.set(i.key, { status: 'scheduled', court: p.court, courtEstimated: true, startMs: p.startMs, endMs: p.endMs });
    }
  }
  for (const i of completed) {
    const m = i.match;
    rowsByKey.set(i.key, {
      status: 'completed',
      court: m.court ?? null,
      courtEstimated: false,
      startMs: m.started_at ? new Date(m.started_at).getTime() : null,
      endMs: m.finished_at ? new Date(m.finished_at).getTime() : null,
    });
  }

  const rows = items.map((i) => {
    const r = rowsByKey.get(i.key);
    const base = baseline?.get(i.key);
    const delayMinutes = r.status !== 'completed' && base && r.startMs != null ? Math.round((r.startMs - base.startMs) / MIN) : null;
    return {
      key: i.key,
      id: i.id,
      projected: i.projected,
      categoryId: i.categoryId,
      categoryName: i.categoryName,
      bracketLetter: i.bracketLetter,
      matchCode: i.matchCode,
      round_number: i.roundNumber,
      playoff_stage: i.playoffStage,
      stageIndex: i.stageIndex ?? null,
      stageMatchCount: i.stageMatchCount ?? null,
      teamA: i.teamA,
      teamB: i.teamB,
      scoreA: i.match?.score_a ?? null,
      scoreB: i.match?.score_b ?? null,
      winnerTeamId: i.match?.winner_team_id ?? null,
      paused: false,
      runningLong: false,
      isNext: false,
      ...r,
      delayMinutes,
      delayed: delayMinutes != null && delayMinutes >= DELAYED_THRESHOLD_MINUTES,
    };
  });

  const upcoming = rows.filter((r) => r.status === 'next' || r.status === 'scheduled' || r.status === 'live');
  upcoming.sort((a, b) => a.startMs - b.startMs);
  const nextUp = upcoming.find((r) => r.status === 'next') || upcoming.find((r) => r.status === 'live');
  const courts = Array.from({ length: courtCount }, (_, idx) => ({
    court: idx + 1,
    live: rows.find((r) => r.status === 'live' && r.court === idx + 1) || null,
    next: rows.find((r) => r.status === 'next' && r.court === idx + 1) || null,
  }));
  const remainingRows = rows.filter((r) => r.status !== 'completed');

  return {
    rows,
    courts,
    summary: {
      anchorMs: anchor,
      hasPlannedStart: planned != null,
      plannedStartMs: planned,
      behindMinutes: nextUp?.delayMinutes ?? null,
      liveCount: live.length,
      remainingCount: remainingRows.length,
      completedCount: completed.length,
      estimatedFinishMs: remainingRows.length ? Math.max(...remainingRows.map((r) => r.endMs)) : null,
    },
  };
}
