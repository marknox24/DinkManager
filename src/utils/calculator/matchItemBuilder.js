// Turns one bracket config into a flat list of schedulable "items" for
// courtScheduler.js. There's no real roster here — every team is a
// synthetic placeholder token (`${bracketId}:T1`, `T2`, ...) — so this
// module's job is purely structural: how many items, which round each
// belongs to, which pair of tokens (or placeholder label) each needs, and
// which items a later item depends on.
import { generateRoundRobinRounds } from '../scheduling.js';
import { roundRobinShape, singleEliminationShape, groupKnockoutShape, multiPoolRoundRobinShape } from './bracketMath.js';

function teamToken(bracketId, n) {
  return `${bracketId}:T${n}`;
}
function teamLabel(n) {
  return `Team ${n}`;
}

// Dependency granularity is ROUND-level, not pairwise-slot-level: a
// knockout item can't start until every item in an earlier round of the
// SAME bracket has finished — matching how tournaments actually run (a
// semifinal doesn't start mid-quarterfinal-round just because one specific
// quarterfinal finished early) without needing a fake seeding/advancement
// simulation this calculator has no real roster to drive.
function roundRobinItems(bracket, matchMinutes) {
  const teamIds = Array.from({ length: bracket.teamCount }, (_, i) => i + 1);
  const cycles = bracket.doubleRoundRobin ? [false, true] : [false];
  const items = [];
  let matchNumber = 0;
  let roundOffset = 0;
  for (const reversed of cycles) {
    const rounds = generateRoundRobinRounds(teamIds);
    rounds.forEach((pairs, i) => {
      pairs.forEach(([a, b]) => {
        matchNumber += 1;
        const [x, y] = reversed ? [b, a] : [a, b];
        items.push({
          key: `${bracket.id}:RR:${matchNumber}`,
          bracketId: bracket.id,
          bracketName: bracket.name,
          stage: 'group',
          roundNumber: roundOffset + i + 1,
          matchLabel: `Round ${roundOffset + i + 1} · Match ${matchNumber}`,
          matchNumber,
          teamAId: teamToken(bracket.id, x),
          teamBId: teamToken(bracket.id, y),
          teamALabel: teamLabel(x),
          teamBLabel: teamLabel(y),
          projected: false,
          matchMinutes,
        });
      });
    });
    roundOffset += rounds.length;
  }
  return items;
}

function singleElimItems(bracket, shape, matchMinutes) {
  const items = [];
  let matchNumber = 0;
  // Round 1: pair seeds 1v2, 3v4, ... for the paired slots; the trailing
  // leftover seeds are byes — zero-duration "advances automatically"
  // items so they still occupy a Round-2 dependency slot without
  // consuming any court time (mirrors planSingleEliminationRound1's own
  // trailing-leftover-gets-the-bye rule, see bracketMath.js).
  const pairedCount = shape.round1Matches * 2;
  for (let i = 0; i < pairedCount; i += 2) {
    matchNumber += 1;
    items.push({
      key: `${bracket.id}:R1:${matchNumber}`,
      bracketId: bracket.id,
      bracketName: bracket.name,
      stage: 'knockout',
      roundNumber: 1,
      matchLabel: `${shape.rounds[0].label} · Match ${matchNumber}`,
      matchNumber,
      teamAId: teamToken(bracket.id, i + 1),
      teamBId: teamToken(bracket.id, i + 2),
      teamALabel: teamLabel(i + 1),
      teamBLabel: teamLabel(i + 2),
      projected: false,
      matchMinutes,
    });
  }
  for (let i = pairedCount; i < pairedCount + shape.byeCount; i++) {
    items.push({
      key: `${bracket.id}:BYE:${i}`,
      bracketId: bracket.id,
      bracketName: bracket.name,
      stage: 'knockout',
      roundNumber: 1,
      matchLabel: `${teamLabel(i + 1)} — bye`,
      matchNumber: null,
      teamAId: teamToken(bracket.id, i + 1),
      teamBId: null,
      teamALabel: teamLabel(i + 1),
      teamBLabel: null,
      projected: false,
      matchMinutes: 0,
      isBye: true,
    });
  }
  // Round 2 onward: participants aren't known (depend on the previous
  // round's results), so these are placeholder items — no team tokens,
  // just a "Winner of ..." label, gated to start after the whole previous
  // round (see courtScheduler.js's round-gate).
  for (const round of shape.rounds.slice(1)) {
    for (let i = 0; i < round.matches; i++) {
      matchNumber += 1;
      items.push({
        key: `${bracket.id}:R${round.roundNumber}:${matchNumber}`,
        bracketId: bracket.id,
        bracketName: bracket.name,
        stage: 'knockout',
        roundNumber: round.roundNumber,
        matchLabel: `${round.label} · Match ${i + 1}`,
        matchNumber,
        teamAId: null,
        teamBId: null,
        teamALabel: `Winner of ${shape.rounds[round.roundNumber - 2].label} #${i * 2 + 1}`,
        teamBLabel: `Winner of ${shape.rounds[round.roundNumber - 2].label} #${i * 2 + 2}`,
        projected: true,
        matchMinutes,
      });
    }
  }
  if (shape.hasThirdPlace) {
    const finalRound = shape.rounds[shape.rounds.length - 1].roundNumber;
    items.push({
      key: `${bracket.id}:THIRD`,
      bracketId: bracket.id,
      bracketName: bracket.name,
      stage: 'knockout',
      // Same round number as the Final — both depend on the semifinal
      // round finishing, and only on that; the Final and 3rd-place match
      // are independent of each other, so they're free to share a court
      // slot concurrently once their shared semifinal round is done.
      roundNumber: finalRound,
      matchLabel: '3rd Place Match',
      matchNumber: null,
      teamAId: null,
      teamBId: null,
      teamALabel: 'Loser of Semi-Final #1',
      teamBLabel: 'Loser of Semi-Final #2',
      projected: true,
      matchMinutes,
      isThirdPlace: true,
    });
  }
  return items;
}

