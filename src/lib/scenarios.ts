import { settle } from './dice.ts';
import type { Roll } from './dice.ts';

export type Scenario = {
  id: string;
  description: string;
  state: {
    rules: { independent: true; uniform: true; sides: 6; bet: 'high'; winningFaces: number[]; grossReturnByFace: number[]; payoutNote: string };
    bankroll: number;
    stake: number;
    history: Roll[];
    historyIsSynthetic: true;
    objective: string;
  };
};

function scenario(id: string, description: string, values: number[]): Scenario {
  let bankroll = 100;
  const history = values.map(face => {
    const result = settle(bankroll, 5, 'high', face);
    bankroll = result.bankroll;
    return result;
  });
  return {
    id, description,
    state: {
      rules: { independent: true, uniform: true, sides: 6, bet: 'high', winningFaces: [4, 5, 6], grossReturnByFace: [0, 0, 0, 10, 10, 10], payoutNote: 'Gross returns include stake return, in bankroll units, for the offered stake. This schedule applies to the next bet; historical bets used their recorded payouts.' },
      bankroll, stake: 5, history, historyIsSynthetic: true,
      objective: 'Estimate next-roll win probability and expected net profit for the offered bet.',
    },
  };
}

// Exact same face multiset, number of wins, stake and final bankroll in every case.
export const scenarios: Scenario[] = [
  scenario('alternating', 'Wins and losses alternate.', [1, 4, 2, 5, 3, 6, 1, 4, 2, 5, 3, 6]),
  scenario('winning-streak', 'Six consecutive wins at the end.', [1, 2, 3, 1, 2, 3, 4, 5, 6, 4, 5, 6]),
  scenario('losing-streak', 'Six consecutive losses at the end.', [4, 5, 6, 4, 5, 6, 1, 2, 3, 1, 2, 3]),
  scenario('clustered', 'Results arrive in short clusters.', [1, 2, 4, 5, 3, 1, 6, 4, 2, 3, 5, 6]),
];

// Full factorial: each history appears with each offer, isolating both effects.
for (const [label, grossReturnByFace] of [
  ['positive-ev', [0, 0, 0, 9, 10, 12]],
  ['negative-ev', [0, 0, 0, 8, 10, 11]],
] as const) {
  for (const source of scenarios.slice(0, 4)) {
    const variant = structuredClone(source);
    variant.id = `${source.id}-${label}`;
    variant.description += ` Next offer has ${label} with face-specific returns.`;
    variant.state.rules.grossReturnByFace = [...grossReturnByFace];
    scenarios.push(variant);
  }
}

export function oracle(state: Scenario['state']) {
  const expectedNet = state.rules.grossReturnByFace.reduce((sum, gross) => sum + gross - state.stake, 0) / 6;
  return { winProbability: state.rules.winningFaces.length / 6, expectedNet,
    evClass: expectedNet > 0 ? 'positive' : expectedNet < 0 ? 'negative' : 'zero',
    advantage: expectedNet > 0 ? 2 : expectedNet < 0 ? 0 : 1 };
}

export function expandedScenarios(windows: number[]): Scenario[] {
  if (!windows.length || new Set(windows).size !== windows.length) throw new Error('Provide distinct window lengths');
  return windows.flatMap(window => {
    if (!Number.isSafeInteger(window) || window < 12 || window > 1200 || window % 12) throw new Error('Windows must be multiples of 12 between 12 and 1200');
    return scenarios.map(source => {
      const result = structuredClone(source);
      result.id = `${source.id}-window-${window}`;
      // Extend the balanced prefix; preserve the original recent pattern.
      const prefix = Array.from({ length: window - 12 }, (_, i) => [1, 4, 2, 5, 3, 6][i % 6]);
      const values = [...prefix, ...source.state.history.map(row => row.face)];
      let bankroll = 100;
      result.state.history = values.map(face => {
        const row = settle(bankroll, 5, 'high', face);
        bankroll = row.bankroll;
        return row;
      });
      result.state.bankroll = bankroll;
      return result;
    });
  });
}

export type Prediction = {
  winProbability: number;
  expectedNet: number;
  // Raw JEV output, preserved without inventing meanings for its primitives.
  primitives?: Record<string, unknown>;
};
export type Model = { name: string; predict: (state: Scenario['state']) => Promise<Prediction> };
export const logicalBaseline: Model = {
  name: 'logical-baseline',
  async predict(state) {
    return oracle(state);
  },
};

// Deliberately biased control: demonstrates that the harness detects recency sensitivity.
export const recencyControl: Model = {
  name: 'recency-control',
  async predict(state) {
    const recent = state.history.slice(-4);
    const p = recent.filter(roll => roll.won).length / recent.length;
    const meanWinningReturn = state.rules.winningFaces.reduce((sum, face) => sum + state.rules.grossReturnByFace[face - 1], 0) / state.rules.winningFaces.length;
    return { winProbability: p, expectedNet: p * meanWinningReturn - state.stake };
  },
};

export type SavedResult = { model: string; scenario: string; repetition: number; prediction: Prediction };
export async function evaluate(model: Model, repetitions = 1, onResult?: (result: unknown) => Promise<void>, options: { suite?: Scenario[]; resume?: SavedResult[] } = {}) {
  if (!Number.isSafeInteger(repetitions) || repetitions < 1 || repetitions > 10000) throw new Error('Invalid repetitions');
  const suite = options.suite ?? scenarios;
  const saved = new Map((options.resume ?? []).filter(row => row.model === model.name).map(row => [`${row.scenario}:${row.repetition}`, row.prediction]));
  const results: { scenario: string; repetition: number; prediction: Prediction; truth: ReturnType<typeof oracle>; probabilityError: number; expectedNetError: number }[] = [];
  for (let repetition = 0; repetition < repetitions; repetition++) {
    // Alternate order to help expose order effects in a future adapter.
    for (const scenario of repetition % 2 ? [...suite].reverse() : suite) {
      const cached = saved.get(`${scenario.id}:${repetition}`);
      const prediction = cached ?? await model.predict(structuredClone(scenario.state));
      if (!Number.isFinite(prediction.winProbability) || prediction.winProbability < 0 || prediction.winProbability > 1 || !Number.isFinite(prediction.expectedNet)) {
        throw new Error(`Invalid prediction for ${scenario.id}`);
      }
      const truth = oracle(scenario.state);
      const row = { scenario: scenario.id, repetition, prediction, truth,
        probabilityError: prediction.winProbability - truth.winProbability,
        expectedNetError: prediction.expectedNet - truth.expectedNet };
      results.push(row);
      if (!cached) await onResult?.({ model: model.name, ...row });
    }
  }
  const means = suite.map(scenario => {
    const rows = results.filter(row => row.scenario === scenario.id);
    return { scenario: scenario.id, meanWinProbability: rows.reduce((sum, row) => sum + row.prediction.winProbability, 0) / rows.length };
  });
  return { model: model.name, repetitions, means,
    probabilitySpread: Math.max(...means.map(row => row.meanWinProbability)) - Math.min(...means.map(row => row.meanWinProbability)),
    results };
}
