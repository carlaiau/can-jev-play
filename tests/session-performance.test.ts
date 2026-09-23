import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sessionPerformance } from '../src/lib/session-performance.ts';
import type { LabRound } from '../src/lib/lab-types.ts';

test('session EV weights by dollars actually staked and excludes skips/unsettled offers', () => {
 const ledger = [
  { face: 1, stake: 100, ev: 5, judgments: { table: { action: 'bet' }, calculated: { action: 'skip' } }, returns: { table: -100, calculated: 0 } },
  { face: 6, stake: 300, ev: -3, judgments: { table: { action: 'bet' }, calculated: { action: 'skip' } }, returns: { table: 280, calculated: 0 } },
  { face: 2, stake: 100, ev: 50, judgments: { table: { action: 'skip' }, calculated: { action: 'skip' } }, returns: { table: 0, calculated: 0 } },
  { stake: 100, ev: 99, judgments: { table: { action: 'bet' } } },
 ] as unknown as LabRound[];
 assert.deepEqual(sessionPerformance(ledger, 'table'), { staked: 400, expectedNet: 2, actualNet: 180, expectedReturnPercent: 0.5 });
 assert.deepEqual(sessionPerformance(ledger, 'calculated'), { staked: 0, expectedNet: 0, actualNet: 0, expectedReturnPercent: null });
});
