import { mkdir, open, unlink, readFile, writeFile, appendFile } from 'node:fs/promises';
import { actionQuestions, historyActionPlan, parseAction, summarizeActions } from '../src/lib/history-action.ts';
import type { ActionResult } from '../src/lib/history-action.ts';
import { hash } from '../src/lib/cache-probe.ts';
import { randomizedFacePlan } from '../src/lib/randomized-faces.ts';
import { analyzeThresholds } from '../src/lib/score-threshold.ts';
import { shuffle } from '../src/lib/pilot.ts';
import { seededRandom } from '../src/lib/dice.ts';
import { pricing, contextProxy, inputCost } from '../src/lib/usage.ts';

const key = process.env.TYPESAFE_API_KEY ?? '';
if (!key.trim()) throw new Error('TYPESAFE_API_KEY required');
const model = 'jev-1.13.0';
const negative = process.argv.includes('--negative');
const randomized = process.argv.includes('--randomized');
const mixed = process.argv.includes('--mixed') || randomized;
if (mixed && negative) throw new Error('Choose --mixed or --negative, not both');
const trials = randomized ? randomizedFacePlan() : mixed ? shuffle([...historyActionPlan(false, 20261007), ...historyActionPlan(true, 20261007)], seededRandom(20261008)) : historyActionPlan(negative);
const resume = process.argv.find(arg => arg.startsWith('--resume='))?.slice(9);
const name = resume ?? `history-action-${randomized ? 'faces-' : mixed ? 'mixed-' : negative ? 'negative-' : ''}${Date.now()}`;
if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error('Invalid run name');
const base = `reports/${name}`;
const plan = { version: 1, model, pricing, questions: actionQuestions, trials,
  analysis: '360 calls: 6 blocks x (3 historical return levels x 3 terminal patterns + no-history control) x 2 EV disclosure conditions x 3 identical repeats. Fixed 10000 current bankroll, stake100, independent uniform next roll, risk-neutral one-decision objective. EV +1/+3/+5 crossed with history length30/60. Primary: skip rate versus no-history in matched blocks, separated by disclosure. Secondary: action distribution, EV classification, Noul, repeat variation. A skip is objective-inconsistent here; not a real-world risk preference judgment. No significance claims. No persuasive framing or fabricated predictions are supplied.' };
