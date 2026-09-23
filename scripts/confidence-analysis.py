"""Offline, descriptive confidence sweep; no API calls or dataset mutations."""
import json
from pathlib import Path

study = json.loads(Path('src/data/history-study.json').read_text())
rows = study['rows']
thresholds = [0, .2, .4, .6, .8, .9, .95, 1]
for row in rows:
    answer = row['decisions']['table']['response']['answers']['action']
    assert answer['choice'] == row['decisions']['table']['action']
    assert 0 <= answer['confidence'] <= 1
    assert abs(sum(p['netProfit'] for p in row['state']['rules']['payouts']) / 6 - row['ev']) < 1e-8

def summarize(sample, threshold):
    def answer(row):
        return row['decisions']['table']['response']['answers']['action']
    def bet(row):
        a = answer(row)
        return a['choice'] == 'bet' and a['confidence'] >= threshold
    n = len(sample)
    positives = sum(r['ev'] > 0 for r in sample)
    negatives = n - positives
    bets = sum(bet(r) for r in sample)
    tp = sum(bet(r) for r in sample if r['ev'] > 0)
    tn = sum(not bet(r) for r in sample if r['ev'] < 0)
    ev = sum(r['ev'] for r in sample if bet(r))
    retained = [r for r in sample if answer(r)['confidence'] >= threshold]
    retained_correct = sum((answer(r)['choice'] == 'bet') == (r['ev'] > 0) for r in retained)
    return dict(threshold=threshold, n=n, bets=bets, bet_rate=100*bets/n,
                bet_on_positive=100*tp/positives, skip_on_negative=100*tn/negatives,
                correct_overall=100*(tp+tn)/n, expected_profit=round(ev, 2),
                ev_per_staked_percent=ev/bets if bets else None,
                optimal_expected_profit=round(sum(max(0,r['ev']) for r in sample),2),
                retained_responses=len(retained), coverage=100*len(retained)/n,
                retained_original_accuracy=100*retained_correct/len(retained) if retained else None)

groups = {'All': rows}
groups.update({g: [r for r in rows if r['scenario'] == g] for g in ('mixed','wins','losses','no-history')})
report = {
    'source': study['provenance'],
    'policy': 'Bet only when the recorded choice is bet AND confidence >= threshold; otherwise Skip. All offers remain in the policy denominator.',
    'selective_analysis': 'Coverage and retained accuracy instead exclude low-confidence responses of either choice. They do not describe the full policy accuracy.',
    'limitation': 'Exploratory in-sample analysis. No threshold selected or validated on independent held-out data. Matched history responses are not independent offers.',
    'by_history': {g: [summarize(sample,t) for t in thresholds] for g,sample in groups.items()},
    'by_magnitude': {str(m): [summarize([r for r in rows if r['magnitude']==m],t) for t in thresholds] for m in (1,5,15)},
}
Path('reports').mkdir(exist_ok=True)
Path('reports/confidence-analysis.json').write_text(json.dumps(report,indent=2)+'\n')
for g, records in report['by_history'].items():
    print('\n'+g)
    for r in records:
        print(f"{r['threshold']:.2f} bets={r['bet_rate']:.1f}% +EV={r['bet_on_positive']:.1f}% -EVskip={r['skip_on_negative']:.1f}% correct={r['correct_overall']:.1f}% EV=${r['expected_profit']:,.2f} retained={r['retained_responses']} retained_accuracy={r['retained_original_accuracy']}")
print('\nBy magnitude (baseline / 0.8):')
for m, records in report['by_magnitude'].items():
    print(m, [(r['threshold'],r['expected_profit'],r['correct_overall']) for r in records if r['threshold'] in (0,.8)])
