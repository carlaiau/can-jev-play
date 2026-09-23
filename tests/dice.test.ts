import { test } from 'node:test';
import assert from 'node:assert/strict';
import { faces, rollDie, settle, simulate } from '../src/lib/dice.ts';
import type { Bet } from '../src/lib/dice.ts';
import { evaluate, logicalBaseline, recencyControl, scenarios, oracle } from '../src/lib/scenarios.ts';
import { POST } from '../app/api/simulate/route.ts';

test('every supported bet has exactly zero expected net profit over six faces', () => {
  for (const bet of Object.keys(faces) as Bet[]) {
    const results = Array.from({ length: 6 }, (_, i) => settle(100, 5, bet, i + 1));
    assert.equal(results.reduce((sum, result) => sum + result.net, 0), 0);
  }
});
test('payout includes stake return; losses deduct only the stake', () => {
  assert.equal(settle(100, 5, 'six', 6).bankroll, 125);
  assert.equal(settle(100, 5, 'high', 4).bankroll, 105);
  assert.equal(settle(100, 5, 'high', 1).bankroll, 95);
});
test('rejects invalid bets, stakes, faces, overflow and random samples', () => {
  assert.throws(() => settle(10, 11, 'high', 4));
  assert.throws(() => settle(10, 0.5, 'high', 4));
  assert.throws(() => settle(10, 1, 'high', 7));
  assert.throws(() => settle(10, 1, 'toString' as Bet, 4));
  assert.throws(() => settle(Number.MAX_SAFE_INTEGER, 1, 'six', 6));
  assert.throws(() => rollDie(() => 1));
});
test('die rejects excess values before mapping to a face', () => {
  const samples = [4294967295 / 4294967296, 5 / 4294967296];
  assert.equal(rollDie(() => samples.shift()!), 6);
});
const config = { seed: 42, bankroll: 100, stake: 5, bet: 'high' as const, rounds: 100, window: 12 };
test('simulation is repeatable and rolling window is the full history suffix', () => {
  const small = simulate(config);
  const full = simulate({ ...config, window: 100 });
  assert.deepEqual(small, simulate(config));
  assert.deepEqual(small.history, full.history.slice(-12));
  assert.equal(small.bankroll, full.bankroll);
});
test('simulation stops before an unaffordable bet', () => {
  const result = simulate({ ...config, bankroll: 4 });
  assert.equal(result.played, 0);
  assert.equal(result.bankroll, 4);
  assert.equal(result.stopped, true);
});
test('scenarios control bankroll, exposure, face counts and number of wins', () => {
  const reference = scenarios[0].state;
  for (const { state } of scenarios) {
    assert.equal(state.bankroll, reference.bankroll);
    assert.equal(state.stake, reference.stake);
    assert.deepEqual(state.history.map(r => r.face).sort(), reference.history.map(r => r.face).sort());
    assert.equal(state.history.filter(r => r.won).length, 6);
  }
});
test('harness distinguishes logical invariance from recency sensitivity', async () => {
  const baseline = await evaluate(logicalBaseline, 2);
  const biased = await evaluate(recencyControl, 2);
  assert.equal(baseline.probabilitySpread, 0);
  assert.ok(baseline.results.every(r => r.probabilityError === 0 && r.expectedNetError === 0));
  assert.equal(biased.probabilitySpread, 1);
  assert.equal(baseline.results.length, 24);
});
test('face-specific payout offers have the intended EV and exact settlement', () => {
  for (const { state } of scenarios) {
    const net = Array.from({ length: 6 }, (_, i) => settle(state.bankroll, state.stake, 'high', i + 1, state.rules.grossReturnByFace).net);
    assert.equal(net.reduce((a, b) => a + b, 0) / 6, oracle(state).expectedNet);
  }
  assert.equal(oracle(scenarios[4].state).expectedNet, 1 / 6);
  assert.equal(oracle(scenarios[8].state).expectedNet, -1 / 6);
  assert.throws(() => settle(100, 5, 'high', 4, [0, 0, 0]));
});
test('API returns reproducible results and rejects malformed input', async () => {
  const response = await POST(new Request('http://localhost/api/simulate', { method: 'POST', body: JSON.stringify(config) }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), simulate(config));
  assert.equal((await POST(new Request('http://localhost/api/simulate', { method: 'POST', body: '{}' }))).status, 400);
});
