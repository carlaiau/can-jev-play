export function actionVerdict(ev: number, action: 'bet' | 'skip') {
  if (ev === 0) return { correct: true, label: 'EV-neutral action', explanation: 'Bet and Skip have equal expected return.' };
  const correct = action === (ev > 0 ? 'bet' : 'skip');
  return { correct, label: correct ? 'Correct EV action' : 'Incorrect EV action',
    explanation: ev > 0 ? 'Positive EV: Bet maximizes expected return.' : 'Negative EV: Skip maximizes expected return.' };
}
