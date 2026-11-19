import test from 'node:test';
import assert from 'node:assert/strict';
import { categoryLadder, deriveLadder, deriveLadderFromPlan, expandFirstStageSlots, priorStageOf, stageMatchCode } from './playoffLadder.js';
import { compareMatchCode } from './match.js';
import { buildBracketTreesForCategory } from './bracketTree.js';
import { buildTimetable } from './timetable.js';

// A category exactly as Supabase returns it — snake_case plan columns, no
// `ladder` of its own. Everything below starts from this shape on purpose:
// that's what useMatchSchedule and the Preview Screen actually hold.
const row = (over = {}) => ({
  id: 'c1',
  name: 'Men A',
  order_index: 0,
  format: 'Round Robin',
  playoff_enabled: true,
  playoff_pool_count: 2,
  playoff_pool_pairs: [['A', 'B']],
  playoff_advance_per_pool: 2,
  playoff_third_place: true,
  ...over,
});
const kinds = (ladder) => ladder.levels.map((l) => l.kind);

test('deriveLadderFromPlan reads a saved plan the same as deriveLadder reads camelCase', () => {
  const plans = [
    row(),
    row({ playoff_third_place: false }),
    row({ playoff_pool_count: 4, playoff_pool_pairs: [['A', 'C'], ['B', 'D']] }),
    row({ playoff_pool_count: 1, playoff_pool_pairs: [], playoff_advance_per_pool: 4 }),
    row({ playoff_advance_per_pool: 1 }),
    row({ playoff_pool_pairs: [] }),
  ];
  for (const plan of plans) {
    const expected = deriveLadder({
      poolCount: plan.playoff_pool_count,
      poolPairs: plan.playoff_pool_pairs,
      advancePerPool: plan.playoff_advance_per_pool,
      thirdPlace: plan.playoff_third_place,
    });
    assert.deepEqual(deriveLadderFromPlan(plan), expected);
  }
});

test('every common saved plan produces the knockout stages it describes', () => {
  assert.deepEqual(kinds(deriveLadderFromPlan(row())), ['semifinal', 'third_place', 'final']);
  assert.deepEqual(kinds(deriveLadderFromPlan(row({ playoff_third_place: false }))), ['semifinal', 'final']);
  assert.deepEqual(kinds(deriveLadderFromPlan(row({ playoff_advance_per_pool: 1 }))), ['final']);
  assert.deepEqual(kinds(deriveLadderFromPlan(row({ playoff_pool_count: 4, playoff_pool_pairs: [['A', 'C'], ['B', 'D']] }))), ['quarterfinal', 'semifinal', 'third_place', 'final']);
  assert.deepEqual(kinds(deriveLadderFromPlan(row({ playoff_pool_count: 1, playoff_pool_pairs: [], playoff_advance_per_pool: 4 }))), ['semifinal', 'third_place', 'final']);
});

test('a saved plan that really is invalid still reports why', () => {
  const ladder = deriveLadderFromPlan(row({ playoff_pool_pairs: [] }));
  assert.equal(ladder.valid, false);
  assert.match(ladder.error, /pool pair/);
});

test('categoryLadder covers the whole Round Robin family, and nothing else', () => {
  assert.equal(categoryLadder(row()).valid, true);
  assert.equal(categoryLadder(row({ format: 'Double Round Robin' })).valid, true);
  assert.equal(categoryLadder(row({ playoff_enabled: false })), null);
  assert.equal(categoryLadder(row({ format: 'Single Elimination' })), null);
  assert.equal(categoryLadder(row({ format: 'Double Elimination' })), null);
  assert.equal(categoryLadder(row({ format: null })), null);
});

// ---------------------------------------------------------------------------
// The original bug, end to end: a raw row through the same steps as
// useMatchSchedule, not a hand-written `ladder` the way older tests pass one.
// ---------------------------------------------------------------------------

