import { supabase } from '../lib/supabaseClient';
import { rankTeams, isTiedAtCut } from '../utils/standings';

function ordinal(n) {
  if (n % 10 === 1 && n % 100 !== 11) return `${n}st`;
  if (n % 10 === 2 && n % 100 !== 12) return `${n}nd`;
  if (n % 10 === 3 && n % 100 !== 13) return `${n}rd`;
  return `${n}th`;
}

// Knockout levels in play order — every stage after the first is fully
// determined by pool count + advance-per-pool, so there is no separate
// "round_of_16" here (out of scope for v1, see the plan's documented
// tradeoffs on non-power-of-2 pool counts).
export const PLAYOFF_STAGES = {
  quarterfinal: { label: 'Quarterfinals', short: 'QF' },
  semifinal: { label: 'Semifinals', short: 'SF' },
  third_place: { label: 'Fight for 3rd', short: '3RD' },
  final: { label: 'Championship', short: 'F' },
};

// The human-readable "level" a match belongs to — a playoff stage name, or
// the pool round-robin round number when it isn't a playoff match. Shared by
// the Match List round headers, the Start/Log-score modals, and the public
// Preview Screen so the same match is always described the same way.
export function matchLevelLabel(match) {
  return match.playoff_stage ? PLAYOFF_STAGES[match.playoff_stage].label : `Round ${match.round_number || 1}`;
}

// ---------------------------------------------------------------------------
// PURE DERIVATION  (no I/O — drives the level visualizer + validation)
// ---------------------------------------------------------------------------

