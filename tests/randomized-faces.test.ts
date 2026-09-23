import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomizedFacePlan } from '../src/lib/randomized-faces.ts';

test('permutations preserve EV, win probability and match both disclosure inputs', () => {
 const trials = randomizedFacePlan();
 assert.equal(trials.length, 720);
 const winningSets = new Set<string>();
 for (const t of trials) {
  const rules = t.state.rules as { winningFaces: number[]; bet: string; payoutTable: string };
  assert.equal(t.gross.reduce((a,b)=>a+b,0)/6-100,t.ev);
  assert.equal(rules.winningFaces.length,3);
  assert.deepEqual(rules.winningFaces,t.gross.flatMap((v,i)=>v>100?[i+1]:[]));
  assert.equal(rules.bet,'face-specific');
  winningSets.add(rules.winningFaces.join(','));
  if(t.format==='supplied-ev') {
   const control=trials.find(r=>r.caseId===t.caseId&&r.repeat===t.repeat&&r.format==='table-only')!;
   const {calculatedExpectedNetProfit,...rest}=t.state;
   assert.deepEqual(rest,control.state);
   assert.deepEqual(t.gross,control.gross);
  }
 }
 assert.ok(winningSets.size>=15);
});
