# Can Jev Play

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Next.js, TypeScript, Catalyst UI Kit. User confirmed recorded-first, live optional.

## Product Purpose
Let visitors inspect and replay controlled dice experiments comparing JEV judgments with a payout table versus the same table plus calculated EV. Show offers and decisions before revealing outcomes. Examine historical-return effects without claiming general trading performance.

## Capabilities and Constraints
Keep the TypeSafe credential server-side. Preserve raw requests and responses. Clearly distinguish recorded judgments, live judgments, and newly simulated rolls. Match offers and dice outcomes between conditions. Statistical studies and interactive session returns are different evidence.

## Evidence on Hand
Completed scripts and raw reports in reports/. Versioned replay data derived from those reports in src/data/recorded-study.json. No invented model responses. No real-money wagering.

## Product Principles
Reveal decisions before outcomes. Label provenance. Compare like with like. Keep selected actions separate from probabilities. No implication that a winning roll validates a judgment.

## Mixed offers and cutoff analysis
The default session mixes −5/−3/−1/+1/+3/+5 EV offers, shuffled within six-round blocks. JEV Score is displayed; action weight is omitted. A separate fresh, interleaved study fits Score cutoffs on 30-roll histories and evaluates them on 60-roll histories, excluding duplicated no-history controls. Report expected profit and decision errors without changing JEV's own displayed action or presenting fitted rules as trading validation.

## Current binary-only scope
Supersedes the earlier Score display/cutoff feature: ask only Bet or Skip. Payout-only and calculated-EV inputs remain paired. Earlier multi-question studies are archived. One Roll click performs decisions, highlights the rolled payout row, and advances automatically. Exact model inputs and outputs expand from completed experiment-log rows.

## Archived current-offer-only inputs
The preceding structured-v3 study sent no historical rolls, historical summaries or synthetic-history flags; its displayed history was display-only. This contract is archived and superseded for new sessions by Six-roll history experiments below. Only current payout rules, an independent-roll net-profit objective, optional supplied EV and the binary Bet/Skip question are sent. Stake and bankroll are not sent. Recorded responses must come from this exact history-free request contract.

## Structured payout contract
Current offers use a six-entry JSON payout array rather than a Markdown table. Each face specifies gross payout and net profit. The overall rules state that the die is fair and six-sided; no per-face probabilities are included. Both treatments share this structure; only one receives calculated EV. Fresh recordings must match this schema.

## Six-roll history experiments (current)
Supersedes current-offer-only inputs for new game sessions. Every request now includes six controlled recent outcomes, oldest first, under the historical offer's net ±$100 payout rule. Conditions are mixed (three wins, three losses), six wins, and six losses. The history is held fixed per condition; it is not formed from the new simulated outcomes. Stake and bankroll remain absent from model inputs. Questions remain binary Bet/Skip.

All sessions contain 30 mixed positive/negative EV offers. The selectable maximum absolute EV is 1%, 5%, or 15%; each uses six levels (±20%, ±60%, and ±100% of its maximum). Future offers/payout-face permutations are matched across the three histories. The experiment tab presents fresh real recordings for all nine combinations (540 calls), with matched simulated outcome faces generated only after decisions.

The chart adds expected dollar profit from each Bet; Skip contributes zero. Bet size stays $100. There is no reinvestment, bankroll growth, or realized outcome in these lines. Incorrect decisions have selectable markers. Table rows locate rounds on the chart and chart points select table rows; the inspector shows exact requests/responses and the EV cost relative to the correct Bet/Skip action. A 10-roll viewport permits panning; all 30 offers stay in the table.

## Live homepage and payload inspection
The homepage creates and restores only live JEV sessions. Saved studies remain on Experiments (and the earlier-study archive); there is no homepage response-source selector or automatic fallback to recorded results. Without a server credential, starting a live session is disabled. Live sessions use a separate browser persistence key.

Each A/B condition heading opens a Catalyst modal showing the payout fields of the current request. A shows rules/payouts; B additionally shows calculated expected net profit. Before evaluation this uses the same request builder as the server and is labeled not sent; after evaluation it reads the saved request. Opening snapshots the payload so autoplay cannot change it mid-inspection. Full request/response evidence remains in the ledger.

## Expanded recorded experiment
Recorded experiments now collect 1,000 rolls for each of nine magnitude/history combinations: 9,000 offers and 18,000 JEV calls across the two information strategies. Each condition has 500 positive- and 500 negative-EV offers; corresponding offers remain matched across histories. Original 30-roll reports remain preserved. The live homepage remains capped at 30 interactive rolls.

