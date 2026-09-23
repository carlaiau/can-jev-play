import { seededRandom, settle } from './dice.ts';
import { shuffle } from './pilot.ts';
import { scenarios } from './scenarios.ts';
import { explicitPayoutState } from './payout-format.ts';
import { questions, parseAnswers } from './typesafe.ts';

export const actionQuestions = {
  ...questions,
  action: {
    type: 'choice',
    instructions: 'Which available action maximizes expected bankroll immediately after this single decision, under the stated risk-neutral objective?',
    criteria: {
      bet: 'Place the offered fixed-stake bet once and receive the payout for the next die face.',
      skip: 'Do not place the bet; keep the current bankroll unchanged.',
    },
  },
};

export function historyActionPlan(negative = false, seed = 20260929) {
  const random = seededRandom(seed);
  const trials = [];
  for (let block = 0; block < 6; block++) {
    const length = block < 3 ? 30 : 60;
    const ev = [1, 3, 5][block % 3] * (negative ? -1 : 1);
    const source = structuredClone(scenarios[0].state);
    source.stake = 100;
    source.bankroll = 10000;
    source.history = [];
    source.rules.grossReturnByFace = [0, 0, 0, 190, 200, 210 + ev * 6];
    const base = {
      ...explicitPayoutState(source),
      objective: 'Maximize expected bankroll immediately after ONE decision: bet the fixed 100-unit stake once, or skip and keep 10000. The agent is risk-neutral. There is no utility penalty for variance, no longer-term target, and no further decisions.',
    };
    const conditions: { returns: string; ending: string; state: Record<string, unknown> }[] = [{ returns: 'none', ending: 'none', state: { ...base, history: undefined } }];
    for (const returns of ['gain', 'flat', 'loss']) {
      const wins = length * (returns === 'gain' ? 0.6 : returns === 'loss' ? 0.4 : 0.5);
      const highs = shuffle(Array.from({ length: wins }, (_, i) => 4 + i % 3), random);
      const lows = shuffle(Array.from({ length: length - wins }, (_, i) => 1 + i % 3), random);
      for (const ending of ['mixed', 'win-streak', 'loss-streak']) {
        const tailWins = ending === 'win-streak' ? 6 : ending === 'loss-streak' ? 0 : 3;
        const tailLosses = 6 - tailWins;
        const tail = ending === 'mixed' ? lows.slice(0, 3).flatMap((face, i) => [face, highs[i]]) : [...highs.slice(0, tailWins), ...lows.slice(0, tailLosses)];
        const values = [...shuffle([...highs.slice(tailWins), ...lows.slice(tailLosses)], random), ...tail];
        const net = (2 * wins - length) * 100;
        const startingBankroll = 10000 - net;
        let bankroll = startingBankroll;
        const history = values.map(face => { const row = settle(bankroll, 100, 'high', face); bankroll = row.bankroll; return row; });
        if (bankroll !== 10000) throw new Error('Historical accounting mismatch');
        conditions.push({ returns, ending, state: { ...base, history,
          historicalSummary: { rolls: length, wins, losses: length - wins, startingBankroll, endingBankroll: bankroll, totalNetProfit: net,
            netReturnPercent: 100 * net / startingBankroll, lastSixNetProfit: tail.reduce((sum, face) => sum + (face >= 4 ? 100 : -100), 0),
            payoutNote: 'Historical bets all had a 100-unit stake and fair gross payout of 200 on faces 4, 5, 6; zero on faces 1, 2, 3. The next offer is the payout table above.' },
        } });
      }
    }
    for (const condition of conditions) for (const format of ['table-only', 'supplied-ev']) for (let repeat = 0; repeat < 3; repeat++) {
      const caseId = `${negative ? 'negative-' : ''}block-${block + 1}-${condition.returns}-${condition.ending}`;
      trials.push({ id: `${caseId}-${format}-${repeat}`, caseId, block: block + 1, length, ev, returns: condition.returns, ending: condition.ending, format, repeat,
        state: format === 'table-only' ? condition.state : { ...condition.state,
          calculatedExpectedNetProfit: { value: ev, units: 'bankroll units per next bet',
            calculation: `(-100 + -100 + -100 + 90 + 100 + ${110 + ev * 6}) / 6 = ${ev}`,
            note: 'This is net profit after deducting the stake once. Skipping has expected net profit zero.' },
        },
      });
    }
  }
  return shuffle(trials, seededRandom(20260930));
}
export type ActionTrial = ReturnType<typeof historyActionPlan>[number];
export type ActionResult = Omit<ActionTrial, 'state'> & { action: string; betWeight: number; evChoice: string; pWin: number; response: Record<string, unknown>; elapsedMs: number };
export function parseAction(raw: unknown) {
  const parsed = parseAnswers(raw);
  const answers = parsed.response.answers as Record<string, Record<string, unknown>>;
  const action = answers.action;
  if (!action || action.type !== 'choice' || !['bet', 'skip'].includes(String(action.choice))) throw new Error('Invalid action choice');
  const probabilities = action.probabilities as Record<string, number>;
  if (!probabilities || !['bet', 'skip'].every(key => typeof probabilities[key] === 'number' && Number.isFinite(probabilities[key]) && probabilities[key] >= 0 && probabilities[key] <= 1) || Math.abs(probabilities.bet + probabilities.skip - 1) > 0.02) throw new Error('Invalid action distribution');
  return { response: parsed.response, action: String(action.choice), betWeight: probabilities.bet, evChoice: String(answers.ev_class.choice), pWin: parsed.winProbability };
}
export function summarizeActions(results: ActionResult[]) {
  const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
  return ['table-only', 'supplied-ev'].map(format => {
    const rows = results.filter(row => row.format === format);
    const cells = [...new Set(rows.map(row => `${row.returns}/${row.ending}`))].sort().map(condition => {
      const subset = rows.filter(row => `${row.returns}/${row.ending}` === condition);
      return { condition, calls: subset.length, skips: subset.filter(row => row.action === 'skip').length,
        evNotPositive: subset.filter(row => row.evChoice !== 'positive').length,
        meanBetWeight: mean(subset.map(row => row.betWeight)), meanPWin: mean(subset.map(row => row.pWin)) };
    });
    const contrasts = cells.filter(cell => cell.condition !== 'none/none').map(cell => {
      const perBlock = Array.from({ length: 6 }, (_, i) => {
        const treated = rows.filter(row => row.block === i + 1 && `${row.returns}/${row.ending}` === cell.condition);
        const control = rows.filter(row => row.block === i + 1 && row.returns === 'none');
        return { block: i + 1, skipRateDifference: mean(treated.map(row => +(row.action === 'skip'))) - mean(control.map(row => +(row.action === 'skip'))),
          betWeightDifference: mean(treated.map(row => row.betWeight)) - mean(control.map(row => row.betWeight)) };
      });
      return { condition: cell.condition, meanSkipRateDifference: mean(perBlock.map(row => row.skipRateDifference)), meanBetWeightDifference: mean(perBlock.map(row => row.betWeightDifference)), perBlock };
    });
    const varyingCases = [...new Set(rows.map(row => row.caseId))].filter(id => new Set(rows.filter(row => row.caseId === id).map(row => row.action)).size > 1).length;
    const unanimousControlBlocks = Array.from({ length: 6 }, (_, i) => i + 1).filter(block => rows.filter(row => row.block === block && row.returns === 'none').every(row => row.action === 'bet'));
    const blocksWithRejectionAfterUnanimousControl = unanimousControlBlocks.filter(block => rows.some(row => row.block === block && row.returns !== 'none' && row.action === 'skip'));
    const byHistoricalReturns = ['none', 'gain', 'flat', 'loss'].map(returns => {
      const subset = rows.filter(row => row.returns === returns);
      return { returns, calls: subset.length, skips: subset.filter(row => row.action === 'skip').length, meanBetWeight: mean(subset.map(row => row.betWeight)), meanPWin: mean(subset.map(row => row.pWin)) };
    });
    return { format, calls: rows.length, skips: rows.filter(row => row.action === 'skip').length, varyingCases, unanimousControlBlocks, blocksWithRejectionAfterUnanimousControl, byHistoricalReturns, cells, contrasts };
  });
}