// How many knockout levels a { poolPairs, advancePerPool, thirdPlace } plan
// produces, and how many matches each level has. Quarterfinals is the
// largest first-round stage this ladder supports (4 first-round matches, 8
// teams) — a "Round of 16" stage is out of scope for v1 (see the plan's
// documented tradeoffs on non-power-of-2 / larger pool counts), so anything
// bigger comes back invalid with a concrete message rather than silently
// producing an unsupported stage.
export function deriveLadder({ poolPairs, advancePerPool, thirdPlace }) {
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
  if (!isPowerOfTwo || firstRoundMatches > 4) {
    const teamCount = firstRoundMatches * 2;
    return {
      valid: false,
      error: `${pairs.length} pool pair${pairs.length === 1 ? '' : 's'} × top ${advancePerPool} = ${teamCount} team${teamCount === 1 ? '' : 's'} advancing, which doesn't fit a knockout bracket up to Quarterfinals. Use 1, 2 or 4 pool pairs (with 1 or 2 advancing per pool).`,
      levels: [],
    };
  }

  const levels = [];
  let matchCount = firstRoundMatches;
  const stageOrder = matchCount >= 4 ? ['quarterfinal', 'semifinal'] : ['semifinal'];
  // A single pool-pair (2 teams advancing) skips straight to the final —
  // there's no quarterfinal or semifinal to play.
  if (matchCount === 1) {
    levels.push({ kind: 'final', label: PLAYOFF_STAGES.final.label, matchCount: 1 });
    return { valid: true, error: null, levels };
  }
  for (const kind of stageOrder) {
    levels.push({ kind, label: PLAYOFF_STAGES[kind].label, matchCount });
    matchCount = matchCount / 2;
  }
  if (thirdPlace) {
    levels.push({ kind: 'third_place', label: PLAYOFF_STAGES.third_place.label, matchCount: 1 });
  }
  levels.push({ kind: 'final', label: PLAYOFF_STAGES.final.label, matchCount: 1 });
  return { valid: true, error: null, levels };
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

// ---------------------------------------------------------------------------
// PLAN PERSISTENCE
// ---------------------------------------------------------------------------

export function readPlan(category) {
  return {
    playoff_enabled: category.playoff_enabled,
    playoff_pool_count: category.playoff_pool_count,
    playoff_advance_per_pool: category.playoff_advance_per_pool,
    playoff_pool_pairs: category.playoff_pool_pairs || [],
    playoff_third_place: category.playoff_third_place,
  };
}

export async function savePlan(categoryId, plan) {
  const { data, error } = await supabase.from('categories').update(plan).eq('id', categoryId).select().single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// RUNTIME  (readiness + generation, once pools exist and are being played)
// ---------------------------------------------------------------------------

export async function getPlayoffBracket(categoryId) {
  const { data, error } = await supabase.from('brackets').select('*').eq('category_id', categoryId).eq('kind', 'playoff').maybeSingle();
  if (error) throw error;
  return data;
}

// Which stage feeds `kind`, given the specific ladder in play — NOT a fixed
// QF->SF->Final chain, since a small enough pool-pair count skips levels
// (e.g. one pool pair advancing 1 each goes straight to a 2-team Final, fed
// directly by pools, with no semifinal in the ladder at all).
function priorStageOf(kind, ladderKinds) {
  if (kind === 'quarterfinal') return null;
  if (kind === 'semifinal') return ladderKinds.has('quarterfinal') ? 'quarterfinal' : null;
  // Both the 3rd-place match and the final are fed by the semifinal round
  // when one exists in this ladder; otherwise they're the first stage,
  // fed directly by pools.
  if (kind === 'third_place' || kind === 'final') return ladderKinds.has('semifinal') ? 'semifinal' : null;
  return null;
}

// Per-stage readiness for a category's derived ladder. Returns one row per
// ladder level, in play order.
export async function getPlayoffStatus(categoryId) {
  const { data: category, error: catErr } = await supabase.from('categories').select('*').eq('id', categoryId).single();
  if (catErr) throw catErr;
  const plan = readPlan(category);
  if (!plan.playoff_enabled) return [];

  const ladder = deriveLadder({ poolPairs: plan.playoff_pool_pairs, advancePerPool: plan.playoff_advance_per_pool, thirdPlace: plan.playoff_third_place });
  if (!ladder.valid) return [];

  const [{ data: poolBrackets, error: poolErr }, poBracket] = await Promise.all([
    supabase.from('brackets').select('id, letter').eq('category_id', categoryId).eq('kind', 'pool'),
    getPlayoffBracket(categoryId),
  ]);
  if (poolErr) throw poolErr;

  let poMatches = [];
  if (poBracket) {
    const { data, error } = await supabase.from('matches').select('*').eq('bracket_id', poBracket.id);
    if (error) throw error;
    poMatches = data;
  }

  const poolsReady = await arePoolsComplete(poolBrackets.map((b) => b.id));
  const ladderKinds = new Set(ladder.levels.map((l) => l.kind));

  return ladder.levels.map((level) => {
    const stageMatches = poMatches.filter((m) => m.playoff_stage === level.kind);
    const completedCount = stageMatches.filter((m) => m.status === 'completed').length;

    if (stageMatches.length > 0) {
      return {
        ...level,
        status: completedCount === stageMatches.length ? 'complete' : 'generated',
        matchCount: stageMatches.length,
        completedCount,
        blockedReason: null,
      };
    }

    const prior = priorStageOf(level.kind, ladderKinds);
    if (prior === null) {
      // First stage — gated on pool play, not a prior knockout stage.
      return {
        ...level,
        status: poolsReady.ok ? 'ready' : 'locked',
        completedCount: 0,
        blockedReason: poolsReady.ok ? null : poolsReady.reason,
      };
    }

    const priorMatches = poMatches.filter((m) => m.playoff_stage === prior);
    const priorLevel = ladder.levels.find((l) => l.kind === prior);
    const priorComplete = priorMatches.length === priorLevel?.matchCount && priorMatches.every((m) => m.status === 'completed' && m.winner_team_id);
    return {
      ...level,
      status: priorComplete ? 'ready' : 'locked',
      completedCount: 0,
      blockedReason: priorComplete ? null : `${PLAYOFF_STAGES[prior].label} isn't finished yet.`,
    };
  });
}

async function arePoolsComplete(poolBracketIds) {
  if (poolBracketIds.length === 0) return { ok: false, reason: 'No pools have been drawn yet.' };
  const [{ data: teams, error: teamErr }, { data: matches, error: matchErr }] = await Promise.all([
    supabase.from('teams').select('id, bracket_id').in('bracket_id', poolBracketIds),
    supabase.from('matches').select('id, bracket_id, status').in('bracket_id', poolBracketIds),
  ]);
  if (teamErr) throw teamErr;
  if (matchErr) throw matchErr;

  for (const bracketId of poolBracketIds) {
    const teamCount = teams.filter((t) => t.bracket_id === bracketId).length;
    const totalMatches = (teamCount * (teamCount - 1)) / 2;
    const completedCount = matches.filter((m) => m.bracket_id === bracketId && m.status === 'completed').length;
    if (totalMatches === 0 || completedCount < totalMatches) {
      return { ok: false, reason: 'Every pool needs to finish its round robin first.' };
    }
  }
  return { ok: true, reason: null };
}

// Generates exactly one stage's matches. { replace: true } deletes that
// stage's still-scheduled rows first (refusing if any are completed/
// in_progress) before regenerating — used after the plan changes.
export async function generateStageMatches(categoryId, kind, { replace = false } = {}) {
  const { data: category, error: catErr } = await supabase.from('categories').select('*').eq('id', categoryId).single();
  if (catErr) throw catErr;
  const plan = readPlan(category);
  const ladder = deriveLadder({ poolPairs: plan.playoff_pool_pairs, advancePerPool: plan.playoff_advance_per_pool, thirdPlace: plan.playoff_third_place });
  if (!plan.playoff_enabled || !ladder.valid) throw new Error('This category has no valid playoff plan.');
  const level = ladder.levels.find((l) => l.kind === kind);
  if (!level) throw new Error('Unknown playoff stage.');

  const { data: poolBrackets, error: poolErr } = await supabase.from('brackets').select('id, letter').eq('category_id', categoryId).eq('kind', 'pool');
  if (poolErr) throw poolErr;

  let poBracket = await getPlayoffBracket(categoryId);

  // Without a playoff bracket yet, no match row for this category's playoff
  // stages could possibly exist — skip the delete entirely rather than
  // running it unscoped by bracket_id, which would otherwise delete every
  // still-scheduled match at this stage across every category and event.
  if (replace && poBracket) {
    const { error: delErr } = await supabase.from('matches').delete().eq('bracket_id', poBracket.id).eq('playoff_stage', kind).eq('status', 'scheduled');
    if (delErr) throw delErr;
  }

  const { data: existingRows, error: existingErr } = poBracket
    ? await supabase.from('matches').select('id').eq('bracket_id', poBracket.id).eq('playoff_stage', kind)
    : { data: [], error: null };
  if (existingErr) throw existingErr;
  if (existingRows.length > 0) throw new Error(`${level.label} has already been generated.`);

  const { data: poolMatches, error: poolMatchErr } = await supabase
    .from('matches')
    .select('round_number')
    .in(
      'bracket_id',
      poolBrackets.map((b) => b.id)
    );
  if (poolMatchErr) throw poolMatchErr;
  const baseRound = poolMatches.reduce((max, m) => Math.max(max, m.round_number || 0), 0);
  const ladderIndex = ladder.levels.findIndex((l) => l.kind === kind);
  const roundNumber = baseRound + 1 + ladderIndex;

  const ladderKinds = new Set(ladder.levels.map((l) => l.kind));
  const isFirstStage = priorStageOf(kind, ladderKinds) === null;
  let teamPairs; // [{ a: teamId, b: teamId }, ...]

  if (isFirstStage) {
    const letters = plan.playoff_pool_pairs.flat();
    const byLetter = new Map(poolBrackets.map((b) => [b.letter, b]));
    const missing = letters.filter((l) => !byLetter.has(l));
    if (missing.length > 0) throw new Error(`Pool${missing.length === 1 ? '' : 's'} ${missing.join(', ')} no longer exist — update the playoff plan to match the pools you drew.`);
    const extraLetters = poolBrackets.map((b) => b.letter).filter((l) => !letters.includes(l));
    if (extraLetters.length > 0) throw new Error(`Pool${extraLetters.length === 1 ? '' : 's'} ${extraLetters.join(', ')} ${extraLetters.length === 1 ? "isn't" : "aren't"} included in the playoff plan — update it before generating.`);

    const { data: allTeams, error: teamErr } = await supabase
      .from('teams')
      .select('*')
      .in(
        'bracket_id',
        poolBrackets.map((b) => b.id)
      );
    if (teamErr) throw teamErr;

    const rankedByLetter = new Map();
    for (const b of poolBrackets) {
      const poolTeams = allTeams.filter((t) => t.bracket_id === b.id);
      if (poolTeams.length < plan.playoff_advance_per_pool) {
        throw new Error(`Bracket ${b.letter} only has ${poolTeams.length} team${poolTeams.length === 1 ? '' : 's'}, fewer than the ${plan.playoff_advance_per_pool} needed to advance.`);
      }
      const ranked = rankTeams(poolTeams);
      for (let rank = 1; rank <= plan.playoff_advance_per_pool; rank++) {
        if (isTiedAtCut(ranked, rank)) {
          throw new Error(`Bracket ${b.letter} has a tie for ${ordinal(rank)} place — settle it before generating ${level.label}.`);
        }
      }
      rankedByLetter.set(b.letter, ranked);
    }

    if (!poBracket) {
      const { data: created, error: createErr } = await supabase
        .from('brackets')
        .insert({ category_id: categoryId, letter: 'PO', order_index: 99, kind: 'playoff' })
        .select()
        .single();
      if (createErr) throw createErr;
      poBracket = created;
    }

    const seedTeam = (letter, rank) => rankedByLetter.get(letter).find((t) => t.rank === rank);
    const slots = expandFirstStageSlots(plan.playoff_pool_pairs, plan.playoff_advance_per_pool);
    const neededSeeds = new Map();
    slots.forEach((slot) => {
      neededSeeds.set(`${slot.a.letter}${slot.a.rank}`, slot.a);
      neededSeeds.set(`${slot.b.letter}${slot.b.rank}`, slot.b);
    });

    const teamRows = Array.from(neededSeeds.entries()).map(([seedLabel, { letter, rank }]) => {
      const source = seedTeam(letter, rank);
      return {
        bracket_id: poBracket.id,
        registration_id: null,
        player1_name: source.player1_name,
        player2_name: source.player2_name,
        club_name: source.club_name,
        source_team_id: source.id,
        seed_label: seedLabel,
      };
    });
    const { data: insertedTeams, error: teamInsertErr } = await supabase
      .from('teams')
      .upsert(teamRows, { onConflict: 'bracket_id,source_team_id' })
      .select();
    if (teamInsertErr) throw teamInsertErr;
    const teamBySeed = new Map(insertedTeams.map((t) => [t.seed_label, t]));

    teamPairs = slots.map((slot) => ({
      a: teamBySeed.get(`${slot.a.letter}${slot.a.rank}`).id,
      b: teamBySeed.get(`${slot.b.letter}${slot.b.rank}`).id,
    }));
  } else {
    if (!poBracket) throw new Error('Generate the earlier playoff stages first.');
    const prior = priorStageOf(kind, ladderKinds);
    const priorLevel = ladder.levels.find((l) => l.kind === prior);
    const { data: priorMatches, error: priorErr } = await supabase
      .from('matches')
      .select('*')
      .eq('bracket_id', poBracket.id)
      .eq('playoff_stage', prior)
      .order('match_code');
    if (priorErr) throw priorErr;
    if (priorMatches.length !== priorLevel?.matchCount || priorMatches.some((m) => m.status !== 'completed' || !m.winner_team_id)) {
      throw new Error(`${PLAYOFF_STAGES[prior].label} isn't finished yet.`);
    }

    if (kind === 'third_place') {
      const losers = priorMatches.map((m) => (m.winner_team_id === m.team_a_id ? m.team_b_id : m.team_a_id));
      teamPairs = [{ a: losers[0], b: losers[1] }];
    } else {
      teamPairs = [];
      for (let i = 0; i < priorMatches.length; i += 2) {
        teamPairs.push({ a: priorMatches[i].winner_team_id, b: priorMatches[i + 1].winner_team_id });
      }
    }
  }

  const rows = teamPairs.map((pair, i) => ({
    bracket_id: poBracket.id,
    team_a_id: pair.a,
    team_b_id: pair.b,
    status: 'scheduled',
    round_number: roundNumber,
    playoff_stage: kind,
    match_code: kind === 'third_place' ? '3RD' : kind === 'final' ? 'F' : `${PLAYOFF_STAGES[kind].short}${i + 1}`,
  }));
  const { data, error } = await supabase.from('matches').insert(rows).select();
  if (error) throw error;
  return data;
}
