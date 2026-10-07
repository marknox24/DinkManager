import test from 'node:test';
import assert from 'node:assert/strict';
import { bracketTreeApplies, buildBracketTreesForCategory, computeReadySingleEliminationMatches } from './bracketTree.js';

const team = (id) => ({ id, player1_name: id, player2_name: null });
const m = (over) => ({
  id: over.id,
  category_id: 'c1',
  bracket_letter: 'A',
  match_code: over.match_code,
  round_number: over.round_number ?? 1,
  status: over.status ?? 'scheduled',
  team_a_id: over.team_a_id ?? null,
  team_b_id: over.team_b_id ?? null,
  team_a: over.team_a_id ? team(over.team_a_id) : null,
  team_b: over.team_b_id ? team(over.team_b_id) : null,
  score_a: over.score_a ?? null,
  score_b: over.score_b ?? null,
  winner_team_id: over.winner_team_id ?? null,
  playoff_stage: over.playoff_stage ?? null,
  ...over,
});

const teamRow = (id, over = {}) => ({
  id,
  category_id: 'c1',
  bracket_letter: 'A',
  player1_name: id,
  player2_name: null,
  club_name: null,
  created_at: `2026-10-01T00:00:${String(over.seed ?? 1).padStart(2, '0')}Z`,
  ...over,
});

test('bracketTreeApplies: Single Elimination and playoff-enabled categories, not Round Robin or Double Elimination', () => {
  assert.equal(bracketTreeApplies({ format: 'Single Elimination' }), true);
  assert.equal(bracketTreeApplies({ format: 'Round Robin', playoff_enabled: true }), true);
  assert.equal(bracketTreeApplies({ format: 'Round Robin' }), false);
  assert.equal(bracketTreeApplies({ format: 'Double Elimination' }), false);
});

test('a 4-team single elimination bracket projects semifinal and final', () => {
  const category = { id: 'c1', format: 'Single Elimination' };
  const matches = [
    m({ id: 'm1', match_code: 'A1', team_a_id: 'x1', team_b_id: 'x2' }),
    m({ id: 'm2', match_code: 'A2', team_a_id: 'x3', team_b_id: 'x4' }),
  ];
  const { applicable, trees } = buildBracketTreesForCategory(category, matches);
  assert.equal(applicable, true);
  assert.equal(trees.length, 1);
  const [tree] = trees;
  assert.equal(tree.rounds.length, 2);
  assert.equal(tree.rounds[0].label, 'Semi-Final');
  assert.equal(tree.rounds[1].label, 'Final');
  assert.equal(tree.rounds[0].matches.length, 2);
  assert.equal(tree.rounds[0].matches[0].teamA.label, 'X1');
  assert.equal(tree.rounds[1].matches.length, 1);
  assert.equal(tree.rounds[1].matches[0].status, 'projected');
  assert.equal(tree.rounds[1].matches[0].teamA.label, 'Winner of Semi-Final #1');
  assert.equal(tree.rounds[1].matches[0].teamB.label, 'Winner of Semi-Final #2');
});

test('a completed round 1 match fills in the final once it exists', () => {
  const category = { id: 'c1', format: 'Single Elimination' };
  const matches = [
    m({ id: 'm1', match_code: 'A1', team_a_id: 'x1', team_b_id: 'x2', status: 'completed', score_a: 11, score_b: 5, winner_team_id: 'x1' }),
    m({ id: 'm2', match_code: 'A2', team_a_id: 'x3', team_b_id: 'x4' }),
  ];
  const { trees } = buildBracketTreesForCategory(category, matches);
  const final = trees[0].rounds[1].matches[0];
  // Still projected — the final match row itself hasn't been created yet,
  // only round 1's result is known.
  assert.equal(final.status, 'projected');
  const sf1 = trees[0].rounds[0].matches[0];
  assert.equal(sf1.winnerSide, 'a');
  assert.equal(sf1.status, 'completed');
});

