import { test } from 'node:test';
import assert from 'node:assert/strict';
import { payoutFormatPlan, suppliedEvPlan, explicitPayoutState, summarizeFormats } from '../src/lib/payout-format.ts';
import { pilotCases } from '../src/lib/pilot.ts';
test('payout table gives exact gross and net payouts without aggregate EV', () => {
  for (const { scenario } of pilotCases()) {
    const state = explicitPayoutState(scenario.state);
    assert.deepEqual(state.history, scenario.state.history);
    assert.equal(state.stake, scenario.state.stake);
    for (let i = 0; i < 6; i++) {
      const gross = scenario.state.rules.grossReturnByFace[i];
      assert.ok(state.rules.payoutTable.includes(`| ${i + 1} | 1/6 | 100 | ${gross} | ${gross - 100} |`));
    }
    assert.ok(!('expectedNet' in state));
  }
});
test('supplied-EV treatment adds only the correct calculation to each matched control', () => {
  const trials = suppliedEvPlan();
  assert.equal(trials.length, 216);
  for (const trial of trials.filter(row => row.format === 'supplied-ev')) {
    const control = trials.find(row => row.caseId === trial.caseId && row.repeat === trial.repeat && row.format === 'table-only')!;
    const { calculatedExpectedNetProfit, ...rest } = trial.state as typeof trial.state & { calculatedExpectedNetProfit: { value: number } };
    assert.equal(calculatedExpectedNetProfit.value, trial.truth.expectedNet);
    assert.deepEqual(rest, control.state);
    assert.equal('evClass' in trial.state, false);
  }
  const rows = trials.map(({ state, ...trial }) => ({ ...trial, p: 0.5, choice: trial.truth.evClass, score: trial.truth.advantage, response: {}, elapsedMs: 0 }));
  assert.ok(summarizeFormats(rows, ['table-only', 'supplied-ev']).arms.every(arm => arm.correct === 108));
});
test('format experiment has balanced classes and identical repeated inputs', () => {
  const trials = payoutFormatPlan();
  assert.equal(trials.length, 216);
  for (const format of ['original', 'explicit-table']) {
    for (const label of ['negative', 'zero', 'positive']) assert.equal(trials.filter(row => row.format === format && row.truth.evClass === label).length, 36);
  }
  const groups = new Map<string, string[]>();
  for (const trial of trials) {
    const key = `${trial.caseId}-${trial.format}`;
    groups.set(key, [...groups.get(key) ?? [], JSON.stringify(trial.state)]);
  }
  for (const values of groups.values()) { assert.equal(values.length, 3); assert.equal(new Set(values).size, 1); }
  const rows = trials.map(({ state, ...trial }) => ({ ...trial, p: 0.5, choice: trial.truth.evClass, score: trial.truth.advantage, response: {}, elapsedMs: 0 }));
  const summary = summarizeFormats(rows);
  assert.equal(summary.meanGroupAccuracyImprovement, 0);
  assert.ok(summary.arms.every(arm => arm.correct === 108 && arm.repeatedCasesChangingCategory === 0));
});
