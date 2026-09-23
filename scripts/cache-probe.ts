import { mkdir, open, unlink, writeFile, readFile, appendFile } from 'node:fs/promises';
import { cacheProbes, hash, normalizedResponse, summarizeProbes } from '../src/lib/cache-probe.ts';
import type { ProbeResult } from '../src/lib/cache-probe.ts';
import { contextProxy, inputCost, pricing } from '../src/lib/usage.ts';

const apiKey = process.env.TYPESAFE_API_KEY ?? '';
if (!apiKey.trim()) throw new Error('TYPESAFE_API_KEY is required');
// Same concrete model as the pilot. No aliases changing between trials.
const model = 'jev-1.13.0';
const probes = cacheProbes(model);
const resume = process.argv.find(arg => arg.startsWith('--resume='))?.slice(9);
const name = resume ?? `cache-probe-${Date.now()}`;
if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error('Invalid run basename');
const base = `reports/${name}`;
const manifest = { version: 1, model, pricing, probes, analysis: 'Seven methods, three states (fair/positive/negative EV), three variants per method, two byte-identical replays each: 126 requests. Pairs are adjacent, pair order randomized. Compare normalized answer distributions to exact controls and paired replays. Timing is descriptive only. No documented cache-bypass mechanism or guaranteed cache indicator.' };
const fingerprint = hash(JSON.stringify(manifest));
if (probes.some(probe => contextProxy(JSON.parse(probe.body)) > 32000)) throw new Error('Context preflight failed');
await mkdir('reports', { recursive: true });
const lock = await open(`${base}.lock`, 'wx');
try {
const results: ProbeResult[] = [];
if (resume) {
  const previous = JSON.parse(await readFile(`${base}-manifest.json`, 'utf8'));
  if (previous.fingerprint !== fingerprint) throw new Error('Resume configuration mismatch');
  let log = '';
  try { log = await readFile(`${base}.jsonl`, 'utf8'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  results.push(...log.split('\n').filter(Boolean).map(line => JSON.parse(line)));
} else await writeFile(`${base}-manifest.json`, JSON.stringify({ ...manifest, fingerprint, createdAt: new Date().toISOString() }, null, 2));
console.log(`Run: ${base}; ${results.length}/126 completed`);
for (const probe of probes) for (let replay = 0; replay < 2; replay++) {
  const id = `${probe.id}-${replay}`;
  if (results.some(row => row.id === id)) continue;
  const start = performance.now();
  await appendFile(`${base}-requests.jsonl`, JSON.stringify({ id, at: new Date().toISOString(), body: probe.body, headers: probe.headers }) + '\n');
  const response = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST', body: probe.body,
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...probe.headers },
    signal: AbortSignal.timeout(30000),
  });
  const raw = await response.text();
  const elapsedMs = Math.round(performance.now() - start);
  const headers = Object.fromEntries([...response.headers].filter(([key]) => /cache|^age$|^date$|timing|request-id|^cf-ray$/.test(key)));
  await appendFile(`${base}-responses.jsonl`, JSON.stringify({ id, status: response.status, elapsedMs, headers, raw }) + '\n');
  if (!response.ok) throw new Error(`HTTP ${response.status}; raw response saved; no automatic retry`);
  const parsed = normalizedResponse(JSON.parse(raw), probe.keyMap);
  if (parsed.model !== model) throw new Error('Resolved model differs from pinned version');
  const row: ProbeResult = { id, probeId: probe.id, group: probe.group, method: probe.method, variant: probe.variant, replay, status: response.status, elapsedMs, headers, bodyHash: hash(probe.body), response: parsed };
  await appendFile(`${base}.jsonl`, JSON.stringify(row) + '\n');
  results.push(row);
  if (results.length % 10 === 0 || results.length === 126) console.log(`${results.length}/126 completed`);
}
const summary = summarizeProbes(results);
let inputTokens = 0, missingUsage = 0;
for (const row of results) {
  const usage = row.response.usage as { input_tokens?: number } | undefined;
  if (Number.isSafeInteger(usage?.input_tokens) && usage!.input_tokens! >= 0) inputTokens += usage!.input_tokens!;
  else missingUsage++;
}
const diagnosticHeaders = Object.fromEntries([...new Set(results.flatMap(row => Object.keys(row.headers)))].map(key => [key, [...new Set(results.map(row => row.headers[key]).filter(Boolean))]]));
const cost = { inputTokens, missingUsage, estimatedUsd: inputCost(inputTokens), pricing };
const exact = summary.find(row => row.method === 'exact')!;
await writeFile(`${base}.json`, JSON.stringify({ model, summary, diagnosticHeaders, cost, results }, null, 2));
const lines = ['# JEV cache and noise experiment', '', `Model: ${model}. Calls: 126. Seven methods × three base states × three variants × two identical replays.`, '',
  `Exact controls changed their full answer distributions in **${exact.repeatMismatches}/9** pairs. Win probability changed in **${exact.replayProbabilityChanges}/9** pairs (maximum ${(100 * exact.maxReplayProbabilityDelta).toFixed(2)} percentage points), and the EV category changed in **${exact.replayChoiceChanges}/9** pairs.`, '',
  'These controls already vary without noise. Therefore this run does not establish that any noise method bypasses a response cache. It also means the earlier pilot’s differences between histories cannot yet be attributed to history: repeated-input variability must be measured alongside them.', '',
  '| Method | Changed answers vs baseline | EV category changed | Exact replay mismatches | Max P(win) shift (pp) | First / replay median ms |',
  '|---|---:|---:|---:|---:|---:|',
  ...summary.map(row => `| ${row.method} | ${row.changedFromBaseline}/${row.variants} | ${row.choiceChanges}/${row.variants} | ${row.repeatMismatches}/${row.variants} | ${(100 * row.maxProbabilityDelta).toFixed(2)} | ${row.medianFirstMs} / ${row.medianReplayMs} |`), '',
  `Input tokens: ${inputTokens}; estimated cost: $${cost.estimatedUsd.toFixed(6)} at user-provided pricing. Missing usage: ${missingUsage}.`, '',
  '## Design', '',
  'The same three game states are used for all methods. Exact controls are unchanged. Header nonce changes only X-Experiment-Nonce. Question-ID nonce renames response keys, which TypeSafe documents as not model-visible. JSON whitespace changes only serialization. State nonce adds a 32-character trial ID and ignore note. State noise adds 256 pseudorandom hex characters and ignore note. Instruction nonce appends the same ignored trial ID to each question. Noise is seeded and its exact bytes are preserved. Each request is replayed byte-for-byte with identical experimental headers. Pair order is randomized; original precedes replay. Normalization restores question IDs and sorts object keys before comparing full answers.', '',
  '## Limits on conclusions', '',
  'The exact-control baseline comparison includes three self-comparisons (one reference per state); use paired replay mismatches as the primary repeatability measure, rather than comparing its changed-vs-baseline fraction directly with noise arms.', '',
  'Changed outputs under irrelevant noise show input sensitivity, not a confirmed server cache miss. Identical outputs can reflect either caching or deterministic inference. Lower replay latency is consistent with caching but also affected by connection reuse, warm-up and network variation. Request IDs and usage counts alone do not prove cache status. Edge/CDN cache headers do not necessarily describe inference-result caching. Model-visible nonce methods alter the prompt, so they cannot provide unbiased independent replicates of the original input.', '',
  'Only three base states are tested; nine variants per method are not nine independent game states. If provider cache-hit/miss telemetry is absent, cache bypass remains unconfirmed. The practical criterion is whether a method changes outputs without exposing new content to the model, and whether identical replays then stabilize. Confirm any proposed bypass with the provider before relying on it.', '',
  'Documentation: https://docs.typesafe.ai/api . Raw wire bodies, diagnostic response headers, raw responses, normalized answers and the pre-run manifest are saved alongside this report.' ];
await writeFile(`${base}.md`, lines.join('\n') + '\n');
console.log(JSON.stringify({ summary, cost, diagnosticHeaderNames: Object.keys(diagnosticHeaders), report: `${base}.md` }, null, 2));
} catch (error) {
  await appendFile(`${base}-errors.jsonl`, JSON.stringify({ at: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) }) + '\n');
  throw error;
} finally { await lock.close(); await unlink(`${base}.lock`); }
