
export type PayoutEntry = { face: number; grossPayout: number; netProfit: number };
export function payoutAmounts(state: Record<string, unknown>): number[] {
  const rules = state.rules as Record<string, unknown>;
  const values = Array.isArray(rules.payouts)
    ? (rules.payouts as PayoutEntry[]).map(row => row.grossPayout)
    : String(rules.payoutTable).split('\n').slice(2).map(row => Number(row.split('|')[4]?.trim()));
  if (values.length !== 6 || values.some(value => !Number.isFinite(value) || value < 0)) throw new Error('Invalid six-face payout schedule');
  return values;
}
export function structuredOfferState(state: Record<string, unknown>): Record<string, unknown> {
  const rules = state.rules as Record<string, unknown>;
  const gross = payoutAmounts(state);
  const existing = rules.payouts as PayoutEntry[] | undefined;
  const stake = Number(state.stake);
  const payouts: PayoutEntry[] = gross.map((grossPayout, index) => {
    const netProfit = existing ? existing[index].netProfit : grossPayout - stake;
    if (!Number.isFinite(netProfit)) throw new Error('Invalid net profit');
    return { face: index + 1, grossPayout, netProfit };
  });
  return {
    rules: { independent: true, uniform: true, sides: 6, fair: true, payouts,
      payoutNote: 'Net profit is the final gain or loss in dollars for each outcome. Skipping returns zero.' },
    objective: 'Maximize expected net profit from this one independent roll. Choose bet or skip. The decision is risk-neutral; variance carries no penalty and there are no future decisions.',
    ...(state.calculatedExpectedNetProfit === undefined ? {} : {
      calculatedExpectedNetProfit: calculatedExpectedProfit(payouts.map(row => row.netProfit)),
    }),
  };
}
export function calculatedExpectedProfit(netProfits: number[]) {
  const value = netProfits.reduce((sum, net) => sum + net, 0) / 6;
  return { value, units: 'dollars per roll',
    calculation: `(${netProfits.join(' + ')}) / 6 = ${value}`,
    note: 'Skipping has expected net profit zero.' };
}