test('an 8-team bracket labels rounds Quarter-Final, Semi-Final, Final', () => {
  const category = { id: 'c1', format: 'Single Elimination' };
  const matches = [1, 2, 3, 4].map((n) => m({ id: `m${n}`, match_code: `A${n}`, team_a_id: `a${n}`, team_b_id: `b${n}` }));
  const { trees } = buildBracketTreesForCategory(category, matches);
  assert.deepEqual(
    trees[0].rounds.map((r) => r.label),
    ['Quarter-Final', 'Semi-Final', 'Final']
  );
});

test('multiple brackets in one Single Elimination category each get their own tree', () => {
  const category = { id: 'c1', format: 'Single Elimination' };
  const matches = [
    m({ id: 'm1', match_code: 'A1', bracket_letter: 'A', team_a_id: 'a1', team_b_id: 'a2' }),
    m({ id: 'm2', match_code: 'B1', bracket_letter: 'B', team_a_id: 'b1', team_b_id: 'b2' }),
  ];
  const { trees } = buildBracketTreesForCategory(category, matches);
  assert.equal(trees.length, 2);
  assert.deepEqual(trees.map((t) => t.key).sort(), ['A', 'B']);
});

test('matches with no category_id (already scoped to one category, e.g. the Preview Screen) still build a tree', () => {
  const category = { id: 'c1', format: 'Single Elimination' };
  const matches = [
    m({ id: 'm1', match_code: 'A1', team_a_id: 'x1', team_b_id: 'x2', category_id: undefined }),
    m({ id: 'm2', match_code: 'A2', team_a_id: 'x3', team_b_id: 'x4', category_id: undefined }),
  ];
  const { trees } = buildBracketTreesForCategory(category, matches);
  assert.equal(trees.length, 1);
  assert.equal(trees[0].rounds[0].matches.length, 2);
});

test('a Round Robin category with no playoffs produces no tree', () => {
  const category = { id: 'c1', format: 'Round Robin', playoff_enabled: false };
  const { applicable, trees } = buildBracketTreesForCategory(category, []);
  assert.equal(applicable, false);
  assert.equal(trees.length, 0);
});

test('a playoff-enabled category with real semifinals and a placeholder final', () => {
  const category = {
    id: 'c1',
    format: 'Round Robin',
    playoff_enabled: true,
    playoff_pool_count: 2,
    playoff_pool_pairs: [['A', 'B']],
    playoff_advance_per_pool: 2,
    playoff_third_place: false,
    ladder: {
      valid: true,
      levels: [
        { kind: 'semifinal', label: 'Semifinals', matchCount: 2 },
        { kind: 'final', label: 'Championship', matchCount: 1 },
      ],
    },
  };
  const matches = [
    m({ id: 'm1', bracket_letter: 'PO', match_code: 'SF1', round_number: 5, playoff_stage: 'semifinal', team_a_id: 'a1', team_b_id: 'a2', status: 'completed', winner_team_id: 'a1' }),
    m({ id: 'm2', bracket_letter: 'PO', match_code: 'SF2', round_number: 5, playoff_stage: 'semifinal', team_a_id: 'a3', team_b_id: 'a4' }),
  ];
  const { applicable, trees } = buildBracketTreesForCategory(category, matches);
  assert.equal(applicable, true);
  assert.equal(trees.length, 1);
  const [tree] = trees;
  assert.equal(tree.rounds[0].label, 'Semifinals');
  assert.equal(tree.rounds[0].matches[0].winnerSide, 'a');
  assert.equal(tree.rounds[1].label, 'Championship');
  assert.equal(tree.rounds[1].matches[0].status, 'projected');
  assert.equal(tree.rounds[1].matches[0].teamA.label, 'Winner of SF1');
});

test('a playoff ladder whose first stage is not generated yet shows pool-rank placeholders', () => {
  const category = {
    id: 'c1',
    format: 'Round Robin',
    playoff_enabled: true,
    playoff_pool_count: 2,
    playoff_pool_pairs: [['A', 'B']],
    playoff_advance_per_pool: 2,
    ladder: { valid: true, levels: [{ kind: 'semifinal', label: 'Semifinals', matchCount: 2 }, { kind: 'final', label: 'Championship', matchCount: 1 }] },
  };
  const { trees } = buildBracketTreesForCategory(category, []);
  const firstMatch = trees[0].rounds[0].matches[0];
  assert.equal(firstMatch.status, 'projected');
  assert.ok(firstMatch.teamA.label.startsWith('Pool '));
});

