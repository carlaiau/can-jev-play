# Can Jev Play

**Can Jev find an edge—or does it follow luck?**

Can Jev Play tests AI decisions in games where the correct move is known. Dice is the first game: a fair six-sided die, exact payouts, and one choice—**Bet or Skip**. More games of differing complexity are planned.

Inspired by Jev trading demos, this project asks a simpler question first: if a model knows every possible payoff and its probability, can it reliably identify a profitable bet? A winning streak alone can be luck. Here, we assess the decision by its expected value (EV), independently of whether the roll wins.

![Can Jev Play: Jev’s cumulative expected profit compared with the optimal EV strategy across 4,000 decisions in the ±5% range](docs/images/can-jev-play.png)

## What we found

The latest experiment collected **12,000 decisions from 3,000 distinct payout tables** using `jev-1.13.0`. Each offer was evaluated under four conditions: mixed recent outcomes, six wins, six losses, and no history. Requests were interleaved, with identical upcoming payouts within each matched set.

| History supplied | Bet rate | Bet on +EV | Skip on −EV | Correct overall |
| --- | ---: | ---: | ---: | ---: |
| Mixed outcomes | 87.8% | 94.0% | 18.3% | 56.2% |
| Six wins | 61.7% | 71.1% | 47.7% | 59.4% |
| Six losses | 92.0% | 96.3% | 12.4% | 54.4% |
| No history | **96.0%** | 98.2% | **6.3%** | 52.2% |

Each row contains 3,000 decisions: 1,500 positive-EV offers and 1,500 negative-EV offers. “Bet on +EV” and “Skip on −EV” use those respective denominators; the other columns use all 3,000 decisions.

Jev often took profitable bets, but struggled to reject unprofitable ones. Without history, it bet on almost everything. Recent wins reduced its willingness to bet, even though the next roll was independent. All six paired comparisons of betting rates remained significant after Holm correction (exact McNemar tests; adjusted *p* < 0.001).

In a **separate supplied-EV control study**, adding the calculated expected net profit produced **9,000 correct actions out of 9,000** across three history conditions. That demonstrates using an explicit numerical answer; it does not establish reliable calculation from the payouts. This control was not repeated in the latest interleaved batch, and did not include no history.

### Why this matters

TypeSafe’s own [model jaggedness documentation](https://docs.typesafe.ai/model-jaggedness/jev-1.13#math-and-numbers) says “Jev is not a calculator.” Our results illustrate why that distinction matters: choosing an action from a supplied EV and inferring EV from exact payouts are different capabilities.

We think relying on Jev to infer a trading edge is poorly supported when it struggles with this fully specified task. These experiments do not test every trading system that uses Jev, or show that every profitable trading demo is a random walk. They do show why a profitable outcome is insufficient evidence of sound decisions.

The history pattern is consistent with a rebound expectation after losses or caution after wins, but binary choices cannot reveal the model’s reasoning. Significance establishes differences in these tested conditions, not their internal cause. Smaller effects and generalization need fresh offers and repeated batches; 12,000 responses are not 12,000 independent offers.

## Explore the app

- **Dice lab:** run live Bet/Skip decisions, manually or with autoplay, up to 30 rounds. Track betting rates, correct actions, realized returns, and expected returns.
- **Experiments:** compare the four history conditions across ±1%, ±5%, and ±15% EV ranges. Click the graph to inspect an offer, its payouts, and the exact model request and response.
- **Findings:** read the results, statistical comparisons, and interpretation.
- **Guide:** understand the game and experimental setup.

The charts sum **expected dollar profit from each chosen action**: Bet adds the offer’s EV; Skip adds zero. Bet size is fixed at a simulated $100. There is no bankroll compounding, and actual roll outcomes do not affect either line. The comparison line is a mathematical benchmark that bets only on positive EV—not another model response.

## Run locally

Use **Node.js 24+** and npm.

```sh
git clone https://github.com/carlaiau/can-jev-play.git
cd can-jev-play
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). Bundled experiment results are available without an API key.

For live decisions, copy `.env.example` to `.env.local`, add your TypeSafe API key, and restart the server:

```sh
cp .env.example .env.local
```

Live rounds make one model request each and incur provider usage. Credentials remain server-side. Session files are stored locally in `reports/web/`; this is a local research app. Public deployment needs access controls, spending limits, and suitable persistent storage for the live endpoint.

## Reproduce the experiment

The current design uses 1,000 offers per EV range, each evaluated under all four history conditions: **3 ranges × 1,000 offers × 4 conditions = 12,000 decisions**. Each condition has equal numbers of positive- and negative-EV offers.

The prompt provides structured JSON payouts and states that the die is fair, six-sided, and independent. It asks only Bet or Skip. It does not ask for a win forecast, EV classification, or score, and it does not include bankroll or stake fields. History conditions supply a controlled six-roll window; the no-history condition omits it entirely. These histories are experimental inputs, not the live session’s preceding outcomes.

To collect a fresh batch with your API key:

```sh
node --env-file=.env.local --experimental-strip-types scripts/history-experiment.ts \
  --interleaved --rolls=1000 --concurrency=12
```

This makes paid API calls. The runner saves its plan, checkpoints responses, and publishes the completed dataset atomically. Resume an interrupted batch with the same flags plus `--resume=reports/history-window-TIMESTAMP`.

To recompute the paired statistical comparisons from the bundled dataset, without API calls:

```sh
mkdir -p reports
python3 scripts/history-significance.py
```

The analysis matches offers across conditions, checks duplicate payout inputs, and applies Holm correction across the six betting-rate and six correctness comparisons. Its output is saved to `reports/history-significance.json`.

### Data and implementation

- [`src/data/history-study.json`](src/data/history-study.json): latest experiment records, including requests and responses. Source batch: `history-window-1790134749957`.
- [`src/data/history-control-summary.json`](src/data/history-control-summary.json): separate supplied-EV control summary. Source batch: `history-window-1790131933133`.
- [`src/lib/history-experiment.ts`](src/lib/history-experiment.ts): offer generation, matching, metrics, and EV benchmark.
- [`scripts/history-experiment.ts`](scripts/history-experiment.ts): collection and resume workflow.
- [`scripts/history-significance.py`](scripts/history-significance.py): paired statistical analysis.

The app uses Next.js, React, TypeScript, and Recharts. Additional scripts and datasets retain earlier exploratory work; the results above refer to the latest interleaved batch unless explicitly labeled as the separate control.

```sh
npm test
npm run typecheck
npm run build
```
