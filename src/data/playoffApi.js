import { supabase } from '../lib/supabaseClient';
import { isDoubleForfeit, matchIsDecided, resolveFixture } from '../utils/forfeit';
import { compareMatchCode } from '../utils/match';
import { arePoolsReady } from '../utils/scheduling';
import { rankTeams, isTiedAtCut } from '../utils/standings';
// The pure ladder-derivation logic lives in utils/playoffLadder.js (no
// Supabase import) so utils/bracketTree.js and anything else that only
// needs the pure math can import it without pulling this file's `supabase`
// import along for the ride — that breaks under the plain `node --test`
// runner, which has no `import.meta.env`. Re-exported here so every
// existing `from '../../data/playoffApi'` import (CategoryEditor.jsx,
// PlayoffStagesEditor.jsx, PlayoffCrossoverConfirmModal.jsx,
// MatchScheduleView.jsx) keeps working unchanged.
// (a plain `export { X } from 'Y'` re-export wouldn't bind these names
// locally, and this file's own functions below call them directly)
import {
  PLAYOFF_STAGES,
  matchLevelLabel,
  deriveLadder,
  deriveLadderFromPlan,
  priorStageOf,
  stageMatchCode,
  unpairedPools,
  expandFirstStageSlots,
  expandSinglePoolSlots,
  usesPointsSeeding,
  hasSemifinal,
  semifinalOpensKnockout,
  semifinalPairing,
  applySeedOrder,
  seedSemifinals,
  withSemifinalSetup,
} from '../utils/playoffLadder';
export { PLAYOFF_STAGES, matchLevelLabel, deriveLadder, deriveLadderFromPlan, unpairedPools, expandFirstStageSlots, expandSinglePoolSlots };

function ordinal(n) {
  if (n % 10 === 1 && n % 100 !== 11) return `${n}st`;
  if (n % 10 === 2 && n % 100 !== 12) return `${n}nd`;
  if (n % 10 === 3 && n % 100 !== 13) return `${n}rd`;
  return `${n}th`;
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
    playoff_semifinal_seeding: category.playoff_semifinal_seeding || 'crossover',
    playoff_semifinal_pairing: category.playoff_semifinal_pairing || '1v4',
    playoff_points_metric: category.playoff_points_metric || 'total',
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

// Per-stage readiness for a category's derived ladder. Returns one row per
// ladder level, in play order.
export async function getPlayoffStatus(categoryId) {
  const { data: category, error: catErr } = await supabase.from('categories').select('*').eq('id', categoryId).single();
  if (catErr) throw catErr;
  const plan = readPlan(category);
  if (!plan.playoff_enabled) return [];

  const ladder = deriveLadderFromPlan(plan);
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
    const priorComplete = priorMatches.length === priorLevel?.matchCount && priorMatches.every(matchIsDecided);
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
    supabase.from('teams').select('id, bracket_id, withdrawn_at').in('bracket_id', poolBracketIds),
    supabase.from('matches').select('id, bracket_id, team_a_id, team_b_id, status').in('bracket_id', poolBracketIds),
  ]);
  if (teamErr) throw teamErr;
  if (matchErr) throw matchErr;
  return arePoolsReady(poolBracketIds, teams, matches);
}

// Every pool's qualifiers for a points-seeded semifinal: each pool's top N
// by the normal standings, exactly as the crossover picks them. Only the
// seeding afterwards differs. Each team carries its pool letter for display.
async function loadPointsQualifiers(plan, poolBrackets, level) {
  if (poolBrackets.length !== plan.playoff_pool_count) {
    throw new Error(
      `This plan expects ${plan.playoff_pool_count} pool${plan.playoff_pool_count === 1 ? '' : 's'}, but ${poolBrackets.length} ${poolBrackets.length === 1 ? 'was' : 'were'} drawn — update the playoff plan to match.`
    );
  }
  const { data: poolRows, error } = await supabase
    .from('teams')
    .select('*')
    .in(
      'bracket_id',
      poolBrackets.map((b) => b.id)
    );
  if (error) throw error;
  const qualifiers = [];
  for (const b of poolBrackets) {
    const poolTeams = poolRows.filter((t) => t.bracket_id === b.id && !t.withdrawn_at);
    if (poolTeams.length < plan.playoff_advance_per_pool) {
      throw new Error(`Pool ${b.letter} only has ${poolTeams.length} team${poolTeams.length === 1 ? '' : 's'}, fewer than the ${plan.playoff_advance_per_pool} needed to advance.`);
    }
    const ranked = rankTeams(poolTeams);
    for (let rank = 1; rank <= plan.playoff_advance_per_pool; rank++) {
      if (isTiedAtCut(ranked, rank)) {
        throw new Error(`Pool ${b.letter} has a tie for ${ordinal(rank)} place — settle it before generating ${level.label}.`);
      }
    }
    qualifiers.push(...ranked.slice(0, plan.playoff_advance_per_pool).map((t) => ({ ...t, pool_letter: b.letter })));
  }
  return qualifiers;
}