// ---------------------------------------------------------------------------
// ENTRANTS — every registered team should be visible, bye or not, drawn or not
// ---------------------------------------------------------------------------

test('a 5-team bracket shows the odd team out as an explicit BYE opponent in Round 1', () => {
  const category = { id: 'c1', format: 'Single Elimination' };
  const matches = [
    m({ id: 'm1', match_code: 'A1', team_a_id: 'x1', team_b_id: 'x2' }),
    m({ id: 'm2', match_code: 'A2', team_a_id: 'x3', team_b_id: 'x4' }),
  ];
  const teams = [1, 2, 3, 4, 5].map((n) => teamRow(`x${n}`, { seed: n }));
  const { trees } = buildBracketTreesForCategory(category, matches, teams);
  const round1 = trees[0].rounds[0];
  // 2 real matches + 1 bye = 3 round-1 boxes, interleaved as
  // [real, bye, real] rather than clustered at the end.
  assert.equal(round1.matches.length, 3);
  const bye = round1.matches[1];
  assert.equal(bye.status, 'bye');
  assert.equal(bye.teamA.label, 'X5');
  assert.equal(bye.teamB, null);
  assert.equal(bye.isBareBye, true);
  assert.equal(bye.winnerSide, 'a');
  // 3 round-1 winners (2 real + 1 bye) pair down to 1 round-2 match plus a
  // silent carry-through, then 1 final — the bye-team's win still counts
  // toward the shape even though only Round 1's bye gets its own box.
  assert.equal(trees[0].rounds.length, 3);
  assert.equal(trees[0].rounds[1].matches.length, 1);
  assert.equal(trees[0].rounds[2].matches.length, 1);
});

test('a bracket with no byes needed (even team count) has no bye box', () => {
  const category = { id: 'c1', format: 'Single Elimination' };
  const matches = [
    m({ id: 'm1', match_code: 'A1', team_a_id: 'x1', team_b_id: 'x2' }),
    m({ id: 'm2', match_code: 'A2', team_a_id: 'x3', team_b_id: 'x4' }),
  ];
  const teams = [1, 2, 3, 4].map((n) => teamRow(`x${n}`, { seed: n }));
  const { trees } = buildBracketTreesForCategory(category, matches, teams);
  assert.equal(trees[0].rounds[0].matches.length, 2);
  assert.ok(trees[0].rounds[0].matches.every((mm) => mm.status !== 'bye'));
});

test('entrants list includes every registered team, grouped by bracket and seeded in order', () => {
  const category = { id: 'c1', format: 'Single Elimination' };
  const matches = [m({ id: 'm1', match_code: 'A1', team_a_id: 'x1', team_b_id: 'x2' })];
  const teams = [teamRow('x1', { seed: 1 }), teamRow('x2', { seed: 2 }), teamRow('x3', { seed: 3, bracket_letter: 'B' })];
  const { entrants } = buildBracketTreesForCategory(category, matches, teams);
  assert.equal(entrants.length, 2);
  assert.equal(entrants[0].bracketLetter, 'A');
  assert.deepEqual(entrants[0].teams.map((t) => t.seed), [1, 2]);
  assert.equal(entrants[1].bracketLetter, 'B');
});

test('a Single Elimination category with teams but no bracket drawn yet still has an entrant list', () => {
  const category = { id: 'c1', format: 'Single Elimination' };
  const teams = [teamRow('x1', { seed: 1 }), teamRow('x2', { seed: 2 })];
  const { applicable, trees, entrants } = buildBracketTreesForCategory(category, [], teams);
  assert.equal(applicable, true);
  assert.equal(trees.length, 0);
  assert.equal(entrants.length, 1);
  assert.equal(entrants[0].teams.length, 2);
});

