import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionDecisionRates} from '../src/lib/session-performance.ts';
import type {LabRound} from '../src/lib/lab-types.ts';
const row=(number:number,ev:number,action?:'bet'|'skip'):LabRound=>({number,ev,stake:100,gross:[],bankroll:10000,historyFaces:[],historicalNet:0,state:{},judgments:action?{table:{action,model:'test',inputTokens:0,raw:{}}}:{}});
test('live rates count current decisions without outcomes and do not double count settled rounds',()=>{
 const ledger=[row(1,1,'bet'),row(2,-1,'bet'),row(3,1,'skip'),row(4,-1,'skip')];
 assert.deepEqual(sessionDecisionRates(ledger,ledger[3]),{decisions:4,bets:2,positive:2,correctBet:1,negative:2,correctSkip:1,correct:2});
 assert.equal(sessionDecisionRates(ledger,row(5,1)).decisions,4);
 assert.equal(sessionDecisionRates(ledger,row(5,1,'bet')).correct,3);
 assert.equal(sessionDecisionRates([]).decisions,0);
});
