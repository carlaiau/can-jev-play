'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { sessionPerformance } from '../lib/session-performance';
import { actionVerdict } from '../lib/action-verdict';
import { Button } from './catalyst/button';
import { Select } from './catalyst/select';
import { Badge } from './catalyst/badge';
import { ArrowRightIcon, ArrowDownTrayIcon, ArrowPathIcon, BeakerIcon, ChartBarIcon, CheckIcon, ChevronRightIcon, DocumentTextIcon, InformationCircleIcon, PlayIcon, PlusIcon } from '@heroicons/react/24/outline';
import type { summarizeBinary } from '../lib/binary-action';
import type { analyzeThresholds } from '../lib/score-threshold';
import type { LabConfig, LabSession, Judgment } from '../lib/lab-types';

type Studies = { binary: ReturnType<typeof summarizeBinary>; thresholds: ReturnType<typeof analyzeThresholds>; payout: { arms: { format: string; correct: number; calls: number; byEv: { label: string; correct: number; calls: number }[] }[] }; supplied: { arms: { format: string; correct: number; calls: number; byEv: { label: string; correct: number; calls: number }[] }[] }; negativeHistory: { format: string; skips: number; calls: number }[]; history: { format: string; skips: number; calls: number }[] };
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const dollars = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const signedDollars = (n: number) => `${n > 0 ? '+' : ''}${dollars(n)}`;
const percent = (n: number) => `${(n * 100).toFixed(0)}%`;
const initial: LabConfig = { mode: 'recorded', ev: 'mixed', returns: 'loss', ending: 'loss-streak' };

function Die({ face, large = false }: { face: number; large?: boolean }) {
  const dots = [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]][face] ?? [];
  return <span className={`die ${large ? 'die-large' : ''}`} role="img" aria-label={`Die showing ${face}`}><svg viewBox="0 0 30 30" aria-hidden="true">{dots.map(i => <circle key={i} cx={7 + (i % 3) * 8} cy={7 + Math.floor(i / 3) * 8} r="2.15" />)}</svg></span>;
}

