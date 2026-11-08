// Match-count/shape formulas for the public Tournament Time Calculator.
// Deliberately composes the real product's own proven, tested formulas
// (imported, not re-derived) rather than inventing parallel math — the
// calculator has no real team/match rows to build a tree from, so it needs
// a lighter "team count in, shape out" interface than the production
// functions these wrap, but the underlying arithmetic is identical.
import { nextPowerOfTwo, generateRoundRobinRounds, expectedRoundRobin } from '../scheduling.js';
import { projectShape, stageLabel } from '../bracketTree.js';
import { deriveLadder } from '../playoffLadder.js';

// Round Robin: every team plays every other team once (or twice, double
// RR). `expectedRoundRobin` is the real product's own formula — reused
// unchanged. `roundCount` comes from actually running the real circle-
// method pairer (`generateRoundRobinRounds`) on placeholder ids, rather
// than re-deriving the odd/even round-count rule by hand.
export function roundRobinShape(teamCount, { double = false } = {}) {
  if (!Number.isInteger(teamCount) || teamCount < 2) {
    return { valid: false, error: 'Round Robin needs at least 2 teams.', totalMatches: 0, perTeam: 0, roundCount: 0 };
  }
  const { total, perTeam, perTeamMax } = expectedRoundRobin(teamCount, double, null);
  const placeholderIds = Array.from({ length: teamCount }, (_, i) => `T${i + 1}`);
  let roundCount = generateRoundRobinRounds(placeholderIds).length;
  if (double) roundCount *= 2;
  return { valid: true, error: null, totalMatches: total, perTeam, perTeamMax, roundCount };
}

// Single Elimination: n-1 matches always produce one champion, regardless
// of byes — the bye math (byeCount = nextPowerOfTwo(n) - n, trailing
// leftover teams all get a bye rather than just one odd team out) and the
// round-shape projection (projectShape) are the exact same proven rules
// bracketTree.js uses for the real app's bracket display. 3rd place is
// only offered when a real 4-player semifinal exists in the shape — a
// 2-team bracket skips straight to the Final with nothing to add a 3rd-
// place match from, so `thirdPlace: true` is silently ignored there
// (hasThirdPlace reports the true answer either way, never double-adds).
export function singleEliminationShape(teamCount, { thirdPlace = false } = {}) {
  if (!Number.isInteger(teamCount) || teamCount < 2) {
    return { valid: false, error: 'Single Elimination needs at least 2 teams.', totalMatches: 0, rounds: [], byeCount: 0, hasThirdPlace: false };
  }
  const size = nextPowerOfTwo(teamCount);
  const byeCount = size - teamCount;
  const pairedCount = teamCount - byeCount;
  const round1Matches = pairedCount / 2;
  // Slots ENTERING round 2 = real-match winners + bye-advancers (= size/2)
  // — this is what projectShape expects as its starting slot count, the
  // same value bracketTree.js's `round1Count` (real matches + bye teams)
  // represents for the real app's bracket display.
  const round2EntrySlots = round1Matches + byeCount;
  const laterRounds = round2EntrySlots > 1 ? projectShape(round2EntrySlots, 2) : [];
  const shape = [{ round: 1, matches: round1Matches }, ...laterRounds];
  const totalRounds = shape.length;
  const rounds = shape.map(({ round, matches }) => ({ roundNumber: round, matches, label: stageLabel(round, totalRounds) }));
  const hasRealSemifinal = shape.length >= 2 && shape[shape.length - 2].matches === 2;
  const hasThirdPlace = Boolean(thirdPlace) && hasRealSemifinal;
  return {
    valid: true,
    error: null,
    byeCount,
    pairedCount,
    round1Matches,
    rounds,
    totalRounds,
    hasThirdPlace,
    // Always derived directly from (n-1) + an optional 3rd place — never
    // summed from rounds[], so there is no code path that could ever
    // double-count the final or the 3rd-place match.
    totalMatches: teamCount - 1 + (hasThirdPlace ? 1 : 0),
  };
}

