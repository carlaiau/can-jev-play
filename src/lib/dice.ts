export type Bet = 'high' | 'low' | 'odd' | 'even' | 'six';
export type Roll = { face: number; won: boolean; stake: number; net: number; bankroll: number };
export const faces: Record<Bet, readonly number[]> = {
  high: [4, 5, 6], low: [1, 2, 3], odd: [1, 3, 5], even: [2, 4, 6], six: [6],
};

export function integer(value: number, name: string, min: number, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`Invalid ${name}`);
}

// Seeded PRNG for reproducible experiments; never use for real-money gambling.
export function seededRandom(seed: number): () => number {
  integer(seed, 'seed', 0, 0xffffffff);
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Reject the four excess uint32 values to avoid modulo bias for six faces.
export function rollDie(random: () => number): number {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const sample = random();
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) throw new Error('Invalid random sample');
    const value = Math.floor(sample * 4294967296);
    if (value < 4294967292) return (value % 6) + 1;
  }
  throw new Error('Random source repeatedly rejected');
}

export function payoutSchedule(stake: number, bet: Bet, custom?: readonly number[]): readonly number[] {
  if (!Object.hasOwn(faces, bet)) throw new Error('Invalid bet');
  const schedule = custom ?? Array.from({ length: 6 }, (_, i) => faces[bet].includes(i + 1) ? stake * 6 / faces[bet].length : 0);
  if (!Array.isArray(schedule) || schedule.length !== 6) throw new Error('Payout schedule needs six gross returns');
  for (let i = 0; i < 6; i++) {
    integer(schedule[i], 'gross return', 0);
    if (!faces[bet].includes(i + 1) && schedule[i] !== 0) throw new Error('Losing faces must return zero');
  }
  return schedule;
}

export function settle(bankroll: number, stake: number, bet: Bet, face: number, grossReturnByFace?: readonly number[]): Roll {
  integer(bankroll, 'bankroll', 0);
  integer(stake, 'stake', 1, bankroll);
  integer(face, 'face', 1, 6);
  if (!Object.hasOwn(faces, bet)) throw new Error('Invalid bet');
  const won = faces[bet].includes(face);
  const net = payoutSchedule(stake, bet, grossReturnByFace)[face - 1] - stake;
  integer(bankroll + net, 'resulting bankroll', 0);
  return { face, won, stake, net, bankroll: bankroll + net };
}

export type SimulationConfig = { seed: number; bankroll: number; stake: number; bet: Bet; rounds: number; window: number; grossReturnByFace?: number[] };
export function simulate(config: SimulationConfig) {
  integer(config.bankroll, 'bankroll', 0);
  integer(config.stake, 'stake', 1);
  integer(config.rounds, 'rounds', 0, 100000);
  integer(config.window, 'window', 1, 1000);
  if (!Object.hasOwn(faces, config.bet)) throw new Error('Invalid bet');
  payoutSchedule(config.stake, config.bet, config.grossReturnByFace);
  const random = seededRandom(config.seed);
  let bankroll = config.bankroll;
  const history: Roll[] = [];
  let played = 0;
  for (; played < config.rounds && bankroll >= config.stake; played++) {
    const result = settle(bankroll, config.stake, config.bet, rollDie(random), config.grossReturnByFace);
    bankroll = result.bankroll;
    history.push(result);
    if (history.length > config.window) history.shift();
  }
  return { config, bankroll, played, stopped: played < config.rounds, history };
}