const team = (id) => ({ id, player1_name: id, player2_name: null });
const playoffMatch = (over) => ({
  id: over.match_code,
  category_id: 'c1',
  bracket_letter: 'PO',
  round_number: 6,
  status: 'scheduled',
  team_a_id: `${over.match_code}-a`,
  team_b_id: `${over.match_code}-b`,
  team_a: team(`${over.match_code}-a`),
  team_b: team(`${over.match_code}-b`),
  ...over,
});
const semifinals = [playoffMatch({ match_code: 'SF1', playoff_stage: 'semifinal' }), playoffMatch({ match_code: 'SF2', playoff_stage: 'semifinal' })];

test('a pool-plus-playoffs row with generated semifinals builds its bracket tree', () => {
  const category = row();
  const { trees } = buildBracketTreesForCategory({ ...category, ladder: categoryLadder(category) }, semifinals);
  assert.equal(trees.length, 1);
  assert.equal(trees[0].title, 'Playoffs');
  assert.deepEqual(trees[0].rounds.map((r) => r.label), ['Semifinals', 'Championship']);
  assert.deepEqual(trees[0].rounds[0].matches.map((m) => m.status), ['scheduled', 'scheduled']);
  assert.equal(trees[0].rounds[1].matches[0].teamA.label, 'Winner of SF1');
  assert.equal(trees[0].thirdPlace.teamA.label, 'Loser of SF1');
});

test('a pool-plus-playoffs row projects its ungenerated stages into the timetable', () => {
  const category = row();
  const now = new Date(2026, 9, 10, 9, 0, 0).getTime();
  const event = { num_courts: 2, match_duration_minutes: 20, start_date: '2026-10-10', end_date: '2026-10-10', daily_start_time: null };
  const t = buildTimetable({ event, categories: [{ ...category, ladder: categoryLadder(category) }], matches: semifinals, now });
  assert.deepEqual(t.rows.filter((r) => r.projected).map((r) => r.playoff_stage), ['third_place', 'final']);
});

test('a stale playoff flag on a Single Elimination row projects nothing', () => {
  const category = row({ format: 'Single Elimination' });
  const now = new Date(2026, 9, 10, 9, 0, 0).getTime();
  const event = { num_courts: 2, match_duration_minutes: 20, start_date: '2026-10-10', end_date: '2026-10-10', daily_start_time: null };
  const round1 = [playoffMatch({ match_code: 'M1', bracket_letter: 'A', round_number: 1 })];
  const t = buildTimetable({ event, categories: [{ ...category, ladder: categoryLadder(category) }], matches: round1, now });
  assert.equal(t.rows.filter((r) => r.projected).length, 0);
});

// ---------------------------------------------------------------------------
// ROUND OF 16 / ROUND OF 32
// ---------------------------------------------------------------------------

const eightPools = [['A', 'E'], ['B', 'F'], ['C', 'G'], ['D', 'H']];
const sixteenPools = [['A', 'I'], ['B', 'J'], ['C', 'K'], ['D', 'L'], ['E', 'M'], ['F', 'N'], ['G', 'O'], ['H', 'P']];

test('8 pools advancing their top 2 starts at a Round of 16', () => {
  const ladder = deriveLadderFromPlan(row({ playoff_pool_count: 8, playoff_pool_pairs: eightPools }));
  assert.deepEqual(ladder.levels.map((l) => [l.kind, l.matchCount]), [
    ['round_of_16', 8],
    ['quarterfinal', 4],
    ['semifinal', 2],
    ['third_place', 1],
    ['final', 1],
  ]);
});

test('every route to 32 teams starts at a Round of 32', () => {
  const sixteenTopTwo = deriveLadderFromPlan(row({ playoff_pool_count: 16, playoff_pool_pairs: sixteenPools }));
  const eightTopFour = deriveLadderFromPlan(row({ playoff_pool_count: 8, playoff_pool_pairs: eightPools, playoff_advance_per_pool: 4 }));
  assert.deepEqual(kinds(sixteenTopTwo).slice(0, 3), ['round_of_32', 'round_of_16', 'quarterfinal']);
  assert.equal(sixteenTopTwo.levels[0].matchCount, 16);
  assert.deepEqual(kinds(eightTopFour), kinds(sixteenTopTwo));
});

