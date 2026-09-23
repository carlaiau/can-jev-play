import type { ActionResult } from './history-action.ts';

type Row = { ev: number; score: number; action: string };
export function evaluatePolicy(rows: Row[], bet: (row: Row) => boolean) {
  const chosen = rows.filter(bet);
  const expectedNet = chosen.reduce((sum, row) => sum + row.ev, 0);
  const oracleNet = rows.reduce((sum, row) => sum + Math.max(0, row.ev), 0);
  return { calls: rows.length, bets: chosen.length, skips: rows.length - chosen.length,
    negativeBets: chosen.filter(row => row.ev < 0).length,
    positiveSkips: rows.filter(row => row.ev > 0 && !bet(row)).length,
    expectedNet, meanExpectedNet: expectedNet / rows.length,
    regretPerOffer: (oracleNet - expectedNet) / rows.length };
}
export function fitThreshold(rows: Row[]) {
  if (!rows.length || rows.some(row => !Number.isFinite(row.score) || row.score < 0 || row.score > 2)) throw new Error('Invalid calibration scores');
  // 0 bets on every valid Score; 3 skips every valid Score. Other cutoffs
  // include each distinct calibration score without consulting held-out data.
  const candidates = [...new Set([0, ...rows.map(row => row.score), 3])].sort((a, b) => a - b);
  return candidates.map(cutoff => ({ cutoff, ...evaluatePolicy(rows, row => row.score >= cutoff) }))
    .sort((a, b) => b.expectedNet - a.expectedNet || b.cutoff - a.cutoff)[0];
}
export function analyzeThresholds(results: ActionResult[]) {
  return ['table-only', 'supplied-ev'].map(format => {
    const convert = (row: ActionResult): Row => ({ ev: row.ev, action: row.action,
      score: Number((row.response.answers as Record<string, { score: number }>).advantage.score) });
    const train = results.filter(row => row.format === format && row.length === 30 && row.returns !== 'none').map(convert);
    const test = results.filter(row => row.format === format && row.length === 60 && row.returns !== 'none').map(convert);
    if (!train.length || !test.length) throw new Error('Both scenario splits are required');
    const calibration = fitThreshold(train);
    return { format, splitNote: 'Calibration: 30-roll histories. Held-out: 60-roll histories. No-history controls excluded because their inputs repeat across lengths.', rule: 'bet if Score >= cutoff; cutoff 3 means never bet', cutoff: calibration.cutoff, calibration,
      heldOut: evaluatePolicy(test, row => row.score >= calibration.cutoff),
      directAction: evaluatePolicy(test, row => row.action === 'bet'),
      alwaysBet: evaluatePolicy(test, () => true), neverBet: evaluatePolicy(test, () => false), oracle: evaluatePolicy(test, row => row.ev > 0),
      byEv: [-5, -3, -1, 1, 3, 5].map(ev => ({ ev, ...evaluatePolicy(test.filter(row => row.ev === ev), row => row.score >= calibration.cutoff) })) };
  });
}
