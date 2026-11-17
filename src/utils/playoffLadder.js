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

// ---------------------------------------------------------------------------
// POINTS-SYSTEM SEMIFINAL SEEDING
// ---------------------------------------------------------------------------
// An alternative to the crossover for a ladder that starts at the
// semifinals. Who qualifies is unchanged (each pool's top N by the normal
// standings); only the matchups differ. The four qualifiers are reseeded 1-4
// by point differential from round robin, ignoring wins and losses, and paired
// by the organizer's chosen pattern. Ties are settled by the organizer (a
// coin toss), never by the app.

// Pairing pattern key -> the two semifinals, as seed numbers. SF1 is listed
// first, so the Final is SF1's winner vs SF2's.
export const SEMIFINAL_PAIRINGS = {
  '1v4': { label: '1 vs 4 · 2 vs 3', matches: [[1, 4], [2, 3]] },
  '1v2': { label: '1 vs 2 · 3 vs 4', matches: [[1, 2], [3, 4]] },
  '1v3': { label: '1 vs 3 · 2 vs 4', matches: [[1, 3], [2, 4]] },
};

export const POINTS_METRICS = {
  total: { label: 'Total point differential', short: 'point diff' },
  average: { label: 'Average point differential per game', short: 'avg point diff' },
};

// The setting only has meaning when the ladder has a semifinal round at all
// (a plain final-only ladder has nothing to seed). It applies whether the
// knockout opens with the semifinals (the four qualifiers are seeded) or
// with the quarterfinals or earlier (the four teams that reach the semifinals
// are seeded once the previous round is played).
export function hasSemifinal(ladder) {
  return Boolean(ladder?.valid) && ladder.levels.some((l) => l.kind === 'semifinal');
}

// True when the semifinals are the knockout's first round, so seeding picks
// the four qualifiers straight from the pools.
export function semifinalOpensKnockout(ladder) {
  return Boolean(ladder?.valid) && ladder.levels[0]?.kind === 'semifinal';
}

export function usesPointsSeeding(category, ladder) {
  return category.playoff_semifinal_seeding === 'points' && hasSemifinal(ladder);
}

export function semifinalPairing(category) {
  return SEMIFINAL_PAIRINGS[category.playoff_semifinal_pairing] || SEMIFINAL_PAIRINGS['1v4'];
}

// The non-points way of matching the semifinals, named for how this ladder
// actually does it (so a quarterfinals-first category doesn't say "crossover").
export function crossoverOption(poolCount, opensKnockout) {
  if (!opensKnockout) return { title: 'Bracket order', hint: 'Winners meet as drawn' };
  if (poolCount === 1) return { title: 'Standings', hint: 'Seeded by pool standings' };
  return { title: 'Crossover', hint: 'Pools play each other' };
}

// One line describing how a category's semifinals are set up, for showing
// where they get generated.
export function semifinalSetupSummary(category, ladder) {
  if (!hasSemifinal(ladder)) return '';
  if (usesPointsSeeding(category, ladder)) {
    const metric = POINTS_METRICS[category.playoff_points_metric] || POINTS_METRICS.total;
    return `Points system · ${semifinalPairing(category).label} · ${metric.short}`;
  }
  return crossoverOption(category.playoff_pool_count, semifinalOpensKnockout(ladder)).title;
}

// A team's seeding value as an exact fraction, so "average per game" ties
// are found exactly rather than through rounded floats. Games played is
// wins + losses (pickleball has no draws); a team yet to play counts as 1 so
// its value is simply 0.
function pointsFraction(team, metric) {
  const diff = (team.points_for || 0) - (team.points_against || 0);
  const games = metric === 'average' ? Math.max(1, (team.wins || 0) + (team.losses || 0)) : 1;
  return { diff, games };
}

function comparePoints(a, b, metric) {
  const x = pointsFraction(a, metric);
  const y = pointsFraction(b, metric);
  return y.diff * x.games - x.diff * y.games; // > 0 when b is higher
}

// The number shown next to a seed: "+12", or "+2.40" per game.
export function formatPointsValue(team, metric) {
  const { diff, games } = pointsFraction(team, metric);
  const value = metric === 'average' ? diff / games : diff;
  const text = metric === 'average' ? Math.abs(value).toFixed(2) : String(Math.abs(value));
  return `${value < 0 ? '−' : '+'}${text}`;
}

// Qualifiers best-first with their tie groups: [{ team, group }], where
// teams sharing a `group` number are level on the metric and need the
// organizer to order them. Within a tie, the incoming order is kept, so
// passing the teams in an organizer's chosen order keeps that order.
export function rankByPoints(teams, metric) {
  const sorted = teams.map((team, i) => ({ team, i })).sort((a, b) => comparePoints(a.team, b.team, metric) || a.i - b.i);
  let group = 0;
  return sorted.map(({ team }, i) => {
    if (i > 0 && comparePoints(sorted[i - 1].team, team, metric) !== 0) group += 1;
    return { team, group };
  });
}

export function hasPointsTie(ranked) {
  return ranked.some((r, i) => i > 0 && ranked[i - 1].group === r.group);
}

// Turns an organizer's seed order (team ids, best first) into the final
// seeding. The order may only rearrange teams within a tie: anything else
// would let a lower differential outrank a higher one. Without an order, a
// tie is refused rather than broken silently.
export function applySeedOrder(teams, metric, seedOrder) {
  const ranked = rankByPoints(teams, metric);
  if (!seedOrder) {
    if (hasPointsTie(ranked)) throw new Error('Two or more semifinalists are tied on point differential. Settle the tie before generating the Semifinals.');
    return ranked.map((r) => r.team);
  }
  const byId = new Map(teams.map((t) => [t.id, t]));
  if (seedOrder.length !== teams.length || new Set(seedOrder).size !== teams.length || !seedOrder.every((id) => byId.has(id))) {
    throw new Error('The semifinal seeding no longer matches the qualified teams. Reopen it and try again.');
  }
  const ordered = seedOrder.map((id) => byId.get(id));
  for (let i = 1; i < ordered.length; i++) {
    if (comparePoints(ordered[i - 1], ordered[i], metric) > 0) {
      throw new Error('The semifinal seeding no longer matches the standings. Reopen it and try again.');
    }
  }
  return ordered;
}
