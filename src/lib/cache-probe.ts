import { createHash } from 'node:crypto';
import { pilotCases, shuffle } from './pilot.ts';
import { seededRandom } from './dice.ts';
import { questions, parseAnswers } from './typesafe.ts';

export const methods = ['exact', 'header-nonce', 'question-id-nonce', 'json-whitespace', 'state-nonce', 'state-noise-256', 'instruction-nonce'] as const;
export type Method = typeof methods[number];
export type Probe = { id: string; group: number; method: Method; variant: number; body: string; headers: Record<string, string>; keyMap: Record<string, string> };
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => JSON.stringify(key) + ':' + canonical(entry)).join(',') + '}';
  return JSON.stringify(value);
}
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');

export function cacheProbes(model: string, seed = 20260924): Probe[] {
  const cases = pilotCases();
  const probes: Probe[] = [];
  for (let group = 1; group <= 3; group++) {
    const original = cases.find(item => item.group === group && item.pattern === 'neutral')!.scenario.state;
    for (const method of methods) for (let variant = 0; variant < 3; variant++) {
      const nonce = hash(`${seed}:${group}:${method}:${variant}`).slice(0, 32);
      const state: Record<string, unknown> = structuredClone(original);
      const query: Record<string, { type: string; instructions: string; criteria?: unknown }> = structuredClone(questions);
      const headers: Record<string, string> = {};
      const keyMap: Record<string, string> = {};
      if (method === 'header-nonce') headers['X-Experiment-Nonce'] = nonce;
      if (method === 'state-nonce') state.experimentMetadata = { note: 'Irrelevant trial identifier; ignore when evaluating the bet.', trialId: nonce };
      if (method === 'state-noise-256') state.experimentMetadata = { note: 'Irrelevant random text; ignore when evaluating the bet.', noise: Array.from({ length: 8 }, (_, i) => hash(`${nonce}:${i}`).slice(0, 32)).join('') };
      if (method === 'instruction-nonce') for (const question of Object.values(query)) question.instructions += ` Irrelevant trial identifier (ignore): ${nonce}.`;
      if (method === 'question-id-nonce') for (const key of Object.keys(query)) {
        const replacement = `${key}_${nonce}`;
        query[replacement] = query[key];
        delete query[key];
        keyMap[replacement] = key;
      }
      const body = method === 'json-whitespace' ? JSON.stringify({ model, state, questions: query }, null, variant + 1) + ' '.repeat(variant + 1) : JSON.stringify({ model, state, questions: query });
      probes.push({ id: `${group}-${method}-${variant}`, group, method, variant, body, headers, keyMap });
    }
  }
  return shuffle(probes, seededRandom(seed));
}

export function normalizedResponse(raw: unknown, keyMap: Record<string, string>) {
  const response = structuredClone(raw) as Record<string, unknown>;
  const answers = response.answers as Record<string, unknown>;
  if (!answers || typeof answers !== 'object') throw new Error('Missing answers');
  response.answers = Object.fromEntries(Object.entries(answers).map(([key, value]) => [keyMap[key] ?? key, value]));
  return parseAnswers(response).response;
}
export type ProbeResult = { id: string; probeId: string; group: number; method: Method; variant: number; replay: number; status: number; elapsedMs: number; headers: Record<string, string>; bodyHash: string; response: Record<string, unknown> };
export function summarizeProbes(results: ProbeResult[]) {
  const answerHash = (row: ProbeResult) => hash(canonical(row.response.answers));
  const metric = (row: ProbeResult) => {
    const answers = row.response.answers as Record<string, Record<string, unknown>>;
    return { p: Number(answers.next_win.noul), choice: String(answers.ev_class.choice), score: Number(answers.advantage.score) };
  };
  const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); return sorted.length % 2 ? sorted[Math.floor(sorted.length / 2)] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2; };
  return methods.map(method => {
    const rows = results.filter(row => row.method === method && row.replay === 0);
    let changedFromBaseline = 0, repeatMismatches = 0, choiceChanges = 0, maxProbabilityDelta = 0, replayChoiceChanges = 0, replayProbabilityChanges = 0, maxReplayProbabilityDelta = 0;
    for (const row of rows) {
      const baseline = results.find(other => other.group === row.group && other.method === 'exact' && other.variant === 0 && other.replay === 0)!;
      const repeated = results.find(other => other.probeId === row.probeId && other.replay === 1)!;
      if (answerHash(row) !== answerHash(baseline)) changedFromBaseline++;
      if (answerHash(row) !== answerHash(repeated)) repeatMismatches++;
      if (metric(row).choice !== metric(repeated).choice) replayChoiceChanges++;
      const replayDelta = Math.abs(metric(row).p - metric(repeated).p);
      if (replayDelta > 1e-12) replayProbabilityChanges++;
      maxReplayProbabilityDelta = Math.max(maxReplayProbabilityDelta, replayDelta);
      if (metric(row).choice !== metric(baseline).choice) choiceChanges++;
      maxProbabilityDelta = Math.max(maxProbabilityDelta, Math.abs(metric(row).p - metric(baseline).p));
    }
    return { method, variants: rows.length, changedFromBaseline, repeatMismatches, choiceChanges, maxProbabilityDelta, replayChoiceChanges, replayProbabilityChanges, maxReplayProbabilityDelta,
      medianFirstMs: median(rows.map(row => row.elapsedMs)),
      medianReplayMs: median(results.filter(row => row.method === method && row.replay === 1).map(row => row.elapsedMs)) };
  });
}
