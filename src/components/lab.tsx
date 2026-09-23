'use client';
import {HistoryReport,HistoryDiscussion} from './history-report';
import type {historyMetrics} from '../lib/history-experiment';
import { Die } from './die';

import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '../catalyst/typescript/dialog';
import { historyPlan, historyRequest, withoutRecentHistory } from '../lib/history-experiment';
import { HistoryExperiments } from './history-experiments';
import { Fragment, useEffect, useRef, useState } from 'react';
import { sessionPerformance, sessionDecisionRates } from '../lib/session-performance';
import { actionVerdict } from '../lib/action-verdict';
import { Button } from './catalyst/button';
import { Select } from './catalyst/select';
import { Badge } from './catalyst/badge';
import { ArrowRightIcon, ArrowDownTrayIcon, ArrowPathIcon, BeakerIcon, ChartBarIcon, CheckIcon, ChevronRightIcon, DocumentTextIcon, InformationCircleIcon, PlayIcon, PlusIcon } from '@heroicons/react/24/outline';
import type { summarizeBinary } from '../lib/binary-action';
import type { analyzeThresholds } from '../lib/score-threshold';
import type { LabConfig, LabSession, LabRound, Judgment } from '../lib/lab-types';

type Studies = { findings: {current:{provenance:string;interleaved:boolean;metrics:ReturnType<typeof historyMetrics>};provenance:string;calls:number;groups:{scenario:string;calls:number;tableCorrect:number;tableBets:number;controlCorrect:number}[]}; binary: ReturnType<typeof summarizeBinary>; thresholds: ReturnType<typeof analyzeThresholds>; payout: { arms: { format: string; correct: number; calls: number; byEv: { label: string; correct: number; calls: number }[] }[] }; supplied: { arms: { format: string; correct: number; calls: number; byEv: { label: string; correct: number; calls: number }[] }[] }; negativeHistory: { format: string; skips: number; calls: number }[]; history: { format: string; skips: number; calls: number }[] };
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const dollars = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const signedDollars = (n: number) => `${n > 0 ? '+' : ''}${dollars(n)}`;
const percent = (n: number) => `${(n * 100).toFixed(0)}%`;
const initial: LabConfig = { mode: 'live', magnitude: 5, ending: 'mixed' };