// Independent pools, no knockout — each pool is its own complete round
// robin (optionally double), labeled "Bracket A/B/..." rather than "Group
// A/B/..." so it reads as terminal (nothing advances out of it), unlike
// the group stage of groupKnockoutItems below. Round numbers are NOT
// offset per pool (pool B's round 1 is roundNumber 1, same as pool A's) —
// pools don't depend on each other, so this lets courtScheduler's
// round-first queue order interleave them across courts from minute zero,
// same reasoning as groupKnockoutItems' own group stage.
function multiPoolRoundRobinItems(bracket, matchMinutes) {
  const items = [];
  const groupSizes = bracket.groupSizes || [];
  const cycles = bracket.doubleRoundRobin ? [false, true] : [false];
  let matchNumber = 0;
  groupSizes.forEach((size, poolIdx) => {
    const letter = String.fromCharCode(65 + poolIdx);
    const teamIds = Array.from({ length: size }, (_, i) => i + 1);
    let roundOffset = 0;
    for (const reversed of cycles) {
      const rounds = generateRoundRobinRounds(teamIds);
      rounds.forEach((pairs, roundIdx) => {
        pairs.forEach(([a, b]) => {
          matchNumber += 1;
          const [x, y] = reversed ? [b, a] : [a, b];
          items.push({
            key: `${bracket.id}:BRK${letter}:${matchNumber}`,
            bracketId: bracket.id,
            bracketName: bracket.name,
            stage: 'group',
            roundNumber: roundOffset + roundIdx + 1,
            matchLabel: `Bracket ${letter} · Round ${roundOffset + roundIdx + 1}`,
            matchNumber,
            teamAId: teamToken(bracket.id, `${letter}${x}`),
            teamBId: teamToken(bracket.id, `${letter}${y}`),
            teamALabel: `Bracket ${letter} — ${teamLabel(x)}`,
            teamBLabel: `Bracket ${letter} — ${teamLabel(y)}`,
            projected: false,
            matchMinutes,
          });
        });
      });
      roundOffset += rounds.length;
    }
  });
  return items;
}