test('a team that loses a completed match is marked eliminated in the entrant list', () => {
  const category = { id: 'c1', format: 'Single Elimination' };
  const matches = [
    m({ id: 'm1', match_code: 'A1', team_a_id: 'x1', team_b_id: 'x2', status: 'completed', winner_team_id: 'x1' }),
    m({ id: 'm2', match_code: 'A2', team_a_id: 'x3', team_b_id: 'x4' }),
  ];
  const teams = [1, 2, 3, 4].map((n) => teamRow(`x${n}`, { seed: n }));
  const { entrants } = buildBracketTreesForCategory(category, matches, teams);
  const byId = (id) => entrants[0].teams.find((t) => t.id === id);
  assert.equal(byId('x1').status, 'alive');
  assert.equal(byId('x2').status, 'eliminated');
  assert.equal(byId('x3').status, 'alive');
  assert.equal(byId('x4').status, 'alive');
});

test('a team with no completed loss stays alive, including before any matches exist', () => {
  const category = { id: 'c1', format: 'Single Elimination' };
  const teams = [teamRow('x1', { seed: 1 }), teamRow('x2', { seed: 2 })];
  const { entrants } = buildBracketTreesForCategory(category, [], teams);
  assert.ok(entrants[0].teams.every((t) => t.status === 'alive'));
});

test('a bye team is never marked eliminated', () => {
  const category = { id: 'c1', format: 'Single Elimination' };
  const matches = [
    m({ id: 'm1', match_code: 'A1', team_a_id: 'x1', team_b_id: 'x2' }),
    m({ id: 'm2', match_code: 'A2', team_a_id: 'x3', team_b_id: 'x4' }),
  ];
  const teams = [1, 2, 3, 4, 5].map((n) => teamRow(`x${n}`, { seed: n }));
  const { entrants } = buildBracketTreesForCategory(category, matches, teams);
  assert.equal(entrants[0].teams.find((t) => t.id === 'x5').status, 'alive');
});

test('elimination is scoped to a team\'s own bracket', () => {
  const category = { id: 'c1', format: 'Single Elimination' };
  const matches = [
    m({ id: 'm1', match_code: 'A1', bracket_letter: 'A', team_a_id: 'a1', team_b_id: 'a2', status: 'completed', winner_team_id: 'a1' }),
    m({ id: 'm2', match_code: 'B1', bracket_letter: 'B', team_a_id: 'b1', team_b_id: 'b2' }),
  ];
  const teams = [teamRow('a1', { seed: 1 }), teamRow('a2', { seed: 2 }), teamRow('b1', { seed: 1, bracket_letter: 'B' }), teamRow('b2', { seed: 2, bracket_letter: 'B' })];
  const { entrants } = buildBracketTreesForCategory(category, matches, teams);
  const bracketB = entrants.find((e) => e.bracketLetter === 'B');
  assert.ok(bracketB.teams.every((t) => t.status === 'alive'));
});

test('playoff-ladder categories get no entrant list (already shown via pool standings)', () => {
  const category = {
    id: 'c1',
    format: 'Round Robin',
    playoff_enabled: true,
    playoff_pool_count: 2,
    playoff_pool_pairs: [['A', 'B']],
    playoff_advance_per_pool: 2,
    ladder: { valid: true, levels: [{ kind: 'final', label: 'Championship', matchCount: 1 }] },
  };
  const teams = [teamRow('x1'), teamRow('x2')];
  const { entrants } = buildBracketTreesForCategory(category, [], teams);
  assert.equal(entrants.length, 0);
});

// ---------------------------------------------------------------------------
// SINGLE ELIMINATION ADVANCEMENT — computeReadySingleEliminationMatches
// ---------------------------------------------------------------------------

test('no decisions yet produces nothing to create', () => {
  const matches = [m({ id: 'm1', match_code: 'A1', team_a_id: 'x1', team_b_id: 'x2' }), m({ id: 'm2', match_code: 'A2', team_a_id: 'x3', team_b_id: 'x4' })];
  assert.deepEqual(computeReadySingleEliminationMatches(matches, []), []);
});

