import { randomInt, randomUUID } from 'node:crypto';
import { readFile, writeFile, rename, mkdir, open, unlink, appendFile } from 'node:fs/promises';
import path from 'node:path';
import dataset from '../data/recorded-study.json';
import mixedData from '../data/mixed-study.json';
import faceData from '../data/face-study.json';
import binaryData from '../data/binary-study.json';
import offerData from '../data/offer-only-study.json';
import { offerOnlyState } from './offer-only.ts';
import { binaryQuestions, parseBinaryAction } from './binary-action.ts';
import type { summarizeBinary } from './binary-action.ts';
import type { analyzeThresholds } from './score-threshold';
const mixedDataset = mixedData as unknown as { provenance: string; cases: typeof dataset.cases; results: typeof dataset.results; thresholds: ReturnType<typeof analyzeThresholds> };
const faceDataset = faceData as unknown as typeof mixedDataset;
const binaryDataset = binaryData as unknown as Omit<typeof mixedDataset, 'thresholds'> & { summary: ReturnType<typeof summarizeBinary> };

import { contextProxy, inputCost } from './usage.ts';
import { MODEL } from './lab-types.ts';
import type { LabConfig, LabSession, LabRound, Judgment } from './lab-types.ts';

const offerDataset = offerData as unknown as typeof binaryDataset;
const root = path.join(process.cwd(), 'reports', 'web');
export const studySummaries = { ...dataset.studies, thresholds: faceDataset.thresholds, binary: offerDataset.summary };
export const liveAvailable = () => !!process.env.TYPESAFE_API_KEY?.trim();
export function validateConfig(value: unknown): LabConfig {
  const c = value as LabConfig;
  if (!c || !['recorded', 'live'].includes(c.mode) || !(c.ev === 'mixed' || [-5, -3, -1, 1, 3, 5].includes(c.ev)) || !['gain', 'flat', 'loss'].includes(c.returns) || !['mixed', 'win-streak', 'loss-streak'].includes(c.ending)) throw new Error('Choose a valid offer and history.');
  if (c.mode === 'live' && !liveAvailable()) throw new Error('Live mode needs TYPESAFE_API_KEY on the server. Recorded mode is available.');
  return { mode: c.mode, ev: c.ev, returns: c.returns, ending: c.ending };
}
function round(config: LabConfig, number: number, ev: number, study?: 'faces' | 'binary' | 'offer-only'): LabRound {
  const replayRepeat = (config.ev === 'mixed' ? Math.floor((number - 1) / 6) : number - 1) % 3;
  const source = (study === 'offer-only' ? offerDataset : study === 'binary' ? binaryDataset : study === 'faces' ? faceDataset : config.ev === 'mixed' ? mixedDataset : dataset).cases.find(c => c.ev === ev && c.length === 30 && c.returns === config.returns && c.ending === config.ending && (!study || c.repeat === replayRepeat))!;
  const displaySource = study === 'offer-only' ? binaryDataset.cases.find(c => c.id === source.id)! : source;
  const gross = source.state.rules.payoutTable.split('\n').slice(2).map(row => Number(row.split('|')[4].trim()));
  return { number, replayRepeat, ev, stake: 100, gross, bankroll: 10000,
    historyFaces: displaySource.state.history!.map(row => row.face), historicalNet: displaySource.state.historicalSummary!.totalNetProfit,
    state: structuredClone(source.state) as unknown as Record<string, unknown>, judgments: {} };
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
  const validated = validateConfig(config);
  await mkdir(root, { recursive: true });
  const offerSequence = Array.from({ length: 5 }, () => {
    const offers = [-5, -3, -1, 1, 3, 5];
    for (let i = offers.length - 1; i > 0; i--) { const j = randomInt(i + 1); [offers[i], offers[j]] = [offers[j], offers[i]]; }
    return offers;
  }).flat();
  const session: LabSession = { study: 'offer-only', offerSequence, id: randomUUID(), config: validated, createdAt: new Date().toISOString(), round: round(validated, 1, validated.ev === 'mixed' ? offerSequence[0] : validated.ev, 'offer-only'), ledger: [], totals: { table: 0, calculated: 0 } };
  await save(session);
  return session;
}
export async function readSession(id: string): Promise<LabSession> { return JSON.parse(await readFile(file(id), 'utf8')); }
function mapJudgment(response: Record<string, unknown>, sourceId?: string): Judgment {
  const parsed = parseBinaryAction(response);
  const usage = response.usage as { input_tokens?: number };
  return { action: parsed.action, model: String(response.model), inputTokens: usage?.input_tokens ?? 0, raw: response, sourceId };
}
function recorded(session: LabSession, format: 'table-only' | 'supplied-ev') {
  const cfg = session.config;
  const source = (session.study === 'offer-only' ? offerDataset : session.study === 'binary' ? binaryDataset : session.study === 'faces' ? faceDataset : cfg.ev === 'mixed' ? mixedDataset : dataset).results.find(r => r.length === 30 && r.ev === session.round.ev && r.returns === cfg.returns && r.ending === cfg.ending && r.format === format && r.repeat === (cfg.ev === 'mixed' ? Math.floor((session.round.number - 1) / 6) : session.round.number - 1) % 3)!;
  if (!source) throw new Error('Recorded study is still being prepared. Try again shortly.');
  return { ...mapJudgment(source.response as unknown as Record<string, unknown>, source.id), sourceRun: session.study === 'offer-only' ? offerDataset.provenance : session.study === 'binary' ? binaryDataset.provenance : session.study === 'faces' ? faceDataset.provenance : cfg.ev === 'mixed' ? mixedDataset.provenance : session.round.ev < 0 ? dataset.negativeProvenance : dataset.provenance };
}
async function evaluate(session: LabSession, arm: 'table' | 'calculated') {
  if (session.study !== 'offer-only') throw new Error('Start a new session to use current-offer-only inputs. Previous results remain saved.');
  const state = offerOnlyState(session.round.state);
  if (arm === 'calculated') state.calculatedExpectedNetProfit = { value: session.round.ev, units: 'bankroll units per next bet',
    calculation: `(${session.round.gross.map(gross => gross - session.round.stake).join(' + ')}) / 6 = ${session.round.ev}`,
    note: 'This is net profit after deducting the stake once. Skipping has expected net profit zero.' };
  const body = { model: MODEL, state, questions: binaryQuestions };
  session.round.requests ??= {};
  session.round.requests[arm] = body;
  if (session.config.mode === 'recorded') return recorded(session, arm === 'table' ? 'table-only' : 'supplied-ev');
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
      for (const arm of ['table', 'calculated'] as const) {
        if (!current.judgments[arm]) { current.judgments[arm] = await evaluate(session, arm); await save(session); }
      }
      current.decidedAt ??= new Date().toISOString();
    } else if (action === 'roll') {
      if (!current.decidedAt) throw new Error('Reveal both decisions before rolling.');
      if (current.face !== undefined) return session;
      current.face = randomInt(1, 7);
      current.net = current.gross[current.face - 1] - current.stake;
      current.returns = { table: current.judgments.table!.action === 'bet' ? current.net : 0, calculated: current.judgments.calculated!.action === 'bet' ? current.net : 0 };
      current.rolledAt = new Date().toISOString();
      session.totals.table += current.returns.table;
      session.totals.calculated += current.returns.calculated;
      session.ledger.push(structuredClone(current));
    } else if (action === 'next') {
      if (current.face === undefined) throw new Error('Roll before starting the next round.');
      if (current.number >= 30) throw new Error('This session is complete. Start a new experiment.');
      session.study = 'offer-only';
      session.round = round(session.config, current.number + 1, session.config.ev === 'mixed' ? session.offerSequence![current.number] : session.config.ev, session.study);
    } else throw new Error('Unknown step.');
    await save(session);
    return session;
  } finally { await lock.close(); await unlink(`${target}.lock`); }
}
export function sessionCost(session: LabSession) {
  const rounds = [...session.ledger, ...(session.round.face === undefined ? [session.round] : [])];
  return session.config.mode === 'recorded' ? 0 : inputCost(rounds.reduce((sum, r) => sum + Object.values(r.judgments).reduce((total, j) => total + j.inputTokens, 0), 0));
}
