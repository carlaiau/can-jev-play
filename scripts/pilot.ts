import { mkdir, readFile, writeFile, appendFile, open, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pilotCases, summarizePilot, PILOT_SEED } from '../src/lib/pilot.ts';
import type { PilotResult } from '../src/lib/pilot.ts';
import { oracle } from '../src/lib/scenarios.ts';
import { typesafeModel, questions } from '../src/lib/typesafe.ts';
import { pricing, contextProxy, inputCost } from '../src/lib/usage.ts';

const apiKey = process.env.TYPESAFE_API_KEY ?? '';
if (!apiKey.trim()) throw new Error('TYPESAFE_API_KEY is required');
const requestedModel = process.env.TYPESAFE_MODEL ?? 'jev-latest';
const resumeName = process.argv.find(arg => arg.startsWith('--resume='))?.slice('--resume='.length);
const name = resumeName ?? `pilot-${Date.now()}`;
if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error('Invalid report basename');
const base = `reports/${name}`;
const cases = pilotCases();
if (new Set(cases.map(item => JSON.stringify(item.scenario.state))).size !== 100) throw new Error('Pilot contains duplicate states');
const plan = { version: 1, seed: PILOT_SEED, requestedModel, pricing, questions, cases,
  analysis: 'Descriptive pilot: EV classification accuracy, mean/max within-group Noul range, signed winning-minus-losing Noul difference, groups with changed EV category, Score range. Group is the comparison unit; no significance claims. Five-percentage-point spread is a descriptive threshold, not a statistical test.' };
