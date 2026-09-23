import {test} from 'node:test';
import assert from 'node:assert/strict';
import {choiceThresholdMetrics} from '../src/lib/binary-action.ts';
const row=(ev:number,choice:string,confidence:unknown)=>({ev,decisions:{table:{response:{model:'jev-1.13.0',answers:{action:{type:'choice',choice,confidence}}}}}});
test('confidence gates only Bet, skips exact ties, and keeps all offers in metrics',()=>{
 const rows=[row(5,'bet',.2),row(-3,'bet',.3),row(-1,'skip',.99),row(1,'skip',.1)];
 const result=choiceThresholdMetrics(rows).find(r=>r.threshold===.2)!;
 assert.deepEqual(result,{threshold:.2,calls:4,bets:1,positive:2,negative:2,correctBet:0,correctSkip:1,correct:1,expectedProfit:-3});
 assert.equal(choiceThresholdMetrics(rows).at(-1)!.bets,0);
 for(const invalid of [undefined,null,'0.8',NaN,-.1,1.1])assert.throws(()=>choiceThresholdMetrics([row(1,'bet',invalid)]));
});
