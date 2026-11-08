// Earliest-feasible, dependency- and availability-constrained court
// scheduler for the Tournament Time Calculator.
//
// Queue order is ROUND NUMBER FIRST, bracket second (not bracket-then-
// round, which production's timetable.js uses for its own different
// purpose — see matchItemBuilder.js's header comment). If brackets were
// processed one at a time, the first-listed bracket would claim every
// court for all of its own matches before the next bracket got a single
// match in — the opposite of "avoid running an entire bracket
// sequentially when others could play concurrently." Interleaving every
// bracket's round 1 first, then every bracket's round 2, etc. is what
// actually lets independent brackets share the available courts fairly
// from minute zero.
const MIN = 60000;

function sortKey(item) {
  return [item.roundNumber, item.bracketOrder ?? 0, item.matchNumber ?? 0, item.key];
}
function compareItems(a, b) {
  const ka = sortKey(a);
  const kb = sortKey(b);
  for (let i = 0; i < ka.length; i++) {
    if (ka[i] < kb[i]) return -1;
    if (ka[i] > kb[i]) return 1;
  }
  return 0;
}

function overlapsAnyBreak(startMs, endMs, breaks) {
  return breaks.find((b) => startMs < b.endMs && endMs > b.startMs);
}

// Pushes `start` forward past every break it would otherwise straddle —
// loops because clearing one break can land inside a later one.
function pushPastBreaks(start, durationMs, breaks) {
  let s = start;
  for (let guard = 0; guard < breaks.length + 1; guard++) {
    const hit = overlapsAnyBreak(s, s + durationMs, breaks);
    if (!hit) return s;
    s = hit.endMs;
  }
  return s;
}

// One deterministic placement pass. `courtFree` is either a real
// fixed-size array (the actual schedule) or `null` (the "ideal, unlimited
// courts" pass used only to measure peak concurrent demand — see below).
function place(items, { startAtMs, courtFree, changeoverBufferMs, minRestMs, breaks }) {
  const teamFree = new Map();
  const roundEnds = new Map(); // bracketId -> Map(roundNumber -> latest end)
  const placed = new Map();
  for (const item of items) {
    let start = startAtMs;
    let slot = -1;
    if (courtFree) {
      slot = 0;
      for (let i = 1; i < courtFree.length; i++) if (courtFree[i] < courtFree[slot]) slot = i;
      start = Math.max(start, courtFree[slot]);
    }
    if (item.teamAId) start = Math.max(start, teamFree.get(item.teamAId) ?? startAtMs);
    if (item.teamBId) start = Math.max(start, teamFree.get(item.teamBId) ?? startAtMs);
    if (item.projected) {
      const ends = roundEnds.get(item.bracketId);
      if (ends) {
        for (const [round, endMs] of ends) {
          if (round < item.roundNumber) start = Math.max(start, endMs);
        }
      }
    }
    start = pushPastBreaks(start, item.matchMinutes * MIN, breaks);
    const end = start + item.matchMinutes * MIN;

    if (courtFree) courtFree[slot] = end + changeoverBufferMs;
    if (item.teamAId) teamFree.set(item.teamAId, end + minRestMs);
    if (item.teamBId) teamFree.set(item.teamBId, end + minRestMs);

    const ends = roundEnds.get(item.bracketId) || new Map();
    ends.set(item.roundNumber, Math.max(ends.get(item.roundNumber) || 0, end));
    roundEnds.set(item.bracketId, ends);

    placed.set(item.key, { startMs: start, endMs: end, court: courtFree ? slot + 1 : null });
  }
  return placed;
}

// Sweep-line peak concurrency: given each item's "ideal" interval (team/
// round/break-constrained only, as if courts were unlimited), the maximum
// number simultaneously in flight is exactly the minimum court count that
// would let every match start at its ideal time — i.e. the real,
// computed answer to "how many courts would it take to never wait on a
// court," not a guess.
function peakConcurrency(idealPlacements) {
  const events = [];
  for (const { startMs, endMs } of idealPlacements.values()) {
    if (endMs <= startMs) continue; // zero-duration (bye) items never contend for a court
    events.push([startMs, 1], [endMs, -1]);
  }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]); // ends-before-starts at the same instant
  let running = 0;
  let peak = 0;
  for (const [, delta] of events) {
    running += delta;
    peak = Math.max(peak, running);
  }
  return peak;
}

