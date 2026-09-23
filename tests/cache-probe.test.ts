import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cacheProbes, canonical } from '../src/lib/cache-probe.ts';
test('noise probe preserves game data and provides 63 paired requests', () => {
  const probes = cacheProbes('jev-1.13.0');
  assert.equal(probes.length, 63);
  assert.deepEqual(probes, cacheProbes('jev-1.13.0'));
  for (const probe of probes) {
    const baseline = probes.find(row => row.group === probe.group && row.method === 'exact')!;
    const body = JSON.parse(probe.body), base = JSON.parse(baseline.body);
    delete body.state.experimentMetadata;
    assert.deepEqual(body.state, base.state);
    if (probe.method === 'header-nonce') assert.equal(probe.body, baseline.body);
    if (probe.method === 'json-whitespace') assert.equal(canonical(body), canonical(base));
    if (probe.method === 'question-id-nonce') assert.deepEqual(Object.fromEntries(Object.entries(body.questions).map(([key, value]) => [probe.keyMap[key], value])), base.questions);
  }
});
test('canonical comparison ignores object order but preserves arrays and values', () => {
  assert.equal(canonical({ b: 2, a: 1 }), canonical({ a: 1, b: 2 }));
  assert.notEqual(canonical([1, 2]), canonical([2, 1]));
});