if (negative) plan.analysis = plan.analysis.replace('EV +1/+3/+5', 'EV -1/-3/-5').replace('A skip is objective-inconsistent here', 'A bet is objective-inconsistent here');
if (mixed) plan.analysis = '720 calls in seeded interleaved order: EV -5/-3/-1/+1/+3/+5, history lengths30/60, 9 history conditions and no-history, two formats, three repeats. Fresh history seed20261007. Threshold analysis separately by format: tune Score cutoff (bet if Score >= cutoff) on length30, freeze then evaluate on length60. Keep all repeats, matched signs and formats of a scenario in the same split. Optimize mean true expected net profit per offered decision, ties prefer higher cutoff. Compare direct action, always bet, never bet and EV oracle. No cutoff is selected using held-out outputs. Holdout tests different history lengths, not unseen EV magnitudes or general trading performance. No significance claims.';
if (randomized) plan.analysis += ' Randomized-face variant: fresh history seed20261011. Gross payouts are permuted over die faces for each scenario and repetition, matched across EV signs and disclosure formats. The three repetitions vary permutations rather than repeat exact inputs. Historical payouts remain as stated in the historical summary. No-history controls are excluded from cutoff analysis. Prior fixed-face cutoff results do not apply to these new inputs.';
const fingerprint = hash(JSON.stringify(plan));
if (trials.some(trial => contextProxy({ model, state: trial.state, questions: actionQuestions }) > 32000)) throw new Error('Context preflight failed');
await mkdir('reports', { recursive: true });
const lock = await open(`${base}.lock`, 'wx');
try {
const results: ActionResult[] = [];
if (resume) {
  if (JSON.parse(await readFile(`${base}-manifest.json`, 'utf8')).fingerprint !== fingerprint) throw new Error('Resume mismatch');
  let log = '';
  try { log = await readFile(`${base}.jsonl`, 'utf8'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  results.push(...log.split('\n').filter(Boolean).map(line => JSON.parse(line)));
} else await writeFile(`${base}-manifest.json`, JSON.stringify({ ...plan, fingerprint, at: new Date().toISOString() }, null, 2));
console.log(`Run ${base}; ${results.length}/${trials.length} complete`);
for (const trial of trials) {
  if (results.some(row => row.id === trial.id)) continue;
  const body = JSON.stringify({ model, state: trial.state, questions: actionQuestions });
  await appendFile(`${base}-requests.jsonl`, JSON.stringify({ id: trial.id, at: new Date().toISOString(), body }) + '\n');
  const start = performance.now();
  const response = await fetch('https://api.typesafe.ai/v1/systemone', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(30000) });
  const raw = await response.text();
  const elapsedMs = Math.round(performance.now() - start);
  await appendFile(`${base}-responses.jsonl`, JSON.stringify({ id: trial.id, status: response.status, elapsedMs, requestId: response.headers.get('x-typesafe-request-id'), raw }) + '\n');
  if (!response.ok) throw new Error(`HTTP ${response.status}; response saved`);
  const parsed = parseAction(JSON.parse(raw));
  if (parsed.response.model !== model) throw new Error('Model version mismatch');
  const { state, ...metadata } = trial;
  const result = { ...metadata, ...parsed, elapsedMs };
  await appendFile(`${base}.jsonl`, JSON.stringify(result) + '\n');
  results.push(result);
  if (results.length % 30 === 0) console.log(`${results.length}/${trials.length} complete`);
}
const summary = summarizeActions(results);
let tokens = 0, missingUsage = 0;
for (const row of results) {
  const usage = row.response.usage as { input_tokens?: number } | undefined;
  if (Number.isSafeInteger(usage?.input_tokens) && usage!.input_tokens! >= 0) tokens += usage!.input_tokens!; else missingUsage++;
}
const attempts = (await readFile(`${base}-requests.jsonl`, 'utf8')).split('\n').filter(Boolean).length;
const cost = { inputTokens: tokens, estimatedUsd: inputCost(tokens), missingUsage, attempts, attemptsWithoutResult: attempts - results.length, pricing };
await writeFile(`${base}.json`, JSON.stringify({ summary, cost, results, ...(mixed ? { thresholds: analyzeThresholds(results) } : {}) }, null, 2));
const lines = ['# Historical returns and positive-EV actions', '', `Model ${model}. 360 responses, six matched blocks, three repetitions per input.`, '',
  `Total skip decisions: **${summary.reduce((sum, arm) => sum + arm.skips, 0)}/360**. All offers are positive EV; there are no negative-EV action controls in this experiment. Thus selecting bet everywhere cannot distinguish correct opportunity evaluation from a general preference to bet.`, '',
  '| EV disclosure | History return / ending | Skip decisions | Non-positive EV classifications | Mean weight on bet | Mean P(win) |', '|---|---|---:|---:|---:|---:|',
  ...summary.flatMap(arm => arm.cells.map(cell => `| ${arm.format} | ${cell.condition} | ${cell.skips}/${cell.calls} | ${cell.evNotPositive}/${cell.calls} | ${cell.meanBetWeight.toFixed(3)} | ${cell.meanPWin.toFixed(3)} |`)), '',
  '## Probability estimates by historical return', '',
  'The true next-bet win probability is 50% in every condition. These averages pool terminal patterns; each historical-return condition covers the same six blocks.', '',
  '| Disclosure | Historical return | Calls | Mean estimated P(win) | Mean weight on bet |', '|---|---|---:|---:|---:|',
  ...summary.flatMap(arm => arm.byHistoricalReturns.map(row => `| ${arm.format} | ${row.returns} | ${row.calls} | ${(100 * row.meanPWin).toFixed(2)}% | ${(100 * row.meanBetWeight).toFixed(2)}% |`)), '',
  '## Matched differences against no-history controls', '',
  '| Disclosure | History | Skip-rate difference (pp) | Bet-weight difference (pp) |', '|---|---|---:|---:|',
  ...summary.flatMap(arm => arm.contrasts.map(row => `| ${arm.format} | ${row.condition} | ${(100 * row.meanSkipRateDifference).toFixed(2)} | ${(100 * row.meanBetWeightDifference).toFixed(2)} |`)), '',
  ...summary.map(arm => `${arm.format}: ${arm.varyingCases}/60 exact inputs changed selected action across repeats. ${arm.unanimousControlBlocks.length}/6 blocks always chose bet without history; ${arm.blocksWithRejectionAfterUnanimousControl.length} of those blocks had at least one skip when history was added.`), '',
  '## Design', '',
  'Every upcoming offer has EV +1, +3 or +5 per 100-unit stake. Current bankroll is always 10000. The explicit objective maximizes expected bankroll after one decision, with risk neutrality and no variance penalty. Bet is therefore the reference action; skip gives zero EV. This objective prevents legitimate risk aversion or different horizons from being misclassified as an error.', '',
  'Within each block, six terminal wins, six terminal losses, or a mixed six-roll ending are crossed with total historical gains, flat returns, or losses. Gains use 60% historical wins, flat uses 50%, losses 40%; historical wagers were fair. History lengths are 30/60. Starting bankroll varies to keep current bankroll fixed. Historical accounting and a factual summary are shown. No-history controls omit history. All future die faces remain independent and uniform. Table-only and supplied-EV conditions differ only by a calculated EV field. Questions also request EV category, Noul and Score.', '',
  '## Interpretation', '',
  'A change in selected action differs from a change in its probability distribution. Bet weight is classification weight, not an independently validated probability of financial success. Exact repeats measure output variability. Compare skip rates against matched no-history controls before attributing rejections to historical outcomes. History versus no-history also changes input length; contrasts among historical return/ending conditions help, but do not fully eliminate representation confounds. Different historical totals necessarily change face frequencies and starting bankroll. Neutral framing does not directly instruct gambler’s fallacy.', '',
  'There are six matched blocks, not 360 independent units. Results are exploratory and do not establish general trading ability, causation by gambler’s fallacy, or absence of effects beyond these conditions. Higher estimated win probabilities after gains than after losses resemble extrapolation of historical frequencies; classic gambler’s fallacy instead predicts that a reversal is due. Neither mechanism can be diagnosed from a category label alone. No real stakes were placed. Full raw requests/responses and the pre-run manifest are preserved.', '',
  `Input tokens: ${tokens}; estimated cost: $${cost.estimatedUsd.toFixed(6)} under user-provided pricing. Missing usage: ${missingUsage}. Attempts without recorded result: ${cost.attemptsWithoutResult}; their potential charges are not included.` ];
const negativeLines = ['# Negative-EV action controls', '', `Model ${model}. ${results.length} responses across six matched blocks, three repeats per input.`, '', 'Offers have EV -1, -3 or -5 per 100-unit stake. Skip is the correct action under the explicit risk-neutral one-decision objective. Historical outcomes and questions match the earlier positive-EV study; the future payout is changed. Runs occurred separately, so sign comparisons also differ in run time.', '', '| Disclosure | EV | Skips | Bets |', '|---|---:|---:|---:|', ...summary.flatMap(arm => [-1,-3,-5].map(ev => { const rows = results.filter(r => r.format === arm.format && r.ev === ev); const skips = rows.filter(r => r.action === 'skip').length; return `| ${arm.format} | ${ev} | ${skips}/${rows.length} | ${rows.length-skips}/${rows.length} |`; })), '', 'Exact repeats are not independent observations. These results test selected actions separately from classification weights and estimated win probabilities. They do not establish trading performance or a causal gambler-fallacy mechanism.', '', `Input tokens: ${tokens}; estimated cost: $${cost.estimatedUsd.toFixed(6)}. Attempts without result: ${cost.attemptsWithoutResult}.`, '', 'Full trial plan and raw requests/responses are preserved beside this report.'];
await writeFile(`${base}.md`, (mixed ? ['# Mixed-EV Score threshold experiment', '', plan.analysis, '', '```json', JSON.stringify(analyzeThresholds(results), null, 2), '```', '', `Input tokens: ${tokens}; estimated cost: $${cost.estimatedUsd.toFixed(6)}`] : negative ? negativeLines : lines).join('\n') + '\n');
console.log(JSON.stringify({ summary: summary.map(({ contrasts, ...arm }) => arm), cost, report: `${base}.md` }, null, 2));
} catch (error) {
  await appendFile(`${base}-errors.jsonl`, JSON.stringify({ at: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) }) + '\n');
  throw error;
} finally { await lock.close(); await unlink(`${base}.lock`); }
