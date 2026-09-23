import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actionVerdict } from '../src/lib/action-verdict.ts';
test('EV verdict depends only on offered EV and action, never realized outcome', () => {
 for(const ev of [1,3,5]){assert.equal(actionVerdict(ev,'bet').correct,true);assert.equal(actionVerdict(ev,'skip').correct,false);}
 for(const ev of [-1,-3,-5]){assert.equal(actionVerdict(ev,'skip').correct,true);assert.equal(actionVerdict(ev,'bet').correct,false);}
 assert.equal(actionVerdict(0,'bet').label,'EV-neutral action');
 assert.equal(actionVerdict(0,'skip').label,'EV-neutral action');
});
