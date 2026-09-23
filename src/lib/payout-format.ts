import { pilotCases, shuffle } from './pilot.ts';
import { seededRandom } from './dice.ts';
import { oracle } from './scenarios.ts';
import type { Scenario } from './scenarios.ts';

export function explicitPayoutState(original: Scenario['state']) {
  const { grossReturnByFace, payoutNote, ...rules } = original.rules;
  return {
    ...structuredClone(original),
    rules: {
      ...rules,
      payoutNote: 'This table applies to the next bet only. Amounts are bankroll units. Deduct the stake exactly once: net profit = gross payout minus stake. Gross payout includes any stake returned. Historical bets used their recorded payouts.',
      payoutTable: [
        '| Die face | Probability | Stake deducted | Gross payout including stake return | Net profit |',
        '|---|---|---|---|---|',
        ...grossReturnByFace.map((gross, i) => `| ${i + 1} | 1/6 | ${original.stake} | ${gross} | ${gross - original.stake} |`),
      ].join('\n'),
    },
  };
}
export function payoutFormatPlan() {
  const cases = pilotCases(20260925).filter(item => item.group <= 9);
  const trials = cases.flatMap(item => (['original', 'explicit-table'] as const).flatMap(format =>
    Array.from({ length: 3 }, (_, repeat) => ({
      id: `${item.scenario.id}-${format}-${repeat}`, caseId: item.scenario.id, group: item.group,
      pattern: item.pattern, format, repeat, truth: oracle(item.scenario.state),
      state: format === 'original' ? item.scenario.state : explicitPayoutState(item.scenario.state),
    }))));
  return shuffle(trials, seededRandom(20260926));
}
export function suppliedEvPlan() {
  const cases = pilotCases(20260927).filter(item => item.group <= 9);
  const trials = cases.flatMap(item => (['table-only', 'supplied-ev'] as const).flatMap(format =>
    Array.from({ length: 3 }, (_, repeat) => {
      const truth = oracle(item.scenario.state);
      const tableState = explicitPayoutState(item.scenario.state);
      const net = item.scenario.state.rules.grossReturnByFace.map(gross => gross - item.scenario.state.stake);
      return {
        id: `${item.scenario.id}-${format}-${repeat}`, caseId: item.scenario.id, group: item.group,
        pattern: item.pattern, format, repeat, truth,
        state: format === 'table-only' ? tableState : {
          ...tableState,
          calculatedExpectedNetProfit: {
            value: truth.expectedNet,
            units: 'bankroll units per next bet',
            calculation: `(${net.join(' + ')}) / 6 = ${truth.expectedNet}`,
            note: 'Calculated from the six equally likely outcomes for the offered next bet. This is net profit after the stake has been deducted once; do not deduct the stake again.',
          },
        },
      };
    })));
  return shuffle(trials, seededRandom(20260928));
}
export type FormatResult = {
  id: string; caseId: string; group: number; pattern: string; format: string; repeat: number;
  truth: ReturnType<typeof oracle>; p: number; choice: string; score: number;
  response: Record<string, unknown>; elapsedMs: number;
};
export function summarizeFormats(results: FormatResult[], formats: readonly string[] = ['original', 'explicit-table']) {
  const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
  const arms = formats.map(format => {
    const rows = results.filter(row => row.format === format);
    const cases = [...new Set(rows.map(row => row.caseId))].map(caseId => {
      const repeats = rows.filter(row => row.caseId === caseId);
      return { caseId, categoryChanged: new Set(repeats.map(row => row.choice)).size > 1,
        probabilityRange: Math.max(...repeats.map(row => row.p)) - Math.min(...repeats.map(row => row.p)) };
    });
    return { format, calls: rows.length, correct: rows.filter(row => row.choice === row.truth.evClass).length,
      probabilityMae: mean(rows.map(row => Math.abs(row.p - 0.5))),
      scoreMae: mean(rows.map(row => Math.abs(row.score - row.truth.advantage))),
      repeatedCasesChangingCategory: cases.filter(row => row.categoryChanged).length,
      meanRepeatedInputProbabilityRange: mean(cases.map(row => row.probabilityRange)),
      byEv: ['negative', 'zero', 'positive'].map(label => {
        const subset = rows.filter(row => row.truth.evClass === label);
        return { label, calls: subset.length, correct: subset.filter(row => row.choice === label).length };
      }),
      predictedCounts: Object.fromEntries(['negative', 'zero', 'positive'].map(label => [label, rows.filter(row => row.choice === label).length])),
    };
  });
  const groups = [...new Set(results.map(row => row.group))].sort((a, b) => a - b).map(group => {
    const accuracies = formats.map(format => {
      const rows = results.filter(row => row.group === group && row.format === format);
      return rows.filter(row => row.choice === row.truth.evClass).length / rows.length;
    });
    return { group, originalAccuracy: accuracies[0], tableAccuracy: accuracies[1], improvement: accuracies[1] - accuracies[0] };
  });
  return { arms, groups, meanGroupAccuracyImprovement: mean(groups.map(row => row.improvement)) };
}
