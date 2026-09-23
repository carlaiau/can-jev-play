# JEV Dice Lab

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

## Current-offer-only inputs
JEV receives no historical rolls, historical summaries or synthetic-history flags. Retain displayed history as explicitly display-only. Only current bankroll, stake, payout rules, objective, optional supplied EV and the binary Bet/Skip question are sent. Recorded responses must come from this exact history-free request contract.
