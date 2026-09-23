import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, expandedScenarios, logicalBaseline } from '../src/lib/scenarios.ts';
import type { SavedResult } from '../src/lib/scenarios.ts';
import { inputCost, contextProxy } from '../src/lib/usage.ts';
import { questions } from '../src/lib/typesafe.ts';

test('expanded windows retain matched bankroll, recent patterns and fair historical payouts', () => {
  const suite = expandedScenarios([12, 60, 240]);
  assert.equal(suite.length, 36);
  for (const scenario of suite) {
    assert.equal(scenario.state.bankroll, 100);
    assert.equal(scenario.state.history.filter(row => row.won).length, scenario.state.history.length / 2);
    assert.ok(contextProxy({ model: 'jev-latest', state: scenario.state, questions }) < 32000);
  }
  assert.throws(() => expandedScenarios([13]));
});
test('checkpoint resumes missing calls without repeating saved predictions', async () => {
  const suite = expandedScenarios([12]);
  const saved: SavedResult[] = [];
  let calls = 0;
  const model = { name: 'test', predict: async (state: typeof suite[number]['state']) => {
    if (++calls === 4) throw new Error('interrupted');
    return logicalBaseline.predict(state);
  } };
  await assert.rejects(evaluate(model, 2, async row => { saved.push(row as SavedResult); }, { suite }));
  assert.equal(saved.length, 3);
  let resumedCalls = 0;
  const resumed = await evaluate({ name: 'test', predict: async state => { resumedCalls++; return logicalBaseline.predict(state); } }, 2, undefined, { suite, resume: saved });
  assert.equal(resumedCalls, 21);
  assert.equal(resumed.results.length, 24);
  assert.equal(resumed.probabilitySpread, 0);
});
test('user-provided input pricing is calculated per billion tokens', () => {
  assert.equal(inputCost(1e9), 42);
  assert.equal(inputCost(32000), 0.001344);
  assert.throws(() => inputCost(-1));
});
