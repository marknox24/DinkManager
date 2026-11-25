import test from 'node:test';
import assert from 'node:assert/strict';
import { canJoinDrawnBracket, eligibleBrackets, pickRandomBracket, planTransferFixtures, transferBlockers } from './transfer.js';

const t = (id, bracket_id = 'A', extra = {}) => ({ id, bracket_id, ...extra });
const opp = (ids) => ids.map((id) => t(id));

test('only Round Robin formats can take a team into a drawn bracket', () => {
  assert.equal(canJoinDrawnBracket('Round Robin'), true);
  assert.equal(canJoinDrawnBracket('Double Round Robin'), true);
  assert.equal(canJoinDrawnBracket('Single Elimination'), false);
  assert.equal(canJoinDrawnBracket('RR:Custom Match 1'), false);
  assert.equal(canJoinDrawnBracket(null), false);
});

test('eligibleBrackets counts active teams, skips playoffs and flags full brackets', () => {
  const brackets = [
    { id: 'B', letter: 'B', kind: 'pool' },
    { id: 'PO', letter: 'PO', kind: 'playoff' },
    { id: 'A', letter: 'A', kind: 'pool' },
  ];
  const teams = [t('1', 'A'), t('2', 'A'), t('3', 'A', { withdrawn_at: '2026-11-20' }), t('4', 'B')];
  const result = eligibleBrackets(brackets, teams, 2);
  assert.deepEqual(
    result.map((b) => [b.letter, b.count, b.full]),
    [
      ['A', 2, true],
      ['B', 1, false],
    ]
  );
  assert.equal(eligibleBrackets(brackets, teams, null)[0].full, false);
});

test('random assignment picks among the smallest brackets with room', () => {
  const eligible = [
    { letter: 'A', count: 3, full: false },
    { letter: 'B', count: 2, full: false },
    { letter: 'C', count: 2, full: false },
    { letter: 'D', count: 1, full: true },
  ];
  assert.equal(pickRandomBracket(eligible, () => 0).letter, 'B');
  assert.equal(pickRandomBracket(eligible, () => 0.99).letter, 'C');
  assert.equal(pickRandomBracket([{ letter: 'A', count: 4, full: true }]), null);
});

test('round robin: one match against every opponent, sides alternating', () => {
  const plan = planTransferFixtures({ opponents: opp(['e', 'f', 'g', 'h']) });
  assert.deepEqual(
    plan.map((f) => [f.opponent.id, f.side]),
    [
      ['e', 'a'],
      ['f', 'b'],
      ['g', 'a'],
      ['h', 'b'],
    ]
  );
});

test('double round robin: every opponent twice, the second with sides swapped', () => {
  const plan = planTransferFixtures({ opponents: opp(['e', 'f']), isDouble: true });
  assert.deepEqual(
    plan.map((f) => [f.opponent.id, f.side]),
    [
      ['e', 'a'],
      ['f', 'a'],
      ['e', 'b'],
      ['f', 'b'],
    ]
  );
});

test('games-per-team target: plays the opponents with the fewest games first', () => {
  const plan = planTransferFixtures({
    opponents: opp(['e', 'f', 'g', 'h', 'i']),
    gamesTarget: 2,
    matchCounts: { e: 3, f: 2, g: 2, h: 1, i: 3 },
  });
  assert.deepEqual(
    plan.map((f) => f.opponent.id),
    ['f', 'h']
  );
});

test('a target at or above a full round robin plays everyone', () => {
  assert.equal(planTransferFixtures({ opponents: opp(['e', 'f', 'g']), gamesTarget: 3 }).length, 3);
  assert.equal(planTransferFixtures({ opponents: opp(['e', 'f', 'g']), gamesTarget: 0 }).length, 3);
});

test('an empty bracket gives no matches', () => {
  assert.deepEqual(planTransferFixtures({ opponents: [] }), []);
});

test('transferBlockers mirrors the server checks', () => {
  const beginner = { id: 'c1', name: 'Men’s Beginner', match_type: 'Singles', format: 'Round Robin' };
  const intermediate = { id: 'c2', name: 'Men’s Intermediate', match_type: 'Singles', format: 'Round Robin' };
  assert.deepEqual(transferBlockers({ registration: { status: 'approved' }, sourceCategory: beginner, destCategory: intermediate, destHasPools: true, bracket: { letter: 'B', full: false } }), []);

  assert.equal(transferBlockers({ registration: { status: 'pending' } }).length, 1);
  assert.match(transferBlockers({ sourceLive: true })[0], /On court/);
  assert.match(transferBlockers({ sourceInPlayoffs: true })[0], /playoffs/);
  assert.match(transferBlockers({ sourceTeam: { withdrawn_at: 'x' } })[0], /withdrawn/);
  assert.match(transferBlockers({ sourceCategory: beginner, destCategory: { ...intermediate, match_type: 'Doubles' } })[0], /singles entry/);
  assert.match(transferBlockers({ destCategory: { ...intermediate, format: 'Single Elimination' }, destHasPools: true })[0], /Round Robin only/);
  assert.match(transferBlockers({ destCategory: intermediate, destHasPools: true, destHasPlayoffs: true })[0], /Playoffs/);
  assert.match(transferBlockers({ destCategory: intermediate, destHasPools: true, bracket: { letter: 'B', full: true } })[0], /full/);
  // Not drawn yet: format and playoffs don't matter, the player joins the draw.
  assert.deepEqual(transferBlockers({ destCategory: { ...intermediate, format: 'Single Elimination' }, destHasPools: false }), []);
});
