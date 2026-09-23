import { binaryQuestions } from './binary-action.ts';
import { calculatedExpectedProfit } from './structured-offer.ts';
export const scenarios = ['mixed', 'wins', 'losses'] as const;
export type Scenario = typeof scenarios[number] | 'no-history';
export type HistoryGroup = Scenario | 'all';
export type Magnitude = 1 | 5 | 15;
export type Arm = 'table' | 'calculated';
export type HistoryTrial = { id: string; magnitude: Magnitude; scenario: Scenario; number: number; ev: number; gross: number[]; history: {face:number;netProfit:number;outcome:'win'|'loss'}[]; state: Record<string,unknown> };
export type ExperimentDecision = {action:'bet'|'skip'; request:Record<string,unknown>; response:Record<string,unknown>};
export type ExperimentRow = HistoryTrial & { face:number; sourceNumber?:number; sourceRun?:string; decisions:{table:ExperimentDecision;calculated?:ExperimentDecision} };
export type HistoryStudy = { schemaVersion:1; provenance:string; rows:ExperimentRow[]; createdAt:string; metrics?:ReturnType<typeof historyMetrics>; totalCalls?:number; counts?:{magnitude:number;scenario:HistoryGroup;calls:number;tableCorrect:number;calculatedCorrect:number}[] };
export function historyPlan(count = 30): HistoryTrial[] {
 if(!Number.isInteger(count)||count<1||count>10000)throw new Error('Invalid roll count');
 let seed=19843;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const shuffle=<T,>(items:T[])=>{for(let i=items.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[items[i],items[j]]=[items[j],items[i]];}return items;};
 const rows:HistoryTrial[]=[];
 for(const magnitude of [1,5,15] as const) {
  const offers=[...Array.from({length:Math.floor(count/6)},()=>shuffle([-1,-.6,-.2,.2,.6,1])).flat(), ...shuffle([-1,1,-.2,.2,-.6,.6].slice(0,count%6))];
  for(let i=0;i<count;i++) {
   const ev=Number((offers[i]*magnitude).toFixed(2));
   const gross=shuffle([0,0,0,195,200,Number((205+6*ev).toFixed(2))]);
   for(const scenario of scenarios) {
    const faces=scenario==='wins'?[4,5,6,4,5,6]:scenario==='losses'?[1,2,3,1,2,3]:[1,4,2,5,3,6];
    const history=faces.map(face=>({face,netProfit:face>=4?100:-100,outcome:face>=4?'win' as const:'loss' as const}));
    const state={rules:{independent:true,uniform:true,sides:6,fair:true,payouts:gross.map((g,j)=>({face:j+1,grossPayout:g,netProfit:Number((g-100).toFixed(2))})),payoutNote:'Net profit is the final gain or loss in dollars for each outcome. Skipping returns zero.'},objective:'Maximize expected net profit from this one independent roll. Choose bet or skip. The decision is risk-neutral; variance carries no penalty and there are no future decisions.',recentRolls:{order:'oldest to newest',count:6,payoutContext:'Previous offers paid net profit +100 dollars for faces 4, 5, 6 and -100 dollars for faces 1, 2, 3. The next offer uses the current payout array.',rolls:history}};
    rows.push({id:`history-v1-${magnitude}-${i+1}-${scenario}`,magnitude,scenario,number:i+1,ev,gross:[...gross],history,state});
   }
  }
 }
 return rows;
}
export function historyRequest(trial:Pick<HistoryTrial,'state'|'gross'>,arm:Arm) {
 return {model:'jev-1.13.0',state:{...trial.state,...(arm==='calculated'?{calculatedExpectedNetProfit:calculatedExpectedProfit(trial.gross.map(g=>Number((g-100).toFixed(2))))}:{})},questions:binaryQuestions};
}
export function cumulativeExpectedRows(rows:ExperimentRow[]) {
 let table=0,calculated=0;
 return rows.map(row=>{table+=row.decisions.table.action==='bet'?row.ev:0;calculated+=row.decisions.calculated?.action==='bet'?row.ev:0;return {number:row.number,table:Number(table.toFixed(2)),calculated:Number(calculated.toFixed(2))};});
}

/** Combine matched histories in offer order; preserve the original trial number. */
export function selectExperimentRows(rows:ExperimentRow[],magnitude:number,group:HistoryGroup):ExperimentRow[] {
 return rows.filter(r=>r.magnitude===magnitude&&(group==='all'||r.scenario===group))
  .sort((a,b)=>a.number-b.number||[...scenarios,'no-history'].indexOf(a.scenario)-[...scenarios,'no-history'].indexOf(b.scenario))
  .map((row,index)=>({...row,sourceNumber:row.sourceNumber??row.number,number:index+1}));
}

/** Mathematical benchmark, independent of supplied-EV model responses. */
export function expectedBenchmarkRows(rows:ExperimentRow[]) {
 let table=0,optimal=0;
 return rows.map(row=>{table+=row.decisions.table.action==='bet'?row.ev:0;optimal+=Math.max(row.ev,0);return {number:row.number,table:Number(table.toFixed(2)),optimal:Number(optimal.toFixed(2))};});
}

/** Fresh unique offers; all four conditions stay adjacent in randomized order. */
export function interleavedPlan(count=1000):HistoryTrial[] {
 let seed=9232026;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const shuffle=<T,>(a:T[])=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
 const original=historyPlan(count),seen=new Set<string>(),blocks:HistoryTrial[][]=[];
 for(let i=0;i<original.length;i+=3){
  const source=original.slice(i,i+3),base=source[0];let gross:number[],key:string;
  do {const a=18000+Math.floor(random()*4001),b=18000+Math.floor(random()*4001),c=60000+Math.round(base.ev*600)-a-b;gross=shuffle([0,0,0,a/100,b/100,c/100]);key=JSON.stringify(gross);}while(seen.has(key));seen.add(key);
  const trials:HistoryTrial[]=source.map(t=>({...t,id:`interleaved-v2-${t.magnitude}-${t.number}-${t.scenario}`,gross:[...gross],state:{...t.state,rules:{...(t.state.rules as object),payouts:gross.map((g,j)=>({face:j+1,grossPayout:g,netProfit:Number((g-100).toFixed(2))}))}}}));
  const {recentRolls,...state}=trials[0].state;
  blocks.push(shuffle([...trials,{...trials[0],id:`interleaved-v2-${base.magnitude}-${base.number}-no-history`,scenario:'no-history',history:[],state}]));
 }
 return shuffle(blocks).flat();
}

export function historyMetrics(rows:ExperimentRow[]){
 return (['all',...scenarios,'no-history'] as HistoryGroup[]).map(scenario=>{
  const r=rows.filter(r=>scenario==='all'||r.scenario===scenario),positive=r.filter(r=>r.ev>0),negative=r.filter(r=>r.ev<0);
  return {scenario,calls:r.length,bets:r.filter(r=>r.decisions.table.action==='bet').length,positive:positive.length,correctBet:positive.filter(r=>r.decisions.table.action==='bet').length,negative:negative.length,correctSkip:negative.filter(r=>r.decisions.table.action==='skip').length};
 });
}

export function withoutRecentHistory(trial:HistoryTrial):HistoryTrial {
 const {recentRolls,...state}=trial.state;
 return {...trial,scenario:'no-history',history:[],state};
}