test('16 pools advancing their winner also starts at a Round of 16', () => {
  assert.equal(deriveLadderFromPlan(row({ playoff_pool_count: 16, playoff_pool_pairs: sixteenPools, playoff_advance_per_pool: 1 })).levels[0].kind, 'round_of_16');
});

test('team counts a knockout cannot use are refused with the numbers that would work', () => {
  const tooMany = deriveLadderFromPlan(row({ playoff_pool_count: 16, playoff_pool_pairs: sixteenPools, playoff_advance_per_pool: 4 }));
  assert.equal(tooMany.valid, false);
  assert.match(tooMany.error, /64 teams advancing.*2, 4, 8, 16 or 32/);
  const sixPools = deriveLadderFromPlan(row({ playoff_pool_count: 6, playoff_pool_pairs: [['A', 'D'], ['B', 'E'], ['C', 'F']] }));
  assert.equal(sixPools.valid, false);
  assert.match(sixPools.error, /12 teams advancing/);
});

test('each stage is fed by the one before it in that ladder', () => {
  const ladderKinds = new Set(['round_of_32', 'round_of_16', 'quarterfinal', 'semifinal', 'third_place', 'final']);
  assert.equal(priorStageOf('round_of_32', ladderKinds), null);
  assert.equal(priorStageOf('round_of_16', ladderKinds), 'round_of_32');
  assert.equal(priorStageOf('quarterfinal', ladderKinds), 'round_of_16');
  assert.equal(priorStageOf('semifinal', ladderKinds), 'quarterfinal');
  assert.equal(priorStageOf('final', ladderKinds), 'semifinal');
  assert.equal(priorStageOf('third_place', ladderKinds), 'semifinal');
});

test('stages a smaller ladder skips are skipped when finding what feeds a stage', () => {
  const r16Start = new Set(['round_of_16', 'quarterfinal', 'semifinal', 'final']);
  assert.equal(priorStageOf('round_of_16', r16Start), null);
  const qfStart = new Set(['quarterfinal', 'semifinal', 'final']);
  assert.equal(priorStageOf('quarterfinal', qfStart), null);
  assert.equal(priorStageOf('semifinal', new Set(['semifinal', 'final'])), null);
  assert.equal(priorStageOf('final', new Set(['final'])), null);
});

test('match codes keep the round number apart from the match number', () => {
  assert.equal(stageMatchCode('round_of_16', 3), 'R16-3');
  assert.equal(stageMatchCode('round_of_32', 16), 'R32-16');
  assert.equal(stageMatchCode('quarterfinal', 2), 'QF2');
  assert.equal(stageMatchCode('third_place', 1), '3RD');
  assert.equal(stageMatchCode('final', 1), 'F');
});

test('Round of 32 codes sort numerically, so winners pair with their neighbour', () => {
  const codes = Array.from({ length: 16 }, (_, i) => stageMatchCode('round_of_32', i + 1));
  const shuffled = [...codes].sort(); // text order, which is what the database would return
  assert.notDeepEqual(shuffled, codes);
  assert.deepEqual([...shuffled].sort(compareMatchCode), codes);
});

test('a pool pair lands in opposite halves of a Round of 16, so they cannot rematch before the Final', () => {
  const slots = expandFirstStageSlots(eightPools, 2);
  assert.equal(slots.length, 8);
  const half = (letter) => slots.map((s, i) => ([s.a.letter, s.b.letter].includes(letter) ? (i < 4 ? 'top' : 'bottom') : null)).filter(Boolean);
  assert.deepEqual(half('A'), ['top', 'bottom']);
  assert.deepEqual(half('E'), ['top', 'bottom']);
});

