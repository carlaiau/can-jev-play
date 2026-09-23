import { mkdir, open, unlink, readFile, writeFile, appendFile } from 'node:fs/promises';
import { payoutFormatPlan, suppliedEvPlan, summarizeFormats } from '../src/lib/payout-format.ts';
import type { FormatResult } from '../src/lib/payout-format.ts';
import { questions, parseAnswers } from '../src/lib/typesafe.ts';
import { hash } from '../src/lib/cache-probe.ts';
import { pricing, contextProxy, inputCost } from '../src/lib/usage.ts';

const apiKey = process.env.TYPESAFE_API_KEY ?? '';
if (!apiKey.trim()) throw new Error('TYPESAFE_API_KEY is required');
const model = 'jev-1.13.0';
const suppliedEv = process.argv.includes('--supplied-ev');
const trials = suppliedEv ? suppliedEvPlan() : payoutFormatPlan();
const formats = suppliedEv ? ['table-only', 'supplied-ev'] : ['original', 'explicit-table'];
const resume = process.argv.find(arg => arg.startsWith('--resume='))?.slice(9);
const name = resume ?? `${suppliedEv ? 'supplied-ev' : 'payout-format'}-${Date.now()}`;
if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error('Invalid report name');
const base = `reports/${name}`;
const manifest = { version: 1, model, questions, pricing, trials,
  analysis: suppliedEv
    ? 'Paired exploratory supplied-EV experiment. 9 groups x 4 histories x 2 conditions x 3 identical repeats = 216 calls. History seed 20260927, order seed 20260928. Control is explicit payout table; treatment adds exact numeric expected net profit and its arithmetic, without naming the category. Questions and remaining state unchanged. Primary: selected EV category accuracy and paired group accuracy difference. Secondary: Noul and Score errors and repeated-input variability. No significance claims.'
    : 'Paired exploratory representation experiment. 9 groups x 4 histories x 2 formats x 3 identical repeats = 216 calls. New history seed 20260925. Interleaved seeded request order. Primary metric: selected EV category accuracy and paired group accuracy difference. Secondary: Noul absolute error, Score absolute error, repeated-input variation. Questions unchanged. Only payout encoding and explicit stake-accounting explanation differ. Per-face net profit is provided; aggregate EV is not. No significance claims.' };