// A double-forfeited match sends nobody on, but a fixture needs two
// teams — one who forfeited fills the slot and resolveFixture closes the
// match as a walkover (see utils/forfeit.js).
const winnerSide = (m) => (isDoubleForfeit(m) ? { team: m.team_a_id, dead: true } : { team: m.winner_team_id, dead: false });
const loserSide = (m) =>
  isDoubleForfeit(m) ? { team: m.team_b_id, dead: true } : { team: m.winner_team_id === m.team_a_id ? m.team_b_id : m.team_a_id, dead: false };

// The previous knockout round's matches in code order (numerically: the
// database sorts R32-10 before R32-2, which would pair the wrong winners),
// once every one of them has a result.
async function loadDecidedStage(poBracket, prior, priorLevel) {
  if (!poBracket) throw new Error('Generate the earlier playoff stages first.');
  const { data: priorMatches, error } = await supabase.from('matches').select('*').eq('bracket_id', poBracket.id).eq('playoff_stage', prior);
  if (error) throw error;
  priorMatches.sort((a, b) => compareMatchCode(a.match_code, b.match_code));
  if (priorMatches.length !== priorLevel?.matchCount || !priorMatches.every(matchIsDecided)) {
    throw new Error(`${PLAYOFF_STAGES[prior].label} isn't finished yet.`);
  }
  return priorMatches;
}

// The four teams that won their way into a points-seeded semifinal that
// follows an earlier knockout round, each carrying its round-robin record
// (what the seeding ranks on), its pool letter, and the knockout-bracket
// team (`poTeamId`) that actually plays the fixture.
// A team marked `dead` lost a double forfeit and is ranked last (see
// rankByPoints), so the walkover goes to the top seed.
async function loadPointsWinners(priorMatches, poolBrackets) {
  const sides = priorMatches.map(winnerSide);
  if (sides.length !== 4) throw new Error('A points-seeded semifinal needs exactly four teams.');
  // One request: each knockout team with its pool row embedded.
  const { data: poTeams, error } = await supabase
    .from('teams')
    .select('id, source:source_team_id(*)')
    .in(
      'id',
      sides.map((s) => s.team)
    );
  if (error) throw error;
  const letterByBracket = new Map(poolBrackets.map((b) => [b.id, b.letter]));
  return sides.map((side) => {
    const source = poTeams.find((t) => t.id === side.team)?.source;
    if (!source) throw new Error("Couldn't find a semifinalist's round-robin record to seed from.");
    return { ...source, pool_letter: letterByBracket.get(source.bracket_id), poTeamId: side.team, dead: side.dead };
  });
}

// The four teams a points-seeded semifinal would be drawn from (with their
// round-robin records), unranked: the generate popup ranks them itself so the
// organizer can switch the ranking metric without another round trip.
// The category, its pools and its knockout bracket don't depend on each
// other, so they're fetched together (this runs while the popup says
// "Loading the standings…", often on venue mobile data).
export async function getSemifinalCandidates(categoryId) {
  const [{ data: category, error: catErr }, { data: poolBrackets, error: poolErr }, poBracket] = await Promise.all([
    supabase.from('categories').select('*').eq('id', categoryId).single(),
    supabase.from('brackets').select('id, letter').eq('category_id', categoryId).eq('kind', 'pool'),
    getPlayoffBracket(categoryId),
  ]);
  if (catErr) throw catErr;
  if (poolErr) throw poolErr;
  const plan = readPlan(category);
  const ladder = deriveLadderFromPlan(plan);
  if (!plan.playoff_enabled || !hasSemifinal(ladder)) throw new Error('This category has no semifinals.');
  poolBrackets.sort((a, b) => a.letter.localeCompare(b.letter));
  if (semifinalOpensKnockout(ladder)) return loadPointsQualifiers(plan, poolBrackets, ladder.levels[0]);
  const prior = priorStageOf('semifinal', new Set(ladder.levels.map((l) => l.kind)));
  const priorMatches = await loadDecidedStage(poBracket, prior, ladder.levels.find((l) => l.kind === prior));
  return loadPointsWinners(priorMatches, poolBrackets);
}

