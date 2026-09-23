import { evaluate, logicalBaseline, recencyControl } from '../src/lib/scenarios.ts';
import { simulate } from '../src/lib/dice.ts';
import { typesafeModel, questions } from '../src/lib/typesafe.ts';
import { scenarios as defaultScenarios, expandedScenarios } from '../src/lib/scenarios.ts';
import type { SavedResult } from '../src/lib/scenarios.ts';
import { mkdir, writeFile, appendFile, readFile, open } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { contextProxy, inputCost, pricing } from '../src/lib/usage.ts';

const live = process.argv.includes('--live');
const repetitionsArg = process.argv.find(arg => arg.startsWith('--repetitions='));
const repetitions = repetitionsArg ? Number(repetitionsArg.split('=')[1]) : 1;
if (!Number.isSafeInteger(repetitions) || repetitions < 1 || repetitions > 10000) throw new Error('Repetitions must be 1–10000');
const windowsArg = process.argv.find(arg => arg.startsWith('--windows='));
const scenarios = windowsArg ? expandedScenarios(windowsArg.split('=')[1].split(',').map(Number)) : defaultScenarios;
const model = live ? typesafeModel(process.env.TYPESAFE_API_KEY ?? '', process.env.TYPESAFE_MODEL ?? 'jev-latest') : null;
await mkdir('reports', { recursive: true });
const resumeArg = process.argv.find(arg => arg.startsWith('--resume='));
const runName = resumeArg?.split('=')[1] ?? `${live ? 'jev' : 'offline'}-${Date.now()}`;
if (!/^[a-zA-Z0-9_-]+$/.test(runName)) throw new Error('Resume needs a report basename, without directory or extension');
const base = `reports/${runName}`;
const manifest = { questions, scenarios, repetitions, live, requestedModel: model?.name ?? null, pricing };
const fingerprint = createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
const resume: SavedResult[] = [];
if (resumeArg) {
  const previous = JSON.parse(await readFile(`${base}-manifest.json`, 'utf8'));
  if (previous.fingerprint !== fingerprint) throw new Error('Resume configuration differs from original run; use the original flags');
  let log = '';
  try { log = await readFile(`${base}.jsonl`, 'utf8'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  // Do not silently ignore a torn log line: preserve the file for recovery.
  for (const line of log.split('\n').filter(Boolean)) resume.push(JSON.parse(line).result);
}
const sizes = scenarios.map(scenario => contextProxy({ model: model?.name ?? 'jev-latest', state: scenario.state, questions }));
if (Math.max(...sizes) > pricing.contextTokens) throw new Error('Scenario exceeds conservative context sizing proxy; reduce --windows');
console.log(`Planned live calls: ${live ? scenarios.length * repetitions : 0}; largest context proxy: ${Math.max(...sizes)} / ${pricing.contextTokens}`);
const lock = await open(`${base}.lock`, 'wx');
try {
await writeFile(`${base}-manifest.json`, JSON.stringify({ ...manifest, fingerprint }, null, 2));
let completed = 0;
const logResult = async (result: unknown) => {
  await appendFile(`${base}.jsonl`, JSON.stringify({ recordedAt: new Date().toISOString(), result }) + '\n');
  if (++completed % 25 === 0) console.log(`Saved ${completed} new results (${resume.length} loaded from checkpoint)`);
};
const options = { suite: scenarios, resume };
const report = {
  generatedAt: new Date().toISOString(),
  live,
  questions,
  scenarios,
  simulation: simulate({ seed: 42, bankroll: 100, stake: 5, bet: 'high', rounds: 100, window: 12 }),
  evaluations: [await evaluate(logicalBaseline, repetitions, logResult, options), await evaluate(recencyControl, repetitions, logResult, options), ...(model ? [await evaluate(model, repetitions, logResult, options)] : [])],
};
const liveRows = report.evaluations.filter(evaluation => evaluation.model === model?.name).flatMap(evaluation => evaluation.results);
let inputTokens = 0;
let missingUsage = 0;
const resolvedModels = new Set<string>();
for (const row of liveRows) {
  const usage = row.prediction.primitives?.usage as { input_tokens?: number } | undefined;
  if (Number.isSafeInteger(usage?.input_tokens) && usage!.input_tokens! >= 0) inputTokens += usage!.input_tokens!;
  else missingUsage++;
  const resolved = row.prediction.primitives?.model;
  if (typeof resolved === 'string') resolvedModels.add(resolved);
}
const usageSummary = { pricingSource: 'user-provided', pricing, reportedInputTokens: inputTokens, estimatedUsdForReportedUsage: inputCost(inputTokens), responsesMissingUsage: missingUsage, resolvedModels: [...resolvedModels] };
const path = `${base}.json`;
await writeFile(path, JSON.stringify({ ...report, usageSummary }, null, 2) + '\n');
const lines = ['# Dice experiment report', '', `Generated: ${report.generatedAt}. Live JEV: ${live}. Repetitions: ${repetitions}.`, '',
  `Reported input tokens: ${inputTokens}. Estimated cost for reported usage: $${inputCost(inputTokens).toFixed(6)}. Responses missing usage: ${missingUsage}. Pricing: user-provided $42/billion input, free output.`, '',
  'Each payout offer is crossed with four matched histories. Win probability stays 0.5; EV follows the offer. Noul-implied EV assumes uniform probabilities within the winning faces.', '',
  '| Model | Scenario | Repeat | P(win) | True EV | Implied EV | EV choice | Advantage score |',
  '|---|---|---:|---:|---:|---:|---|---:|'];
for (const evaluation of report.evaluations) {
  for (const row of evaluation.results) {
    const answers = row.prediction.primitives?.answers as Record<string, Record<string, unknown>> | undefined;
    lines.push(`| ${evaluation.model} | ${row.scenario} | ${row.repetition + 1} | ${row.prediction.winProbability.toFixed(3)} | ${row.truth.expectedNet.toFixed(3)} | ${row.prediction.expectedNet.toFixed(3)} | ${answers?.ev_class?.choice ?? '—'} | ${answers?.advantage?.score ?? '—'} |`);
  }
}
lines.push('', 'These are descriptive synthetic experiments, not a test of trading profitability. Inspect raw distributions and repeated outputs before attributing differences to gambler’s fallacy. Logical output on these examples does not prove general logical reasoning.');
await writeFile(`${base}.md`, lines.join('\n') + '\n');
for (const evaluation of report.evaluations) {
  console.log(`${evaluation.model}: next-win probability spread = ${evaluation.probabilitySpread}`);
  console.table(evaluation.means);
}
console.log(`Full report: ${path}`);
console.log(`Readable report: ${base}.md`);
console.log(usageSummary);
} catch (error) {
  await appendFile(`${base}-errors.jsonl`, JSON.stringify({ at: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) }) + '\n');
  throw error;
} finally {
  await lock.close();
  const { unlink } = await import('node:fs/promises');
  await unlink(`${base}.lock`);
}
