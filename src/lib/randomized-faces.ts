import { seededRandom } from './dice.ts';
import { shuffle } from './pilot.ts';
import { historyActionPlan } from './history-action.ts';

export function randomizedFacePlan() {
  const trials = [...historyActionPlan(false, 20261011), ...historyActionPlan(true, 20261011)].map(trial => {
    // Matching signs and disclosure arms share a permutation. The three
    // repetitions now vary face placement; they are not identical replays.
    const key = `${trial.caseId.replace('negative-', '')}-${trial.repeat}`;
    const seed = [...key].reduce((n, char) => (Math.imul(n, 31) + char.charCodeAt(0)) >>> 0, 20261012);
    const gross = shuffle([0, 0, 0, 190, 200, 210 + 6 * trial.ev], seededRandom(seed));
    const state = structuredClone(trial.state) as Record<string, unknown>;
    const rules = state.rules as Record<string, unknown>;
    rules.bet = 'face-specific';
    rules.winningFaces = gross.flatMap((value, i) => value > 100 ? [i + 1] : []);
    rules.payoutTable = ['| Die face | Probability | Stake deducted | Gross payout including stake return | Net profit |',
      '|---|---|---|---|---|', ...gross.map((value, i) => `| ${i + 1} | 1/6 | 100 | ${value} | ${value - 100} |`)].join('\n');
    if (trial.format === 'supplied-ev') state.calculatedExpectedNetProfit = {
      value: trial.ev, units: 'bankroll units per next bet',
      calculation: `(${gross.map(value => value - 100).join(' + ')}) / 6 = ${trial.ev}`,
      note: 'This is net profit after deducting the stake once. Skipping has expected net profit zero.',
    };
    return { ...trial, id: `faces-${trial.id}`, caseId: `faces-${trial.caseId}`, gross, state };
  });
  return shuffle(trials, seededRandom(20261013));
}
