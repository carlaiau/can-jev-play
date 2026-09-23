import { readFile,writeFile,appendFile,mkdir,rename,open,unlink } from 'node:fs/promises';
import { randomInt } from 'node:crypto';
import { historyPlan,interleavedPlan,historyRequest,type Arm,type HistoryStudy,type ExperimentDecision } from '../src/lib/history-experiment.ts';
import { parseBinaryAction } from '../src/lib/binary-action.ts';
const key=process.env.TYPESAFE_API_KEY;if(!key)throw new Error('TYPESAFE_API_KEY required');
const count=Number(process.argv.find(a=>a.startsWith('--rolls='))?.slice(8)??1000);
const concurrency=Number(process.argv.find(a=>a.startsWith('--concurrency='))?.slice(14)??12);
if(!Number.isInteger(concurrency)||concurrency<1||concurrency>24)throw Error('Invalid concurrency');
const base=process.argv.find(a=>a.startsWith('--resume='))?.slice(9)??`reports/history-window-${Date.now()}`;
if(!/^reports\/history-window-\d+$/.test(base))throw new Error('Invalid run path');
await mkdir('reports',{recursive:true});
const lock=await open(`${base}.lock`,'wx');
try {
 const interleaved=process.argv.includes('--interleaved');
 const noHistory=process.argv.includes('--no-history');
 const prior=noHistory?JSON.parse(await readFile('src/data/history-study.json','utf8')) as HistoryStudy:undefined;
 const plan=noHistory?prior!.rows.filter(r=>r.scenario==='mixed').map(r=>{const {recentRolls,...state}=r.state;return {id:`no-history-${r.magnitude}-${r.number}`,magnitude:r.magnitude,number:r.number,scenario:'no-history' as const,ev:r.ev,gross:r.gross,history:[],state};}):interleaved?interleavedPlan(count):historyPlan(count);
 const requestedArms:Arm[]=noHistory||interleaved?['table']:['table','calculated'];
 const manifest={plan,questions:historyRequest(plan[0],'table').questions};
 type Saved={id:string;arm:Arm;decision:ExperimentDecision};
 const saved=new Map<string,Saved>();
 if(process.argv.some(a=>a.startsWith('--resume='))){if(JSON.stringify(JSON.parse(await readFile(`${base}-manifest.json`,'utf8')))!==JSON.stringify(manifest))throw new Error('Resume mismatch');for(const line of (await readFile(`${base}.jsonl`,'utf8')).split('\n').filter(Boolean)){const r=JSON.parse(line) as Saved;saved.set(`${r.id}-${r.arm}`,r);}}else {await writeFile(`${base}-manifest.json`,JSON.stringify(manifest));await writeFile(`${base}.jsonl`,'');}
 console.log(base);console.log(`${saved.size}/${plan.length*requestedArms.length} responses; ${count} rolls per condition; concurrency ${concurrency}`);
 let writes=Promise.resolve();
 const log=(suffix:string,data:unknown)=>{writes=writes.then(()=>appendFile(`${base}${suffix}`,JSON.stringify(data)+'\n'));return writes;};
 const jobs=plan.flatMap(trial=>requestedArms.map(arm=>({trial,arm}))).filter(({trial,arm})=>!saved.has(`${trial.id}-${arm}`));
 let next=0,failed:unknown;
 async function worker(){while(!failed){const job=jobs[next++];if(!job)return;const {trial,arm}=job;const request=historyRequest(trial,arm);
  try {let decision:ExperimentDecision|undefined;
   for(let attempt=0;attempt<8;attempt++){
    await log('-requests.jsonl',{id:trial.id,arm,attempt,at:new Date().toISOString(),request});
    try{
     const response=await fetch('https://api.typesafe.ai/v1/systemone',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(30000)});
     const raw=await response.text();await log('-responses.jsonl',{id:trial.id,arm,attempt,at:new Date().toISOString(),status:response.status,raw});
     if(!response.ok){if(response.status===429||response.status>=500){await new Promise(r=>setTimeout(r,Math.min(30000,1000*2**attempt)));continue;}throw Error(`Fatal HTTP ${response.status}`);}
     const parsed=parseBinaryAction(JSON.parse(raw));if(parsed.response.model!==request.model)throw Error('Fatal model mismatch');
     decision={action:parsed.action,request,response:parsed.response};break;
    }catch(e){if(String(e).includes('Fatal')||attempt===7)throw e;await log('-errors.jsonl',{id:trial.id,arm,attempt,error:String(e)});await new Promise(r=>setTimeout(r,Math.min(30000,1000*2**attempt)));}
   }
   if(!decision)throw Error('Retries exhausted');const row={id:trial.id,arm,decision};await log('.jsonl',row);saved.set(`${trial.id}-${arm}`,row);if(saved.size%300===0)console.log(`${saved.size}/${plan.length*requestedArms.length}`);
  }catch(e){failed=e;}
 }}
 await Promise.all(Array.from({length:concurrency},worker));await writes;if(failed)throw failed;
 const faces=new Map<string,number>();
 const freshRows=plan.map(trial=>{const k=`${trial.magnitude}-${trial.number}`;if(!faces.has(k))faces.set(k,randomInt(1,7));return {...trial,face:prior?.rows.find(r=>r.magnitude===trial.magnitude&&r.number===trial.number)?.face??faces.get(k)!,sourceRun:base,decisions:Object.fromEntries(requestedArms.map(arm=>[arm,saved.get(`${trial.id}-${arm}`)!.decision])) as Record<Arm,ExperimentDecision>};});
 const rows=prior?[...prior.rows.filter(r=>r.scenario!=='no-history').map(r=>({...r,sourceRun:r.sourceRun??prior.provenance})),...freshRows]:freshRows;
 const study:HistoryStudy={schemaVersion:1,provenance:base,createdAt:new Date().toISOString(),rows};
 await writeFile(`${base}.json`,JSON.stringify(study));await writeFile('src/data/history-study.json.tmp',JSON.stringify(study));await rename('src/data/history-study.json.tmp','src/data/history-study.json');
 const summary=[1,5,15].flatMap(magnitude=>['mixed','wins','losses','no-history'].flatMap(scenario=>['table','calculated'].map(arm=>{const r=rows.filter(r=>r.magnitude===magnitude&&r.scenario===scenario&&r.decisions[arm as Arm]);return {magnitude,scenario,arm,bets:r.filter(r=>r.decisions[arm as Arm]!.action==='bet').length,correct:r.filter(r=>(r.decisions[arm as Arm]!.action==='bet')===(r.ev>0)).length,calls:r.length,expectedProfit:r.reduce((s,r)=>s+(r.decisions[arm as Arm]!.action==='bet'?r.ev:0),0)};})));
 await writeFile(`${base}-summary.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
}finally{await lock.close();await unlink(`${base}.lock`);}