test('a Round of 16 row builds a full tree of placeholders with matching codes', () => {
  const category = row({ playoff_pool_count: 8, playoff_pool_pairs: eightPools });
  const { trees } = buildBracketTreesForCategory({ ...category, ladder: categoryLadder(category) }, []);
  const [r16, quarters] = trees[0].rounds;
  assert.equal(r16.label, 'Round of 16');
  assert.equal(r16.matches.length, 8);
  assert.equal(r16.matches[2].matchCode, 'R16-3');
  assert.equal(r16.matches[1].teamA.label, 'Pool B · Rank 1');
  assert.equal(quarters.matches[1].teamA.label, 'Winner of R16-3');
});

// --- Points-system semifinal seeding ---------------------------------------

import { applySeedOrder, crossoverOption, formatPointsValue, hasPointsTie, hasSemifinal, semifinalSetupSummary, rankByPoints, semifinalOpensKnockout, semifinalPairing, usesPointsSeeding } from './playoffLadder.js';

const t = (id, w, l, pf, pa) => ({ id, wins: w, losses: l, points_for: pf, points_against: pa });

test('points seeding ranks by point differential only, ignoring wins and losses', () => {
  // B has the best record but the smallest differential.
  const teams = [t('A', 3, 2, 50, 40), t('B', 5, 0, 55, 50), t('C', 2, 3, 60, 30), t('D', 4, 1, 45, 37)];
  const seeds = applySeedOrder(teams, 'total');
  assert.deepEqual(seeds.map((x) => x.id), ['C', 'A', 'D', 'B']); // +30, +10, +8, +5
});

test('average per game puts a smaller pool on equal footing', () => {
  // A: +12 over 6 games (+2.0/game); B: +10 over 4 games (+2.5/game).
  const teams = [t('A', 4, 2, 60, 48), t('B', 3, 1, 40, 30), t('C', 1, 3, 30, 35), t('D', 2, 2, 40, 40)];
  assert.deepEqual(applySeedOrder(teams, 'total').map((x) => x.id), ['A', 'B', 'D', 'C']);
  assert.deepEqual(applySeedOrder(teams, 'average').map((x) => x.id), ['B', 'A', 'D', 'C']);
  assert.equal(formatPointsValue(teams[1], 'average'), '+2.50');
  assert.equal(formatPointsValue(teams[2], 'total'), '−5');
});

test('a tie on the metric is found exactly, even for averages that only match as fractions', () => {
  // +6 over 3 games and +4 over 2 games are both +2.00/game.
  const teams = [t('A', 2, 1, 30, 24), t('B', 2, 0, 22, 18), t('C', 0, 3, 10, 30), t('D', 1, 1, 20, 20)];
  const ranked = rankByPoints(teams, 'average');
  assert.equal(hasPointsTie(ranked), true);
  assert.equal(ranked[0].group, ranked[1].group);
  assert.equal(hasPointsTie(rankByPoints(teams, 'total')), false);
});

test('a tie is refused without an organizer order, and the organizer may order only within it', () => {
  const teams = [t('John', 3, 2, 50, 38), t('James', 2, 3, 47, 35), t('C', 3, 2, 40, 39), t('D', 4, 1, 30, 40)];
  assert.throws(() => applySeedOrder(teams, 'total'), /tied on point differential/);
  // Coin toss: James takes seed 1.
  assert.deepEqual(applySeedOrder(teams, 'total', ['James', 'John', 'C', 'D']).map((x) => x.id), ['James', 'John', 'C', 'D']);
  assert.throws(() => applySeedOrder(teams, 'total', ['C', 'John', 'James', 'D']), /no longer matches the standings/);
  assert.throws(() => applySeedOrder(teams, 'total', ['John', 'James', 'C']), /no longer matches the qualified teams/);
});

