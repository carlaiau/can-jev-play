import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pilotCases, summarizePilot } from '../src/lib/pilot.ts';
import { oracle } from '../src/lib/scenarios.ts';
test('pilot has 100 reproducible distinct inputs with 25 matched groups', () => {
  const cases = pilotCases();
  assert.deepEqual(cases, pilotCases());
  assert.equal(new Set(cases.map(item => JSON.stringify(item.scenario.state))).size, 100);
  for (let group = 1; group <= 25; group++) {
    const members = cases.filter(item => item.group === group);
    assert.equal(members.length, 4);
    const reference = members[0].scenario.state;
    for (const { pattern, scenario: { state } } of members) {
      assert.equal(state.bankroll, 10000);
      assert.deepEqual(state.rules, reference.rules);
      assert.deepEqual(state.history.map(row => row.face).sort(), reference.history.map(row => row.face).sort());
      assert.equal(oracle(state).expectedNet, oracle(reference).expectedNet);
      if (pattern === 'winning-streak') assert.ok(state.history.slice(-6).every(row => row.won));
      if (pattern === 'losing-streak') assert.ok(state.history.slice(-6).every(row => !row.won));
    }
  }
});
test('pilot summary recognizes perfect logical answers', () => {
  const rows = pilotCases().map(({ group, pattern, scenario }) => {
    const truth = oracle(scenario.state);
    return { id: scenario.id, group, pattern, truth, resolvedModel: 'fixture', elapsedMs: 0,
      prediction: { winProbability: 0.5, expectedNet: truth.expectedNet, primitives: { answers: { ev_class: { choice: truth.evClass }, advantage: { score: truth.advantage } } } } };
  });
  const summary = summarizePilot(rows);
  assert.equal(summary.evCorrect, 100);
  assert.equal(summary.groupsWithEvChoiceChanges, 0);
  assert.equal(summary.maxWithinGroupProbabilitySpread, 0);
  rows[0].prediction.winProbability = 0.55;
  assert.equal(summarizePilot(rows).groupsAboveFivePercentagePointSpread, 0);
  rows[0].prediction.winProbability = 0.56;
  assert.equal(summarizePilot(rows).groupsAboveFivePercentagePointSpread, 1);
});
