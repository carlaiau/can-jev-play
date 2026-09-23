import { readFile, writeFile, appendFile, mkdir, open, unlink } from 'node:fs/promises';
import { offerOnlyState } from '../src/lib/offer-only.ts';
import { randomizedFacePlan } from '../src/lib/randomized-faces.ts';
import { binaryQuestions, parseBinaryAction, summarizeBinary } from '../src/lib/binary-action.ts';
import { hash } from '../src/lib/cache-probe.ts';
import { inputCost, contextProxy } from '../src/lib/usage.ts';

const key = process.env.TYPESAFE_API_KEY;
if (!key?.trim()) throw new Error('TYPESAFE_API_KEY required');
const model = 'jev-1.13.0';
const offerOnly = process.argv.includes('--offer-only');
const trials = randomizedFacePlan().filter(t => t.length === 30).map(t => offerOnly ? { ...t, state: offerOnlyState(t.state) } : t);
const resume = process.argv.find(a=>a.startsWith('--resume='))?.slice(9);
const name = resume ?? `binary-action-${offerOnly ? 'offer-only-' : ''}${Date.now()}`;
if (!/^binary-action-(offer-only-)?\d+$/.test(name)) throw new Error('Invalid run name');
const base = `reports/${name}`;
const plan = { model, questions: binaryQuestions, trials, analysis: '360 interleaved requests: six signed EV values, nine historical conditions plus no-history, three payout-face permutations, two disclosure formats. Only one choice question: bet or skip. No Score, EV classification, win forecast or cutoff fitting. Thirty-roll histories. Existing randomized-face inputs are preserved so the question-set change is explicit. Calls ran separately from prior multi-question studies; no causal attribution or significance claims.' };
if (offerOnly) plan.analysis = '360 binary-only requests using current offers only: six EV levels and randomized payout permutations. Historical rolls, summaries and synthetic-history flags are omitted by an allowlist. Earlier condition IDs identify source payout permutations only, not model-visible history. Some stripped inputs may coincide; calls are not independent unique scenarios. Both disclosure arms are matched. No Score or win forecast is requested.';
if(trials.some(t=>contextProxy({model,state:t.state,questions:binaryQuestions})>32000)) throw new Error('Context limit');
const fingerprint=hash(JSON.stringify(plan));
await mkdir('reports',{recursive:true});
const lock=await open(`${base}.lock`,'wx');
type Result = Omit<typeof trials[number], 'state'> & { action: 'bet'|'skip'; response: Record<string,unknown>; elapsedMs: number };
const results:Result[]=[];
try {
 if(resume){
  if(JSON.parse(await readFile(`${base}-manifest.json`,'utf8')).fingerprint!==fingerprint)throw new Error('Resume mismatch');
  try{results.push(...(await readFile(`${base}.jsonl`,'utf8')).split('\n').filter(Boolean).map(line=>JSON.parse(line)));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 } else await writeFile(`${base}-manifest.json`,JSON.stringify({...plan,fingerprint,at:new Date().toISOString()},null,2));
 console.log(`Run ${base}; ${results.length}/${trials.length} complete`);
 for(const trial of trials){
  if(results.some(r=>r.id===trial.id))continue;
  const body={model,state:trial.state,questions:binaryQuestions};
  await appendFile(`${base}-requests.jsonl`,JSON.stringify({id:trial.id,at:new Date().toISOString(),body})+'\n');
  const started=performance.now();
  const response=await fetch('https://api.typesafe.ai/v1/systemone',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  const raw=await response.text();const elapsedMs=Math.round(performance.now()-started);
  await appendFile(`${base}-responses.jsonl`,JSON.stringify({id:trial.id,status:response.status,raw,elapsedMs})+'\n');
  if(!response.ok)throw new Error(`HTTP ${response.status}; raw response saved`);
  const parsed=parseBinaryAction(JSON.parse(raw));
  if(parsed.response.model!==model)throw new Error('Model version mismatch');
  const {state,...metadata}=trial;
  const result={...metadata,...parsed,elapsedMs};
  await appendFile(`${base}.jsonl`,JSON.stringify(result)+'\n');results.push(result);
  if(results.length%30===0)console.log(`${results.length}/${trials.length} complete`);
 }
 const inputTokens=results.reduce((sum,r)=>sum+Number((r.response.usage as {input_tokens?:number})?.input_tokens??0),0);
 const missingUsage=results.filter(r=>!Number.isSafeInteger((r.response.usage as {input_tokens?:number})?.input_tokens)).length;
 const summary=summarizeBinary(results);
 const cost={inputTokens,estimatedUsd:inputCost(inputTokens),missingUsage};
 await writeFile(`${base}.json`,JSON.stringify({summary,cost,results},null,2));
 await writeFile(offerOnly ? 'src/data/offer-only-study.json' : 'src/data/binary-study.json',JSON.stringify({provenance:base,cases:trials.filter(t=>t.format==='table-only'),results,summary}));
 await writeFile(`${base}.md`,['# Binary-only Bet / Skip experiment','',plan.analysis,'','| Format | EV | Bet | Skip | Correct |','|---|---:|---:|---:|---:|',...summary.flatMap(a=>a.byEv.map(r=>`| ${a.format} | ${r.ev} | ${r.bets} | ${r.skips} | ${r.correct}/${r.calls} |`)),'',...summary.map(a=>`${a.format}: ${a.meanExpectedNet.toFixed(4)} expected units per offered decision.`),'','Reference action: bet for positive EV, skip for negative EV. Realized dice outcomes are not used to judge decision quality. Permutations share base histories and are not independent observations. Both formats receive the same payout table; only one receives calculated EV. Earlier Score thresholds are inapplicable because Score is no longer requested. Raw requests and responses are preserved.', '',`Estimated cost: $${cost.estimatedUsd.toFixed(6)}; missing usage: ${missingUsage}.`].join('\n'));
 console.log(JSON.stringify({summary,cost,report:`${base}.md`},null,2));
}finally{await lock.close();await unlink(`${base}.lock`);}
