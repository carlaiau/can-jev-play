import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAnswers, questions, typesafeModel } from '../src/lib/typesafe.ts';
import { scenarios } from '../src/lib/scenarios.ts';

const fixture = {
  model: 'jev-test', answers: {
    next_win: { type: 'noul', noul: 0.5 },
    ev_class: { type: 'choice', choice: 'zero', confidence: 1, probabilities: { negative: 0, zero: 1, positive: 0 } },
    advantage: { type: 'score', score: 1, confidence: 1, probabilities: { '0': 0, '1': 1, '2': 0 }, legend: { '0': 'negative', '1': 'zero', '2': 'positive' } },
  }, usage: { input_tokens: 100, output_tokens: 30 },
};
test('adapter uses documented request shapes and preserves raw primitives and model version', async () => {
  const transport: typeof fetch = async (url, init) => {
    assert.equal(url, 'https://api.typesafe.ai/v1/systemone');
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer test-key');
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(body.questions, questions);
    assert.deepEqual(body.state, scenarios[0].state);
    assert.equal(body.model, 'jev-test');
    return Response.json(fixture);
  };
  const prediction = await typesafeModel('test-key', 'jev-test', transport).predict(scenarios[0].state);
  assert.equal(prediction.winProbability, 0.5);
  assert.equal(prediction.expectedNet, 0);
  assert.deepEqual(prediction.primitives, fixture);
});
test('adapter rejects missing credentials, failed requests and malformed answers', async () => {
  assert.throws(() => typesafeModel(''));
  await assert.rejects(typesafeModel('test', 'test', async () => new Response('', { status: 401 })).predict(scenarios[0].state), /401/);
  assert.throws(() => parseAnswers({}));
  const malformed = structuredClone(fixture);
  malformed.answers.next_win.noul = 2;
  assert.throws(() => parseAnswers(malformed));
});