export function Lab({ liveAvailable, studies }: { liveAvailable: boolean; studies: Studies }) {
  const [page, setPage] = useState<'lab' | 'experiments' | 'results' | 'guide'>('lab');
  const [config, setConfig] = useState<LabConfig>(initial);
  const [session, setSession] = useState<LabSession | null>(null);
  const [busy, setBusy] = useState('');
  const [autoplay, setAutoplay] = useState(false);
  const [error, setError] = useState('');
  const [cost, setCost] = useState(0);
  const [expandedRound, setExpandedRound] = useState<number | null>(null);
  const [recovered, setRecovered] = useState(false);
  const inFlight = useRef(false);
  const runVersion = useRef(0);
  useEffect(() => {
    let active = true;
    const id = localStorage.getItem('dice-lab-live-session');
    if (!id) { setRecovered(true); return () => { active = false; runVersion.current++; }; }
    (async () => {
      try {
        const response = await fetch('/api/lab', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'load', id }) });
        let data = await response.json();
        if (!active) return;
        if (data.session && (data.session.study !== 'payout-live-v1' || data.session.config.mode !== 'live')) { localStorage.setItem('dice-lab-previous-session', id); localStorage.removeItem('dice-lab-live-session'); return; }
        if (data.session?.round.face !== undefined && data.session.round.number < 30) {
          const next = await fetch('/api/lab', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'next', id, round: data.session.round.number }) });
          if (next.ok) data = await next.json();
        }
        if (!active) return;
        if (data.session) { setSession(data.session); setConfig(data.session.config); setCost(data.estimatedCost); }
        else localStorage.removeItem('dice-lab-live-session');
      } catch { if (active) setError('Could not restore the last session. You can start a new experiment.'); }
      finally { if (active) setRecovered(true); }
    })();
    return () => { active = false; runVersion.current++; };
  }, []);
  useEffect(() => {
    if (!autoplay || busy || !session || inFlight.current) return;
    if (session.ledger.length >= 30) { setAutoplay(false); return; }
    const timer = setTimeout(() => { void runRound(); }, 700);
    return () => clearTimeout(timer);
  }, [autoplay, busy, session]);
  async function requestStep(action: 'create' | 'evaluate' | 'roll' | 'next', current: LabSession | null) {
    const response = await fetch('/api/lab', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, id: current?.id, round: current?.round.number, config: { ...config, mode: 'live' } }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to complete this step.');
    setSession(data.session); setCost(data.estimatedCost); localStorage.setItem('dice-lab-live-session', data.session.id);
    return data.session as LabSession;
  }
  async function start() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy('create'); setError('');
    try { await requestStep('create', null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not start the experiment.'); }
    finally { setBusy(''); inFlight.current = false; }
  }
  async function runRound() {
    if (inFlight.current || !session) return;
    inFlight.current = true; setError('');
    const ticket = ++runVersion.current;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pause = async (ms: number) => { await new Promise(resolve => setTimeout(resolve, ms)); if (ticket !== runVersion.current) throw new Error('Interrupted'); };
    let current = session;
    try {
      if (current.round.face !== undefined) {
        if (current.round.number < 30) { setBusy('transition'); await requestStep('next', current); }
        return;
      }
      setBusy('evaluate'); current = await requestStep('evaluate', current);
      setBusy('rolling'); await pause(reduced ? 250 : 650);
      current = await requestStep('roll', current);
      if (current.round.number >= 30) setAutoplay(false);
      setBusy('outcome'); await pause(2000);
      if (current.round.number < 30) {
        setBusy('transition'); await pause(reduced ? 0 : 250);
        await requestStep('next', current);
      }
    } catch (e) { setAutoplay(false); if (ticket === runVersion.current) setError(e instanceof Error ? e.message : 'Retry this roll. Saved decisions and outcomes are preserved.'); }
    finally { if (ticket === runVersion.current) { setBusy(''); inFlight.current = false; } }
  }
  function reset() { setAutoplay(false); setSession(null); setCost(0); setError(''); setExpandedRound(null); localStorage.removeItem('dice-lab-live-session'); }
  function download() {
    if (!session) return;
    const blob = new Blob([JSON.stringify({ ...session, displayCurrency: 'simulated dollars', performance: { table: sessionPerformance(session.ledger, 'table') }, estimatedApiCost: cost, actionAssessments: session.ledger.map(row => ({ round: row.number, table: actionVerdict(row.ev, row.judgments.table!.action) })), recordedJudgments: session.config.mode === 'recorded', outcomes: 'New server-generated simulated rolls, not historical study outcomes' }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `dice-lab-${session.id}.json`; link.click(); URL.revokeObjectURL(url);
  }
  const inspectedRound = session?.ledger.find(row => row.number === expandedRound);
  const r = session?.round;
  const rates = sessionDecisionRates(session?.ledger ?? [], r);
  const preview = historyPlan().find(t => t.magnitude === config.magnitude && t.scenario === (config.ending === 'win-streak' ? 'wins' : config.ending === 'loss-streak' ? 'losses' : 'mixed') && t.number === 1)!;
  const offer = r ?? (config.ending==='no-history'?withoutRecentHistory(preview):preview);
  const offerEv = offer.ev;
  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="Can Jev Play home"><span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 48 48" focusable="false"><rect width="48" height="48" rx="12" fill="currentColor"/><g transform="rotate(12 31 21)"><rect x="22" y="8" width="17" height="25" rx="3" fill="white"/><path d="m30.5 12-4 5 4 5 4-5Z" fill="currentColor"/></g><rect x="7" y="22" width="22" height="20" rx="5" fill="currentColor"/><rect x="8" y="23" width="19" height="17" rx="4" fill="white"/><g fill="currentColor"><circle cx="12.5" cy="27.5" r="1.65"/><circle cx="22.5" cy="27.5" r="1.65"/><circle cx="17.5" cy="31.5" r="1.65"/><circle cx="12.5" cy="35.5" r="1.65"/><circle cx="22.5" cy="35.5" r="1.65"/></g></svg></span><span>Can Jev Play<span className="brand-sub">Games of judgment</span></span></a>
      <nav aria-label="Main navigation">
        <button aria-current={page === 'lab' ? 'page' : undefined} className={page === 'lab' ? 'nav-active' : ''} onClick={() => setPage('lab')}><BeakerIcon /><span>Dice lab</span></button>
        <button aria-current={page === 'experiments' ? 'page' : undefined} className={page === 'experiments' ? 'nav-active' : ''} onClick={() => setPage('experiments')}><ChartBarIcon /><span>Experiments</span></button>
        <button aria-current={page === 'results' ? 'page' : undefined} className={page === 'results' ? 'nav-active' : ''} onClick={() => setPage('results')}><DocumentTextIcon /><span>Findings</span></button>
        <button aria-current={page === 'guide' ? 'page' : undefined} className={page === 'guide' ? 'nav-active' : ''} onClick={() => setPage('guide')}><InformationCircleIcon /><span>Guide</span></button>
      </nav>
      <a className="sidebar-github" href="https://github.com/carlaiau/can-jev-play" target="_blank" rel="noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 .75a11.25 11.25 0 0 0-3.558 21.923c.563.104.769-.244.769-.543 0-.267-.01-.975-.015-1.913-3.13.68-3.79-1.508-3.79-1.508-.511-1.299-1.248-1.645-1.248-1.645-1.022-.699.078-.685.078-.685 1.13.08 1.725 1.16 1.725 1.16 1.004 1.72 2.633 1.223 3.274.936.102-.728.393-1.224.714-1.506-2.498-.284-5.124-1.249-5.124-5.561 0-1.229.439-2.234 1.16-3.021-.117-.285-.503-1.429.11-2.978 0 0 .945-.303 3.094 1.154A10.78 10.78 0 0 1 12 6.195c.956.005 1.918.129 2.817.379 2.148-1.457 3.091-1.154 3.091-1.154.615 1.549.229 2.693.113 2.978.722.787 1.159 1.792 1.159 3.021 0 4.324-2.63 5.274-5.136 5.553.404.35.766 1.043.766 2.102 0 1.518-.014 2.743-.014 3.116 0 .302.203.653.774.542A11.251 11.251 0 0 0 12 .75Z"/></svg><span>View on GitHub</span></a>
    </aside>
    <div className="workspace">

      <main id="main-content">
      {page === 'lab' ? <>
        <div className="page-heading lab-intro"><div><h1>Can Jev work out the edge?</h1><p>A fair die, known payouts, and one choice: Bet or Skip. Inspired by Jev trading demos, this tests whether it finds a real edge or follows luck—and whether recent wins and losses sway it.</p></div><Button outline onClick={() => setPage('experiments')}><ChartBarIcon data-slot="icon" /> View experiments</Button></div>

        <div className="experiment-controls">

          <label><span>EV magnitude</span><Select aria-label="EV magnitude" value={config.magnitude} disabled={!!session || !!busy} onChange={e => setConfig({ ...config, magnitude: Number(e.target.value) as LabConfig['magnitude'] })}>{[1,5,15].map(value => <option key={value} value={value}>Up to ±{value}%</option>)}</Select></label>
          <label><span>History condition</span><Select aria-label="History condition" value={config.ending} disabled={!!session || !!busy} onChange={e => setConfig({ ...config, ending: e.target.value as LabConfig['ending'] })}><option value="loss-streak">Six losses</option><option value="mixed">Mixed outcomes</option><option value="win-streak">Six wins</option><option value="no-history">No history</option></Select></label>
          {session ? <Button outline disabled={!!busy} onClick={reset}><PlusIcon data-slot="icon" /> New session</Button> : <Button color="green" disabled={!!busy || !recovered || !liveAvailable} onClick={start}>{busy === 'create' ? 'Preparing…' : 'Start experiment'}<ArrowRightIcon data-slot="icon" /></Button>}
        </div>
        <div className="provenance"><span className="source-dot live" /><strong>Live Jev · one call per roll</strong><span>Estimated session cost ${cost.toFixed(5)}</span></div>
        {!liveAvailable && <div className="error" role="status">Live Jev is unavailable. Configure TYPESAFE_API_KEY on the server, or view recorded runs in Experiments.</div>}
        {error && <div className="error" role="alert"><InformationCircleIcon /><span>{error}</span></div>}
            <div className="round-toolbar session-toolbar"><span role="status">{busy === 'evaluate' ? 'Getting Jev’s decision…' : busy === 'rolling' ? 'Decision locked. Rolling…' : busy === 'outcome' ? 'Roll complete' : busy === 'transition' ? 'Preparing the next offer…' : r?.number === 30 && r.face !== undefined ? 'Experiment complete' : autoplay ? 'Autoplay · stops after 30 rounds' : 'Review the offer · 30 rounds maximum'}</span><div className="play-controls"><Button outline disabled={!session || (session.ledger.length >= 30 && !autoplay)} onClick={() => setAutoplay(value => !value)} aria-pressed={autoplay}>{autoplay ? 'Pause autoplay' : 'Autoplay'}</Button><Button color="green" disabled={!session || autoplay || !!busy || (r?.number === 30 && r.face !== undefined)} onClick={runRound}>{busy ? <><ArrowPathIcon data-slot="icon" className="spin" />{busy === 'evaluate' ? 'Deciding…' : busy === 'rolling' ? 'Rolling…' : busy === 'outcome' ? 'Result' : 'Next offer…'}</> : r?.number === 30 && r.face !== undefined ? 'Complete' : r?.face !== undefined ? 'Next offer' : <><PlayIcon data-slot="icon" />Roll</>}</Button></div></div>
        <div className={`lab-grid phase-${busy || 'ready'}`}>
          <section key={r?.number ?? 0} className="offer-panel" aria-labelledby="offer-heading">
            <div className="panel-heading"><h2 id="offer-heading">The next offer</h2></div>
            <table className="payout-table"><caption className="sr-only">Payout by die face. Each face has probability one sixth.</caption><thead><tr><th>Face</th><th>Gross payout</th><th>Net profit</th></tr></thead><tbody>{offer.gross.map((gross, index) => <tr key={index} className={r?.face === index + 1 ? 'selected-roll' : ''}><td><Die face={index + 1} /><span className="face-number">{index + 1}</span>{r?.face === index + 1 && <span className="rolled-label">Rolled</span>}</td><td>{dollars(gross)}</td><td className={gross > 100 ? 'positive' : 'negative'}>{signedDollars(gross - 100)}</td></tr>)}</tbody></table>
            <div className="expected-line"><span>Expected return</span><div className="expected-value"><Badge color={(offerEv) > 0 ? "green" : "red"}>{(offerEv) > 0 ? "+EV" : "−EV"}</Badge><strong className={(offerEv) < 0 ? "negative" : "positive"}>{signed(100 * offerEv / (r?.stake ?? 100))}%</strong></div></div>
            <div className="history-heading"><h3>What happened before</h3><span>{r ? 'Last 6 rolls' : 'Selected scenario'}</span></div>
            {config.ending==='no-history' ? <p className="tiny">No recent rolls are sent to Jev. Each offer is evaluated from its payouts and the fair-die rules.</p> : r ? <><div className="history-strip" aria-label="Historical rolls, oldest to newest">{r.historyFaces.map((face, i) => <span key={i} className={face >= 4 ? 'history-win' : 'history-loss'} title={`Roll ${i + 1}: ${face}, ${face >= 4 ? 'won' : 'lost'}`}>{face}</span>)}</div><div className="history-legend"><span><i className="legend-win" /> Win</span><span><i className="legend-loss" /> Loss</span><span>Oldest → newest</span></div><div className="history-total"><span>Historical net return</span><strong className={r.historicalNet < 0 ? 'negative' : 'positive'}>{signedDollars(r.historicalNet)}</strong></div><p className="tiny">Sent to Jev as controlled recent outcomes. Previous offers had net gains or losses of $100. The next offer uses the table above.</p></> : <div className="history-empty"><ChartBarIcon /><span>The selected six-roll history is sent with every offer. Positive and negative offers are mixed throughout the session.</span></div>}
          </section>
          <section className="comparison-panel" aria-labelledby="comparison-heading">
            <div className="panel-heading"><h2 id="comparison-heading">Jev’s decision</h2><span className="round-counter">Round {r?.number ?? '—'} <span>/ 30</span></span></div>

            <div className="comparison-columns payout-only-columns">
              <Decision ready={!!session} request={r?.requests?.table ?? historyRequest(offer, 'table')} sent={!!r?.requests?.table} round={r?.number ?? 1} arm="table" judgment={r?.judgments.table} busy={busy === 'evaluate' && !r?.judgments.table} ev={offerEv} net={r?.returns?.table} performance={sessionPerformance(session?.ledger ?? [], 'table')} />
            </div>
          </section>
        </div>
        {rates.decisions>0&&<section className="history-report live-decision-rates" aria-label="Live session decision rates"><div className="table-scroll"><table className="study-table-data"><caption>Live session · {rates.decisions} {rates.decisions===1?'decision':'decisions'} · assessed by EV, independently of roll outcomes</caption><thead><tr><th scope="col">Bet rate</th><th scope="col">Bet on +EV</th><th scope="col">Skip on −EV</th><th scope="col">Correct overall</th></tr></thead><tbody><tr>{[[rates.bets,rates.decisions],[rates.correctBet,rates.positive],[rates.correctSkip,rates.negative],[rates.correct,rates.decisions]].map(([n,d],i)=><td key={i}>{d?`${(100*n/d).toFixed(1)}%`:'—'}<small>{n} / {d}</small></td>)}</tr></tbody></table></div></section>}
        <section className="ledger-section"><div className="ledger-title"><div><h2>The experiment log</h2><p>The offer, the decision, then the outcome. In that order.</p></div><Button outline onClick={download} disabled={!session}><ArrowDownTrayIcon data-slot="icon" /> Export JSON</Button></div>
          {inspectedRound&&<LiveRoundDetails row={inspectedRound} onClose={()=>setExpandedRound(null)}/>}
          {session?.ledger.length ? <div className="table-scroll"><table className="ledger"><thead><tr><th>Round</th><th>Offered EV</th><th>Jev action</th><th>Roll</th><th>Return</th><th>Details</th></tr></thead><tbody>{[...session.ledger].reverse().map(row => <Fragment key={row.number}><tr><td>{String(row.number).padStart(2, '0')}</td><td>{signed(100 * row.ev / row.stake)}%</td><td><span className="action-with-verdict">{row.judgments.table?.action === 'bet' ? 'Bet' : 'Skip'}<Verdict ev={row.ev} action={row.judgments.table!.action} /></span></td><td><Die face={row.face!} /></td><td className={row.returns!.table < 0 ? 'negative' : 'positive'}>{signedDollars(row.returns!.table)}</td><td><button className="log-inspect-button" aria-expanded={expandedRound === row.number} aria-controls={`round-details-${row.number}`} aria-label={`${expandedRound === row.number ? 'Hide' : 'Show'} model details for round ${row.number}`} onClick={() => setExpandedRound(expandedRound === row.number ? null : row.number)}>{expandedRound === row.number ? 'Close' : 'Inspect'}<ChevronRightIcon /></button></td></tr></Fragment>)}</tbody></table></div> : <div className="ledger-empty"><DocumentTextIcon /><div><strong>Your first round belongs here.</strong><p>Review the offer, get Jev’s decision, and roll to begin the log.</p></div></div>}
          <p className="ledger-footnote">Every session mixes positive and negative offers at the selected magnitude. {config.ending==='no-history'?'No recent-roll history is sent.':'The six-roll history is a controlled input, held fixed to test its influence.'} This page calls Jev live before generating each outcome. Recorded runs are on the Experiments page.</p>
        </section>
      </> : page === 'experiments' ? <HistoryExperiments /> : page === 'results' ? <><Findings findings={studies.findings}/></> : <Guide />}

      </main>
    </div>
  </div>;
}

function LiveRoundDetails({row,onClose}:{row:LabRound;onClose:()=>void}) {
 const ref=useRef<HTMLElement>(null);
 useEffect(()=>{ref.current?.scrollIntoView({behavior:'smooth',block:'nearest'});},[row.number]);
 const action=row.judgments.table!.action,verdict=actionVerdict(row.ev,action);
 return <section ref={ref} id={`round-details-${row.number}`} className="selected-decision live-round-details" aria-live="polite"><div className="panel-heading"><h2>Round {row.number} · {signed(100*row.ev/row.stake)}% EV</h2><Button plain onClick={onClose}>Close details</Button></div><p>The correct action is <strong>{row.ev>0?'Bet':'Skip'}</strong>: {row.ev>0?`betting adds ${signedDollars(row.ev)} of expected profit.`:`skipping avoids ${dollars(Math.abs(row.ev))} of expected loss.`} The rolled face ({row.face}) does not change this assessment.</p><div className="experiment-detail-grid"><section><h3>Offered payouts</h3><table className="payout-table"><thead><tr><th>Face</th><th>Gross payout</th><th>Net profit</th></tr></thead><tbody>{row.gross.map((gross,index)=><tr key={index} className={row.face===index+1?'selected-roll':''}><td><Die face={index+1}/><span className="face-number">{index+1}</span>{row.face===index+1&&<span className="rolled-label">Rolled</span>}</td><td>{dollars(gross)}</td><td className={gross-row.stake<0?'negative':'positive'}>{signedDollars(gross-row.stake)}</td></tr>)}</tbody></table></section><section><h3>Jev · {action==='bet'?'Bet':'Skip'}</h3><p className={verdict.correct?'positive':'negative'}>{verdict.label}{!verdict.correct&&` · ${dollars(Math.max(row.ev,0)-(action==='bet'?row.ev:0))} expected profit forgone`}</p><details open><summary>Exact model input and output</summary><pre>{JSON.stringify({request:row.requests?.table,response:row.judgments.table?.raw,sourceRun:row.judgments.table?.sourceRun,sourceTrial:row.judgments.table?.sourceId,decidedAt:row.decidedAt,rolledAt:row.rolledAt},null,2)}</pre></details></section></div></section>;
}

function Verdict({ ev, action }: { ev: number; action: 'bet' | 'skip' }) {
  const verdict = actionVerdict(ev, action);
  return <span className={`ev-verdict ${verdict.correct ? 'verdict-correct' : 'verdict-incorrect'}`} role="img" tabIndex={0} aria-label={`${verdict.label}. ${verdict.explanation}`} title={`${verdict.label}. ${verdict.explanation}`}>{verdict.correct ? <CheckIcon aria-hidden="true" /> : <InformationCircleIcon aria-hidden="true" />}</span>;
}

function Decision({ ready, request, sent, round, arm, judgment, busy, ev, net, performance }: { ready:boolean; request: Record<string, unknown>; sent: boolean; round: number; arm: 'table' | 'calculated'; judgment?: Judgment; busy: boolean; ev: number; net?: number; performance: ReturnType<typeof sessionPerformance> }) {
  const total = performance.actualNet;
  const [payload, setPayload] = useState<{json: string; sent: boolean; round: number} | null>(null);
  function inspect() {
    const state = request.state as Record<string, unknown>;
    setPayload({json: JSON.stringify({rules: state.rules, ...(arm === 'calculated' ? {calculatedExpectedNetProfit: state.calculatedExpectedNetProfit} : {})}, null, 2), sent, round});
  }
  return <article className={`decision ${arm}`}><button type="button" className="arm-heading payload-trigger" aria-haspopup="dialog" aria-label={`Inspect ${arm === 'table' ? 'payout' : 'payout and EV'} JSON`} onClick={inspect}><div><h3>Payout table only</h3><span>{arm === 'table' ? 'Jev must infer EV from the payouts' : 'The arithmetic is supplied'}</span></div><ChevronRightIcon className="payload-chevron" /></button>
    <div className="input-note">{arm === 'table' ? <>{(request.state as Record<string,unknown>).recentRolls ? 'Sees JSON payouts and six recent rolls.' : 'Sees JSON payouts with no history.'}<br />The die is fair and independent.</> : <>Same information, plus:<br /><strong>Expected net profit: {signedDollars(ev)}</strong></>}</div>
    <div className={`judgment ${judgment ? 'has-judgment' : ''}`} aria-live="polite">{judgment ? <><span className="judgment-label">Jev’s selected action</span><strong className="action-word">{judgment.action === 'bet' ? 'Bet' : 'Skip'}{net !== undefined && <Verdict ev={ev} action={judgment.action} />}</strong></> : <><span className="waiting-line" /><strong>{busy ? 'Evaluating the offer…' : 'Decision not revealed'}</strong><span>{busy ? 'The roll is still unknown.' : ready?'Click Roll to run this offer.':'Start an experiment to run this offer.'}</span></>}</div>
    <div className="session-return"><span>{net === undefined ? 'Session net return' : `This roll ${signedDollars(net)} · Session net`}</span><strong className={total < 0 ? 'negative' : total > 0 ? 'positive' : ''}>{signedDollars(total)}</strong><dl className="performance-metrics"><div><dt>Total staked</dt><dd>{dollars(performance.staked)}</dd></div><div><dt>Expected net (EV)</dt><dd>{signedDollars(performance.expectedNet)}</dd></div><div><dt>EV / amount staked</dt><dd>{performance.expectedReturnPercent === null ? '—' : `${signed(performance.expectedReturnPercent)}%`}</dd></div></dl></div>
    <Dialog open={payload !== null} onClose={() => setPayload(null)} size="2xl" className="payload-dialog">
      <DialogTitle>{arm === 'table' ? 'Payout JSON' : 'Payout and expected value JSON'}</DialogTitle>
      <DialogDescription>Round {payload?.round} · {payload?.sent ? 'Payout fields from the submitted Jev request.' : 'Payout fields prepared for the next Jev request. Not sent yet.'}</DialogDescription>
      <DialogBody><pre className="payload-json">{payload?.json}</pre></DialogBody>
      <DialogActions><Button outline onClick={() => setPayload(null)}>Close</Button></DialogActions>
    </Dialog>
  </article>;
}

function StudyResults({ studies }: { studies: Studies }) {
  const table = studies.supplied.arms.find(arm => arm.format === 'table-only')!;
  const ev = studies.supplied.arms.find(arm => arm.format === 'supplied-ev')!;
  return <><div className="page-heading"><div><h1>What the experiments found</h1><p>Jev receives one question: Bet or Skip. Randomized payout faces, mixed positive and negative EV.</p></div><Badge color="zinc">Actual study data</Badge></div><section className="study-feature"><h2>One question. Bet or Skip.</h2><p>This earlier experiment asked only for the action. No Score, EV classification or win forecast is requested.</p><div className="table-scroll"><table className="study-table-data"><thead><tr><th>Offer return</th><th>Table: Bet / Skip</th><th>With EV: Bet / Skip</th></tr></thead><tbody>{studies.binary[0]?.byEv.map((row, i) => <tr key={row.ev}><td>{signed(row.ev)}%</td><td>{row.bets} / {row.skips}</td><td>{studies.binary[1].byEv[i].bets} / {studies.binary[1].byEv[i].skips}</td></tr>)}</tbody></table></div><p className="study-caveat">Earlier run: 360 current-offer-only calls with structured JSON payouts, mixed EV and randomized payout faces. Historical rolls and summaries are not sent. Correct action: Bet for positive EV, Skip for negative EV. Both conditions see the same payout table; one also receives calculated EV. Related scenarios are not independent samples. No Score cutoff is used.</p></section><details className="archive-studies"><summary>Earlier studies · included additional questions</summary><section className="study-feature"><h2>Calculating an advantage and recognizing one are different tasks.</h2><p>With only an explicit payout table, Jev selected positive EV for every offer. When the calculated EV was included, it correctly classified every tested offer.</p><div className="study-arms">{[table, ev].map((arm, index) => <div key={arm.format} className={index ? 'study-ev' : 'study-table'}><span>{index ? 'Table + calculated EV' : 'Payout table alone'}</span><strong>{percent(arm.correct / arm.calls)}</strong><span>{arm.correct} / {arm.calls} correct EV classifications</span></div>)}</div><div className="table-scroll"><table className="study-table-data"><thead><tr><th>True expected value</th><th>Table alone</th><th>Calculated EV</th></tr></thead><tbody>{table.byEv.map((row, index) => <tr key={row.label}><td>{row.label === 'zero' ? 'Zero' : row.label === 'negative' ? 'Negative' : 'Positive'} EV</td><td>{row.correct} / {row.calls}</td><td>{ev.byEv[index].correct} / {ev.byEv[index].calls}</td></tr>)}</tbody></table></div><p className="study-caveat">216 responses across 9 matched groups, two formats, and three repeats per input. The 100% result demonstrates classifying a supplied number—not independently discovering an advantage.</p></section><section className="study-feature"><h2>Does Jev reject negative-EV offers?</h2><p>New action controls use −$1, −$3 and −$5 of EV per $100 stake. Skipping preserves the bankroll and is the correct action.</p><div className="table-scroll"><table className="study-table-data"><thead><tr><th>Information supplied</th><th>Skip decisions</th><th>Bet decisions</th></tr></thead><tbody>{studies.negativeHistory.map(arm => <tr key={arm.format}><td>{arm.format === "table-only" ? "Payout table alone" : "Table + calculated EV"}</td><td>{arm.skips} / {arm.calls}</td><td>{arm.calls - arm.skips} / {arm.calls}</td></tr>)}</tbody></table></div><p className="study-caveat">360 responses across six matched blocks, two formats and three repeats. Histories match the earlier positive-EV study; these calls ran separately. Repeated responses are not independent observations.</p></section><section className="study-feature"><h2>A Score cutoff, tested on separate scenarios.</h2><p>Positive and negative offers were interleaved in one fresh 720-call experiment. Cutoffs maximize expected profit on 30-roll histories, then are evaluated on held-out 60-roll histories.</p><div className="table-scroll"><table className="study-table-data"><thead><tr><th>Information</th><th>Bet rule</th><th>Cutoff EV / offer</th><th>Jev action EV / offer</th><th>Bad bets / missed good bets</th></tr></thead><tbody>{studies.thresholds.map(arm => <tr key={arm.format}><td>{arm.format === 'table-only' ? 'Table only' : 'Calculated EV'}</td><td>{arm.cutoff > 2 ? 'Always skip' : `Score ≥ ${arm.cutoff}`}</td><td>{signedDollars(arm.heldOut.meanExpectedNet)}</td><td>{signedDollars(arm.directAction.meanExpectedNet)}</td><td>{arm.heldOut.negativeBets} / {arm.heldOut.positiveSkips}</td></tr>)}</tbody></table></div><p className="study-caveat">162 calibration and 162 held-out responses per condition, with matched histories and face permutations grouped together. No-history controls are excluded to keep calibration and evaluation on distinct historical scenarios. Always betting or skipping has 0 expected profit per offer in this balanced sample; the perfect-EV rule earns +$1.50. These are expected values, not simulated winnings. A fitted cutoff is a candidate for further validation, not a trading rule. It does not change Jev’s displayed action.</p></section><div className="study-other"><section><h2>History moved estimates, not actions.</h2><p>In the positive-EV action study, Jev chose “bet” in all {studies.history.reduce((sum, arm) => sum + arm.calls, 0)} calls. Estimated win probabilities still shifted with historical gains and losses.</p><p className="muted">All future offers were positive EV. Always betting cannot establish discrimination between good and bad offers.</p></section><section><h2>Repeated inputs can vary.</h2><p>All nine exact-repeat pairs in our cache probe changed answer values. One changed the selected EV category.</p><p className="muted">Neither response variation nor timing proves the provider’s internal cache behavior. Probability movement and action changes are measured separately.</p></section></div><div className="study-source"><DocumentTextIcon /><div><strong>Source: completed local experiments</strong><p>Supplied-EV comparison: 216 calls · Positive-EV actions: 360 calls · Negative-EV actions: 360 calls · Mixed-EV actions: 720 calls · Cache probe: 126 calls. Raw reports are retained in the project’s reports directory.</p></div></div></details></>;
}
function Findings({findings}:{findings:Studies['findings']}) {
 const correct=findings.groups.reduce((sum,g)=>sum+g.controlCorrect,0);
 const total=findings.current.metrics.find(g=>g.scenario==='all')?.calls??0;
 return <><div className="page-heading"><h1>Findings &amp; discussion</h1></div><div className="findings-content"><HistoryReport metrics={findings.current.metrics} interleaved={findings.current.interleaved}/><HistoryDiscussion/>
 <section className="study-feature"><h2>Supplying the expected value resolved the action task.</h2><p>In a separate supplied-EV control study, Jev chose the EV-optimal action in <strong>{correct.toLocaleString()} of {findings.calls.toLocaleString()} cases ({(correct/findings.calls*100).toFixed(0)}%)</strong>. It bet on positive EV and skipped negative EV across the three tested history conditions.</p><p>This control supplied the calculated expected net profit. It demonstrates using an explicit EV signal, rather than deriving it from payouts. Supplied EV was not tested again in the latest interleaved experiments.</p><div className="table-scroll control-results"><table className="study-table-data"><caption>Separate supplied-EV control · no-history condition not tested</caption><thead><tr><th scope="col">History</th><th scope="col">Correct actions</th><th scope="col">Accuracy</th></tr></thead><tbody>{findings.groups.map(g=><tr key={g.scenario}><th scope="row">{g.scenario==='mixed'?'Mixed outcomes':g.scenario==='wins'?'Six wins':'Six losses'}</th><td>{g.controlCorrect.toLocaleString()} / {g.calls.toLocaleString()}</td><td>{(100*g.controlCorrect/g.calls).toFixed(0)}%</td></tr>)}</tbody></table></div><p className="study-caveat">Control source: {findings.provenance}. This result applies to the tested offers and prompt, not to every numerical or trading decision.</p></section>
 <p className="ledger-footnote">{total.toLocaleString()} decisions across ±1%, ±5% and ±15% ranges. Latest experiment source: {findings.current.provenance}.</p></div></>;
}

function Guide(){return <><div className="page-heading"><h1>From payouts to a decision.</h1></div><section className="guide-content"><h2>The central question</h2><p>Can Jev infer whether a bet is worthwhile from its payout table, and do recent wins or losses sway that choice? The live lab supplies structured payouts, fair-die rules and six controlled recent outcomes. Calculated EV, bankroll and stake fields are not sent.</p><h2>One click, one decision</h2><p>Roll sends one Bet/Skip question to Jev. The decision is saved before the die outcome is generated. The rolled payout row is highlighted and the next offer appears. Autoplay stops after 30 rolls. Inspect the payout heading or expand a completed log entry for exact request details.</p><h2>Recorded experiments</h2><p>Each history/magnitude combination contains 1,000 recorded offers. All combines the four conditions into 4,000 samples at the selected magnitude. The six-roll histories are controlled inputs, not a rolling feed of new simulation outcomes.</p><h2>Expected profit and the benchmark</h2><p>Bets have fixed size. The experiment curve adds the offered EV when Jev bets and zero when it skips. Optimal EV adds only positive offered EV. Actual outcomes do not enter either curve. A win does not make a negative-EV bet correct.</p><h2>The supplied-EV control</h2><p>Adding calculated EV led to 100% correct actions in the recorded sample. Findings &amp; discussion preserves that result and its limits. The live lab now focuses on the unresolved task of calculating EV from payouts.</p></section></>;}