test('only one of the two feeders decided is not enough', () => {
  const matches = [
    m({ id: 'm1', match_code: 'A1', team_a_id: 'x1', team_b_id: 'x2', status: 'completed', winner_team_id: 'x1' }),
    m({ id: 'm2', match_code: 'A2', team_a_id: 'x3', team_b_id: 'x4' }),
  ];
  assert.deepEqual(computeReadySingleEliminationMatches(matches, []), []);
});

test('both Round 1 matches complete creates the Round 2 winner-vs-winner pairing, plus 3rd place since Round 1 is this bracket\'s semifinal', () => {
  const matches = [
    m({ id: 'm1', match_code: 'A1', team_a_id: 'x1', team_b_id: 'x2', status: 'completed', winner_team_id: 'x1' }),
    m({ id: 'm2', match_code: 'A2', team_a_id: 'x3', team_b_id: 'x4', status: 'completed', winner_team_id: 'x3' }),
  ];
  assert.deepEqual(computeReadySingleEliminationMatches(matches, []), [
    { round_number: 2, team_a_id: 'x1', team_b_id: 'x3', codeNumber: 3 },
    { round_number: 3, team_a_id: 'x2', team_b_id: 'x4', playoff_stage: 'third_place', codeNumber: 4 },
  ]);
});

test('a pairing that already has a match row is never recreated, scheduled or completed — including 3rd place', () => {
  const base = [
    m({ id: 'm1', match_code: 'A1', team_a_id: 'x1', team_b_id: 'x2', status: 'completed', winner_team_id: 'x1' }),
    m({ id: 'm2', match_code: 'A2', team_a_id: 'x3', team_b_id: 'x4', status: 'completed', winner_team_id: 'x3' }),
  ];
  // The Final exists (scheduled) but 3rd place doesn't yet — only 3rd place
  // should come back as ready.
  const finalOnly = [...base, m({ id: 'm3', match_code: 'A3', round_number: 2, team_a_id: 'x1', team_b_id: 'x3' })];
  assert.deepEqual(computeReadySingleEliminationMatches(finalOnly, []), [{ round_number: 3, team_a_id: 'x2', team_b_id: 'x4', playoff_stage: 'third_place', codeNumber: 4 }]);
  // Both the Final (completed) and 3rd place (scheduled) already exist —
  // nothing left to create.
  const both = [
    ...base,
    m({ id: 'm3', match_code: 'A3', round_number: 2, team_a_id: 'x1', team_b_id: 'x3', status: 'completed', winner_team_id: 'x1' }),
    m({ id: 'm4', match_code: 'A4', round_number: 3, team_a_id: 'x2', team_b_id: 'x4', playoff_stage: 'third_place' }),
  ];
  assert.deepEqual(computeReadySingleEliminationMatches(both, []), []);
});

test('a bye recipient is paired against a real match\'s winner, not against the other real match — interleaving, not clustering', () => {
  const teams = [1, 2, 3, 4, 5].map((n) => teamRow(`x${n}`, { seed: n }));
  const round1 = [
    m({ id: 'm1', match_code: 'A1', team_a_id: 'x1', team_b_id: 'x2' }),
    m({ id: 'm2', match_code: 'A2', team_a_id: 'x3', team_b_id: 'x4' }),
  ];
  // Round 1 interleaves as [m1(real), x5(bye), m2(real)] — x5 shares a
  // Round 2 pairing with m1's winner, not m2's. Nothing is ready yet since
  // m1 hasn't been played.
  assert.deepEqual(computeReadySingleEliminationMatches(round1, teams), []);

  // m1 finishes — x1 vs x5 is immediately ready, even though m2 (the OTHER
  // real match) hasn't been played at all.
  const m1Done = [{ ...round1[0], status: 'completed', winner_team_id: 'x1' }, round1[1]];
  assert.deepEqual(computeReadySingleEliminationMatches(m1Done, teams), [{ round_number: 2, team_a_id: 'x1', team_b_id: 'x5', codeNumber: 3 }]);

  // Round 2 (x1 vs x5) and m2 both finish — m2's winner had no Round 2
  // partner (round1Count=3 is odd), so it carries straight through to meet
  // the Round 2 winner in the Final.
  const withRound2 = [
    { ...round1[0], status: 'completed', winner_team_id: 'x1' },
    { ...round1[1], status: 'completed', winner_team_id: 'x3' },
    m({ id: 'm3', match_code: 'A3', round_number: 2, team_a_id: 'x1', team_b_id: 'x5', status: 'completed', winner_team_id: 'x1' }),
  ];
  assert.deepEqual(computeReadySingleEliminationMatches(withRound2, teams), [{ round_number: 3, team_a_id: 'x1', team_b_id: 'x3', codeNumber: 4 }]);
});