test('points seeding applies to any ladder with a semifinal, but not one that goes straight to the final', () => {
  const semis = deriveLadderFromPlan(row({ playoff_advance_per_pool: 2 })); // 2 pools x top 2
  const quarters = deriveLadderFromPlan(row({ playoff_pool_count: 4, playoff_pool_pairs: [['A', 'C'], ['B', 'D']], playoff_advance_per_pool: 2 }));
  const finalOnly = deriveLadderFromPlan(row({ playoff_advance_per_pool: 1 })); // 2 pools x top 1
  assert.equal(usesPointsSeeding({ playoff_semifinal_seeding: 'points' }, semis), true);
  assert.equal(usesPointsSeeding({ playoff_semifinal_seeding: 'points' }, quarters), true);
  assert.equal(usesPointsSeeding({ playoff_semifinal_seeding: 'points' }, finalOnly), false);
  assert.equal(usesPointsSeeding({ playoff_semifinal_seeding: 'crossover' }, semis), false);
  assert.equal(semifinalOpensKnockout(semis), true);
  assert.equal(semifinalOpensKnockout(quarters), false);
  assert.equal(hasSemifinal(finalOnly), false);
  assert.deepEqual(semifinalPairing({}).matches, [[1, 4], [2, 3]]);
  assert.deepEqual(semifinalPairing({ playoff_semifinal_pairing: '1v2' }).matches, [[1, 2], [3, 4]]);
});

test('a points-seeded semifinal shows seed placeholders in the bracket until it is generated', () => {
  const category = row({ playoff_semifinal_seeding: 'points', playoff_semifinal_pairing: '1v2', playoff_points_metric: 'average' });
  const { trees } = buildBracketTreesForCategory({ ...category, ladder: categoryLadder(category) }, []);
  const semis = trees[0].rounds[0].matches;
  assert.deepEqual(
    semis.map((m) => [m.teamA?.label ?? m.placeholderA, m.teamB?.label ?? m.placeholderB]),
    [['Seed 1 · avg point diff', 'Seed 2 · avg point diff'], ['Seed 3 · avg point diff', 'Seed 4 · avg point diff']]
  );
});

test('a points-seeded semifinal after the quarterfinals shows seed placeholders, and the quarterfinals keep their pool slots', () => {
  const category = row({
    playoff_pool_count: 4,
    playoff_pool_pairs: [['A', 'C'], ['B', 'D']],
    playoff_advance_per_pool: 2,
    playoff_semifinal_seeding: 'points',
    playoff_semifinal_pairing: '1v3',
    playoff_points_metric: 'total',
  });
  const { trees } = buildBracketTreesForCategory({ ...category, ladder: categoryLadder(category) }, []);
  const label = (m) => [m.teamA?.label ?? m.placeholderA, m.teamB?.label ?? m.placeholderB];
  const [quarters, semis] = trees[0].rounds;
  assert.equal(label(quarters.matches[0])[0], 'Pool A · Rank 1');
  assert.deepEqual(semis.matches.map(label), [['Seed 1 · point diff', 'Seed 3 · point diff'], ['Seed 2 · point diff', 'Seed 4 · point diff']]);
});

test('the semifinal setup is summarised the way an organizer chose it', () => {
  const semis = deriveLadderFromPlan(row({ playoff_advance_per_pool: 2 }));
  const quarters = deriveLadderFromPlan(row({ playoff_pool_count: 4, playoff_pool_pairs: [['A', 'C'], ['B', 'D']], playoff_advance_per_pool: 2 }));
  const finalOnly = deriveLadderFromPlan(row({ playoff_advance_per_pool: 1 }));
  assert.equal(semifinalSetupSummary({ playoff_pool_count: 2, playoff_semifinal_seeding: 'crossover' }, semis), 'Crossover');
  assert.equal(semifinalSetupSummary({ playoff_pool_count: 4, playoff_semifinal_seeding: 'crossover' }, quarters), 'Bracket order');
  assert.equal(
    semifinalSetupSummary({ playoff_semifinal_seeding: 'points', playoff_semifinal_pairing: '1v2', playoff_points_metric: 'average' }, quarters),
    'Points system · 1 vs 2 · 3 vs 4 · avg point diff'
  );
  assert.equal(semifinalSetupSummary({ playoff_semifinal_seeding: 'points' }, finalOnly), '');
  assert.equal(crossoverOption(1, true).title, 'Standings');
});

