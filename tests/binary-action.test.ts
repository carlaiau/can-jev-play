import { test } from 'node:test';
import assert from 'node:assert/strict';
import { binaryQuestions, parseBinaryAction, summarizeBinary } from '../src/lib/binary-action.ts';
test('current experiment asks exactly one binary action question', () => {
 assert.deepEqual(Object.keys(binaryQuestions),['action']);
 assert.doesNotMatch(JSON.stringify(binaryQuestions),/stake|bankroll/i);
 assert.equal(binaryQuestions.action.type,'choice');
 assert.deepEqual(Object.keys(binaryQuestions.action.criteria),['bet','skip']);
 assert.equal(parseBinaryAction({model:'jev-1.13.0',answers:{action:{type:'choice',choice:'skip'}}}).action,'skip');
 assert.throws(()=>parseBinaryAction({model:'jev-1.13.0',answers:{action:{type:'choice',choice:'positive'}}}));
});
test('binary summary assesses actions against offered EV without auxiliary predictions', () => {
 const s=summarizeBinary([{id:'1',format:'table-only',ev:-5,action:'skip'},{id:'2',format:'table-only',ev:3,action:'bet'}])[0];
 assert.equal(s.meanExpectedNet,1.5);
 assert.equal(s.byEv.find(r=>r.ev===-5)?.correct,1);
});