// scheduleTournament({ items, courtCount, startAtMs, changeoverBufferMinutes,
//   minRestMinutes, warmupMinutes, breaks, targetFinishMs }) ->
//   { placedByKey, courtUtilization, warnings, feasible, finishMs, peakCourtsNeeded }
//
// Hard constraints (team double-booking, court overlap, minimum rest) are
// never "checked after the fact" — they're structural: `courtFree`/
// `teamFree` make a conflicting placement impossible to produce in the
// first place, not something validated once a schedule already exists.
export function scheduleTournament({
  items,
  courtCount,
  startAtMs,
  changeoverBufferMinutes = 0,
  minRestMinutes = 0,
  warmupMinutes = 0,
  breaks = [],
  targetFinishMs = null,
}) {
  const effectiveStart = startAtMs + warmupMinutes * MIN;
  const changeoverBufferMs = changeoverBufferMinutes * MIN;
  const minRestMs = minRestMinutes * MIN;

  const byeItems = items.filter((it) => it.isBye);
  const schedulableItems = items.filter((it) => !it.isBye).sort(compareItems);

  // Byes are instantaneous (no real match is played) — they occupy no
  // court and don't cost their team any rest, so they're placed directly
  // rather than run through the court-contention loop.
  const byePlacements = new Map(byeItems.map((it) => [it.key, { startMs: effectiveStart, endMs: effectiveStart, court: null }]));

  if (schedulableItems.length === 0) {
    return { placedByKey: byePlacements, courtUtilization: [], warnings: [], feasible: true, finishMs: effectiveStart, peakCourtsNeeded: 0 };
  }

  const idealPlacements = place(schedulableItems, { startAtMs: effectiveStart, courtFree: null, changeoverBufferMs: 0, minRestMs, breaks });
  const peakCourtsNeeded = peakConcurrency(idealPlacements);

  const courtFree = Array.from({ length: Math.max(1, courtCount) }, () => effectiveStart);
  const realPlacements = place(schedulableItems, { startAtMs: effectiveStart, courtFree, changeoverBufferMs, minRestMs, breaks });

  const placedByKey = new Map([...byePlacements, ...realPlacements]);
  const finishMs = Math.max(...[...realPlacements.values()].map((p) => p.endMs));

  const totalBreakMsInWindow = breaks.reduce((sum, b) => sum + Math.max(0, Math.min(b.endMs, finishMs) - Math.max(b.startMs, effectiveStart)), 0);
  const windowMs = Math.max(1, finishMs - effectiveStart - totalBreakMsInWindow);
  const busyByCourt = new Map();
  for (const item of schedulableItems) {
    const p = realPlacements.get(item.key);
    busyByCourt.set(p.court, (busyByCourt.get(p.court) || 0) + (p.endMs - p.startMs));
  }
  const courtUtilization = courtFree.map((_, i) => {
    const court = i + 1;
    const busyMs = busyByCourt.get(court) || 0;
    return { court, busyMinutes: Math.round(busyMs / MIN), utilizationPct: Math.round((busyMs / windowMs) * 100) };
  });

  const warnings = [];
  if (courtCount < peakCourtsNeeded) {
    warnings.push({
      type: 'insufficient_courts',
      message: `At ${courtCount} court${courtCount === 1 ? '' : 's'}, some matches wait for a court to open up even though their teams are ready. At least ${peakCourtsNeeded} court${peakCourtsNeeded === 1 ? '' : 's'} would let every match start the moment it's ready.`,
      suggestedCourts: peakCourtsNeeded,
    });
  }
  const underused = courtUtilization.filter((c) => c.utilizationPct < 50);
  if (underused.length > 0 && courtCount > 1) {
    warnings.push({
      type: 'underused_courts',
      message: `Court${underused.length === 1 ? '' : 's'} ${underused.map((c) => c.court).join(', ')} ${underused.length === 1 ? 'is' : 'are'} under 50% busy across the day — ${courtCount - underused.length} court${courtCount - underused.length === 1 ? '' : 's'} may be enough.`,
      courts: underused.map((c) => c.court),
    });
  }
  let feasible = true;
  if (targetFinishMs != null && finishMs > targetFinishMs) {
    feasible = false;
    const overrunMinutes = Math.round((finishMs - targetFinishMs) / MIN);
    const windowMinutes = Math.max(1, Math.round((targetFinishMs - effectiveStart) / MIN));
    const demandMinutes = windowMs / MIN + overrunMinutes; // rough court-minutes actually demanded
    const courtsForTarget = Math.max(courtCount + 1, Math.ceil((demandMinutes * courtCount) / windowMinutes));
    warnings.push({
      type: 'target_finish_exceeded',
      message: `Projected finish is about ${overrunMinutes} minute${overrunMinutes === 1 ? '' : 's'} past your target. Adding courts (around ${courtsForTarget} total) or extending the day by ~${overrunMinutes} minutes would close the gap.`,
      overrunMinutes,
      suggestedCourts: courtsForTarget,
    });
  }

  return { placedByKey, courtUtilization, warnings, feasible, finishMs, peakCourtsNeeded };
}
