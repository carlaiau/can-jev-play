export const binaryQuestions = { action: {
  type: 'choice' as const,
  instructions: 'Which action maximizes expected net profit for this one independent roll under the risk-neutral objective?',
  criteria: {
    bet: 'Accept the net profit or loss corresponding to the next die face.',
    skip: 'Do not bet; net profit is zero.',
  },
} };
export function parseBinaryAction(raw: unknown) {
  const response = raw as Record<string, unknown>;
  const answers = response?.answers as Record<string, { type?: string; choice?: string }> | undefined;
  if (typeof response?.model !== 'string' || answers?.action?.type !== 'choice' || !['bet', 'skip'].includes(answers.action.choice ?? '')) throw new Error('Invalid binary action response');
  return { action: answers.action.choice as 'bet' | 'skip', response };
}

export type BinaryResult = { id: string; format: string; ev: number; action: string };
export function summarizeBinary(results: BinaryResult[]) {
  return ['table-only', 'supplied-ev'].map(format => {
    const rows = results.filter(r => r.format === format);
    return { format, calls: rows.length,
      byEv: [-5, -3, -1, 1, 3, 5].map(ev => {
        const cell = rows.filter(r => r.ev === ev);
        const bets = cell.filter(r => r.action === 'bet').length;
        return { ev, calls: cell.length, bets, skips: cell.length - bets, correct: ev > 0 ? bets : cell.length - bets };
      }),
      meanExpectedNet: rows.reduce((sum, r) => sum + (r.action === 'bet' ? r.ev : 0), 0) / rows.length };
  });
}