function groupKnockoutItems(bracket, groupShape, matchMinutes) {
  const items = [];
  const groupSizes = bracket.groupSizes;
  let matchNumber = 0;
  let lastGroupRound = 0;
  groupSizes.forEach((size, groupIdx) => {
    const letter = String.fromCharCode(65 + groupIdx);
    const teamIds = Array.from({ length: size }, (_, i) => i + 1);
    const rounds = generateRoundRobinRounds(teamIds);
    rounds.forEach((pairs, roundIdx) => {
      pairs.forEach(([a, b]) => {
        matchNumber += 1;
        items.push({
          key: `${bracket.id}:GRP${letter}:${matchNumber}`,
          bracketId: bracket.id,
          bracketName: bracket.name,
          stage: 'group',
          roundNumber: roundIdx + 1,
          matchLabel: `Group ${letter} · Round ${roundIdx + 1}`,
          matchNumber,
          teamAId: teamToken(bracket.id, `${letter}${a}`),
          teamBId: teamToken(bracket.id, `${letter}${b}`),
          teamALabel: `Group ${letter} — ${teamLabel(a)}`,
          teamBLabel: `Group ${letter} — ${teamLabel(b)}`,
          projected: false,
          matchMinutes,
        });
      });
      lastGroupRound = Math.max(lastGroupRound, roundIdx + 1);
    });
  });
  // Knockout: every level is a placeholder — no real group standings
  // exist here — gated to start only after every group's round-robin has
  // finished (knockout "round 1" is numbered one past the latest group
  // round, so the round-gate naturally waits for the whole group stage).
  let roundNumber = lastGroupRound + 1;
  for (const level of groupShape.knockoutLevels) {
    for (let i = 0; i < level.matchCount; i++) {
      matchNumber += 1;
      items.push({
        key: `${bracket.id}:KO:${level.kind}:${i + 1}`,
        bracketId: bracket.id,
        bracketName: bracket.name,
        stage: 'knockout',
        roundNumber,
        matchLabel: `${level.label} · Match ${i + 1}`,
        matchNumber,
        teamAId: null,
        teamBId: null,
        teamALabel: level.kind === 'third_place' ? 'Loser of Semi-Final #1' : `Group stage qualifier #${i * 2 + 1}`,
        teamBLabel: level.kind === 'third_place' ? 'Loser of Semi-Final #2' : `Group stage qualifier #${i * 2 + 2}`,
        projected: true,
        matchMinutes,
        isThirdPlace: level.kind === 'third_place',
      });
    }
    // 3rd place shares the semifinal's dependency (both wait only on the
    // group/earlier-knockout stage before them), not the final's.
    if (level.kind !== 'third_place') roundNumber += 1;
  }
  return items;
}

// -> { items, warnings, shape } — `shape` is the bracketMath result, kept
// around so the UI can show match counts without recomputing.
export function buildBracketItems(bracket, globalMatchDurationMinutes) {
  const matchMinutes = bracket.matchDurationMinutes ?? globalMatchDurationMinutes;
  if (!bracket.name || !bracket.name.trim()) {
    return { items: [], warnings: [`Bracket "${bracket.id}" needs a name.`], shape: null };
  }

  if (bracket.format === 'Round Robin') {
    if (bracket.splitIntoBrackets) {
      const groupSizes = bracket.groupSizes || [];
      const shape = multiPoolRoundRobinShape({ groupSizes, double: bracket.doubleRoundRobin });
      if (!shape.valid) return { items: [], warnings: [`${bracket.name}: ${shape.error}`], shape };
      return { items: multiPoolRoundRobinItems(bracket, matchMinutes), warnings: [], shape };
    }
    const shape = roundRobinShape(bracket.teamCount, { double: bracket.doubleRoundRobin });
    if (!shape.valid) return { items: [], warnings: [`${bracket.name}: ${shape.error}`], shape };
    return { items: roundRobinItems(bracket, matchMinutes), warnings: [], shape };
  }

  if (bracket.format === 'Single Elimination') {
    const shape = singleEliminationShape(bracket.teamCount, { thirdPlace: bracket.thirdPlace });
    if (!shape.valid) return { items: [], warnings: [`${bracket.name}: ${shape.error}`], shape };
    return { items: singleElimItems(bracket, shape, matchMinutes), warnings: [], shape };
  }

  if (bracket.format === 'Round Robin + Playoffs') {
    const groupSizes = bracket.groupSizes || [];
    const shape = groupKnockoutShape({ groupSizes, advancePerGroup: bracket.advancePerGroup, thirdPlace: bracket.thirdPlace });
    if (!shape.valid) return { items: [], warnings: [`${bracket.name}: ${shape.error}`], shape };
    return { items: groupKnockoutItems(bracket, shape, matchMinutes), warnings: [], shape };
  }

  return { items: [], warnings: [`${bracket.name}: unsupported format "${bracket.format}".`], shape: null };
}