Charts derive limits and counts from the selected run, with 10-roll, 100-roll and full-run views. The API sends only one selected run's detailed payloads plus summary counts for the other scenarios. Collection is resumable, logs each attempt, retries transient errors with backoff, and publishes the new dataset atomically only after all responses are complete.

## Combined history view and Recharts
Experiments include an All history group: for the selected EV range, combine the existing 1,000 samples from each history into 3,000 samples. Order is original offer number, then mixed/wins/losses. Display sample numbers are 1–3,000; original trial IDs, history labels, source round and exact request/response pairs remain unchanged. Cumulative expected profit sums all selected samples and equals the sum of the three individual endpoint totals. This combines existing evidence without new model calls.

Recharts renders the two strategies as straight-segment line graphs at every zoom level, without dots or diamond markers. Hover gives action/correctness and cumulative EV; click selects a sample and its ledger row. Table verdict icons and the exact-payload inspector retain correctness evidence. Full-run views continue to hide the Earlier/Later slider controls.

## Payout-only versus optimal EV (current experiment reporting)
Experiments now compare payout-only JEV to a mathematical benchmark: add max(offer EV, 0) at each fixed-size decision. This replaces supplied-EV model performance in charts, summaries, tooltips, tables and experiment exports. Prior raw supplied-EV recordings remain preserved; the live homepage comparison is unchanged. Selected-roll details show the home page's shared die icons, six gross/net payouts and rolled-row highlight, alongside only the payout-only model request/response and action assessment.

## Core question and live payout-only scope
The homepage now makes one payout-only JEV call per roll, using study version payout-live-v1. Prior paired live sessions are archived on recovery rather than silently continued under a changed protocol. Recorded studies and raw supplied-EV control evidence remain intact. Findings & discussion reports data-derived control accuracy (9,000/9,000 in the current study), history-stratified payout-only results, and the distinction between using a supplied expected value and inferring it from payouts. Perfect tested action accuracy is not a guarantee for other prompts or market decisions; it does not assert unchanged probabilities.

## Matched no-history control
Experiments now include a no-history condition with 1,000 offers per EV range. These reuse the existing matched payout schedules and sampled outcome faces, omit recentRolls completely, and collect only payout-only JEV responses. All combines four conditions (4,000 samples per range). Historical supplied-EV responses remain archival; none are invented for the new control. Every row retains its own source run, so extending the dataset does not relabel old recordings.

The interleaved replication (`--interleaved`) evaluates 3,000 fresh, distinct payout tables (1,000 per EV range), with four adjacent condition requests per offer in seeded randomized order and shuffled offer blocks. Only payout-only Bet/Skip is requested. Each group has 500 positive and 500 negative offers per range. Historical supplied-EV results remain independently archived in `history-control-summary.json` and raw reports. Experiments and Findings separate overall bet rate, correct Bet on +EV, and correct Skip on −EV; denominators are explicit. The current comparison highlights the selected tab. Initial findings and replication are labeled separately. Explanations for no-history betting bias are hypotheses, not claims about internal reasoning.

Discussion reference: https://docs.typesafe.ai/model-jaggedness/jev-1.13#math-and-numbers (reviewed 2026-09-23). TypeSafe explicitly says Jev is not a calculator and recommends mathematical logic in code. Retain this attribution when discussing the experiments. Our thesis is that relying on Jev to infer a trading edge is poorly supported when it cannot reliably select positive-EV actions with exact payouts and probabilities fixed by a fair six-sided die. Describe this as our assessment, not proof that every Jev-assisted trading system fails. Probabilities are implied exactly by the fair-die rules, not individually supplied fields. Preserve the distinction between semantic classification and independently computed/validated numerical trading decisions.

## Brand and game scope
The product and repository name is Can Jev Play. Dice is the first game; further games will test decisions at differing levels of complexity. Use a combined die and playing-card mark for the app identity to represent the broader gaming scope. The current live navigation entry is Dice lab. No additional game is presented as available until implemented.

## Matched Noul experiment
A separate Noul batch reuses all 12,000 exact Choice states and history conditions. Its positive-EV proposition maps to Bet iff `noul > 0.5`, with ties skipped. Choice remains the live-lab and Findings baseline. Experiments adds a question-type selector; both datasets share the full-run chart and inspector. Collection timestamps differ and wording changes with the primitive, so this is a matched-input comparison rather than a simultaneous randomized primitive trial.
