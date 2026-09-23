import { test } from 'node:test';
import assert from 'node:assert/strict';
import { offerOnlyState } from '../src/lib/offer-only.ts';
import { randomizedFacePlan } from '../src/lib/randomized-faces.ts';
test('current-offer input excludes all history and preserves both payout treatments', () => {
 for (const trial of randomizedFacePlan()) {
  const s=offerOnlyState(trial.state);
  assert.deepEqual(Object.keys(s).sort(), ['bankroll','objective','rules','stake',...(trial.format==='supplied-ev'?['calculatedExpectedNetProfit']:[])].sort());
  assert.equal(s.history,undefined);assert.equal(s.historicalSummary,undefined);assert.equal(s.historyIsSynthetic,undefined);
  assert.equal((s.rules as any).payoutTable,(trial.state.rules as any).payoutTable);
  assert.equal(s.bankroll,10000);assert.equal(s.stake,100);
  assert.equal(JSON.stringify(s).toLowerCase().includes('histor'),false);
  assert.deepEqual(offerOnlyState({...trial.state,history:[{face:6}],historicalSummary:{totalNetProfit:999}}),s);
 }
});
