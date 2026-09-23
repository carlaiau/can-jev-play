import {test} from 'node:test';
import assert from 'node:assert/strict';
import {historyPlan,historyRequest,cumulativeExpectedRows,type ExperimentRow} from '../src/lib/history-experiment.ts';
test('history treatments use matched offers and six independent past outcomes without stake or bankroll',()=>{
 const plan=historyPlan();assert.equal(plan.length,270);
 for(const t of plan){assert.equal(t.history.length,6);assert.equal(t.history.filter(r=>r.outcome==='win').length,t.scenario==='wins'?6:t.scenario==='losses'?0:3);assert.ok(Math.abs(t.gross.reduce((s,g)=>s+g-100,0)/6-t.ev)<1e-8);assert.ok(Math.abs(t.ev)<=t.magnitude);const req=historyRequest(t,'table');assert.doesNotMatch(JSON.stringify(req),/stake|bankroll/i);assert.equal('calculatedExpectedNetProfit' in req.state,false);assert.ok(Math.abs(historyRequest(t,'calculated').state.calculatedExpectedNetProfit!.value-t.ev)<1e-8);const peers=plan.filter(p=>p.magnitude===t.magnitude&&p.number===t.number);assert.equal(peers.length,3);for(const p of peers)assert.deepEqual(p.gross,t.gross);}
 for(const magnitude of [1,5,15]){const offers=plan.filter(t=>t.magnitude===magnitude&&t.scenario==='mixed');assert.equal(offers.filter(t=>t.ev>0).length,15);assert.equal(offers.filter(t=>t.ev<0).length,15);}
});
test('expected-profit curves add offer EV only for bets and ignore realized outcomes',()=>{
 const rows=[{number:1,ev:5,face:1,decisions:{table:{action:'bet'},calculated:{action:'skip'}}},{number:2,ev:-3,face:6,decisions:{table:{action:'bet'},calculated:{action:'skip'}}},{number:3,ev:1,face:2,decisions:{table:{action:'skip'},calculated:{action:'bet'}}}] as ExperimentRow[];
 assert.deepEqual(cumulativeExpectedRows(rows),[{number:1,table:5,calculated:0},{number:2,table:2,calculated:0},{number:3,table:2,calculated:1}]);
});

test('1000-roll study has 9000 matched offers and balanced signs per condition',()=>{
 const plan=historyPlan(1000);assert.equal(plan.length,9000);
 for(const magnitude of [1,5,15])for(const scenario of ['mixed','wins','losses']){
  const rows=plan.filter(r=>r.magnitude===magnitude&&r.scenario===scenario);
  assert.equal(rows.length,1000);assert.equal(rows.filter(r=>r.ev>0).length,500);assert.equal(rows.filter(r=>r.ev<0).length,500);
  assert.deepEqual(rows.map(r=>r.number),Array.from({length:1000},(_,i)=>i+1));
 }
 for(let i=0;i<plan.length;i+=3){assert.deepEqual(plan[i].gross,plan[i+1].gross);assert.deepEqual(plan[i].gross,plan[i+2].gross);assert.equal(plan[i].ev,plan[i+2].ev);}
 assert.equal(new Set(plan.map(r=>r.id)).size,9000);
});

test('All history group preserves every original trial and sums the three strategy curves',async()=>{
 const {selectExperimentRows}=await import('../src/lib/history-experiment.ts');
 const fixtures=historyPlan().filter(r=>r.magnitude===5&&r.number<=2).map(r=>({...r,face:1,decisions:{table:{action:r.scenario==='wins'?'skip':'bet'},calculated:{action:r.ev>0?'bet':'skip'}}})) as ExperimentRow[];
 const combined=selectExperimentRows(fixtures,5,'all');
 assert.equal(combined.length,6);assert.deepEqual(combined.map(r=>r.number),[1,2,3,4,5,6]);assert.deepEqual(combined.map(r=>r.sourceNumber),[1,1,1,2,2,2]);assert.equal(new Set(combined.map(r=>r.id)).size,6);
 const sum={table:0,calculated:0};for(const group of ['mixed','wins','losses'] as const){const c=cumulativeExpectedRows(selectExperimentRows(fixtures,5,group)).at(-1)!;sum.table+=c.table;sum.calculated+=c.calculated;}
 const last=cumulativeExpectedRows(combined).at(-1)!;assert.equal(last.table,sum.table);assert.equal(last.calculated,sum.calculated);
 assert.equal(selectExperimentRows(fixtures,15,'all').length,0);
});

test('optimal EV benchmark ignores model decisions and realized dice outcomes',async()=>{
 const {expectedBenchmarkRows}=await import('../src/lib/history-experiment.ts');
 const rows=[{number:1,ev:-3,face:6,decisions:{table:{action:'bet'},calculated:{action:'bet'}}},{number:2,ev:5,face:1,decisions:{table:{action:'skip'},calculated:{action:'skip'}}}] as ExperimentRow[];
 assert.deepEqual(expectedBenchmarkRows(rows),[{number:1,table:-3,optimal:0},{number:2,table:-3,optimal:5}]);
});

test('interleaved replication uses unique matched offers and all four conditions',async()=>{
 const {interleavedPlan,historyMetrics}=await import('../src/lib/history-experiment.ts');
 const rows=interleavedPlan(1000);
 assert.equal(rows.length,12000);
 const seen=new Set();
 for(let i=0;i<rows.length;i+=4){
  const block=rows.slice(i,i+4);
  assert.equal(new Set(block.map(r=>r.scenario)).size,4);
  const key=JSON.stringify(block[0].gross);assert.ok(!seen.has(key));seen.add(key);
  for(const r of block){assert.deepEqual(r.gross,block[0].gross);assert.ok(Math.abs(r.gross.reduce((s,v)=>s+v,0)/6-100-r.ev)<1e-8);assert.equal('recentRolls' in r.state,r.scenario!=='no-history');}
 }
 for(const magnitude of [1,5,15])for(const scenario of ['mixed','wins','losses','no-history'])assert.equal(rows.filter(r=>r.magnitude===magnitude&&r.scenario===scenario&&r.ev>0).length,500);
 assert.deepEqual(interleavedPlan(2),interleavedPlan(2));
});

test('history metrics distinguish profitable bets from avoided losses',async()=>{
 const {historyMetrics}=await import('../src/lib/history-experiment.ts');
 const trial=historyPlan(1)[0];
 const rows=[{...trial,ev:1,face:1,decisions:{table:{action:'bet' as const,request:{},response:{}}}},{...trial,ev:-1,face:1,decisions:{table:{action:'bet' as const,request:{},response:{}}}}];
 const mixed=historyMetrics(rows).find(r=>r.scenario==='mixed')!;
 assert.equal(mixed.bets,2);assert.equal(mixed.positive,1);assert.equal(mixed.correctBet,1);assert.equal(mixed.negative,1);assert.equal(mixed.correctSkip,0);
});
