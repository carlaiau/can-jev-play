'use client';
import {ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine} from 'recharts';
import {useEffect,useMemo,useRef,useState} from 'react';
import {HistoryReport} from './history-report';
import {Die} from './die';
import {Button} from './catalyst/button';
import {Select} from './catalyst/select';
import {expectedBenchmarkRows,scenarios,type HistoryStudy,type Magnitude,type HistoryGroup} from '../lib/history-experiment';
import {ArrowDownTrayIcon,ChevronLeftIcon,ChevronRightIcon} from '@heroicons/react/24/outline';
const money=(n:number)=>`${n<0?'−':n>0?'+':''}$${Math.abs(n).toFixed(2)}`;
const names:Record<HistoryGroup,string>={all:'All','no-history':'No history',mixed:'Mixed outcomes',wins:'Six wins',losses:'Six losses'};
const groups:HistoryGroup[]=['all',...scenarios,'no-history'];

export function HistoryExperiments(){
 const [study,setStudy]=useState<HistoryStudy|null>(null),[error,setError]=useState('');
 const [magnitude,setMagnitude]=useState<Magnitude>(5),[scenario,setScenario]=useState<HistoryGroup>('mixed');
 const [selected,setSelected]=useState<number|null>(null),[rollInput,setRollInput]=useState('1');
 const detailsRef=useRef<HTMLElement>(null);
 const loadVersion=useRef(0);
 async function load(){const version=++loadVersion.current;setError('');setStudy(null);try{const r=await fetch(`/api/experiments?magnitude=${magnitude}&scenario=${scenario}`);const d=await r.json();if(!r.ok)throw Error(d.error);if(version!==loadVersion.current)return;setStudy(d);}catch(e){if(version===loadVersion.current)setError(e instanceof Error?e.message:'Could not load results.');}}
 useEffect(()=>{void load();return()=>{loadVersion.current++;};},[magnitude,scenario]);
 const rows=useMemo(()=>study?.rows.filter(r=>r.magnitude===magnitude&&(scenario==='all'||r.scenario===scenario))??[],[study,magnitude,scenario]);
 const total=rows.length || (scenario==='all'?4000:1000);
 const curves=useMemo(()=>[{number:0,table:0,optimal:0},...expectedBenchmarkRows(rows)],[rows]);
 const points=curves;
 const lo=Math.min(0,...points.flatMap(p=>[p.table,p.optimal])),hi=Math.max(1,...points.flatMap(p=>[p.table,p.optimal]));
 const pad=Math.max(1,(hi-lo)*.12),bottom=lo-pad,top=hi+pad;

 const chosen=rows.find(r=>r.number===selected);
 useEffect(()=>{if(selected!==null)detailsRef.current?.scrollIntoView({behavior:'smooth',block:'nearest'});},[selected]);
 function selectRound(number:number){if(!Number.isInteger(number)||number<1||number>rows.length)return;setSelected(number);setRollInput(String(number));}
 function changeRange(value:Magnitude){setMagnitude(value);setSelected(null);setRollInput('1');}
 function exportRun(){if(!study)return;const b=new Blob([JSON.stringify({provenance:study.provenance,magnitude,scenario,metric:'Cumulative expected dollar profit, fixed $100 bets; skips add zero',rows:rows.map(({decisions,...row})=>({...row,decisions:{table:decisions.table},optimalAction:row.ev>0?'bet':'skip'})),curves,benchmark:'Bet on positive EV; otherwise Skip. Mathematical benchmark, not a Jev response.'},null,2)],{type:'application/json'});const url=URL.createObjectURL(b);const a=document.createElement('a');a.href=url;a.download=`jev-history-${magnitude}-${scenario}.json`;a.click();URL.revokeObjectURL(url);}
 return <>
  <div className="page-heading"><div><h1>Does the recent past change the decision?</h1><p>Can Jev find the profitable offers when recent history changes? Compare the full run with the mathematical EV benchmark.</p></div><Button outline disabled={!study} onClick={exportRun}><ArrowDownTrayIcon data-slot="icon"/>Export run</Button></div>

  <div className="history-study-controls"><label>EV magnitude<Select aria-label="Experiment EV magnitude" value={magnitude} onChange={e=>changeRange(Number(e.target.value) as Magnitude)}>{[1,5,15].map(m=><option key={m} value={m}>Up to ±{m}%</option>)}</Select></label><p>{total.toLocaleString()} offers per run · mixed positive and negative EV · fixed $100 bets</p></div>
  <div className="history-tabs" role="tablist" aria-label="Recent-roll experiment">{groups.map(s=>{const count=study?.counts?.find(c=>c.magnitude===magnitude&&c.scenario===s);return <button key={s} id={`history-tab-${s}`} tabIndex={scenario===s?0:-1} onKeyDown={e=>{const i=groups.indexOf(s);const next=e.key==='ArrowRight'?groups[(i+1)%groups.length]:e.key==='ArrowLeft'?groups[(i+groups.length-1)%groups.length]:e.key==='Home'?groups[0]:e.key==='End'?groups.at(-1):undefined;if(next){e.preventDefault();setScenario(next);setSelected(null);setRollInput('1');document.getElementById(`history-tab-${next}`)?.focus();}}} role="tab" aria-selected={scenario===s} aria-controls="history-study-panel" onClick={()=>{setScenario(s);setSelected(null);setRollInput('1');}}><span>{names[s]}</span><small>{count?`${count.tableCorrect.toLocaleString()} / ${count.calls.toLocaleString()} correct`:'Loading…'}</small></button>;})}</div>
  {error?<div className="error" role="alert">{error}<Button outline onClick={load}>Retry</Button></div>:!study?<p role="status">Loading recorded experiments…</p>:<div id="history-study-panel" role="tabpanel" aria-label={names[scenario]}>


  <section className="ev-chart-panel" aria-labelledby="ev-chart-title">
   <div className="chart-heading"><div><h2 id="ev-chart-title">Cumulative expected profit</h2><p>Jev compared with the optimal EV rule. Actual outcomes do not affect either line. Click the graph to inspect a roll.</p></div><span className="chart-scope">All {total.toLocaleString()} rolls</span></div>
   <div className="chart-legend"><span className="table-key">Jev <strong>{money(curves.at(-1)!.table)}</strong></span><span className="calculated-key">Optimal EV <strong>{money(curves.at(-1)!.optimal)}</strong></span></div>
   <div className="recharts-experiment" aria-label={`Cumulative expected profit for ${names[scenario]}. Click a line to inspect a decision.`}>
    <ResponsiveContainer width="100%" height={340}>
     <LineChart data={points} margin={{top:16,right:20,bottom:16,left:8}} onClick={state=>{const n=Number(state.activeLabel);if(Number.isInteger(n)&&n>=1&&n<=total)selectRound(n);}}>
      <CartesianGrid vertical={false} stroke="var(--line)" />
      <XAxis dataKey="number" type="number" domain={[0,total]} ticks={Array.from({length:6},(_,i)=>Math.round(i*total/5))} allowDecimals={false} tickLine={false} axisLine={false} tick={{fontSize:11,fill:'var(--muted)'}} />
      <YAxis domain={[bottom,top]} tickFormatter={money} width={88} tickLine={false} axisLine={false} tick={{fontSize:11,fill:'var(--muted)'}} />
      <ReferenceLine y={0} stroke="#a5afa0" />
      {selected!==null&&<ReferenceLine x={selected} stroke="var(--muted)" strokeDasharray="3 4" />}
      <Tooltip cursor={{stroke:'var(--muted)',strokeDasharray:'3 4'}} content={({active,label})=>{const n=Number(label),row=rows[n-1],point=curves[n];return active&&row&&point?<div className="experiment-tooltip"><strong>Roll {n} · {names[row.scenario]}</strong><p><span>Jev: {money(point.table)}</span><span className={(row.decisions.table.action==='bet')===(row.ev>0)?'positive':'negative'}>{row.decisions.table.action==='bet'?'Bet':'Skip'} · {(row.decisions.table.action==='bet')===(row.ev>0)?'Correct':'Incorrect'} EV action</span></p><p>Optimal EV: {money(point.optimal)} · {row.ev>0?'Bet':'Skip'}</p><small>Click to inspect input and output</small></div>:null;}} />
      <Line type="linear" dataKey="table" name="Jev" stroke="var(--green)" strokeWidth={2} dot={false} activeDot={false} isAnimationActive={false} />
      <Line type="linear" dataKey="optimal" name="Optimal EV" stroke="var(--amber)" strokeWidth={2} strokeDasharray="7 4" dot={false} activeDot={false} isAnimationActive={false} />
     </LineChart>
    </ResponsiveContainer>
   </div>
   <form className="roll-inspector-controls" onSubmit={e=>{e.preventDefault();selectRound(Number(rollInput));}}><label htmlFor="inspect-roll">Inspect roll <input id="inspect-roll" type="number" min={1} max={total} step={1} required value={rollInput} onChange={e=>setRollInput(e.target.value)}/></label><span>of {total.toLocaleString()}</span><Button outline type="submit">Inspect</Button><div><Button plain type="button" aria-label="Inspect previous roll" disabled={selected===null||selected<=1} onClick={()=>selectRound(selected!-1)}><ChevronLeftIcon data-slot="icon"/>Previous</Button><Button plain type="button" aria-label="Inspect next roll" disabled={selected===null||selected>=total} onClick={()=>selectRound(selected!+1)}>Next<ChevronRightIcon data-slot="icon"/></Button></div></form>
   <p className="chart-formula">{scenario==='all' && <>Combines all history conditions in matched-offer order. </>}Starts at $0. Bet adds the offer’s expected dollar profit; Skip adds $0. Optimal EV bets only on positive-EV offers. No reinvestment or changing bet size.</p>
  </section>
  {chosen&&<section ref={detailsRef} className="selected-decision" aria-live="polite"><div className="panel-heading"><h2>Roll {chosen.number} · {names[chosen.scenario]} · {chosen.ev>0?'+':''}{chosen.ev}% EV</h2><Button plain onClick={()=>setSelected(null)}>Close details</Button></div><p>The correct action is <strong>{chosen.ev>0?'Bet':'Skip'}</strong>: {chosen.ev>0?`betting adds ${money(chosen.ev)} of expected profit.`:`skipping avoids ${money(chosen.ev)} of expected loss.`} The rolled face ({chosen.face}) does not change this assessment.</p><div className="experiment-detail-grid"><section><h3>Offered payouts</h3><table className="payout-table"><thead><tr><th>Face</th><th>Gross payout</th><th>Net profit</th></tr></thead><tbody>{chosen.gross.map((gross,index)=><tr key={index} className={chosen.face===index+1?'selected-roll':''}><td><Die face={index+1}/><span className="face-number">{index+1}</span>{chosen.face===index+1&&<span className="rolled-label">Rolled</span>}</td><td>${gross.toFixed(2)}</td><td className={gross-100<0?'negative':'positive'}>{money(gross-100)}</td></tr>)}</tbody></table></section><section><h3>Jev · {chosen.decisions.table.action==='bet'?'Bet':'Skip'}</h3><p className={(chosen.decisions.table.action==='bet')===(chosen.ev>0)?'positive':'negative'}>{(chosen.decisions.table.action==='bet')===(chosen.ev>0)?'Correct EV action':`Incorrect EV action · $${(Math.max(chosen.ev,0)-(chosen.decisions.table.action==='bet'?chosen.ev:0)).toFixed(2)} expected profit forgone`}</p><details open><summary>Exact model input and output</summary><pre>{JSON.stringify({request:chosen.decisions.table.request,response:chosen.decisions.table.response,source:chosen.sourceRun??study.provenance,trial:chosen.id,sourceRound:chosen.sourceNumber??chosen.number,history:chosen.scenario},null,2)}</pre></details></section></div></section>}

  {study.metrics&&<HistoryReport view="table" metrics={study.metrics} selected={scenario} interleaved={study.rows.every(r=>r.id.startsWith('interleaved-v2-'))}/>}
  <p className="ledger-footnote">Jev responses across three EV ranges and three controlled history scenarios and a no-history control. The Optimal EV line is a mathematical benchmark, not a model response. History conditions contain the stated fixed six-roll window; the no-history control omits it entirely. These are controlled inputs, not the preceding outcomes of the simulation. Offers and outcome faces are matched across scenarios. Repeated or related inputs are not independent samples. Source: {study.provenance}.</p>
  </div>}
 </>;
}