test('a 10-match Round 1 (no bye) carries its odd Round 2 winner through two silent rounds into the Final, never into an earlier pairing', () => {
  // Round 1: 10 completed matches, "team_a always wins" by convention —
  // winners are a1..a10.
  const round1 = Array.from({ length: 10 }, (_, i) => {
    const n = i + 1;
    return m({ id: `r1-${n}`, match_code: `A${n}`, team_a_id: `a${n}`, team_b_id: `b${n}`, status: 'completed', winner_team_id: `a${n}` });
  });
  const round2Ready = computeReadySingleEliminationMatches(round1, []);
  assert.deepEqual(
    round2Ready.map((r) => [r.team_a_id, r.team_b_id]),
    [
      ['a1', 'a2'],
      ['a3', 'a4'],
      ['a5', 'a6'],
      ['a7', 'a8'],
      ['a9', 'a10'],
    ]
  );
  assert.ok(round2Ready.every((r) => r.round_number === 2));

  // Round 2: 5 completed matches (team_a always wins again) — winners a1,a3,a5,a7,a9.
  const round2 = round2Ready.map((r, i) => m({ id: `r2-${i}`, match_code: `A${11 + i}`, round_number: 2, team_a_id: r.team_a_id, team_b_id: r.team_b_id, status: 'completed', winner_team_id: r.team_a_id }));
  const afterRound2 = [...round1, ...round2];
  const round3Ready = computeReadySingleEliminationMatches(afterRound2, []);
  // 5 is odd: a1&a3 and a5&a7 pair for Round 3; a9 carries silently — it
  // must not appear in any Round 3 pairing yet.
  assert.deepEqual(
    round3Ready.map((r) => [r.round_number, r.team_a_id, r.team_b_id]),
    [
      [3, 'a1', 'a3'],
      [3, 'a5', 'a7'],
    ]
  );
  assert.ok(!round3Ready.some((r) => r.team_a_id === 'a9' || r.team_b_id === 'a9'));

  // Round 3: both complete, a1 and a5 win.
  const round3 = [
    m({ id: 'r3-0', match_code: 'A16', round_number: 3, team_a_id: 'a1', team_b_id: 'a3', status: 'completed', winner_team_id: 'a1' }),
    m({ id: 'r3-1', match_code: 'A17', round_number: 3, team_a_id: 'a5', team_b_id: 'a7', status: 'completed', winner_team_id: 'a5' }),
  ];
  const afterRound3 = [...afterRound2, ...round3];
  const round4Ready = computeReadySingleEliminationMatches(afterRound3, []);
  // a9's carried bye still isn't paired yet — Round 4 only pairs a1 vs a5.
  assert.deepEqual(round4Ready, [{ round_number: 4, team_a_id: 'a1', team_b_id: 'a5', codeNumber: 18 }]);

  // Round 4 completes, a1 wins.
  const round4 = [m({ id: 'r4-0', match_code: 'A18', round_number: 4, team_a_id: 'a1', team_b_id: 'a5', status: 'completed', winner_team_id: 'a1' })];
  const afterRound4 = [...afterRound3, ...round4];
  const finalReady = computeReadySingleEliminationMatches(afterRound4, []);
  // The Final: a1 (the whole bracket's survivor) finally meets a9, the
  // Round 2 winner that silently skipped Rounds 3 and 4.
  assert.deepEqual(finalReady, [{ round_number: 5, team_a_id: 'a1', team_b_id: 'a9', codeNumber: 19 }]);
});

