import assert from 'node:assert/strict';

const base = process.env.LAB_TEST_URL || 'http://127.0.0.1:3000';
async function post(body) {
  const response = await fetch(`${base}/api/lab`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return { status: response.status, ...await response.json() };
}
const created = await post({ action: 'create', config: { mode: 'recorded', ev: 1, returns: 'loss', ending: 'loss-streak' } });
assert.equal(created.status, 200);
const id = created.session.id;
assert.equal((await post({ action: 'roll', id, round: 1 })).status, 400);
const evaluated = await post({ action: 'evaluate', id, round: 1 });
assert.equal(evaluated.status, 200);
assert.equal(evaluated.session.round.face, undefined);
assert.ok(evaluated.session.round.decidedAt);
assert.ok(evaluated.session.round.judgments.table.sourceId);
assert.equal(evaluated.session.round.requests.table.state.calculatedExpectedNetProfit, undefined);
assert.equal(evaluated.session.round.requests.calculated.state.calculatedExpectedNetProfit.value, 1);
assert.equal(evaluated.estimatedCost, 0);
const rolled = await post({ action: 'roll', id, round: 1 });
assert.equal(rolled.status, 200);
assert.ok(rolled.session.round.face >= 1 && rolled.session.round.face <= 6);
assert.equal(rolled.session.ledger.length, 1);
const repeated = await post({ action: 'roll', id, round: 1 });
assert.deepEqual(repeated.session, rolled.session);
assert.deepEqual((await post({ action: 'load', id })).session, rolled.session);
assert.equal((await post({ action: 'next', id, round: 1 })).session.round.number, 2);
assert.equal((await post({ action: 'roll', id, round: 1 })).status, 400);
console.log('Recorded API flow passed: ordered decisions, shared roll, idempotency, recovery, stale-round rejection.');

for (const ev of [-1, -3, -5]) {
  const created = await post({ action: 'create', config: { mode: 'recorded', ev, returns: 'loss', ending: 'loss-streak' } });
  assert.equal(created.status, 200);
  const id = created.session.id;
  const evaluated = await post({ action: 'evaluate', id, round: 1 });
  assert.equal(evaluated.status, 200);
  assert.equal(evaluated.session.round.requests.calculated.state.calculatedExpectedNetProfit.value, ev);
  assert.equal(evaluated.session.round.gross.reduce((a, b) => a + b, 0) / 6 - 100, ev);
  const rolled = await post({ action: 'roll', id, round: 1 });
  for (const arm of ['table', 'calculated']) {
    assert.equal(rolled.session.round.returns[arm], evaluated.session.round.judgments[arm].action === 'skip' ? 0 : rolled.session.round.net);
  }
}
console.log('Negative EV replay and action-based settlement passed for all three offers.');
const mixed = await post({ action: 'create', config: { mode: 'recorded', ev: 'mixed', returns: 'loss', ending: 'loss-streak' } });
assert.equal(mixed.status, 200);
const mixedId = mixed.session.id;
const observed = [];
for (let round = 1; round <= 6; round++) {
  const response = await post({ action: 'evaluate', id: mixedId, round });
  assert.equal(response.status, 200);
  const current = response.session.round;
  observed.push(current.ev);
  assert.equal(current.requests.calculated.state.calculatedExpectedNetProfit.value, current.ev);
  assert.equal(current.judgments.table.score, undefined);
  assert.deepEqual(Object.keys(current.requests.table.questions), ['action']);
  assert.deepEqual(Object.keys(current.requests.calculated.questions), ['action']);
  assert.deepEqual(Object.keys(current.judgments.table.raw.answers), ['action']);
  assert.equal(current.judgments.table.betWeight, undefined);
  const rolled = await post({ action: 'roll', id: mixedId, round });
  assert.equal(rolled.status, 200);
  if (round < 6) assert.equal((await post({ action: 'next', id: mixedId, round })).status, 200);
}
assert.deepEqual([...observed].sort((a,b)=>a-b), [-5,-3,-1,1,3,5]);
console.log('Mixed replay presents every EV once per block with exact matching model inputs.');
// New recordings must use exactly the state shown, including payout placement.
const { readFile } = await import('node:fs/promises');
const finalMixed = (await post({ action: 'load', id: mixedId })).session;
const sample = finalMixed.ledger[0];
const manifest = JSON.parse(await readFile(`${sample.judgments.table.sourceRun}-manifest.json`, 'utf8'));
for (const arm of ['table','calculated']) {
 const trial = manifest.trials.find(t=>t.id===sample.judgments[arm].sourceId);
 assert.deepEqual(sample.requests[arm].state,trial.state);
}
const actualGross = sample.state.rules.payoutTable.split('\n').slice(2).map(row=>Number(row.split('|')[4].trim()));
assert.deepEqual(sample.gross,actualGross);
console.log('Displayed randomized payout, request and recorded source trial match exactly.');
for (const row of finalMixed.ledger) for (const arm of ['table','calculated']) {
 const state = row.requests[arm].state;
 assert.equal(state.history,undefined);
 assert.equal(state.historicalSummary,undefined);
 assert.equal(state.historyIsSynthetic,undefined);
 assert.equal(JSON.stringify(state).toLowerCase().includes('histor'),false);
}
console.log('Both experimental API inputs contain only the current offer, never historical context.');