export function Lab({ liveAvailable, studies }: { liveAvailable: boolean; studies: Studies }) {
  const [page, setPage] = useState<'lab' | 'results' | 'guide'>('lab');
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
    const id = localStorage.getItem('dice-lab-session');
    if (!id) { setRecovered(true); return () => { active = false; runVersion.current++; }; }
    (async () => {
      try {
        const response = await fetch('/api/lab', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'load', id }) });
        let data = await response.json();
        if (!active) return;
        if (data.session && data.session.study !== 'offer-only') { localStorage.setItem('dice-lab-previous-session', id); localStorage.removeItem('dice-lab-session'); return; }
        if (data.session?.round.face !== undefined && data.session.round.number < 30) {
          const next = await fetch('/api/lab', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'next', id, round: data.session.round.number }) });
          if (next.ok) data = await next.json();
        }
        if (!active) return;
        if (data.session) { setSession(data.session); setConfig(data.session.config); setCost(data.estimatedCost); }
        else localStorage.removeItem('dice-lab-session');
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
    const response = await fetch('/api/lab', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, id: current?.id, round: current?.round.number, config }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to complete this step.');
    setSession(data.session); setCost(data.estimatedCost); localStorage.setItem('dice-lab-session', data.session.id);
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
  function reset() { setAutoplay(false); setSession(null); setCost(0); setError(''); setExpandedRound(null); localStorage.removeItem('dice-lab-session'); }
  function download() {
    if (!session) return;
    const blob = new Blob([JSON.stringify({ ...session, displayCurrency: 'simulated dollars', performance: { table: sessionPerformance(session.ledger, 'table'), calculated: sessionPerformance(session.ledger, 'calculated') }, estimatedApiCost: cost, actionAssessments: session.ledger.map(row => ({ round: row.number, table: actionVerdict(row.ev, row.judgments.table!.action), calculated: actionVerdict(row.ev, row.judgments.calculated!.action) })), recordedJudgments: session.config.mode === 'recorded', outcomes: 'New server-generated simulated rolls, not historical study outcomes' }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `dice-lab-${session.id}.json`; link.click(); URL.revokeObjectURL(url);
  }
  const r = session?.round;
  const offerEv = r?.ev ?? (config.ev === 'mixed' ? 1 : config.ev);
  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="Dice Lab home"><span className="brand-die"><Die face={5} /></span><span>Dice Lab<span className="brand-sub">An experiment in judgment</span></span></a>
      <nav aria-label="Main navigation">
        <button className={page === 'lab' ? 'nav-active' : ''} onClick={() => setPage('lab')}><BeakerIcon /> Experiment lab <ChevronRightIcon className="nav-chevron" /></button>
        <button className={page === 'results' ? 'nav-active' : ''} onClick={() => setPage('results')}><ChartBarIcon /> Study results</button>
        <button className={page === 'guide' ? 'nav-active' : ''} onClick={() => setPage('guide')}><DocumentTextIcon /> How it works</button>
      </nav>
      <div className="sidebar-note"><span className="status-dot" /> Independent rolls.<br /><span>Human questions.</span><p>A small laboratory for examining what a model believes—and what it bets on.</p><span className="version">JEV 1.13.0 · Play money only</span></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><span>Research workspace <span className="slash">/</span> <strong>{page === 'lab' ? 'Experiment lab' : page === 'results' ? 'Study results' : 'How it works'}</strong></span><div><span className="model-tag"><span className="status-dot" /> jev-1.13.0</span><span className="top-label">Independent six-sided rolls</span></div></header>
      <main id="main-content">
      {page === 'lab' ? <>
        <div className="page-heading"><div><h1>Same dice. Different information.</h1><p>See how JEV acts with a payout table—and with the math already done.</p></div><Button outline onClick={() => setPage('results')}><ChartBarIcon data-slot="icon" /> View the evidence</Button></div>
        <div className="experiment-controls">
          <label><span>Response source</span><Select aria-label="Response source" value={config.mode} disabled={!!session || !!busy} onChange={e => setConfig({ ...config, mode: e.target.value as LabConfig['mode'] })}><option value="recorded">Recorded study</option><option value="live" disabled={!liveAvailable}>Live JEV{!liveAvailable ? ' · key required' : ''}</option></Select></label>
          <label><span>Future offer</span><Select aria-label="Future offer" value={config.ev} disabled={!!session || !!busy} onChange={e => setConfig({ ...config, ev: e.target.value === 'mixed' ? 'mixed' : Number(e.target.value) })}><option value="mixed">Mixed +EV / −EV offers</option>{[1, 3, 5, -1, -3, -5].map(value => <option key={value} value={value}>{signed(value)}% expected return</option>)}</Select></label>
          <label><span>Displayed history</span><Select aria-label="Historical return" value={config.returns} disabled={!!session || !!busy} onChange={e => setConfig({ ...config, returns: e.target.value as LabConfig['returns'] })}><option value="loss">Losses · −$600</option><option value="flat">Flat · $0</option><option value="gain">Gains · +$600</option></Select></label>
          <label><span>Last six rolls</span><Select aria-label="Last six rolls" value={config.ending} disabled={!!session || !!busy} onChange={e => setConfig({ ...config, ending: e.target.value as LabConfig['ending'] })}><option value="loss-streak">Six losses</option><option value="mixed">Mixed outcomes</option><option value="win-streak">Six wins</option></Select></label>
          {session ? <Button outline disabled={!!busy} onClick={reset}><PlusIcon data-slot="icon" /> New session</Button> : <Button color="green" disabled={!!busy || !recovered} onClick={start}>{busy === 'create' ? 'Preparing…' : 'Start experiment'}<ArrowRightIcon data-slot="icon" /></Button>}
        </div>
        <div className="provenance"><span className={`source-dot ${config.mode}`} /><strong>{config.mode === 'recorded' ? 'Recorded responses. New simulated rolls.' : 'Live responses. Two JEV calls per round.'}</strong><span>{config.mode === 'recorded' ? 'Bet or Skip, using only the current offer. No API charges.' : `Server-side API · estimated session cost $${cost.toFixed(5)}`}</span></div>
        {error && <div className="error" role="alert"><InformationCircleIcon /><span>{error}</span></div>}
            <div className="round-toolbar session-toolbar"><span role="status">{busy === 'evaluate' ? 'Getting JEV’s decisions…' : busy === 'rolling' ? 'Decisions locked. Rolling…' : busy === 'outcome' ? 'Roll complete' : busy === 'transition' ? 'Preparing the next offer…' : r?.number === 30 && r.face !== undefined ? 'Experiment complete' : autoplay ? 'Autoplay · stops after 30 rounds' : 'Review the offer · 30 rounds maximum'}</span><div className="play-controls"><Button outline disabled={!session || (session.ledger.length >= 30 && !autoplay)} onClick={() => setAutoplay(value => !value)} aria-pressed={autoplay}>{autoplay ? 'Pause autoplay' : 'Autoplay'}</Button><Button color="green" disabled={!session || autoplay || !!busy || (r?.number === 30 && r.face !== undefined)} onClick={runRound}>{busy ? <><ArrowPathIcon data-slot="icon" className="spin" />{busy === 'evaluate' ? 'Deciding…' : busy === 'rolling' ? 'Rolling…' : busy === 'outcome' ? 'Result' : 'Next offer…'}</> : r?.number === 30 && r.face !== undefined ? 'Complete' : r?.face !== undefined ? 'Next offer' : <><PlayIcon data-slot="icon" />Roll</>}</Button></div></div>
        <div className={`lab-grid phase-${busy || 'ready'}`}>
          <section key={r?.number ?? 0} className="offer-panel" aria-labelledby="offer-heading">
            <div className="panel-heading"><h2 id="offer-heading">The next offer</h2><Badge color={(offerEv) > 0 ? "green" : "red"}>{(offerEv) > 0 ? "+EV" : "−EV"}</Badge></div>
            <table className="payout-table"><caption className="sr-only">Payout by die face. Each face has probability one sixth.</caption><thead><tr><th>Face</th><th>Gross payout</th><th>Net profit</th></tr></thead><tbody>{(r?.gross ?? [0, 0, 0, 190, 200, 210 + 6 * offerEv]).map((gross, index) => <tr key={index} className={r?.face === index + 1 ? 'selected-roll' : ''}><td><Die face={index + 1} /><span className="face-number">{index + 1}</span>{r?.face === index + 1 && <span className="rolled-label">Rolled</span>}</td><td>{dollars(gross)}</td><td className={gross > 100 ? 'positive' : 'negative'}>{signedDollars(gross - 100)}</td></tr>)}</tbody></table>
            <div className="expected-line"><span>Expected return</span><strong className={(offerEv) < 0 ? "negative" : "positive"}>{signed(100 * offerEv / (r?.stake ?? 100))}%</strong></div>
            <div className="history-heading"><h3>What happened before</h3><span>{r ? '30 rolls' : 'Selected scenario'}</span></div>
            {r ? <><div className="history-strip" aria-label="Historical rolls, oldest to newest">{r.historyFaces.map((face, i) => <span key={i} className={face >= 4 ? 'history-win' : 'history-loss'} title={`Roll ${i + 1}: ${face}, ${face >= 4 ? 'won' : 'lost'}`}>{face}</span>)}</div><div className="history-legend"><span><i className="legend-win" /> Win</span><span><i className="legend-loss" /> Loss</span><span>Oldest → newest</span></div><div className="history-total"><span>Historical net return</span><strong className={r.historicalNet < 0 ? 'negative' : 'positive'}>{signedDollars(r.historicalNet)}</strong></div><p className="tiny">Not sent to JEV. Previous bets paid $200 on any win, with a $100 stake. The next offer uses the table above.</p></> : <div className="history-empty"><ChartBarIcon /><span>Your selected history appears here when you start. Mixed mode draws the first offer at the start; this table is a preview.</span></div>}
          </section>
          <section className="comparison-panel" aria-labelledby="comparison-heading">
            <div className="panel-heading"><h2 id="comparison-heading">Two views. One decision.</h2><span className="round-counter">Round {r?.number ?? '—'} <span>/ 30</span></span></div>

            <div className="comparison-columns">
              <Decision arm="table" judgment={r?.judgments.table} busy={busy === 'evaluate' && !r?.judgments.table} ev={offerEv} net={r?.returns?.table} performance={sessionPerformance(session?.ledger ?? [], 'table')} />
              <Decision arm="calculated" judgment={r?.judgments.calculated} busy={busy === 'evaluate' && !r?.judgments.calculated} ev={offerEv} net={r?.returns?.calculated} performance={sessionPerformance(session?.ledger ?? [], 'calculated')} />
            </div>
          </section>
        </div>
        <section className="ledger-section"><div className="ledger-title"><div><h2>The experiment log</h2><p>The offer, the decision, then the outcome. In that order.</p></div><Button outline onClick={download} disabled={!session}><ArrowDownTrayIcon data-slot="icon" /> Export JSON</Button></div>
          {session?.ledger.length ? <div className="table-scroll"><table className="ledger"><thead><tr><th>Round</th><th>Offered EV</th><th>Table only</th><th>With EV</th><th>Roll</th><th>Table return</th><th>EV return</th><th>Details</th></tr></thead><tbody>{[...session.ledger].reverse().map(row => <Fragment key={row.number}><tr><td>{String(row.number).padStart(2, '0')}</td><td>{signed(100 * row.ev / row.stake)}%</td><td><span className="action-with-verdict">{row.judgments.table?.action === 'bet' ? 'Bet' : 'Skip'}<Verdict ev={row.ev} action={row.judgments.table!.action} /></span></td><td><span className="action-with-verdict">{row.judgments.calculated?.action === 'bet' ? 'Bet' : 'Skip'}<Verdict ev={row.ev} action={row.judgments.calculated!.action} /></span></td><td><Die face={row.face!} /></td><td className={row.returns!.table < 0 ? 'negative' : 'positive'}>{signedDollars(row.returns!.table)}</td><td className={row.returns!.calculated < 0 ? 'negative' : 'positive'}>{signedDollars(row.returns!.calculated)}</td><td><button className="log-inspect-button" aria-expanded={expandedRound === row.number} aria-controls={`round-details-${row.number}`} aria-label={`${expandedRound === row.number ? 'Hide' : 'Show'} model details for round ${row.number}`} onClick={() => setExpandedRound(expandedRound === row.number ? null : row.number)}>{expandedRound === row.number ? 'Close' : 'Inspect'}<ChevronRightIcon /></button></td></tr>{expandedRound === row.number && <tr id={`round-details-${row.number}`} className="log-details"><td colSpan={8}><h3>Round {row.number} · Model input and output</h3><p>Each condition’s exact request and raw response, with its source recording. The outcome was generated after both decisions.</p><div className="log-json-columns">{(['table', 'calculated'] as const).map(arm => <section key={arm}><h4>{arm === 'table' ? 'Payout table only' : 'Calculated EV included'}</h4><pre>{JSON.stringify({ request: row.requests?.[arm], response: row.judgments[arm]?.raw, sourceRun: row.judgments[arm]?.sourceRun, sourceTrial: row.judgments[arm]?.sourceId, decidedAt: row.decidedAt, rolledAt: row.rolledAt }, null, 2)}</pre></section>)}</div></td></tr>}</Fragment>)}</tbody></table></div> : <div className="ledger-empty"><DocumentTextIcon /><div><strong>Your first round belongs here.</strong><p>Review the offer, reveal both judgments, and roll to begin the log.</p></div></div>}
          <p className="ledger-footnote">Each round evaluates its offer independently. New sessions use randomized payout faces. Mixed mode shuffles all six EV levels in each six-round block. Session returns accumulate simulated outcomes; they are not new model evidence. Recorded mode cycles through three saved face permutations.</p>
        </section>
      </> : page === 'results' ? <StudyResults studies={studies} /> : <Guide />}
      <footer className="footer"><span>Dice Lab · A controlled experiment in model judgment</span><span>Evidence before conclusions.</span></footer>
      </main>
    </div>
  </div>;
}

function Verdict({ ev, action }: { ev: number; action: 'bet' | 'skip' }) {
  const verdict = actionVerdict(ev, action);
  return <span className={`ev-verdict ${verdict.correct ? 'verdict-correct' : 'verdict-incorrect'}`} role="img" tabIndex={0} aria-label={`${verdict.label}. ${verdict.explanation}`} title={`${verdict.label}. ${verdict.explanation}`}>{verdict.correct ? <CheckIcon aria-hidden="true" /> : <InformationCircleIcon aria-hidden="true" />}</span>;
}

function Decision({ arm, judgment, busy, ev, net, performance }: { arm: 'table' | 'calculated'; judgment?: Judgment; busy: boolean; ev: number; net?: number; performance: ReturnType<typeof sessionPerformance> }) {
  const total = performance.actualNet;
  return <article className={`decision ${arm}`}><div className="arm-heading"><span className="arm-letter">{arm === 'table' ? 'A' : 'B'}</span><div><h3>{arm === 'table' ? 'Payout table only' : 'Calculated EV included'}</h3><span>{arm === 'table' ? 'Expected value not supplied' : 'The arithmetic is supplied'}</span></div></div>
    <div className="input-note">{arm === 'table' ? <>Sees the six payouts, probabilities,<br />and stake. No history.</> : <>Same information, plus:<br /><strong>Expected net profit: {signedDollars(ev)}</strong></>}</div>
    <div className={`judgment ${judgment ? 'has-judgment' : ''}`} aria-live="polite">{judgment ? <><span className="judgment-label">JEV’s selected action</span><strong className="action-word">{judgment.action === 'bet' ? 'Bet' : 'Skip'}{net !== undefined && <Verdict ev={ev} action={judgment.action} />}</strong></> : <><span className="waiting-line" /><strong>{busy ? 'Evaluating the offer…' : 'Decision not revealed'}</strong><span>{busy ? 'The roll is still unknown.' : 'Click Roll to run this offer.'}</span></>}</div>
    <div className="session-return"><span>{net === undefined ? 'Session net return' : `This roll ${signedDollars(net)} · Session net`}</span><strong className={total < 0 ? 'negative' : total > 0 ? 'positive' : ''}>{signedDollars(total)}</strong><dl className="performance-metrics"><div><dt>Total staked</dt><dd>{dollars(performance.staked)}</dd></div><div><dt>Expected net (EV)</dt><dd>{signedDollars(performance.expectedNet)}</dd></div><div><dt>EV / amount staked</dt><dd>{performance.expectedReturnPercent === null ? '—' : `${signed(performance.expectedReturnPercent)}%`}</dd></div></dl></div>
  </article>;
}

function StudyResults({ studies }: { studies: Studies }) {
  const table = studies.supplied.arms.find(arm => arm.format === 'table-only')!;
  const ev = studies.supplied.arms.find(arm => arm.format === 'supplied-ev')!;
  return <><div className="page-heading"><div><h1>What the experiments found</h1><p>JEV receives one question: Bet or Skip. Randomized payout faces, mixed positive and negative EV.</p></div><Badge color="zinc">Actual study data</Badge></div><section className="study-feature"><h2>One question. Bet or Skip.</h2><p>The current experiment asks only for the action. No Score, EV classification or win forecast is requested.</p><div className="table-scroll"><table className="study-table-data"><thead><tr><th>Offer return</th><th>Table: Bet / Skip</th><th>With EV: Bet / Skip</th></tr></thead><tbody>{studies.binary[0]?.byEv.map((row, i) => <tr key={row.ev}><td>{signed(row.ev)}%</td><td>{row.bets} / {row.skips}</td><td>{studies.binary[1].byEv[i].bets} / {studies.binary[1].byEv[i].skips}</td></tr>)}</tbody></table></div><p className="study-caveat">360 current-offer-only calls with mixed EV and randomized payout faces. Historical rolls and summaries are not sent. Correct action: Bet for positive EV, Skip for negative EV. Both conditions see the same payout table; one also receives calculated EV. Related scenarios are not independent samples. No Score cutoff is used.</p></section><details className="archive-studies"><summary>Earlier studies · included additional questions</summary><section className="study-feature"><h2>Calculating an advantage and recognizing one are different tasks.</h2><p>With only an explicit payout table, JEV selected positive EV for every offer. When the calculated EV was included, it correctly classified every tested offer.</p><div className="study-arms">{[table, ev].map((arm, index) => <div key={arm.format} className={index ? 'study-ev' : 'study-table'}><span>{index ? 'Table + calculated EV' : 'Payout table alone'}</span><strong>{percent(arm.correct / arm.calls)}</strong><span>{arm.correct} / {arm.calls} correct EV classifications</span></div>)}</div><div className="table-scroll"><table className="study-table-data"><thead><tr><th>True expected value</th><th>Table alone</th><th>Calculated EV</th></tr></thead><tbody>{table.byEv.map((row, index) => <tr key={row.label}><td>{row.label === 'zero' ? 'Zero' : row.label === 'negative' ? 'Negative' : 'Positive'} EV</td><td>{row.correct} / {row.calls}</td><td>{ev.byEv[index].correct} / {ev.byEv[index].calls}</td></tr>)}</tbody></table></div><p className="study-caveat">216 responses across 9 matched groups, two formats, and three repeats per input. The 100% result demonstrates classifying a supplied number—not independently discovering an advantage.</p></section><section className="study-feature"><h2>Does JEV reject negative-EV offers?</h2><p>New action controls use −$1, −$3 and −$5 of EV per $100 stake. Skipping preserves the bankroll and is the correct action.</p><div className="table-scroll"><table className="study-table-data"><thead><tr><th>Information supplied</th><th>Skip decisions</th><th>Bet decisions</th></tr></thead><tbody>{studies.negativeHistory.map(arm => <tr key={arm.format}><td>{arm.format === "table-only" ? "Payout table alone" : "Table + calculated EV"}</td><td>{arm.skips} / {arm.calls}</td><td>{arm.calls - arm.skips} / {arm.calls}</td></tr>)}</tbody></table></div><p className="study-caveat">360 responses across six matched blocks, two formats and three repeats. Histories match the earlier positive-EV study; these calls ran separately. Repeated responses are not independent observations.</p></section><section className="study-feature"><h2>A Score cutoff, tested on separate scenarios.</h2><p>Positive and negative offers were interleaved in one fresh 720-call experiment. Cutoffs maximize expected profit on 30-roll histories, then are evaluated on held-out 60-roll histories.</p><div className="table-scroll"><table className="study-table-data"><thead><tr><th>Information</th><th>Bet rule</th><th>Cutoff EV / offer</th><th>JEV action EV / offer</th><th>Bad bets / missed good bets</th></tr></thead><tbody>{studies.thresholds.map(arm => <tr key={arm.format}><td>{arm.format === 'table-only' ? 'Table only' : 'Calculated EV'}</td><td>{arm.cutoff > 2 ? 'Always skip' : `Score ≥ ${arm.cutoff}`}</td><td>{signedDollars(arm.heldOut.meanExpectedNet)}</td><td>{signedDollars(arm.directAction.meanExpectedNet)}</td><td>{arm.heldOut.negativeBets} / {arm.heldOut.positiveSkips}</td></tr>)}</tbody></table></div><p className="study-caveat">162 calibration and 162 held-out responses per condition, with matched histories and face permutations grouped together. No-history controls are excluded to keep calibration and evaluation on distinct historical scenarios. Always betting or skipping has 0 expected profit per offer in this balanced sample; the perfect-EV rule earns +$1.50. These are expected values, not simulated winnings. A fitted cutoff is a candidate for further validation, not a trading rule. It does not change JEV’s displayed action.</p></section><div className="study-other"><section><h2>History moved estimates, not actions.</h2><p>In the positive-EV action study, JEV chose “bet” in all {studies.history.reduce((sum, arm) => sum + arm.calls, 0)} calls. Estimated win probabilities still shifted with historical gains and losses.</p><p className="muted">All future offers were positive EV. Always betting cannot establish discrimination between good and bad offers.</p></section><section><h2>Repeated inputs can vary.</h2><p>All nine exact-repeat pairs in our cache probe changed answer values. One changed the selected EV category.</p><p className="muted">Neither response variation nor timing proves the provider’s internal cache behavior. Probability movement and action changes are measured separately.</p></section></div><div className="study-source"><DocumentTextIcon /><div><strong>Source: completed local experiments</strong><p>Supplied-EV comparison: 216 calls · Positive-EV actions: 360 calls · Negative-EV actions: 360 calls · Mixed-EV actions: 720 calls · Cache probe: 126 calls. Raw reports are retained in the project’s reports directory.</p></div></div></details></>;
}
function Guide() { return <><div className="page-heading"><div><h1>A decision before a roll.</h1><p>A controlled comparison, one offer at a time.</p></div></div><section className="guide-content"><h2>Two versions of the same information</h2><p>Both conditions receive the same fair die, payout table, fixed and stake. No history. Condition A must work out the expected value. Condition B also receives the calculated expected net profit.</p><h2>One click, one round</h2><p>Start with a history of gains, flat returns, or losses. Click Roll. Both model decisions are saved before the server generates a die outcome. The app highlights the rolled face, then transitions to the next offer automatically. Expand any experiment-log row to inspect its full inputs and outputs. Both decisions settle against the same face. A skip earns zero; a bet earns its gross payout minus the $100 stake.</p><h2>What recorded mode means</h2><p>The judgments are real responses from our completed study. The rolls are new simulations. The three recorded face permutations cycle as you advance. New sessions use fresh recorded responses for those exact payout tables. Mixed mode shuffles positive and negative offers together while keeping the selected historical condition. Fixed-offer mode repeats one scenario; accumulated session returns are illustrative, not independent new experimental observations.</p><h2>What live mode means</h2><p>The server asks JEV twice per round, once for each condition. Credentials stay on the server. Requests and raw responses are logged, and partial evaluations survive a retry. Both decisions complete before the roll is generated, within the single-click sequence.</p><h2>Session performance</h2><p>Dollar amounts are simulated play money. Expected net sums the EV of bets actually placed; skipped offers contribute zero. EV / amount staked divides that sum by total dollars wagered. A dash means no bets have been placed. Actual net follows the rolled outcomes. Autoplay finishes the current round when paused and stops at 30 rounds or on an error; it stays off after reload.</p><h2>Keep the quantities separate</h2><p>Expected value is an average over possible outcomes. JEV is asked only to choose Bet or Skip. The app does not ask for an EV classification, win forecast or Score. An individual win does not establish that a decision was sound, and an individual loss does not refute positive EV.</p><h2>The decision objective</h2><p>The model is asked to maximize expected bankroll after a single decision, under risk neutrality. Betting is the reference action for positive-EV offers; skipping is the reference action for negative-EV offers. The app is an experiment with play money, not a trading-performance test.</p></section></>; }