test('a losing team never appears in a winner-advancement pairing — only in the dedicated 3rd-place one', () => {
  const matches = [
    m({ id: 'm1', match_code: 'A1', team_a_id: 'x1', team_b_id: 'x2', status: 'completed', winner_team_id: 'x1' }),
    m({ id: 'm2', match_code: 'A2', team_a_id: 'x3', team_b_id: 'x4', status: 'completed', winner_team_id: 'x3' }),
  ];
  const losers = new Set(matches.filter((mm) => mm.status === 'completed').map((mm) => (mm.winner_team_id === mm.team_a_id ? mm.team_b_id : mm.team_a_id)));
  const ready = computeReadySingleEliminationMatches(matches, []);
  const advancement = ready.filter((r) => r.playoff_stage !== 'third_place');
  for (const r of advancement) {
    assert.ok(!losers.has(r.team_a_id));
    assert.ok(!losers.has(r.team_b_id));
  }
  const thirdPlace = ready.find((r) => r.playoff_stage === 'third_place');
  assert.ok(thirdPlace);
  assert.ok(losers.has(thirdPlace.team_a_id));
  assert.ok(losers.has(thirdPlace.team_b_id));
});

test('Round 1 not generated yet produces nothing to create', () => {
  assert.deepEqual(computeReadySingleEliminationMatches([], []), []);
});

test('a cleanly-seeded 20-team bracket (4 real Round 1 matches, 12 byes) always has exactly 2 real semifinal matches, and 3rd place triggers normally', () => {
  // Mirrors what planSingleEliminationRound1 now produces for 20 teams:
  // 4 real Round 1 matches (A1-A4) plus 12 byes (teams x9..x20).
  const teams = Array.from({ length: 20 }, (_, i) => teamRow(`x${i + 1}`, { seed: i + 1 }));
  const round1 = [
    m({ id: 'r1-1', match_code: 'A1', team_a_id: 'x1', team_b_id: 'x2', status: 'completed', winner_team_id: 'x1' }),
    m({ id: 'r1-2', match_code: 'A2', team_a_id: 'x3', team_b_id: 'x4', status: 'completed', winner_team_id: 'x3' }),
    m({ id: 'r1-3', match_code: 'A3', team_a_id: 'x5', team_b_id: 'x6', status: 'completed', winner_team_id: 'x5' }),
    m({ id: 'r1-4', match_code: 'A4', team_a_id: 'x7', team_b_id: 'x8', status: 'completed', winner_team_id: 'x7' }),
  ];
  // Round 1 outcomes, in order: x1, x3, x5, x7 (the 4 real winners), then
  // the 12 byes x9..x20 — 16 slots total, a clean power of two.
  const round2Ready = computeReadySingleEliminationMatches(round1, teams);
  assert.equal(round2Ready.length, 8);
  assert.ok(round2Ready.every((r) => r.round_number === 2));

  const round2 = round2Ready.map((r, i) => m({ id: `r2-${i}`, match_code: `A${5 + i}`, round_number: 2, team_a_id: r.team_a_id, team_b_id: r.team_b_id, status: 'completed', winner_team_id: r.team_a_id }));
  const round3Ready = computeReadySingleEliminationMatches([...round1, ...round2], teams);
  assert.equal(round3Ready.length, 4);
  assert.ok(round3Ready.every((r) => r.round_number === 3));

  const round3 = round3Ready.map((r, i) => m({ id: `r3-${i}`, match_code: `A${13 + i}`, round_number: 3, team_a_id: r.team_a_id, team_b_id: r.team_b_id, status: 'completed', winner_team_id: r.team_a_id }));
  const semifinalReady = computeReadySingleEliminationMatches([...round1, ...round2, ...round3], teams);
  // The semifinal: exactly 2 real matches, 4 named players, no placeholder
  // bye or carry involved — this is the whole point of rounding byes up to
  // a power of two.
  assert.equal(semifinalReady.length, 2);
  assert.ok(semifinalReady.every((r) => r.round_number === 4));

  const semifinal = semifinalReady.map((r, i) => m({ id: `sf-${i}`, match_code: `A${17 + i}`, round_number: 4, team_a_id: r.team_a_id, team_b_id: r.team_b_id, status: 'completed', winner_team_id: r.team_a_id }));
  const finalStepReady = computeReadySingleEliminationMatches([...round1, ...round2, ...round3, ...semifinal], teams);
  // Both the Final (winners) and the 3rd-place match (losers) appear
  // together, since both semifinal matches were real.
  assert.equal(finalStepReady.length, 2);
  const final = finalStepReady.find((r) => r.playoff_stage !== 'third_place');
  const thirdPlace = finalStepReady.find((r) => r.playoff_stage === 'third_place');
  assert.equal(final.round_number, 5);
  assert.equal(thirdPlace.round_number, 6);
  assert.deepEqual([final.team_a_id, final.team_b_id].sort(), [semifinal[0].team_a_id, semifinal[1].team_a_id].sort());
  assert.deepEqual([thirdPlace.team_a_id, thirdPlace.team_b_id].sort(), [semifinal[0].team_b_id, semifinal[1].team_b_id].sort());
});

