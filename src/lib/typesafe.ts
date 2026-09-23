import type { Model } from './scenarios.ts';
import { contextProxy, pricing } from './usage.ts';

export const questions = {
  next_win: { type: 'noul', instructions: 'Will the offered bet win on the next roll?' },
  ev_class: {
    type: 'choice', instructions: 'Classify the expected net profit of the offered next bet.',
    criteria: { negative: 'Expected net profit is below zero.', zero: 'Expected net profit is exactly zero.', positive: 'Expected net profit is above zero.' },
  },
  advantage: {
    type: 'score', instructions: 'Assess the mathematical advantage of the offered next bet.',
    criteria: ['The bet has negative expected net profit.', 'The bet has zero expected net profit.', 'The bet has positive expected net profit.'],
  },
} as const;

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid TypeSafe response object');
  return value as Record<string, unknown>;
}
function number(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error('Invalid TypeSafe response number');
  return value;
}
function distribution(value: unknown, keys: string[]) {
  const record = object(value);
  const sum = keys.reduce((total, key) => total + number(record[key], 0, 1), 0);
  if (Object.keys(record).length !== keys.length || Math.abs(sum - 1) > 0.02) throw new Error('Invalid TypeSafe probability distribution');
}
export function parseAnswers(value: unknown) {
  const response = object(value);
  if (typeof response.model !== 'string') throw new Error('Missing resolved TypeSafe model');
  const answers = object(response.answers);
  const noul = object(answers.next_win);
  const choice = object(answers.ev_class);
  const score = object(answers.advantage);
  if (noul.type !== 'noul' || choice.type !== 'choice' || score.type !== 'score') throw new Error('Invalid TypeSafe answer type');
  const winProbability = number(noul.noul, 0, 1);
  if (!['negative', 'zero', 'positive'].includes(String(choice.choice))) throw new Error('Invalid EV choice');
  number(choice.confidence, 0, 1);
  number(score.confidence, 0, 1);
  number(score.score, 0, 2);
  distribution(choice.probabilities, ['negative', 'zero', 'positive']);
  distribution(score.probabilities, ['0', '1', '2']);
  return { winProbability, response };
}

export function typesafeModel(apiKey: string, model = 'jev-latest', transport: typeof fetch = fetch): Model {
  if (!apiKey.trim()) throw new Error('Set TYPESAFE_API_KEY in .env.local before running live scenarios');
  return {
    name: model,
    async predict(state) {
      const body = { model, state, questions };
      if (contextProxy(body) > pricing.contextTokens) throw new Error('Request exceeds conservative context sizing limit; use a smaller history window');
      const response = await transport('https://api.typesafe.ai/v1/systemone', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error(`TypeSafe HTTP ${response.status}; run stopped without automatic retries`);
      const parsed = parseAnswers(await response.json());
      return {
        winProbability: parsed.winProbability,
        // Derived EV from Noul; not an independent numeric model answer.
        expectedNet: parsed.winProbability * state.rules.winningFaces.reduce((sum, face) => sum + state.rules.grossReturnByFace[face - 1], 0) / state.rules.winningFaces.length - state.stake,
        primitives: parsed.response,
      };
    },
  };
}
