# JEV Dice Lab

A Next.js app with Catalyst UI components for exploring recorded TypeSafe JEV decisions and optionally running live comparisons.

## Web app

```sh
npm install
npm run dev
```

Open http://localhost:3000. Recorded mode works without a key. To enable live mode, set `TYPESAFE_API_KEY` in `.env.local` and restart the server. Credentials stay on the server.

Choose the future offer and historical returns/streak, then start a session. Review the payout table and click Roll once. The app saves both JEV judgments, generates a shared fair die outcome, displays it for two seconds, and automatically prepares the next offer. One condition receives the payout table; the other also receives calculated net EV. Inspect exact inputs and raw outputs, follow the round ledger, and export the session as JSON. The Study results view includes the earlier positive/zero/negative EV classification comparison.

Recorded mode uses real responses bundled in `src/data/recorded-study.json`, sourced from the saved positive- and negative-EV history/action studies (360 calls each). Each round uses the selected independent 30-roll historical scenario and fixed 10,000-unit starting bankroll; its three recorded repetitions cycle. New simulated outcomes accumulate in the displayed returns, but are **not** fed into later model inputs. Replaying a response is not a new model observation. Live mode evaluates the same matched scenario afresh with two calls per round.

Sessions persist locally in `reports/web/`; live requests and responses are logged there without authorization headers. The browser remembers the last session ID. This is a local research app: filesystem persistence and the unauthenticated live endpoint need deployment-specific storage, access controls and spending limits before public hosting.

```sh
npm test
npm run typecheck
npm run build
# With the web server running:
node scripts/lab-smoke.mjs
```

The API smoke test checks decision-before-roll ordering, recorded replay, idempotent settlement, saved-session recovery and stale-round rejection. It does not make live API calls.

## Matched pilot

```sh
node --env-file-if-exists=.env --env-file-if-exists=.env.local --experimental-strip-types scripts/pilot.ts
```

Runs 100 unique states in 25 matched groups, using a fixed reproducible pilot seed. Each group includes a shuffled neutral history, alternating history, winning streak and losing streak. Request order is seeded and shuffled across groups. There are 9 fair-offer groups, 8 positive-EV groups and 8 negative-EV groups. The three history lengths are 24, 60 and 120; edge magnitudes vary. All three primitives are requested together. The first response resolves the model version; remaining requests pin that version.

The runner saves its design and analysis plan before requesting results, logs raw requests and responses (without authorization headers), checkpoints parsed results, and produces JSON and Markdown summaries. Resume an interrupted run with `--resume=pilot-EXISTING_TIMESTAMP`. A successful recorded response is reused, rather than counted again. Inputs are unique but this does not guarantee provider cache misses. Keep the pilot separate from the main study; use fresh scenario seeds for the latter. No live stakes or trading decisions are executed.

## Cache and irrelevant-noise probe

```sh
node --env-file-if-exists=.env --env-file-if-exists=.env.local --experimental-strip-types scripts/cache-probe.ts
```

Makes 126 calls on pinned `jev-1.13.0`: seven methods × three game states × three variants × two identical replays. Methods are exact control, random header, renamed question IDs, JSON whitespace, state nonce, 256-character state noise and instruction nonce. Pair order is seeded and randomized. Responses are normalized to restore question IDs and ignore object-key order before comparison. Full bodies and diagnostic headers are logged without credentials. Resume with `--resume=cache-probe-EXISTING_TIMESTAMP`.

This tests sensitivity to noise and observable caching behavior; it does not assume an undocumented bypass works. Output equality, timing, request IDs and billed usage cannot individually establish whether inference was cached. Model-visible noise changes the experimental input and must not be used to inflate the main study's independent sample count.

## Payout representation comparison

```sh
node --env-file-if-exists=.env --env-file-if-exists=.env.local --experimental-strip-types scripts/payout-format.ts
```