// Generates exactly one stage's matches. { replace: true } deletes that
// stage's still-scheduled rows first (refusing if any are completed/
// in_progress) before regenerating — used after the plan changes.
// `seedOrder` (team ids, best first) is the organizer's tie-settled order for
// a points-seeded semifinal; see applySeedOrder. `semifinal`
// ({ seeding, pairing, metric }) is what the organizer confirmed in the
// generate popup: it overrides the category's saved semifinal setup for this
// one generation, so someone without permission to edit categories can still
// generate with the settings they confirmed.
export async function generateStageMatches(categoryId, kind, { replace = false, seedOrder = null, semifinal = null } = {}) {
  const { data: category, error: catErr } = await supabase.from('categories').select('*').eq('id', categoryId).single();
  if (catErr) throw catErr;
  const plan = withSemifinalSetup(readPlan(category), semifinal);
  const ladder = deriveLadderFromPlan(plan);
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
    let rankedByLetter;
    let slots;
    // Every seed this stage needs ({ seedLabel, source team }) and its
    // fixtures as pairs of seed labels.
    let seedEntries;
    let slotLabels;

    if (usesPointsSeeding(plan, ladder) && semifinalOpensKnockout(ladder)) {
      const qualifiers = await loadPointsQualifiers(plan, poolBrackets, level);
      const seeds = applySeedOrder(qualifiers, plan.playoff_points_metric, seedOrder);
      seedEntries = seeds.map((source, i) => ({ seedLabel: `S${i + 1}`, source }));
      slotLabels = semifinalPairing(plan).matches.map(([a, b]) => ({ a: `S${a}`, b: `S${b}` }));
    } else if (plan.playoff_pool_count === 1) {
      if (poolBrackets.length !== 1) {
        throw new Error(`This plan expects 1 pool, but ${poolBrackets.length} pool${poolBrackets.length === 1 ? '' : 's'} were drawn — update the playoff plan to match.`);
      }
      const pool = poolBrackets[0];
      const { data: poolRows, error: teamErr } = await supabase.from('teams').select('*').eq('bracket_id', pool.id);
      if (teamErr) throw teamErr;
      const allTeams = poolRows.filter((t) => !t.withdrawn_at); // the next-ranked player takes a withdrawn player's seed
      if (allTeams.length < plan.playoff_advance_per_pool) {
        throw new Error(`Pool ${pool.letter} only has ${allTeams.length} team${allTeams.length === 1 ? '' : 's'}, fewer than the ${plan.playoff_advance_per_pool} needed to advance.`);
      }
      const ranked = rankTeams(allTeams);
      for (let rank = 1; rank <= plan.playoff_advance_per_pool; rank++) {
        if (isTiedAtCut(ranked, rank)) {
          throw new Error(`Pool ${pool.letter} has a tie for ${ordinal(rank)} place — settle it before generating ${level.label}.`);
        }
      }
      rankedByLetter = new Map([[pool.letter, ranked]]);
      slots = expandSinglePoolSlots(pool.letter, plan.playoff_advance_per_pool);
    } else {
      const letters = plan.playoff_pool_pairs.flat();
      const byLetter = new Map(poolBrackets.map((b) => [b.letter, b]));
      const missing = letters.filter((l) => !byLetter.has(l));
      if (missing.length > 0) throw new Error(`Pool${missing.length === 1 ? '' : 's'} ${missing.join(', ')} no longer exist — update the playoff plan to match the pools you drew.`);
      const extraLetters = poolBrackets.map((b) => b.letter).filter((l) => !letters.includes(l));
      if (extraLetters.length > 0) throw new Error(`Pool${extraLetters.length === 1 ? '' : 's'} ${extraLetters.join(', ')} ${extraLetters.length === 1 ? "isn't" : "aren't"} included in the playoff plan — update it before generating.`);

      const { data: poolRows, error: teamErr } = await supabase
        .from('teams')
        .select('*')
        .in(
          'bracket_id',
          poolBrackets.map((b) => b.id)
        );
      if (teamErr) throw teamErr;
      const allTeams = poolRows.filter((t) => !t.withdrawn_at); // the next-ranked player takes a withdrawn player's seed

      rankedByLetter = new Map();
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
      slots = expandFirstStageSlots(plan.playoff_pool_pairs, plan.playoff_advance_per_pool);
    }

    if (!seedEntries) {
      const seedTeam = (letter, rank) => rankedByLetter.get(letter).find((t) => t.rank === rank);
      const neededSeeds = new Map();
      slots.forEach((slot) => {
        neededSeeds.set(`${slot.a.letter}${slot.a.rank}`, slot.a);
        neededSeeds.set(`${slot.b.letter}${slot.b.rank}`, slot.b);
      });
      seedEntries = Array.from(neededSeeds.entries()).map(([seedLabel, { letter, rank }]) => ({ seedLabel, source: seedTeam(letter, rank) }));
      slotLabels = slots.map((slot) => ({ a: `${slot.a.letter}${slot.a.rank}`, b: `${slot.b.letter}${slot.b.rank}` }));
    }

    if (!poBracket) {
      // Another organizer may be generating this same stage right now, so
      // this keeps whichever copy got there first and reads it back.
      const { error: createErr } = await supabase
        .from('brackets')
        .upsert({ category_id: categoryId, letter: 'PO', order_index: 99, kind: 'playoff' }, { onConflict: 'category_id,letter', ignoreDuplicates: true });
      if (createErr) throw createErr;
      poBracket = await getPlayoffBracket(categoryId);
    }

    const teamRows = seedEntries.map(({ seedLabel, source }) => {
      return {
        bracket_id: poBracket.id,
        registration_id: null,
        player1_name: source.player1_name,
        player2_name: source.player2_name,
        club_name: source.club_name,
        source_team_id: source.id,
        seed_label: seedLabel,
        // A transferred player keeps their TRANSFERRED badge in the playoffs.
        // Only sent when set, so this works on a database without the column.
        ...(source.transferred_in_at ? { transferred_in_at: source.transferred_in_at, transferred_from: source.transferred_from } : {}),
      };
    });
    const { data: insertedTeams, error: teamInsertErr } = await supabase
      .from('teams')
      .upsert(teamRows, { onConflict: 'bracket_id,source_team_id' })
      .select();
    if (teamInsertErr) throw teamInsertErr;
    const teamBySeed = new Map(insertedTeams.map((t) => [t.seed_label, t]));

    teamPairs = slotLabels.map((slot) => ({ a: teamBySeed.get(slot.a).id, b: teamBySeed.get(slot.b).id }));
  } else {
    const prior = priorStageOf(kind, ladderKinds);
    const priorLevel = ladder.levels.find((l) => l.kind === prior);
    const priorMatches = await loadDecidedStage(poBracket, prior, priorLevel);
    const pairOf = (sideA, sideB) => ({ a: sideA.team, b: sideB.team, deadA: sideA.dead, deadB: sideB.dead });

    if (kind === 'semifinal' && usesPointsSeeding(plan, ladder)) {
      // Seeded by round-robin point differential, not by bracket position.
      const winners = await loadPointsWinners(priorMatches, poolBrackets);
      teamPairs = seedSemifinals(winners, plan, seedOrder).map(([a, b]) => pairOf({ team: a.poTeamId, dead: a.dead }, { team: b.poTeamId, dead: b.dead }));
    } else if (kind === 'third_place') {
      teamPairs = [pairOf(loserSide(priorMatches[0]), loserSide(priorMatches[1]))];
    } else {
      teamPairs = [];
      for (let i = 0; i < priorMatches.length; i += 2) {
        teamPairs.push(pairOf(winnerSide(priorMatches[i]), winnerSide(priorMatches[i + 1])));
      }
    }
  }

  const { data: playoffTeams, error: playoffTeamErr } = await supabase.from('teams').select('id, withdrawn_at').eq('bracket_id', poBracket.id);
  if (playoffTeamErr) throw playoffTeamErr;
  const withdrawnIds = new Set(playoffTeams.filter((t) => t.withdrawn_at).map((t) => t.id));
  const finishedAt = new Date().toISOString();

  const rows = teamPairs.map((pair, i) => {
    const fixture = resolveFixture({ teamA: pair.a, teamB: pair.b, deadA: pair.deadA, deadB: pair.deadB, withdrawnIds });
    return {
      bracket_id: poBracket.id,
      ...fixture,
      ...(fixture.status === 'completed' ? { finished_at: finishedAt } : {}),
      round_number: roundNumber,
      playoff_stage: kind,
      match_code: stageMatchCode(kind, i + 1),
    };
  });
  const { data, error } = await supabase.from('matches').upsert(rows, { onConflict: 'bracket_id,match_code', ignoreDuplicates: true }).select();
  if (error) throw error;
  // Nothing written means another organizer's identical request got in first.
  if (data.length === 0) throw new Error(`${level.label} has already been generated.`);
  return data;
}