import { seedSemifinals, withSemifinalSetup } from './playoffLadder.js';
import { isDifferentBuild } from './buildVersion.js';

test('a team that lost a double forfeit is seeded last, whatever its points, and never counts as tied', () => {
  const dead = { ...t('Out', 3, 0, 60, 20), dead: true }; // best differential, but out
  const teams = [dead, t('A', 2, 1, 40, 30), t('B', 2, 1, 35, 30), t('C', 1, 2, 30, 31)];
  const ranked = rankByPoints(teams, 'total');
  assert.deepEqual(ranked.map((r) => r.team.id), ['A', 'B', 'C', 'Out']);
  assert.equal(hasPointsTie(ranked), false);
  // So the top seed gets the walkover, as it would get a bye.
  assert.deepEqual(seedSemifinals(teams, { playoff_points_metric: 'total', playoff_semifinal_pairing: '1v4' }).map(([a, b]) => [a.id, b.id]), [['A', 'Out'], ['B', 'C']]);
  // An order putting the forfeited team above a live one is refused.
  assert.throws(() => applySeedOrder(teams, 'total', ['Out', 'A', 'B', 'C']), /no longer matches the standings/);
  // Two forfeited teams aren't a tie to settle either.
  const twoDead = [dead, { ...t('Out2', 0, 3, 10, 40), dead: true }, t('A', 2, 1, 40, 30), t('B', 2, 1, 35, 30)];
  assert.equal(hasPointsTie(rankByPoints(twoDead, 'total')), false);
  assert.doesNotThrow(() => applySeedOrder(twoDead, 'total'));
});

test('the two semifinals follow the pairing pattern, highest seed first', () => {
  const teams = [t('A', 3, 0, 50, 20), t('B', 2, 1, 40, 30), t('C', 1, 2, 30, 32), t('D', 0, 3, 20, 40)];
  const pairs = (pairing) => seedSemifinals(teams, { playoff_points_metric: 'total', playoff_semifinal_pairing: pairing }).map(([a, b]) => `${a.id}-${b.id}`);
  assert.deepEqual(pairs('1v4'), ['A-D', 'B-C']);
  assert.deepEqual(pairs('1v2'), ['A-B', 'C-D']);
  assert.deepEqual(pairs('1v3'), ['A-C', 'B-D']);
});

test('the setup confirmed when generating replaces the saved one for that generation only', () => {
  const saved = { playoff_pool_count: 4, playoff_semifinal_seeding: 'points', playoff_semifinal_pairing: '1v4', playoff_points_metric: 'total' };
  assert.equal(withSemifinalSetup(saved, null), saved);
  const confirmed = withSemifinalSetup(saved, { seeding: 'crossover', pairing: '1v2', metric: 'average' });
  assert.deepEqual(confirmed, { ...saved, playoff_semifinal_seeding: 'crossover', playoff_semifinal_pairing: '1v2', playoff_points_metric: 'average' });
  assert.equal(saved.playoff_semifinal_seeding, 'points'); // the saved plan isn't touched
  // Anything unexpected falls back to the defaults rather than breaking generation.
  assert.deepEqual(withSemifinalSetup(saved, { seeding: 'bogus', pairing: 'toString', metric: 'x' }), {
    ...saved,
    playoff_semifinal_seeding: 'crossover',
    playoff_semifinal_pairing: '1v4',
    playoff_points_metric: 'total',
  });
});

// Quarterfinal rows as the schedule hands them over: team ids plus embedded teams.
const poMatch = (stage, code, a, b, winner, extra = {}) => ({
  bracket_letter: 'PO',
  playoff_stage: stage,
  match_code: code,
  team_a_id: a,
  team_b_id: b,
  team_a: { id: a, player1_name: a },
  team_b: { id: b, player1_name: b },
  winner_team_id: winner,
  status: winner ? 'completed' : 'scheduled',
  ...extra,
});
const quarterRow = (over = {}) =>
  row({ playoff_pool_count: 4, playoff_pool_pairs: [['A', 'C'], ['B', 'D']], playoff_advance_per_pool: 2, playoff_semifinal_seeding: 'points', ...over });
