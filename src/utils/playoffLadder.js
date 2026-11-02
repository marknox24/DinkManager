// Pure playoff-ladder derivation — no I/O, no Supabase. Moved out of
// data/playoffApi.js (which re-exports all of this for backward
// compatibility) so utils/bracketTree.js and utils/timetable.js can import
// it without pulling in the Supabase client, which breaks under the plain
// `node --test` runner (import.meta.env doesn't exist there).

// Knockout levels in play order — every stage after the first is fully
// determined by pool count + advance-per-pool. The check constraint on
// matches.playoff_stage (schema.sql) lists these same keys.
export const PLAYOFF_STAGES = {
  round_of_32: { label: 'Round of 32', short: 'R32' },
  round_of_16: { label: 'Round of 16', short: 'R16' },
  quarterfinal: { label: 'Quarterfinals', short: 'QF' },
  semifinal: { label: 'Semifinals', short: 'SF' },
  third_place: { label: 'Fight for 3rd', short: '3RD' },
  final: { label: 'Championship', short: 'F' },
};

// The knockout stage with this many matches, largest first. 16 matches (32
// teams advancing) is the top: a bigger bracket couldn't fit a Preview Screen,
// which has no way to scroll.
const STAGE_BY_MATCH_COUNT = { 16: 'round_of_32', 8: 'round_of_16', 4: 'quarterfinal', 2: 'semifinal' };

// A stage's match_code for its match at 1-based `position`. A short code that
// ends in a number takes a separator: R16-3, never "R163".
export function stageMatchCode(kind, position) {
  if (kind === 'third_place') return '3RD';
  if (kind === 'final') return 'F';
  const { short } = PLAYOFF_STAGES[kind];
  return `${short}${/\d$/.test(short) ? '-' : ''}${position}`;
}

// Which stage feeds `kind`, given the specific ladder in play — not a fixed
// chain, since a small enough plan skips levels (one pool pair advancing 1
// each goes straight to a 2-team Final, fed directly by pools). The 3rd-place
// match is fed by the same stage as the Final. Null means pools feed it.
export function priorStageOf(kind, ladderKinds) {
  const order = Object.keys(PLAYOFF_STAGES).filter((k) => k !== 'third_place');
  const position = order.indexOf(kind === 'third_place' ? 'final' : kind);
  return order.slice(0, position).reverse().find((k) => ladderKinds.has(k)) ?? null;
}

// The human-readable "level" a match belongs to — a playoff stage name, or
// the pool round-robin round number when it isn't a playoff match. Shared by
// the Match List round headers, the Start/Log-score modals, and the public
// Preview Screen so the same match is always described the same way.
export function matchLevelLabel(match) {
  return match.playoff_stage ? PLAYOFF_STAGES[match.playoff_stage].label : `Round ${match.round_number || 1}`;
}

// How many knockout levels a { poolPairs, advancePerPool, thirdPlace } plan
// produces, and how many matches each level has. Round of 32 is the largest
// first-round stage this ladder supports (see STAGE_BY_MATCH_COUNT), and a
// team count that can't halve down to a Final comes back invalid too, each
// with a concrete message rather than silently producing an unsupported stage.
export function deriveLadder({ poolCount, poolPairs, advancePerPool, thirdPlace }) {
  // A single, self-contained pool seeds its own top-N into the bracket —
  // no crossover partner needed. Capped at top-4/semifinal (not extended to
  // an 8-team quarterfinal bracket) to match the same "out of scope for v1"
  // ceiling the multi-pool path below already applies.
  if (poolCount === 1) {
    if (advancePerPool < 2) {
      return { valid: false, error: 'Advance at least 2 players from the pool to form a knockout bracket.', levels: [] };
    }
    const firstRoundMatches = advancePerPool / 2;
    const isPowerOfTwo = Number.isInteger(firstRoundMatches) && firstRoundMatches > 0 && (firstRoundMatches & (firstRoundMatches - 1)) === 0;
    if (!isPowerOfTwo || firstRoundMatches > 2) {
      return { valid: false, error: `Top ${advancePerPool} advancing from one pool doesn't fit a knockout bracket. Use 2 or 4.`, levels: [] };
    }
    if (firstRoundMatches === 1) {
      return { valid: true, error: null, levels: [{ kind: 'final', label: PLAYOFF_STAGES.final.label, matchCount: 1 }] };
    }
    const levels = [{ kind: 'semifinal', label: PLAYOFF_STAGES.semifinal.label, matchCount: 2 }];
    if (thirdPlace) levels.push({ kind: 'third_place', label: PLAYOFF_STAGES.third_place.label, matchCount: 1 });
    levels.push({ kind: 'final', label: PLAYOFF_STAGES.final.label, matchCount: 1 });
    return { valid: true, error: null, levels };
  }

  const pairs = poolPairs || [];
  if (pairs.length === 0) {
    return { valid: false, error: 'Choose at least one pool pair to cross over into the knockout stage.', levels: [] };
  }
  const letters = pairs.flat();
  if (new Set(letters).size !== letters.length) {
    return { valid: false, error: 'Each pool can only appear in one crossover pair.', levels: [] };
  }

  const firstRoundMatches = pairs.length * advancePerPool;
  const isPowerOfTwo = firstRoundMatches > 0 && (firstRoundMatches & (firstRoundMatches - 1)) === 0;
  if (!isPowerOfTwo || firstRoundMatches > 16) {
    const teamCount = firstRoundMatches * 2;
    return {
      valid: false,
      error: `${pairs.length} pool pair${pairs.length === 1 ? '' : 's'} × top ${advancePerPool} = ${teamCount} team${teamCount === 1 ? '' : 's'} advancing. A knockout bracket needs exactly 2, 4, 8, 16 or 32 teams.`,
      levels: [],
    };
  }

  const levels = [];
  // A single pool-pair (2 teams advancing) skips straight to the final —
  // the loop adds no earlier stage for it.
  for (let matchCount = firstRoundMatches; matchCount > 1; matchCount /= 2) {
    const kind = STAGE_BY_MATCH_COUNT[matchCount];
    levels.push({ kind, label: PLAYOFF_STAGES[kind].label, matchCount });
  }
  if (firstRoundMatches === 1) {
    levels.push({ kind: 'final', label: PLAYOFF_STAGES.final.label, matchCount: 1 });
    return { valid: true, error: null, levels };
  }
  if (thirdPlace) {
    levels.push({ kind: 'third_place', label: PLAYOFF_STAGES.third_place.label, matchCount: 1 });
  }
  levels.push({ kind: 'final', label: PLAYOFF_STAGES.final.label, matchCount: 1 });
  return { valid: true, error: null, levels };
}