Runs 216 calls: 9 matched groups × 4 histories × 2 formats × 3 exact repeats. Compares the original payout array with a table containing each face's probability, stake, gross payout and net profit, plus an explicit instruction to deduct the stake exactly once. Aggregate EV is not supplied. Histories use a fresh seed; the questions stay unchanged. EV classes and history lengths are balanced. Nonzero offers have +/-1-unit EV on a 100-unit stake. Model is pinned to `jev-1.13.0`; trials are interleaved in seeded random order.

Reports distinguish selected-category accuracy from probability/score error and repeated-input category changes. This is exploratory prompt development with 9 matched groups, not 216 independent observations. Requests, raw responses and the pre-run plan are saved. Resume with `--resume=payout-format-EXISTING_TIMESTAMP`.

## Supplied-EV diagnostic

```sh
node --env-file-if-exists=.env --env-file-if-exists=.env.local --experimental-strip-types scripts/payout-format.ts --supplied-ev
```

Makes 216 calls comparing the explicit payout table alone with the identical state plus a calculated expected net profit field. The supplied EV is -1, 0 or +1 bankroll units per next bet, with its arithmetic and a note that the stake has already been deducted. No category label is supplied. This intentionally tests classification of a known result, not independent EV calculation. Questions remain unchanged. It uses fresh history/order seeds, balanced EV classes, four history patterns, and three exact repeats per condition. Resume using both `--supplied-ev` and `--resume=supplied-ev-EXISTING_TIMESTAMP`.

## Historical returns and future actions

```sh
node --env-file-if-exists=.env --env-file-if-exists=.env.local --experimental-strip-types scripts/history-action.ts
```

Runs 360 calls: six blocks × ten history conditions × two EV-disclosure conditions × three repeats. Every upcoming offer is positive EV (+1, +3 or +5 on a 100-unit stake); each edge appears with 30- and 60-roll histories. The ten conditions are gains/flat/losses crossed with winning/losing/mixed six-roll endings, plus no history. Current bankroll remains 10000; historical starting bankroll adjusts to maintain consistent accounting. Histories have fair payouts and summaries of actual net returns. The offered payout table is fixed within a block.

Adds an explicit bet/skip Choice under a risk-neutral, single-decision expected-bankroll objective. Reports selected actions separately from action distribution weights, compares history with matched no-history controls, and measures repeat variability. Table-only and precomputed-EV arms distinguish calculation from use of known EV. No manipulative narrative or predicted future streak is supplied. This is exploratory across six blocks; it cannot by itself establish gambler's fallacy. Resume with `--resume=history-action-EXISTING_TIMESTAMP`.

Use Node 24+. Install dependencies with `npm install`, then:

```sh
npm test
npm run scenarios
npm run typecheck
npm run build
```

Offline scenarios require no API key. They save timestamped JSON in `reports/`, including states, prompts, outputs, and probability errors. The mathematical baseline must show zero history sensitivity; the deliberately recency-biased control must show a nonzero spread.

## Live JEV experiments

Copy `.env.example` to `.env.local` and set `TYPESAFE_API_KEY`. Keep this credential server-side. Set `TYPESAFE_MODEL` to a pinned model version for comparisons across dates, or use `jev-latest` for exploration. Reports retain the resolved model version and usage returned by the service.

```sh
node --env-file=.env.local --experimental-strip-types scripts/scenarios.ts --live --repetitions=5
```

This makes 60 requests (twelve scenarios × five repetitions), each containing three questions. Live calls incur provider usage. Missing credentials and failed requests stop the run; the harness never substitutes mock answers for a live result. A manifest records the experiment setup before calls begin. Every completed result is appended to JSONL immediately, preserving partial runs. Full JSON and readable Markdown reports are written when all calls succeed.