const quarterfinals = [
  poMatch('quarterfinal', 'QF1', 'A1', 'C2', 'A1'),
  poMatch('quarterfinal', 'QF2', 'B1', 'D2', 'B1'),
  poMatch('quarterfinal', 'QF3', 'C1', 'A2', 'A2'),
  poMatch('quarterfinal', 'QF4', 'D1', 'B2', 'B2'),
];
const codes = (round) => round.matches.map((m) => m.matchCode);

test('a points-seeded semifinal that is not drawn yet has no lines into it', () => {
  const category = quarterRow();
  const { trees } = buildBracketTreesForCategory({ ...category, ladder: categoryLadder(category) }, quarterfinals);
  const [quarters, semis, final] = trees[0].rounds;
  assert.equal(semis.unlinked, true);
  assert.equal(final.unlinked, undefined);
  assert.deepEqual(codes(quarters), ['QF1', 'QF2', 'QF3', 'QF4']);
  // Bracket order (no points system) keeps its lines.
  const crossover = quarterRow({ playoff_semifinal_seeding: 'crossover' });
  assert.equal(buildBracketTreesForCategory({ ...crossover, ladder: categoryLadder(crossover) }, quarterfinals).trees[0].rounds[1].unlinked, undefined);
});

test('once a points-seeded semifinal is drawn, the quarterfinals line up with who actually meets', () => {
  const category = quarterRow();
  // Seeded 1v4: A1 (QF1) meets A2 (QF3); B1 (QF2) meets B2 (QF4).
  const semis = [poMatch('semifinal', 'SF1', 'A1', 'A2', null), poMatch('semifinal', 'SF2', 'B1', 'B2', null)];
  const { trees } = buildBracketTreesForCategory({ ...category, ladder: categoryLadder(category) }, [...quarterfinals, ...semis]);
  const [quarters, semiRound] = trees[0].rounds;
  assert.deepEqual(codes(quarters), ['QF1', 'QF3', 'QF2', 'QF4']);
  assert.equal(semiRound.unlinked, undefined);
  assert.deepEqual(codes(semiRound), ['SF1', 'SF2']);
});

test('a quarterfinal lost to a double forfeit still lines up with its walkover semifinal', () => {
  const category = quarterRow();
  const qf = [...quarterfinals.slice(0, 3), poMatch('quarterfinal', 'QF4', 'D1', 'B2', null, { status: 'completed', result_type: 'double_forfeit' })];
  // The forfeited D1 is seeded last and meets the top seed, A1.
  const semis = [poMatch('semifinal', 'SF1', 'A1', 'D1', null), poMatch('semifinal', 'SF2', 'B1', 'A2', null)];
  const { trees } = buildBracketTreesForCategory({ ...category, ladder: categoryLadder(category) }, [...qf, ...semis]);
  assert.deepEqual(codes(trees[0].rounds[0]), ['QF1', 'QF4', 'QF2', 'QF3']);
});

test('a redeploy in the same minute still counts as a new build', () => {
  const current = { version: '2026.11.19-1200', builtAt: '2026-11-19T04:00:05.000Z' };
  assert.equal(isDifferentBuild({ version: '2026.11.19-1200', builtAt: '2026-11-19T04:00:50.000Z' }, current), true);
  assert.equal(isDifferentBuild({ version: '2026.11.19-1200', builtAt: current.builtAt }, current), false);
  // A build from before build times were stamped is compared by version.
  assert.equal(isDifferentBuild({ version: '2026.11.17-2339' }, current), true);
  assert.equal(isDifferentBuild({ version: '2026.11.19-1200' }, { version: '2026.11.19-1200', builtAt: '' }), false);
  assert.equal(isDifferentBuild(null, current), false);
});
