/** Allowlist the current offer; never forward historical/context fields. */
export function offerOnlyState(state: Record<string, unknown>): Record<string, unknown> {
  const rules = state.rules as Record<string, unknown>;
  return {
    rules: {
      independent: rules.independent, uniform: rules.uniform, sides: rules.sides,
      bet: rules.bet, winningFaces: rules.winningFaces, payoutTable: rules.payoutTable,
      payoutNote: 'Gross payout includes the returned stake. Net profit equals gross payout minus stake.',
    },
    bankroll: state.bankroll, stake: state.stake, objective: state.objective,
    ...(state.calculatedExpectedNetProfit === undefined ? {} : { calculatedExpectedNetProfit: state.calculatedExpectedNetProfit }),
  };
}
