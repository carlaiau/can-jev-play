import { test } from 'node:test';
import assert from 'node:assert/strict';
import { historyActionPlan } from '../src/lib/history-action.ts';
test('action experiment fixes future opportunity while varying historical returns and order', () => {
  const trials = historyActionPlan();
  assert.equal(trials.length, 360);
  for (const trial of trials) {
    const state = trial.state as any;
    assert.equal(state.bankroll, 10000);
    assert.equal(state.stake, 100);
    assert.ok(trial.ev > 0);
    const baseline = trials.find(row => row.block === trial.block && row.format === trial.format && row.returns === 'none')!;
    assert.deepEqual(state.rules, (baseline.state as any).rules);
    if (trial.returns !== 'none') {
      assert.equal(state.history.at(-1).bankroll, 10000);
      const net = state.history.reduce((sum: number, row: { net: number }) => sum + row.net, 0);
      assert.equal(net, state.historicalSummary.totalNetProfit);
      assert.equal(Math.sign(net), trial.returns === 'gain' ? 1 : trial.returns === 'loss' ? -1 : 0);
      if (trial.ending === 'win-streak') assert.ok(state.history.slice(-6).every((row: { won: boolean }) => row.won));
      if (trial.ending === 'loss-streak') assert.ok(state.history.slice(-6).every((row: { won: boolean }) => !row.won));
    }
    if (trial.format === 'supplied-ev') {
      assert.equal(state.calculatedExpectedNetProfit.value, trial.ev);
      const { calculatedExpectedNetProfit, ...rest } = state;
      const control = trials.find(row => row.caseId === trial.caseId && row.format === 'table-only' && row.repeat === trial.repeat)!;
      assert.deepEqual(rest, control.state);
    }
  }
});

test('negative action controls preserve histories and supply exact negative EV', () => {
  const positive = historyActionPlan();
  const negative = historyActionPlan(true);
  assert.equal(negative.length, 360);
  for (const trial of negative) {
    const original = positive.find(row => row.id === trial.id.replace('negative-', ''))!;
    const state = trial.state as any;
    assert.deepEqual(state.history, (original.state as any).history);
    assert.equal(trial.ev, -original.ev);
    const gross = state.rules.payoutTable.split('\n').slice(2).map((line: string) => Number(line.split('|')[4].trim()));
    assert.equal(gross.reduce((a: number, b: number) => a + b, 0) / 6 - 100, trial.ev);
    assert.ok(gross.slice(3).every((p: number) => p > 100));
    if (trial.format === 'supplied-ev') assert.equal(state.calculatedExpectedNetProfit.value, trial.ev);
  }
});

test('mixed study has fresh matched histories and disjoint threshold inputs', () => {
  const trials = [...historyActionPlan(false, 20261007), ...historyActionPlan(true, 20261007)];
  assert.equal(trials.length, 720);
  assert.equal(new Set(trials.map(t => t.id)).size, 720);
  const train = trials.filter(t => t.length === 30 && t.returns !== 'none');
  const heldOut = trials.filter(t => t.length === 60 && t.returns !== 'none');
  const trainInputs = new Set(train.map(t => JSON.stringify(t.state)));
  assert.ok(heldOut.every(t => !trainInputs.has(JSON.stringify(t.state))));
  assert.equal(train.length, 324);
  assert.equal(heldOut.length, 324);
  for (const ev of [-5, -3, -1, 1, 3, 5]) assert.equal(heldOut.filter(t => t.ev === ev).length, 54);
});