const fingerprint = hash(JSON.stringify(manifest));
if (trials.some(trial => contextProxy({ model, state: trial.state, questions }) > 32000)) throw new Error('Context preflight failed');
await mkdir('reports', { recursive: true });
const lock = await open(`${base}.lock`, 'wx');
try {
const results: FormatResult[] = [];
if (resume) {
  const saved = JSON.parse(await readFile(`${base}-manifest.json`, 'utf8'));
  if (saved.fingerprint !== fingerprint) throw new Error('Resume configuration mismatch');
  let log = '';
  try { log = await readFile(`${base}.jsonl`, 'utf8'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  results.push(...log.split('\n').filter(Boolean).map(line => JSON.parse(line)));
} else await writeFile(`${base}-manifest.json`, JSON.stringify({ ...manifest, fingerprint, createdAt: new Date().toISOString() }, null, 2));
console.log(`Run ${base}; ${results.length}/216 completed`);
for (const trial of trials) {
  if (results.some(row => row.id === trial.id)) continue;
  const body = JSON.stringify({ model, state: trial.state, questions });
  await appendFile(`${base}-requests.jsonl`, JSON.stringify({ id: trial.id, at: new Date().toISOString(), body }) + '\n');
  const started = performance.now();
  const response = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body, signal: AbortSignal.timeout(30000),
  });
  const raw = await response.text();
  const elapsedMs = Math.round(performance.now() - started);
  await appendFile(`${base}-responses.jsonl`, JSON.stringify({ id: trial.id, status: response.status, elapsedMs, requestId: response.headers.get('x-typesafe-request-id'), raw }) + '\n');
  if (!response.ok) throw new Error(`HTTP ${response.status}; response saved; no automatic retries`);
  const parsed = parseAnswers(JSON.parse(raw));
  if (parsed.response.model !== model) throw new Error('Resolved model differs from pinned version');
  const answers = parsed.response.answers as Record<string, Record<string, unknown>>;
  const { state, ...metadata } = trial;
  const result: FormatResult = { ...metadata, p: parsed.winProbability, choice: String(answers.ev_class.choice), score: Number(answers.advantage.score), response: parsed.response, elapsedMs };
  await appendFile(`${base}.jsonl`, JSON.stringify(result) + '\n');
  results.push(result);
  if (results.length % 20 === 0 || results.length === 216) console.log(`${results.length}/216 completed`);
}
const summary = summarizeFormats(results, formats);
let inputTokens = 0, missingUsage = 0;
for (const row of results) {
  const usage = row.response.usage as { input_tokens?: number } | undefined;
  if (Number.isSafeInteger(usage?.input_tokens) && usage!.input_tokens! >= 0) inputTokens += usage!.input_tokens!;
  else missingUsage++;
}
const requestAttempts = (await readFile(`${base}-requests.jsonl`, 'utf8')).split('\n').filter(Boolean).length;
const attemptsWithoutRecordedResult = requestAttempts - results.length;
const cost = { inputTokens, missingUsage, requestAttempts, attemptsWithoutRecordedResult, estimatedUsd: inputCost(inputTokens), pricing };
await writeFile(`${base}.json`, JSON.stringify({ model, summary, cost, results }, null, 2));
const lines = [suppliedEv ? '# Supplied expected-value experiment' : '# Explicit payout-table experiment', '',
  `Model: ${model}. 216 calls: 36 states across 9 matched groups, two formats and three repeats per input.`, '',
  '| Format | EV classifications correct | Noul error (percentage points) | Score error (0–2 scale) | Inputs whose EV category varied across repeats |',
  '|---|---:|---:|---:|---:|',
  ...summary.arms.map(arm => `| ${arm.format} | ${arm.correct}/${arm.calls} (${(100 * arm.correct / arm.calls).toFixed(2)}%) | ${(100 * arm.probabilityMae).toFixed(2)} | ${arm.scoreMae.toFixed(3)} | ${arm.repeatedCasesChangingCategory}/36 |`), '',
  `Mean paired group accuracy difference, ${formats[1]} minus ${formats[0]}: **${(100 * summary.meanGroupAccuracyImprovement).toFixed(2)} percentage points**.`, '',
  '| Format | True EV | Correct |', '|---|---|---:|',
  ...summary.arms.flatMap(arm => arm.byEv.map(row => `| ${arm.format} | ${row.label} | ${row.correct}/${row.calls} |`)), '',
  '| Format | Selected negative | Selected zero | Selected positive |', '|---|---:|---:|---:|',
  ...summary.arms.map(arm => `| ${arm.format} | ${arm.predictedCounts.negative} | ${arm.predictedCounts.zero} | ${arm.predictedCounts.positive} |`), '',
  'The classes are balanced, so always selecting one category achieves 33.33% accuracy. Compare each class and predicted-category counts before treating a higher aggregate accuracy or greater stability as improved reasoning.', '',
  `| Group | ${formats[0]} accuracy | ${formats[1]} accuracy | Difference (pp) |`, '|---|---:|---:|---:|',
  ...summary.groups.map(row => `| ${row.group} | ${(100 * row.originalAccuracy).toFixed(2)}% | ${(100 * row.tableAccuracy).toFixed(2)}% | ${(100 * row.improvement).toFixed(2)} |`), '',
  `Reported input tokens: ${inputTokens}. Estimated cost: $${cost.estimatedUsd.toFixed(6)}. Responses missing usage: ${missingUsage}. Pricing is user-provided.`, '',
  `Request attempts: ${requestAttempts}; attempts without a completed recorded result: ${attemptsWithoutRecordedResult}. Cost covers returned usage only; timed-out or failed attempts may incur additional unreported charges.`, '',
  '## What changed', '',
  suppliedEv
    ? 'Both conditions contain the explicit per-face payout table. Treatment adds calculatedExpectedNetProfit: the exact numeric EV (-1, 0 or +1), units, arithmetic across the six equally likely outcomes, and a note that the stake has already been deducted. No category label is supplied. Questions, histories, bankroll, stake and payout table are otherwise identical. This deliberately supplies the quantity being classified to distinguish calculation/interpretation difficulty from classifying a supplied result. It is not a test of independently calculating EV.'
    : 'Original: gross returns encoded as a six-element array. Treatment: explicit table of face, probability (1/6), stake deducted, gross payout including returned stake, and per-face net profit. The explanation says to deduct the stake exactly once. Questions, histories, current bankroll, offered stake and payouts are otherwise held fixed. No precomputed aggregate EV or correct category is sent. This tests the combined representation and accounting clarification, not table formatting alone.', '',
  '## Design and interpretation', '',
  'Fresh seeded histories include neutral, alternating, winning-streak and losing-streak patterns. History lengths are 24, 60 and 120. Within each group the history face counts, bankroll and offer are matched. Fair, positive and negative EV each have three groups. Nonzero edges are +/-1 unit on a 100-unit stake. All three primitives are requested together. Trials are interleaved in randomized seeded order; each exact input is repeated three times without nonce noise.', '',
  'This is a prompt-development diagnostic, not the final confirmatory study. Calls are related: there are 9 matched groups, not 216 independent experimental units. Three repeats only provide a preliminary measure of output variability. No significance or general-performance claim is made. Cache behavior remains unverified. A category flip is distinct from a probability or score change. Report all EV classes to avoid hiding a tendency to pick the same category.', '',
  'Full pre-run plan, exact request bodies, raw responses and normalized results are preserved alongside this report.' ];
await writeFile(`${base}.md`, lines.join('\n') + '\n');
console.log(JSON.stringify({ summary, cost, report: `${base}.md` }, null, 2));
} catch (error) {
  await appendFile(`${base}-errors.jsonl`, JSON.stringify({ at: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) }) + '\n');
  throw error;
} finally { await lock.close(); await unlink(`${base}.lock`); }
