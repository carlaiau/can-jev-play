import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomizedFacePlan} from '../src/lib/randomized-faces.ts';
import {structuredOfferState,payoutAmounts,type PayoutEntry} from '../src/lib/structured-offer.ts';
test('structured payouts preserve each randomized offer and exclude Markdown/history',()=>{
 for(const trial of randomizedFacePlan()){
  const state=structuredOfferState(trial.state);
  const rules=state.rules as {payouts:PayoutEntry[];payoutTable?:unknown;fair:boolean;uniform:boolean;sides:number};
  assert.equal(rules.payoutTable,undefined);
  assert.equal(rules.fair,true);assert.equal(rules.uniform,true);assert.equal(rules.sides,6);
  assert.doesNotMatch(JSON.stringify(state), /stake|bankroll/i);
  assert.equal(state.history,undefined);assert.equal(state.historicalSummary,undefined);
  assert.deepEqual(payoutAmounts(state),trial.gross);
  assert.deepEqual(rules.payouts.map(r=>r.face),[1,2,3,4,5,6]);
  assert.equal(rules.payouts.reduce((s,r)=>s+r.netProfit,0)/6,trial.ev);
  for(const row of rules.payouts){assert.equal('probability' in row,false);assert.equal('stake' in row,false);assert.equal(row.netProfit,row.grossPayout-100);}
  assert.deepEqual(structuredOfferState(state),state);
 }
});
