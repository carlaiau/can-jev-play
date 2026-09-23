import type { LabRound } from './lab-types.ts';

export function sessionPerformance(ledger: LabRound[], arm: 'table' | 'calculated') {
  let staked = 0, expectedNet = 0, actualNet = 0;
  for (const row of ledger) {
    if (row.face === undefined) continue;
    if (row.judgments[arm]?.action === 'bet') {
      staked += row.stake;
      expectedNet += row.ev;
    }
    actualNet += row.returns?.[arm] ?? 0;
  }
  return { staked, expectedNet, actualNet, expectedReturnPercent: staked ? 100 * expectedNet / staked : null };
}

/** Count decisions once, including the current decision before its outcome is known. */
export function sessionDecisionRates(ledger:LabRound[],current?:LabRound) {
 const rounds=new Map(ledger.map(row=>[row.number,row]));
 if(current)rounds.set(current.number,current);
 let decisions=0,bets=0,positive=0,correctBet=0,negative=0,correctSkip=0,correct=0;
 for(const row of rounds.values()) {
  const action=row.judgments.table?.action;if(!action)continue;
  decisions++;if(action==='bet')bets++;
  if(row.ev>0){positive++;if(action==='bet'){correctBet++;correct++;}}
  else if(row.ev<0){negative++;if(action==='skip'){correctSkip++;correct++;}}
  else correct++;
 }
 return {decisions,bets,positive,correctBet,negative,correctSkip,correct};
}
