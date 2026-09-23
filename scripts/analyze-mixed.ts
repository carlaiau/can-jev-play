import { readFile, writeFile } from 'node:fs/promises';
import { analyzeThresholds } from '../src/lib/score-threshold.ts';
import type { ActionResult } from '../src/lib/history-action.ts';

const name = process.argv[2];
if (!/^history-action-(mixed|faces)-\d+$/.test(name ?? '')) throw new Error('Usage: analyze-mixed.ts history-action-mixed-TIMESTAMP');
const randomized = name.includes('-faces-');
const base = `reports/${name}`;
const report = JSON.parse(await readFile(`${base}.json`, 'utf8'));
const manifest = JSON.parse(await readFile(`${base}-manifest.json`, 'utf8'));
const results = report.results as ActionResult[];
if (results.length !== 720 || new Set(results.map(r => r.id)).size !== 720) throw new Error('Expected 720 unique completed trials');
const thresholds = analyzeThresholds(results);
if (thresholds.some(r => r.calibration.calls !== 162 || r.heldOut.calls !== 162)) throw new Error('Unexpected scenario split');
report.thresholds = thresholds;
await writeFile(`${base}.json`, JSON.stringify(report, null, 2));
await writeFile(randomized ? 'src/data/face-study.json' : 'src/data/mixed-study.json', JSON.stringify({
  provenance: base, cases: manifest.trials.filter((t: ActionResult) => t.format === 'table-only' && (randomized || t.repeat === 0)), results, thresholds,
}));
const lines = ['# Mixed-EV Score threshold experiment', '',
  '720 fresh requests on jev-1.13.0, with six EV values (-5, -3, -1, +1, +3, +5) interleaved in seeded random order. Stake 100. Requests are independent: JEV does not receive earlier experimental trials. Both information formats, histories, and repeated inputs are interleaved.', '',
  '## Calibration and held-out evaluation', '',
  'Fit separately per information format on 30-roll histories; evaluate once on 60-roll histories. No-history controls are excluded because their inputs duplicate across lengths. Each split contains 162 responses per format: 6 EV levels × 9 historical conditions × 3 repeats. Repeats and matched inputs stay in the same split. These are 54 distinct scenarios per split, not 162 independent observations. The tested EV levels and historical condition categories occur in both splits; this is not validation on new markets or unseen EV magnitudes.', '',
  'Choose Score >= cutoff to maximize total true expected profit on calibration data. Candidate cutoffs are calibration Score values plus always-bet/never-bet boundaries. Ties prefer the higher cutoff. Roll outcomes and held-out responses are not used for cutoff selection. Score 0/1/2 means negative/neutral/positive assessed advantage. Raw Score is used; action weights are not used.', '',
  '| Information | Selected rule | Calibration EV/offer | Held-out EV/offer | JEV direct action EV/offer | Negative bets | Positive skips |',
  '|---|---|---:|---:|---:|---:|---:|',
  ...thresholds.map(a => `| ${a.format} | ${a.cutoff > 2 ? 'Always skip' : `Score >= ${a.cutoff}`} | ${a.calibration.meanExpectedNet.toFixed(4)} | ${a.heldOut.meanExpectedNet.toFixed(4)} | ${a.directAction.meanExpectedNet.toFixed(4)} | ${a.heldOut.negativeBets} | ${a.heldOut.positiveSkips} |`), '',
  'Always bet and never bet each earn 0 expected units per offered decision on this balanced sample. The known-EV oracle earns +1.5. Expected profit is calculated from the offer, not realized dice winnings. More selective betting can improve profit per placed bet while missing opportunities; the optimization here uses all offered decisions as the denominator.', '',
  '## Interpretation', '',
  'A calibrated cutoff is a candidate policy, not proof that a universal cutoff should be deployed. Compare its held-out expected profit with the direct action and oracle, and inspect negative bets and missed positive offers. Supplied-EV results test recognizing an already-computed advantage. Payout-only performance tests inferring that advantage. Do not interpret either as trading performance. There are no confidence or significance claims; repeats share scenarios, and the holdout changes history length.', '',
  `Estimated cost: $${report.cost.estimatedUsd.toFixed(6)} for ${report.cost.inputTokens} input tokens at the supplied pricing. Raw requests, responses and trial manifest are preserved.`, '',
  '## Held-out breakdown', '', '```json', JSON.stringify(thresholds, null, 2), '```'];
const reportText = lines.join('\n');
await writeFile(`${base}.md`, (randomized ? reportText.replace('Mixed-EV Score threshold experiment', 'Randomized payout-face Score threshold experiment').replace('3 repeats', '3 face permutations').replace('3 repeats', '3 face permutations').replace('These are 54 distinct scenarios per split, not 162 independent observations.', 'These are 54 base scenarios with three face permutations each, not 162 independent observations.').replace('No-history controls are excluded because their inputs duplicate across lengths.', 'No-history controls are excluded to keep calibration and evaluation on distinct historical scenarios.').replace('Repeats and matched inputs stay in the same split.', 'All face permutations and matched inputs of a base scenario stay in the same split.') + '\n\nPayout placement is randomized in the actual requests, matched across both disclosure arms and EV signs. Each of the three repetitions varies placement. The payout multiset and 50% win probability remain unchanged. Historical faces retain their explicitly documented historical payout schedule. This is a separate study from the earlier fixed-face experiments.\n' : reportText) + '\n');
console.log(JSON.stringify(thresholds, null, 2));