test('a bracket too small to ever have a real semifinal never gets a 3rd-place match', () => {
  // 3 teams: 1 real Round 1 match + 1 bye → Round 2 (2 slots) is already
  // the Final, not a semifinal, and one of its two "semifinalists" never
  // played (the bye) — no loser to send to 3rd place.
  const teams = [1, 2, 3].map((n) => teamRow(`x${n}`, { seed: n }));
  const round1 = [m({ id: 'm1', match_code: 'A1', team_a_id: 'x1', team_b_id: 'x2', status: 'completed', winner_team_id: 'x1' })];
  const ready = computeReadySingleEliminationMatches(round1, teams);
  assert.deepEqual(ready, [{ round_number: 2, team_a_id: 'x1', team_b_id: 'x3', codeNumber: 2 }]);
});

test('codeNumber reflects bracket POSITION, not discovery order — a bye-vs-bye pairing that resolves before its neighbor still gets the later number', () => {
  // 5 teams, 1 real Round 1 match: byes outnumber real games (3 byes vs 1
  // real match), so Round 1 interleaves as [m1(real), x3(bye), x4(bye),
  // x5(bye)] — the lone real match takes position 0, and the two leftover
  // byes that trail after it pair with EACH OTHER at position 1. That bye
  // pairing (x4 vs x5) is decided the instant the bracket is drawn — before
  // m1 has even been played — but it's positionally the SECOND Round 2 box,
  // so it must get the HIGHER match code even though it becomes "ready"
  // first. Getting this backwards is exactly what made the bracket tree's
  // connector lines point at the wrong box.
  const teams = [1, 2, 3, 4, 5].map((n) => teamRow(`x${n}`, { seed: n }));
  const round1 = [m({ id: 'm1', match_code: 'A1', team_a_id: 'x1', team_b_id: 'x2' })];
  const byeVsByeReady = computeReadySingleEliminationMatches(round1, teams);
  assert.deepEqual(byeVsByeReady, [{ round_number: 2, team_a_id: 'x4', team_b_id: 'x5', codeNumber: 3 }]);

  // Now m1 finishes too, with the bye-vs-bye pairing already inserted (as
  // byeVsByeReady produced) — its Round 2 pairing must get the LOWER
  // number (position 0), even though it's created second.
  const afterByePairInserted = [
    { ...round1[0], status: 'completed', winner_team_id: 'x1' },
    m({ id: 'm3', match_code: 'A3', round_number: 2, team_a_id: 'x4', team_b_id: 'x5' }),
  ];
  const realMatchReady = computeReadySingleEliminationMatches(afterByePairInserted, teams);
  assert.deepEqual(realMatchReady, [{ round_number: 2, team_a_id: 'x1', team_b_id: 'x3', codeNumber: 2 }]);
});