// Multiple INDEPENDENT round-robin pools in one category — no knockout
// stage, unlike groupKnockoutShape below. This is the "20 teams split into
// 4 brackets of 5" case: each pool plays its own complete round robin and
// that's the whole category. Reuses roundRobinShape per pool (same formula,
// same validation) rather than re-deriving the math, and sums real pool
// sizes so uneven splits (e.g. [5,5,5,5] or [6,5,5,4]) count correctly.
export function multiPoolRoundRobinShape({ groupSizes, double = false }) {
  if (!Array.isArray(groupSizes) || groupSizes.length === 0 || groupSizes.some((s) => !Number.isInteger(s) || s < 2)) {
    return { valid: false, error: 'Each bracket needs at least 2 teams.', totalMatches: 0, poolMatches: [], poolCount: 0 };
  }
  const poolMatches = groupSizes.map((size) => roundRobinShape(size, { double }).totalMatches);
  return {
    valid: true,
    error: null,
    poolCount: groupSizes.length,
    poolMatches,
    totalMatches: poolMatches.reduce((sum, m) => sum + m, 0),
  };
}

// Group stage (N round-robin pools, possibly uneven sizes) followed by a
// knockout bracket. Group-stage match count sums the real per-pool
// round-robin formula over each pool's ACTUAL size (never assumes an even
// split), so e.g. 13 teams in 4 pools ([4,3,3,3]) counts correctly.
// Knockout shape/validity is entirely deriveLadder's real, tested rule
// (capped at Round of 32 / 32 teams advancing — a config beyond that
// comes back invalid with deriveLadder's own concrete message, surfaced
// as-is rather than silently extended).
export function groupKnockoutShape({ groupSizes, advancePerGroup, thirdPlace = false }) {
  if (!Array.isArray(groupSizes) || groupSizes.length === 0 || groupSizes.some((s) => !Number.isInteger(s) || s < 2)) {
    return { valid: false, error: 'Each group needs at least 2 teams.', groupMatches: 0, knockoutMatches: 0, totalMatches: 0, knockoutLevels: [] };
  }
  if (!Number.isInteger(advancePerGroup) || advancePerGroup < 1) {
    return { valid: false, error: 'At least 1 team must advance from each group.', groupMatches: 0, knockoutMatches: 0, totalMatches: 0, knockoutLevels: [] };
  }
  const groupMatches = groupSizes.reduce((sum, size) => sum + expectedRoundRobin(size, false, null).total, 0);

  const letters = groupSizes.map((_, i) => String.fromCharCode(65 + i)); // A, B, C, ...
  const poolCount = letters.length;
  // Sequential pairing (A-B, C-D, ...) — the calculator has no real
  // seeding/standings to pair by, so pools are crossed over in the order
  // they were entered; deriveLadder itself is agnostic to how pairs were
  // chosen; it only validates the resulting bracket size.
  const poolPairs = poolCount > 1 ? Array.from({ length: Math.floor(poolCount / 2) }, (_, i) => [letters[i * 2], letters[i * 2 + 1]]) : [];
  const unpaired = poolCount > 1 && poolCount % 2 === 1 ? letters[poolCount - 1] : null;

  if (unpaired) {
    return {
      valid: false,
      error: `${poolCount} groups can't be evenly crossed into a knockout bracket (pool "${unpaired}" has no partner). Use 1, 2, or 4 groups.`,
      groupMatches,
      knockoutMatches: 0,
      totalMatches: groupMatches,
      knockoutLevels: [],
    };
  }

  const ladder = deriveLadder({ poolCount, poolPairs, advancePerPool: advancePerGroup, thirdPlace });
  if (!ladder.valid) {
    return { valid: false, error: ladder.error, groupMatches, knockoutMatches: 0, totalMatches: groupMatches, knockoutLevels: [] };
  }
  const knockoutMatches = ladder.levels.reduce((sum, l) => sum + l.matchCount, 0);
  return {
    valid: true,
    error: null,
    groupMatches,
    groupCount: poolCount,
    knockoutLevels: ladder.levels,
    knockoutMatches,
    totalMatches: groupMatches + knockoutMatches,
  };
}
