import {choiceThresholdMetrics} from '../src/lib/binary-action.ts';
import { noulThresholdMetrics } from '../src/lib/noul-action.ts';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { historyMetrics, selectExperimentRows, expectedBenchmarkRows, type HistoryStudy, type HistoryGroup } from '../src/lib/history-experiment.ts';
const read = (name:string) => JSON.parse(readFileSync(`src/data/${name}.json`,'utf8'));
const choice:HistoryStudy=read('history-study'), noul:HistoryStudy=read('noul-study');
const profit=(s:HistoryStudy)=>Number(s.rows.reduce((n,r)=>n+(r.decisions.table.action==='bet'?r.ev:0),0).toFixed(2));
const home={...read('recorded-study').studies,thresholds:read('face-study').thresholds,binary:read('structured-study').summary,findings:{...read('history-control-summary'),noul:{choiceThresholds:choiceThresholdMetrics(choice.rows),optimalExpectedProfit:Number(choice.rows.reduce((sum,r)=>sum+Math.max(0,r.ev),0).toFixed(2)),thresholds:noulThresholdMetrics(noul.rows),provenance:noul.provenance,metrics:historyMetrics(noul.rows),expectedProfit:profit(noul),choiceExpectedProfit:profit(choice)},current:{provenance:choice.provenance,interleaved:choice.rows.every(r=>r.id.startsWith('interleaved-v2-')),metrics:historyMetrics(choice.rows)}}};
mkdirSync('src/data/generated',{recursive:true});
writeFileSync('src/data/generated/home.json',JSON.stringify(home));
const version=createHash('sha256').update(readFileSync('scripts/precompute-experiments.ts')).update(JSON.stringify([choice,noul])).digest('hex').slice(0,16);
const base=`public/experiments/${version}`;
rmSync('public/experiments',{recursive:true,force:true});
mkdirSync(base,{recursive:true});
writeFileSync('src/data/generated/manifest.json',JSON.stringify({base:`/experiments/${version}`}));
for(const [primitive,study] of Object.entries({choice,noul})) {
 const dir=`${base}/${primitive}`;mkdirSync(`${dir}/results`,{recursive:true});
 const keys=new Map(study.rows.map((r,i)=>[r.id,String(i)]));
 if(keys.size!==study.rows.length)throw Error('Duplicate trial IDs');
 for(const r of study.rows)writeFileSync(`${dir}/results/${keys.get(r.id)}.json`,JSON.stringify(r));
 const counts=[1,5,15].flatMap(m=>['all','mixed','wins','losses','no-history'].map(s=>{const r=study.rows.filter(r=>r.magnitude===m&&(s==='all'||r.scenario===s));return {magnitude:m,scenario:s,calls:r.length,tableCorrect:r.filter(r=>(r.decisions.table.action==='bet')===(r.ev>0)).length,calculatedCorrect:r.filter(r=>r.decisions.calculated&&(r.decisions.calculated.action==='bet')===(r.ev>0)).length};}));
 for(const magnitude of [1,5,15])for(const scenario of ['all','mixed','wins','losses','no-history'] as HistoryGroup[]) {
  const rows=selectExperimentRows(study.rows,magnitude,scenario),curves=[{number:0,table:0,optimal:0},...expectedBenchmarkRows(rows)];
  const summary={provenance:study.provenance,interleaved:rows.every(r=>r.id.startsWith('interleaved-v2-')),counts,metrics:historyMetrics(study.rows.filter(r=>r.magnitude===magnitude)),curves,rows:rows.map(r=>({number:r.number,scenario:r.scenario,ev:r.ev,decisions:{table:{action:r.decisions.table.action}},detailUrl:`/experiments/${version}/${primitive}/results/${keys.get(r.id)}.json`})),exportUrl:`/experiments/${version}/${primitive}/${magnitude}-${scenario}-export.json`};
  writeFileSync(`${dir}/${magnitude}-${scenario}.json`,JSON.stringify(summary));
  writeFileSync(`${dir}/${magnitude}-${scenario}-export.json`,JSON.stringify({provenance:study.provenance,primitive,decisionRule:primitive==='noul'?'Bet iff noul > 0.5; otherwise Skip':'Use recorded Choice action',magnitude,scenario,metric:'Cumulative expected dollar profit, fixed $100 bets; skips add zero',rows:rows.map(({decisions,...row})=>({...row,decisions:{table:decisions.table},optimalAction:row.ev>0?'bet':'skip'})),curves,benchmark:'Bet on positive EV; otherwise Skip. Mathematical benchmark, not a Jev response.'}));
 }
}
console.log(`Precomputed experiment assets: ${base}`);