// deriveLadder for a saved plan. A `categories` row and readPlan()'s result
// both carry the plan under snake_case column names, which deriveLadder
// doesn't read — handed one directly it sees no pool count or pairs and
// reports every plan invalid. This is the one place those names are mapped;
// call deriveLadder itself only with an editor's own unsaved state.
export function deriveLadderFromPlan(plan) {
  return deriveLadder({
    poolCount: plan.playoff_pool_count,
    poolPairs: plan.playoff_pool_pairs,
    advancePerPool: plan.playoff_advance_per_pool,
    thirdPlace: plan.playoff_third_place,
  });
}

// The `ladder` buildTimetable and buildBracketTreesForCategory expect on a
// category: null unless it really runs playoffs. Playoffs only exist for
// the Round Robin family (the rule CategoryEditor uses to offer them) — a
// category switched to another format before the editor began clearing these
// fields can still carry a stale playoff_enabled, and must not project a
// knockout stage it will never play.
export function categoryLadder(category) {
  if (!category.playoff_enabled || !/round robin/i.test(category.format || '')) return null;
  return deriveLadderFromPlan(category);
}

// Pool letters that don't appear in any crossover pair. deriveLadder only
// checks that paired letters aren't duplicated — it has no notion of "every
// pool that exists," so an odd pool count (or a plan that predates a
// different draw) can leave one pool completely unpaired while still
// reporting a "valid" ladder, silently excluding that pool's teams from the
// knockout stage with no warning. Callers that know the full set of pool
// letters (the editor's own poolCount, or the actually-drawn pool letters at
// generation time) should check this before allowing save/generate.
export function unpairedPools(poolLetters, poolPairs) {
  const paired = new Set((poolPairs || []).flat());
  return (poolLetters || []).filter((l) => !paired.has(l));
}

// The actual first-round fixture list, e.g. [{a:{letter:'A',rank:1},
// b:{letter:'C',rank:2}}, {a:{letter:'B',rank:1}, b:{letter:'D',rank:2}}, ...].
// Seed order matters: rank is the OUTER loop and pool-pairs the inner loop,
// so the two fixtures born from one pool-pair land in opposite bracket
// halves — otherwise two teams from the same pool could meet again in the
// very next round. Mirrors how generateRoundRobinMatchList interleaves
// rounds across brackets.
export function expandFirstStageSlots(poolPairs, advancePerPool) {
  const slots = [];
  for (let rank = 1; rank <= advancePerPool; rank++) {
    for (const [x, y] of poolPairs || []) {
      slots.push({ a: { letter: x, rank }, b: { letter: y, rank: advancePerPool + 1 - rank } });
    }
  }
  return slots;
}

// Standard single-elimination seeding within one unpaired pool: 1v4 and 2v3
// for top-4 (so the top 2 seeds can only meet in the final, not the
// semifinal), or 1v2 for top-2. The single-pool counterpart to
// expandFirstStageSlots, which only knows how to pair two distinct pools.
export function expandSinglePoolSlots(letter, advancePerPool) {
  const slots = [];
  for (let i = 0; i < advancePerPool / 2; i++) {
    slots.push({ a: { letter, rank: i + 1 }, b: { letter, rank: advancePerPool - i } });
  }
  return slots;
}
