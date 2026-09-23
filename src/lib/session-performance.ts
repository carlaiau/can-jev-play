import type { LabRound } from './lab-types.ts';

export function sessionPerformance(ledger: LabRound[], arm: 'table' | 'calculated') {
  let staked = 0, expectedNet = 0, actualNet = 0;
  for (const row of ledger) {
    if (row.face === undefined) continue;
    if (row.judgments[arm]?.action === 'bet') {
      staked += row.stake;
      expectedNet += row.ev;
    }
    actualNet += row.returns?.[arm] ?? 0;
  }
  return { staked, expectedNet, actualNet, expectedReturnPercent: staked ? 100 * expectedNet / staked : null };
}
