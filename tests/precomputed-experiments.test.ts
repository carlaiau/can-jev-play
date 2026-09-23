import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { historyMetrics, selectExperimentRows, expectedBenchmarkRows, type HistoryStudy, type HistoryGroup } from '../src/lib/history-experiment.ts';
import { noulThresholdMetrics } from '../src/lib/noul-action.ts';
const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const manifest=read('src/data/generated/manifest.json');
for(const primitive of ['choice','noul'])test(`${primitive}: summaries, graph ordering, exports, and result links match source data`,()=>{
 const source:HistoryStudy=read(`src/data/${primitive==='choice'?'history':'noul'}-study.json`);
 for(const magnitude of [1,5,15])for(const scenario of ['all','mixed','wins','losses','no-history'] as HistoryGroup[]){
  const summary=read(`public${manifest.base}/${primitive}/${magnitude}-${scenario}.json`);
  const expected=selectExperimentRows(source.rows,magnitude,scenario);
  assert.equal(summary.rows.length,expected.length);
  assert.deepEqual(summary.curves,JSON.parse(JSON.stringify([{number:0,table:0,optimal:0},...expectedBenchmarkRows(expected)])));
  assert.deepEqual(summary.metrics,historyMetrics(source.rows.filter(r=>r.magnitude===magnitude)));
  assert.ok(!JSON.stringify(summary).includes('"request":'));
  assert.ok(!JSON.stringify(summary).includes('"response":'));
  for(const i of [0,Math.floor(expected.length/2),expected.length-1]){
   const detail=read(`public${summary.rows[i].detailUrl}`),row=expected[i];
   assert.equal(detail.id,row.id);
   assert.equal(detail.scenario,row.scenario);
   assert.deepEqual(detail.decisions,row.decisions);
   assert.equal(summary.rows[i].number,row.number);
  }
  const exported=read(`public${summary.exportUrl}`);
  assert.equal(exported.rows.length,expected.length);
  assert.deepEqual(exported.curves,summary.curves);
 }
});
test('homepage metrics and threshold analysis match the complete source studies',()=>{
 const home=read('src/data/generated/home.json');
 const choice:HistoryStudy=read('src/data/history-study.json'),noul:HistoryStudy=read('src/data/noul-study.json');
 assert.deepEqual(home.findings.current.metrics,historyMetrics(choice.rows));
 assert.deepEqual(home.findings.noul.metrics,historyMetrics(noul.rows));
 assert.deepEqual(home.findings.noul.thresholds,noulThresholdMetrics(noul.rows));
 assert.ok(readFileSync('src/data/generated/home.json').length<100_000);
});
