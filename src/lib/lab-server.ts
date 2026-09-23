import {choiceThresholdMetrics} from './binary-action.ts';
import {noulThresholdMetrics} from './noul-action.ts';
import {historyMetrics} from './history-experiment';
import { historyPlan, historyRequest, withoutRecentHistory, type HistoryStudy, type Scenario } from './history-experiment.ts';
import { randomInt, randomUUID } from 'node:crypto';
import { readFile, writeFile, rename, mkdir, open, unlink, appendFile, stat } from 'node:fs/promises';
import path from 'node:path';
import dataset from '../data/recorded-study.json';
import faceData from '../data/face-study.json';
import structuredData from '../data/structured-study.json';
import historyControl from '../data/history-control-summary.json';
import { parseBinaryAction } from './binary-action.ts';
import type { summarizeBinary } from './binary-action.ts';
import type { analyzeThresholds } from './score-threshold';
const faceDataset = faceData as unknown as { thresholds: ReturnType<typeof analyzeThresholds> };

import { contextProxy, inputCost } from './usage.ts';
import { MODEL } from './lab-types.ts';
import type { LabConfig, LabSession, LabRound, Judgment } from './lab-types.ts';

const structuredDataset = structuredData as unknown as { summary: ReturnType<typeof summarizeBinary> };
const root = path.join(process.cwd(), 'reports', 'web');
export const studySummaries = { ...dataset.studies, thresholds: faceDataset.thresholds, binary: structuredDataset.summary };
export const liveAvailable = () => !!process.env.TYPESAFE_API_KEY?.trim();
const historyCaches = new Map<string, { modified: number; value: Promise<HistoryStudy> }>();
export async function readHistoryStudy(primitive: 'choice' | 'noul' = 'choice'): Promise<HistoryStudy> {
 const filename=path.join(process.cwd(),primitive==='noul'?'src/data/noul-study.json':'src/data/history-study.json');
 const modified=(await stat(filename)).mtimeMs;
 let cached=historyCaches.get(primitive);
 if(!cached || cached.modified!==modified) {
  const value=readFile(filename,'utf8').then(raw=>JSON.parse(raw) as HistoryStudy);
  cached={modified,value};historyCaches.set(primitive,cached);
  value.catch(()=>{if(historyCaches.get(primitive)?.value===value)historyCaches.delete(primitive);});
 }
 return cached.value;
}
export function validateConfig(value: unknown): LabConfig {
 const c=value as LabConfig;
 if(!c || !['recorded','live'].includes(c.mode) || ![1,5,15].includes(c.magnitude) || !['mixed','win-streak','loss-streak','no-history'].includes(c.ending))throw new Error('Choose a valid EV range and recent-roll scenario.');
 if(c.mode==='live'&&!liveAvailable())throw new Error('Live mode needs TYPESAFE_API_KEY on the server. Recorded mode is available.');
 return {mode:c.mode,magnitude:c.magnitude,ending:c.ending};
}
function scenario(config:LabConfig):Scenario { return config.ending==='no-history'?'no-history':config.ending==='win-streak'?'wins':config.ending==='loss-streak'?'losses':'mixed'; }
async function round(config:LabConfig,number:number):Promise<LabRound> {
 const trials=config.mode==='recorded'?(await readHistoryStudy()).rows:historyPlan();
 const source=trials.find(t=>t.magnitude===config.magnitude&&t.scenario===(config.mode==='live'&&config.ending==='no-history'?'mixed':scenario(config))&&t.number===number)!;
 const trial=config.ending==='no-history'?withoutRecentHistory(source):source;
 return {number,ev:trial.ev,stake:100,gross:trial.gross,bankroll:10000,historyFaces:trial.history.map(r=>r.face),historicalNet:trial.history.reduce((s,r)=>s+r.netProfit,0),state:trial.state,judgments:{}};
}
function file(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/.test(id)) throw new Error('Invalid session. Start a new experiment.');
  return path.join(root, `${id}.json`);
}
async function save(session: LabSession) {
  const target = file(session.id), temp = `${target}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(session));
  await rename(temp, target);
}
export async function createSession(config: unknown) {
 const validated=validateConfig(config);
 if(validated.mode==='recorded')await readHistoryStudy();
 await mkdir(root,{recursive:true});
 const session:LabSession={study:validated.mode==='live'?'payout-live-v1':'history-v1',id:randomUUID(),config:validated,createdAt:new Date().toISOString(),round:await round(validated,1),ledger:[],totals:{table:0,calculated:0}};
 await save(session);return session;
}
export async function readSession(id: string): Promise<LabSession> { return JSON.parse(await readFile(file(id), 'utf8')); }
function mapJudgment(response: Record<string, unknown>, sourceId?: string): Judgment {
  const parsed = parseBinaryAction(response);
  const usage = response.usage as { input_tokens?: number };
  return { action: parsed.action, model: String(response.model), inputTokens: usage?.input_tokens ?? 0, raw: response, sourceId };
}
async function recorded(session:LabSession,arm:'table'|'calculated') {
 const study=await readHistoryStudy();
 const source=study.rows.find(r=>r.magnitude===session.config.magnitude&&r.scenario===scenario(session.config)&&r.number===session.round.number);
 if(!source)throw new Error('This recording is unavailable. Start a new session.');
 if(JSON.stringify(source.decisions[arm]!.request)!==JSON.stringify(session.round.requests?.[arm]))throw new Error('Recorded input mismatch. Start a new session.');
 return {...mapJudgment(source.decisions[arm]!.response,source.id),sourceRun:source.sourceRun??study.provenance};
}
async function evaluate(session: LabSession, arm: 'table' | 'calculated') {
  if(session.study!==(session.config.mode==='live'?'payout-live-v1':'history-v1'))throw new Error('Start a new session for the six-roll history experiment. Earlier results remain saved.');
  const body=historyRequest(session.round,arm);
  session.round.requests ??= {};
  session.round.requests[arm] = body;
  if (session.config.mode === 'recorded') return recorded(session, arm);
  if (contextProxy(body) > 32000) throw new Error('History exceeds the context limit. Start a new session.');
  const log = path.join(root, `${session.id}.jsonl`);
  await appendFile(log, JSON.stringify({ event: 'request', at: new Date().toISOString(), round: session.round.number, arm, body }) + '\n');
  const response = await fetch('https://api.typesafe.ai/v1/systemone', { method: 'POST', headers: { Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  const raw = await response.text();
  await appendFile(log, JSON.stringify({ event: 'response', at: new Date().toISOString(), round: session.round.number, arm, status: response.status, raw }) + '\n');
  if (!response.ok) throw new Error(`JEV returned HTTP ${response.status}. Retry the unfinished evaluation.`);
  const judgment = mapJudgment(JSON.parse(raw));
  if (judgment.model !== MODEL) throw new Error('JEV returned an unexpected model version.');
  return judgment;
}
export async function actOnSession(id: string, action: 'evaluate' | 'roll' | 'next', expectedRound: number) {
  const target = file(id);
  const lock = await open(`${target}.lock`, 'wx').catch(() => { throw new Error('This session is busy. Wait for the current step to finish.'); });
  try {
    const session = await readSession(id);
    if (session.round.number !== expectedRound) throw new Error('This round has already advanced. Reload the session.');
    const current = session.round;
    if (action === 'evaluate') {
      if (current.face !== undefined) return session;
      for (const arm of (session.config.mode==='live'?['table']:['table','calculated']) as ('table'|'calculated')[]) {
        if (!current.judgments[arm]) { current.judgments[arm] = await evaluate(session, arm); await save(session); }
      }
      current.decidedAt ??= new Date().toISOString();
    } else if (action === 'roll') {
      if (!current.decidedAt) throw new Error('Get the model decision before rolling.');
      if (current.face !== undefined) return session;
      current.face = randomInt(1, 7);
      current.net = current.gross[current.face - 1] - current.stake;
      current.returns = { table: current.judgments.table!.action === 'bet' ? current.net : 0, calculated: current.judgments.calculated?.action === 'bet' ? current.net : 0 };
      current.rolledAt = new Date().toISOString();
      session.totals.table += current.returns.table;
      session.totals.calculated += current.returns.calculated;
      session.ledger.push(structuredClone(current));
    } else if (action === 'next') {
      if (current.face === undefined) throw new Error('Roll before starting the next round.');
      if (current.number >= 30) throw new Error('This session is complete. Start a new experiment.');
      session.study = session.config.mode==='live'?'payout-live-v1':'history-v1';
      session.round = await round(session.config, current.number + 1);
    } else throw new Error('Unknown step.');
    await save(session);
    return session;
  } finally { await lock.close(); await unlink(`${target}.lock`); }
}
export function sessionCost(session: LabSession) {
  const rounds = [...session.ledger, ...(session.round.face === undefined ? [session.round] : [])];
  return session.config.mode === 'recorded' ? 0 : inputCost(rounds.reduce((sum, r) => sum + Object.values(r.judgments).reduce((total, j) => total + j.inputTokens, 0), 0));
}

export async function historyFindings() {
 const [study,noul]=await Promise.all([readHistoryStudy(),readHistoryStudy('noul')]);
 const expectedProfit=(s:HistoryStudy)=>Number(s.rows.reduce((sum,r)=>sum+(r.decisions.table.action==='bet'?r.ev:0),0).toFixed(2));
 return {...historyControl,noul:{choiceThresholds:choiceThresholdMetrics(study.rows),optimalExpectedProfit:Number(study.rows.reduce((sum,r)=>sum+Math.max(0,r.ev),0).toFixed(2)),thresholds:noulThresholdMetrics(noul.rows),provenance:noul.provenance,metrics:historyMetrics(noul.rows),expectedProfit:expectedProfit(noul),choiceExpectedProfit:expectedProfit(study)},current:{provenance:study.provenance,interleaved:study.rows.every(r=>r.id.startsWith('interleaved-v2-')),metrics:historyMetrics(study.rows)}};
}
