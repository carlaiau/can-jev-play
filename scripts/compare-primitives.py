"""Compare saved Choice and Noul decisions on exactly matched states. No API calls."""
import json
from pathlib import Path

choice = json.loads(Path('src/data/history-study.json').read_text())
noul = json.loads(Path('src/data/noul-study.json').read_text())
by_id = {r['id']: r for r in choice['rows']}
assert len(by_id) == len(choice['rows']) == len(noul['rows'])
assert set(by_id) == {r['id'] for r in noul['rows']}
for row in noul['rows']:
    original = by_id[row['id']]
    assert row['state'] == original['state']
    assert row['gross'] == original['gross'] and row['ev'] == original['ev']
    assert row['face'] == original['face']
    decision = row['decisions']['table']
    value = decision['response']['answers']['action']['noul']
    assert decision['action'] == ('bet' if value > .5 else 'skip')
    assert decision['request']['state'] == original['decisions']['table']['request']['state']
    assert decision['response']['model'] == original['decisions']['table']['response']['model']

def metrics(rows):
    positive = [r for r in rows if r['ev'] > 0]
    negative = [r for r in rows if r['ev'] < 0]
    bet = lambda r: r['decisions']['table']['action'] == 'bet'
    bets = sum(bet(r) for r in rows)
    tp = sum(bet(r) for r in positive)
    tn = sum(not bet(r) for r in negative)
    return dict(n=len(rows), bets=bets, bet_rate=100*bets/len(rows),
                bet_on_positive=100*tp/len(positive), skip_on_negative=100*tn/len(negative),
                correct=tp+tn, correct_overall=100*(tp+tn)/len(rows),
                expected_profit=round(sum(r['ev'] for r in rows if bet(r)),2))

records=[]
for magnitude in (None,1,5,15):
    for history in ('all','mixed','wins','losses','no-history'):
        select=lambda s: [r for r in s['rows'] if (magnitude is None or r['magnitude']==magnitude) and (history=='all' or r['scenario']==history)]
        records.append(dict(magnitude=magnitude,history=history,choice=metrics(select(choice)),noul=metrics(select(noul))))
report=dict(choice_source=choice['provenance'],noul_source=noul['provenance'],
            decision_rule='Noul > 0.5 means Bet; otherwise Skip. Threshold fixed before collection.',
            limitation='Matched inputs collected in separate batches. Differences combine question type and proposition wording; this is not a simultaneous randomized comparison.',
            records=records)
Path('reports/primitive-comparison.json').write_text(json.dumps(report,indent=2)+'\n')
lines=['# Choice versus Noul','',report['decision_rule'],'',report['limitation'],'',
       '| History | Primitive | Bet rate | Bet on +EV | Skip on −EV | Correct overall | Expected profit |',
       '| --- | --- | ---: | ---: | ---: | ---: | ---: |']
for record in records:
    if record['magnitude'] is not None: continue
    for primitive in ('choice','noul'):
        m=record[primitive]
        lines.append(f"| {record['history']} | {primitive} | {m['bet_rate']:.1f}% | {m['bet_on_positive']:.1f}% | {m['skip_on_negative']:.1f}% | {m['correct_overall']:.1f}% | ${m['expected_profit']:,.2f} |")
lines.extend(['',f"Choice: `{choice['provenance']}`. Noul: `{noul['provenance']}`.",'','All three EV ranges combined. Each history has 3,000 decisions; 1,500 positive and 1,500 negative offers. Expected profit sums offer EV on Bets at a fixed $100 size; it does not use realized outcomes.'])
Path('reports/primitive-comparison.md').write_text('\n'.join(lines)+'\n')
print('\n'.join(lines))
