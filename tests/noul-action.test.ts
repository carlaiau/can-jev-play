import {test} from 'node:test';
import assert from 'node:assert/strict';
import {noulQuestions,parseNoulAction} from '../src/lib/noul-action.ts';
const response=(noul:unknown)=>({model:'jev-1.13.0',answers:{action:{type:'noul',noul}}});
test('Noul maps a positive-EV belief to Bet with a predeclared tie rule',()=>{
  assert.equal(noulQuestions.action.type,'noul');
  for(const p of [0,.49,.5])assert.equal(parseNoulAction(response(p)).action,'skip');
  for(const p of [.51,1])assert.equal(parseNoulAction(response(p)).action,'bet');
});
test('Noul rejects malformed probabilities instead of manufacturing a decision',()=>{
  for(const p of [undefined,null,'0.9',NaN,Infinity,-.01,1.01])assert.throws(()=>parseNoulAction(response(p)));
  assert.throws(()=>parseNoulAction({model:'jev-1.13.0',answers:{action:{type:'choice',noul:.9}}}));
});

test('threshold sweep skips exact ties, retains all denominators, and uses EV rather than outcomes',async()=>{
  const {noulThresholdMetrics}=await import('../src/lib/noul-action.ts');
  const rows=[{ev:5,p:.7},{ev:-3,p:.8},{ev:1,p:.9},{ev:-1,p:.5}].map(({ev,p})=>({ev,decisions:{table:{response:response(p)}}}));
  const result=noulThresholdMetrics(rows);
  assert.equal(result[2].threshold,.7);
  assert.deepEqual(result[2],{threshold:.7,calls:4,bets:2,positive:2,negative:2,correctBet:1,correctSkip:1,correct:2,expectedProfit:-2});
  assert.equal(result[3].expectedProfit,1);
  assert.equal(result[4].bets,0);
  assert.equal(result[4].correct,2);
});
