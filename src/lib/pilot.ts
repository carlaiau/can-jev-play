import { seededRandom, settle } from './dice.ts';
import { scenarios, oracle } from './scenarios.ts';
import type { Scenario, Prediction } from './scenarios.ts';

export const PILOT_SEED = 20260923;
export type PilotCase = { group: number; pattern: string; scenario: Scenario };
export function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function pilotCases(seed = PILOT_SEED): PilotCase[] {
  const random = seededRandom(seed);
  const cases: PilotCase[] = [];
  for (let group = 0; group < 25; group++) {
    // Rotate EV independently of the window and vary edge magnitude.
    const length = [24, 60, 120][Math.floor(group / 3) % 3];
    const delta = [0, 1, -1][group % 3] * [6, 18, 30][Math.floor(group / 9)];
    const high = shuffle(Array.from({ length: length / 2 }, (_, i) => 4 + i % 3), random);
    const low = shuffle(Array.from({ length: length / 2 }, (_, i) => 1 + i % 3), random);
    const streak = Math.min(length / 2, [6, 12][group % 2]);
    const variants = {
      neutral: shuffle([...high, ...low], random),
      alternating: low.flatMap((face, i) => [face, high[i]]),
      'winning-streak': [...shuffle([...low, ...high.slice(streak)], random), ...high.slice(0, streak)],
      'losing-streak': [...shuffle([...high, ...low.slice(streak)], random), ...low.slice(0, streak)],
    };
    for (const [pattern, values] of Object.entries(variants)) {
      const scenario = structuredClone(scenarios[0]);
      scenario.id = `group-${group + 1}-${pattern}`;
      scenario.description = `${pattern}, ${length} rolls; matched group ${group + 1}`;
      scenario.state.stake = 100;
      scenario.state.rules.grossReturnByFace = [0, 0, 0, 190, 200, 210 + delta];
      let bankroll = 10000;
      scenario.state.history = values.map(face => {
        const row = settle(bankroll, 100, 'high', face);
        bankroll = row.bankroll;
        return row;
      });
      scenario.state.bankroll = bankroll;
      cases.push({ group: group + 1, pattern, scenario });
    }
  }
  // Interleave groups/conditions to avoid confounding condition with request order.
  return shuffle(cases, random);
}

export type PilotResult = { id: string; group: number; pattern: string; prediction: Prediction; truth: ReturnType<typeof oracle>; resolvedModel: string; elapsedMs: number };
export function summarizePilot(results: PilotResult[]) {
  const rows = results.map(row => {
    const answers = row.prediction.primitives!.answers as Record<string, Record<string, unknown>>;
    return { ...row, choice: String(answers.ev_class.choice), score: Number(answers.advantage.score), p: row.prediction.winProbability };
  });
  const groups = [...new Set(rows.map(row => row.group))].sort((a, b) => a - b).map(group => {
    const members = rows.filter(row => row.group === group);
    const winning = members.find(row => row.pattern === 'winning-streak')!;
    const losing = members.find(row => row.pattern === 'losing-streak')!;
    return { group, expectedEvClass: winning.truth.evClass, expectedNet: winning.truth.expectedNet,
      probabilitySpread: Math.max(...members.map(row => row.p)) - Math.min(...members.map(row => row.p)),
      winMinusLossProbability: winning.p - losing.p,
      evChoiceChanges: new Set(members.map(row => row.choice)).size > 1,
      scoreSpread: Math.max(...members.map(row => row.score)) - Math.min(...members.map(row => row.score)),
    };
  });
  const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
  return {
    calls: rows.length, matchedGroups: groups.length,
    evCorrect: rows.filter(row => row.choice === row.truth.evClass).length,
    meanAbsoluteProbabilityError: mean(rows.map(row => Math.abs(row.p - 0.5))),
    meanWithinGroupProbabilitySpread: mean(groups.map(group => group.probabilitySpread)),
    maxWithinGroupProbabilitySpread: Math.max(...groups.map(group => group.probabilitySpread)),
    meanWinMinusLossProbability: mean(groups.map(group => group.winMinusLossProbability)),
    groupsWithEvChoiceChanges: groups.filter(group => group.evChoiceChanges).length,
    predictedEvCounts: Object.fromEntries(['negative', 'zero', 'positive'].map(label => [label, rows.filter(row => row.choice === label).length])),
    groupsAboveFivePercentagePointSpread: groups.filter(group => group.probabilitySpread > 0.05 + 1e-12).length,
    byEv: ['negative', 'zero', 'positive'].map(label => {
      const subset = rows.filter(row => row.truth.evClass === label);
      return { label, calls: subset.length, correct: subset.filter(row => row.choice === label).length };
    }),
    byPattern: ['neutral', 'alternating', 'winning-streak', 'losing-streak'].map(pattern => {
      const subset = rows.filter(row => row.pattern === pattern);
      return { pattern, meanProbability: mean(subset.map(row => row.p)), correct: subset.filter(row => row.choice === row.truth.evClass).length, calls: subset.length };
    }),
    groups,
  };
}