const fingerprint = createHash('sha256').update(JSON.stringify(plan)).digest('hex');
const sizes = cases.map(item => contextProxy({ model: requestedModel, state: item.scenario.state, questions }));
if (Math.max(...sizes) > pricing.contextTokens) throw new Error('Context preflight failed');
await mkdir('reports', { recursive: true });
const lock = await open(`${base}.lock`, 'wx');
try {
const results: PilotResult[] = [];
if (resumeName) {
  const previous = JSON.parse(await readFile(`${base}-manifest.json`, 'utf8'));
  if (previous.fingerprint !== fingerprint) throw new Error('Resume configuration mismatch');
  let log = '';
  try { log = await readFile(`${base}.jsonl`, 'utf8'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  for (const line of log.split('\n').filter(Boolean)) results.push(JSON.parse(line));
} else {
  await writeFile(`${base}-manifest.json`, JSON.stringify({ ...plan, fingerprint, createdAt: new Date().toISOString() }, null, 2));
}
console.log(`Pilot: ${base}; ${cases.length} unique states; ${results.length} completed; max context proxy ${Math.max(...sizes)}`);
let pinnedModel = results[0]?.resolvedModel ?? requestedModel;
for (const item of cases) {
  if (results.some(row => row.id === item.scenario.id)) continue;
  const started = Date.now();
  const transport: typeof fetch = async (url, init) => {
    await appendFile(`${base}-requests.jsonl`, JSON.stringify({ at: new Date().toISOString(), id: item.scenario.id, request: JSON.parse(String(init?.body)) }) + '\n');
    const response = await fetch(url, init);
    const rawText = await response.clone().text();
    // Never persist request authorization headers. Preserve raw response before parsing.
    await appendFile(`${base}-responses.jsonl`, JSON.stringify({ at: new Date().toISOString(), id: item.scenario.id, status: response.status, elapsedMs: Date.now() - started,
      requestId: response.headers.get('x-typesafe-request-id'), cacheStatus: response.headers.get('x-cache'), body: rawText }) + '\n');
    return response;
  };
  const prediction = await typesafeModel(apiKey, pinnedModel, transport).predict(item.scenario.state);
  const resolvedModel = String(prediction.primitives!.model);
  if (results.length && resolvedModel !== pinnedModel) throw new Error(`Resolved model changed: ${pinnedModel} to ${resolvedModel}`);
  pinnedModel = resolvedModel;
  const result: PilotResult = { id: item.scenario.id, group: item.group, pattern: item.pattern, prediction, truth: oracle(item.scenario.state), resolvedModel, elapsedMs: Date.now() - started };
  await appendFile(`${base}.jsonl`, JSON.stringify(result) + '\n');
  results.push(result);
  console.log(`${results.length}/100 ${item.scenario.id}: P(win)=${prediction.winProbability}`);
}
const summary = summarizePilot(results);
let tokens = 0;
let missingUsage = 0;
for (const result of results) {
  const usage = result.prediction.primitives?.usage as { input_tokens?: number } | undefined;
  if (Number.isSafeInteger(usage?.input_tokens) && usage!.input_tokens! >= 0) tokens += usage!.input_tokens!;
  else missingUsage++;
}
const cost = { inputTokens: tokens, estimatedUsd: inputCost(tokens), missingUsage, pricing };
await writeFile(`${base}.json`, JSON.stringify({ summary, cost, pinnedModel, fingerprint, results }, null, 2));
const percent = (value: number) => `${(100 * value).toFixed(2)}%`;
const lines = ['# JEV pilot report', '', `Model: ${pinnedModel}. Seed: ${PILOT_SEED}. 100 unique states in 25 matched groups.`, '',
  `EV classification: **${summary.evCorrect}/100 correct**.`,
  `Predicted categories: ${summary.predictedEvCounts.negative} negative, ${summary.predictedEvCounts.zero} zero, ${summary.predictedEvCounts.positive} positive.`,
  `Mean absolute error against 50% next-win probability: **${(100 * summary.meanAbsoluteProbabilityError).toFixed(2)} percentage points**.`,
  `Mean within-group probability range: **${(100 * summary.meanWithinGroupProbabilitySpread).toFixed(2)} percentage points**; maximum: **${(100 * summary.maxWithinGroupProbabilitySpread).toFixed(2)} percentage points**.`,
  `Groups with changed EV classification: **${summary.groupsWithEvChoiceChanges}/25**. Groups with probability range above five percentage points: **${summary.groupsAboveFivePercentagePointSpread}/25**.`,
  `Mean winning-streak minus losing-streak probability: **${(100 * summary.meanWinMinusLossProbability).toFixed(2)} percentage points** (positive suggests streak-following; negative suggests reversal expectations).`, '',
  `Reported input tokens: ${tokens}. Estimated cost at user-supplied pricing: $${cost.estimatedUsd.toFixed(6)}. Missing usage: ${missingUsage}.`, '',
  '| True EV | Calls | Correct classifications |', '|---|---:|---:|',
  ...summary.byEv.map(row => `| ${row.label} | ${row.calls} | ${row.correct} |`), '',
  '| History | Mean P(win) | Correct EV classifications |', '|---|---:|---:|',
  ...summary.byPattern.map(row => `| ${row.pattern} | ${percent(row.meanProbability)} | ${row.correct}/${row.calls} |`), '',
  '| Group | True EV | Noul range (percentage points) | Score range | EV category changed |', '|---|---|---:|---:|---|',
  ...summary.groups.map(row => `| ${row.group} | ${row.expectedEvClass} | ${(100 * row.probabilitySpread).toFixed(2)} | ${row.scoreSpread.toFixed(4)} | ${row.evChoiceChanges} |`), '',
  '## Interpretation and limitations', '',
  'History sensitivity and EV arithmetic accuracy are separate outcomes. Incorrect EV labels alone do not establish gambler’s fallacy. Before the main study, add a no-history control and a condition supplying precomputed EV, then test alternative payout encodings. These controls can distinguish payout interpretation failures from sensitivity to recent results. The pilot must remain exploratory and separate from that main study.', '',
  'Each group has identical face counts, bankroll, stake, payout and history length. Order changes. Neutral is a random permutation and can contain incidental streaks. History lengths are 24, 60 or 120 rolls; terminal streaks are 6 or 12. Upcoming payouts vary by face, with EV from -5 to +5 units on a 100-unit stake. Historical bets used fair payouts. Group labels and oracle answers were excluded from model inputs.', '',
  'Inputs are unique; provider cache misses are not guaranteed. Exact duplicate requests are not counted as fresh observations. Results are descriptive across 25 matched groups; there are no significance claims. Do not treat 100 related calls as 100 independent observations. All three primitives are asked together. EV classification is a belief measure, not an observed staking decision. This pilot does not establish trading performance or general reasoning ability. Reserve new seeds/scenarios for the main study.', '',
  'Raw requests, raw responses, parsed results and the pre-run manifest are saved alongside this report. Timing and any returned cache header are diagnostic only; timing cannot prove a cache hit or miss.' ];
await writeFile(`${base}.md`, lines.join('\n') + '\n');
console.log(JSON.stringify({ summary, cost, report: `${base}.md` }, null, 2));
} catch (error) {
  await appendFile(`${base}-errors.jsonl`, JSON.stringify({ at: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) }) + '\n');
  throw error;
} finally {
  await lock.close();
  await unlink(`${base}.lock`);
}