The integration follows the [API](https://docs.typesafe.ai/api), [Noul](https://docs.typesafe.ai/primitives/noul), [Choice](https://docs.typesafe.ai/primitives/choice), and [Score](https://docs.typesafe.ai/primitives/score) documentation:

- Noul asks whether the next bet wins. Reference value: 0.5 for every offer. Its implied EV assumes equal probability among winning faces; this is not a separate model estimate of each face probability.
- Choice classifies EV as negative, zero, or positive. Reference category follows the payout offer.
- Score rates mathematical advantage on three descriptive levels. Reference position: 0 for negative EV, 1 for zero EV, 2 for positive EV. Retain the distribution: a mean of 1 can also come from uncertainty between the two extremes.

Only Noul currently receives aggregate error/spread metrics. Choice and Score answers, distributions, and confidence are retained in each raw result for inspection. Their values are not interchangeable with event probabilities.

## Experimental design

The four synthetic histories have the same twelve faces, six wins, six losses, stake of 5, starting bankroll of 100 and final bankroll of 100. Only ordering changes: alternating, recent winning streak, recent losing streak, or clusters. Each is crossed with three upcoming payout offers, giving twelve scenarios:

| Offer | Gross return on faces 1–6 | Expected net per 5-unit bet |
|---|---|---|
| Fair | 0, 0, 0, 10, 10, 10 | 0 |
| Positive EV | 0, 0, 0, 9, 10, 12 | +1/6 |
| Negative EV | 0, 0, 0, 8, 10, 11 | −1/6 |

History used fair payouts; the adjusted schedule explicitly applies only to the upcoming bet. This keeps historical bankroll paths fixed across offer conditions. Scenario names/descriptions and oracle answers are not sent to the model. Every call is independent; repetition order alternates. The rules explicitly state independent uniform rolls. This tests reasoning under known fairness, not inference about an unknown die.

History-sensitive outputs provide evidence of sensitivity in these prompts, not proof that the model is generally illogical. Repeated responses help measure variability but are not independent samples if the provider is deterministic or caches requests. This first suite is descriptive, with no significance test. Expand to more matched permutations, window lengths and prompt variants before making broad claims.

There is no uniquely optimal bankroll-building action without a target, horizon and risk preference. Therefore the first experiments test probability and EV beliefs, rather than labelling a stake recommendation irrational. Actual future outcomes are never provided to the model.

## Game mechanics

All amounts are integer play-money units. By default high/low/odd/even win on three faces and return 2× stake; six wins on one face and returns 6× stake. Net profit is gross return minus stake, so default expected net profit is exactly zero. Optional `grossReturnByFace` supplies six absolute integer gross returns for the configured stake (not multipliers), allowing deliberately nonzero EV experiments. Losing faces must return zero. Variance still permits losses and ruin; zero EV does not promise bankroll growth.

Seeded pseudorandom draws make simulations reproducible. Rejection sampling removes modulo bias when mapping uint32 samples to six faces. This is a simulation PRNG, not a cryptographic source. The simulator stops when the fixed stake is unaffordable and retains a configurable rolling history.

Run `npm run dev` for Next.js. `POST /api/simulate` accepts:

```json
{"seed":42,"bankroll":100,"stake":5,"bet":"high","rounds":100,"window":12}
```

Rounds are capped at 100,000 and the history window at 1,000. The HTTP route only simulates; live JEV calls are available through the script.

## Longer experiments

The runner records the user-provided assumptions of a 32,000-token context, $42 per billion input tokens and free output. At that rate, 32,000 input tokens cost $0.001344; 10,000 requests of that size cost $13.44. These are planning calculations, not independently verified billing guarantees.

```sh
node --env-file=.env.local --experimental-strip-types scripts/scenarios.ts --live --windows=12,60,240 --repetitions=100
```

This plans 3,600 live requests (three windows × twelve scenarios × 100 repetitions), plus offline controls. Requests run sequentially. Repetitions may range from 1 to 10,000. Window sizes must be distinct multiples of twelve, from 12 to 1,200, and must pass context preflight. Larger windows add a balanced alternating prefix while preserving each original twelve-roll suffix, so this isolates history length rather than streak length. Repetition alone does not create new independent evidence when outputs are deterministic.

Each request is checked with a conservative proxy: serialized UTF-8 bytes plus 2,048 for framing. This is not JEV tokenization and may reject requests that would fit. No history is silently truncated. Final reports total provider-reported input tokens, calculate estimated cost, flag missing usage, and list resolved model versions. Failed or unrecorded requests may still incur charges that this report cannot account for.

Resume with the same configuration and the printed report basename (without path or extension):

```sh
node --env-file=.env.local --experimental-strip-types scripts/scenarios.ts --live --windows=12,60,240 --repetitions=100 --resume=jev-EXISTING_TIMESTAMP
```

The manifest fingerprint checks prompts, states, repetitions, model alias and pricing. Completed model/scenario/repetition records are reused; only missing calls run. Errors are logged separately. A lock file prevents concurrent writers. After a forcibly killed process, verify it has exited before removing its stale `.lock` file. Malformed JSONL causes a visible error instead of silently discarding data. Keep code unchanged during a resumed run; the fingerprint is not a source-code hash. Pin a model version for long runs so a changing alias does not mix versions. Checkpointing cannot prevent a duplicate charge if the process dies after a provider completes a request but before its response is saved.

## Negative-EV action controls

```sh
node --env-file-if-exists=.env --env-file-if-exists=.env.local --experimental-strip-types scripts/history-action.ts --negative
```

Runs 360 calls with EV −1/−3/−5, mirroring the original positive-EV action study's exact histories, questions, conditions and repetitions. The objective is unchanged: maximize expected bankroll after one risk-neutral decision. Skip is the reference action. Requests, raw responses, a pre-run manifest, and the summary report are saved; use `--negative --resume=history-action-negative-TIMESTAMP` to continue an interrupted run. Positive and negative calls ran separately; repeated outputs are not independent samples.

The web app offers both positive and negative EV in recorded and live modes. Existing sessions keep their selected offer; choose **New session** to switch.

Latest negative-EV run: `reports/history-action-negative-1790120812245.md`. Table-only skips: 0/60 at −1 EV, 30/60 at −3 EV, 47/60 at −5 EV. Supplied-EV skips: 60/60 at each value. Total estimated input cost: $0.04233 under the supplied pricing.

## Mixed-EV experiment and Score cutoff

```sh
node --env-file-if-exists=.env --env-file-if-exists=.env.local --experimental-strip-types scripts/history-action.ts --mixed
node --experimental-strip-types scripts/analyze-mixed.ts history-action-mixed-TIMESTAMP
```

Runs 720 fresh calls with all six positive/negative EV values interleaved in one seeded random order. The analysis fits a JEV Score cutoff separately for each disclosure format on 30-roll histories and evaluates it on held-out 60-roll histories. No-history controls are excluded because their inputs duplicate across lengths. All repetitions of a scenario stay together. Each split has 162 responses per format; these are not 162 independent observations. Cutoffs maximize true expected profit per offered decision, with higher cutoffs breaking ties. The evaluation compares the frozen cutoff with JEV's direct action, always bet, never bet and the known-EV oracle. It does not optimize simulated winnings or use action weights.

The analysis command validates a complete run, saves its report and bundles authentic responses into `src/data/mixed-study.json`. Mixed web sessions shuffle all six offers within each six-round block, using these responses by default. Live mode offers the same mixture. This earlier multi-question study included JEV Score; its cutoff analysis is retained under Earlier studies. The current binary-only experiment does not request or use Score. Raw provider responses remain unchanged in logs/exports.

Latest mixed run: `reports/history-action-mixed-1790121250099.md`. A table-only cutoff of Score ≥ 1.51 improved held-out expected profit from +1.0123 (direct action) to +1.2593 units per offer, with 14 negative-EV bets and 13 missed positive offers among 162 held-out responses. The supplied-EV cutoff of 1.96 earned +1.4815 versus +1.5 for direct action, missing one positive offer. These fitted cutoffs are candidates, not universal rules; they are not applied to the displayed JEV actions. Cost: approximately $0.08464.


## Randomized payout faces and one-click rounds

```sh
node --env-file-if-exists=.env --env-file-if-exists=.env.local --experimental-strip-types scripts/history-action.ts --randomized
node --experimental-strip-types scripts/analyze-mixed.ts history-action-faces-TIMESTAMP
```

This separate 720-call study permutes the six future payouts over the faces while preserving the offer's EV and 50% win probability. Paired disclosure arms and EV signs share the same permutation. Three permutations replace the earlier three exact repetitions. Historical wins still use the explicitly documented old fair payout schedule. Exact new requests and responses are bundled in `src/data/face-study.json`; older studies remain intact. Existing pending offers keep their exact inputs, and subsequent offers use the randomized study. New cutoffs are fitted for this study rather than carrying over the fixed-face cutoff.

The Roll control sits above both decision columns. One click evaluates, reveals the roll and advances, with an in-flight guard against duplicate clicks. Server checks still require decisions before random outcome generation and make settlement idempotent. A failed step can be retried without duplicating successful settlement. The rolled payout row is highlighted until the next offer appears; every round remains in the exportable ledger, with expandable exact inputs and outputs. EV shown as a percentage is expected net profit divided by the stake, not win probability. Motion respects reduced-motion preferences.


## Current experiment: binary Bet / Skip only

```sh
node --env-file-if-exists=.env --env-file-if-exists=.env.local --experimental-strip-types scripts/binary-action.ts
```

The current game asks **only** the `action` choice question with `bet` and `skip` options. It does not request Score, EV class or a next-roll win forecast. Both information conditions use the same randomized payout table; the second also receives calculated EV as input. A new 360-call recording (`reports/binary-action-1790122317165`) is bundled in `src/data/binary-study.json`. The study uses all six EV values, thirty-roll histories, nine historical conditions plus a no-history control, and three payout permutations. New live calls use the same single-question contract.

Existing multi-question sessions remain saved in reports; the browser starts a fresh binary-only session rather than relabeling old responses. Earlier analysis remains in a collapsed archive in Study results. The main game shows Bet/Skip, percentage expected return, and session return only. The highlighted payout row reveals the roll. Inspect any completed log row for each condition's full request, raw response, recording source and decision/outcome timestamps. No Score threshold is applied.

After settlement, each condition displays **Correct EV action** or **Incorrect EV action**, based solely on the offered EV and Bet/Skip choice. The same verdict persists beside each action in the log and in exported action assessments. Winning or losing the realized roll never changes this verdict. Zero EV would label either action neutral.

## Autoplay and dollar performance

Roll and Autoplay sit above the full game grid. Autoplay completes at most 30 rounds, pauses after the current round, stops on a failed step, and does not resume automatically after reload. Manual play shares the same 30-round server cap. In live mode each new round makes the two binary JEV calls, with the existing retry/checkpoint behavior.

Displayed bankroll amounts are simulated dollars; original recorded request/response text stays intact. Each condition's completed ledger determines total amount staked (bets only), actual net, expected net (sum of EV for bets only), and expected return on stake = expected net / total staked × 100. No bets means the percentage is unavailable, not zero. Exports include these performance summaries.

## Current API input: no history

```sh
node --env-file-if-exists=.env --env-file-if-exists=.env.local --experimental-strip-types scripts/binary-action.ts --offer-only
```

The current request uses an allowlist of current rules/payouts, bankroll, stake and objective, plus calculated EV only in its disclosure arm. Historical rolls, historical summaries and synthetic-history flags are excluded. History in the interface is display-only. Fresh recordings are saved in `src/data/offer-only-study.json`; older recordings remain intact and are not relabeled as history-free. Source scenario IDs still identify payout variants, but their historical labels are not sent. Some stripped requests may coincide and should not be counted as independent scenarios.
