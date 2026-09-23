import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitThreshold, evaluatePolicy, analyzeThresholds } from '../src/lib/score-threshold.ts';
import type { ActionResult } from '../src/lib/history-action.ts';

test('Score cutoff maximizes expected profit, not classification count', () => {
  const rows = [{ score: 1, ev: 1, action: 'bet' }, { score: 1, ev: 1, action: 'bet' }, { score: 1, ev: -5, action: 'bet' }, { score: 2, ev: 3, action: 'bet' }];
  assert.equal(fitThreshold(rows).cutoff, 2);
  assert.equal(fitThreshold(rows).expectedNet, 3);
  const policy = evaluatePolicy(rows, r => r.score >= 2);
  assert.equal(policy.positiveSkips, 2);
  assert.equal(policy.negativeBets, 0);
  assert.equal(policy.regretPerOffer, 0.5);
});
test('Held-out labels cannot change selected cutoff; tied scores stay together', () => {
  const rows = ['table-only', 'supplied-ev'].flatMap(format => [
    { length: 30, ev: -1, score: 0 }, { length: 30, ev: 1, score: 2 },
    { length: 60, ev: -1, score: 2 }, { length: 60, ev: 1, score: 0 },
  ].map(row => ({ ...row, format, action: 'bet', response: { answers: { advantage: { score: row.score } } } }))) as unknown as ActionResult[];
  const result = analyzeThresholds(rows);
  assert.equal(result[0].cutoff, 2);
  assert.equal(result[0].heldOut.expectedNet, -1);
  for (const row of rows) if (row.length === 60) row.ev *= -1;
  assert.equal(analyzeThresholds(rows)[0].cutoff, 2);
  assert.equal(fitThreshold([{ score: 1, ev: -1, action: 'bet' }, { score: 1, ev: 1, action: 'skip' }]).cutoff, 3);
});
