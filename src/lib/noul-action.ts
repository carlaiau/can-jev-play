/** A positive-EV proposition with the same risk-neutral objective as Choice. */
export const noulQuestions = { action: {
  type: 'noul' as const,
  instructions: 'Does betting on this one independent roll have strictly positive expected net profit under the risk-neutral objective?',
  criteria: {
    true: 'Betting has higher expected net profit than skipping, which returns zero.',
    false: 'Betting has expected net profit less than or equal to zero.',
  },
} };

export function parseNoulAction(raw: unknown) {
  const response = raw as Record<string, unknown>;
  const answers = response?.answers as Record<string, {type?: string; noul?: unknown}> | undefined;
  const probability = answers?.action?.noul;
  if (typeof response?.model !== 'string' || answers?.action?.type !== 'noul' ||
      typeof probability !== 'number' || !Number.isFinite(probability) || probability < 0 || probability > 1) {
    throw new Error('Invalid Noul action response');
  }
  // Predeclared boundary: an exact 0.5 tie defaults to Skip.
  return { action: probability > 0.5 ? 'bet' as const : 'skip' as const, probability, response };
}

export function noulThresholdMetrics(rows: {ev:number;decisions:{table:{response:Record<string,unknown>}}}[]) {
  const values=rows.map(row=>({ev:row.ev,probability:parseNoulAction(row.decisions.table.response).probability}));
  return [0.5,0.6,0.7,0.8,0.9].map(threshold=>{
    const positives=values.filter(r=>r.ev>0),negatives=values.filter(r=>r.ev<0);
    const bets=values.filter(r=>r.probability>threshold);
    const correctBet=positives.filter(r=>r.probability>threshold).length;
    const correctSkip=negatives.filter(r=>r.probability<=threshold).length;
    return {threshold,calls:values.length,bets:bets.length,positive:positives.length,negative:negatives.length,correctBet,correctSkip,correct:correctBet+correctSkip,expectedProfit:Number(bets.reduce((sum,r)=>sum+r.ev,0).toFixed(2))};
  });
}
