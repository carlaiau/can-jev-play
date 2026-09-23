"""Paired exact tests; deduplicate identical offers before primary comparisons."""
import json,math,itertools
from pathlib import Path
study=json.loads(Path('src/data/history-study.json').read_text())
groups=('mixed','wins','losses')+ (('no-history',) if any(r['scenario']=='no-history' for r in study['rows']) else ())
matched={}
for r in study['rows']:
 matched.setdefault((r['magnitude'],r['number']),{})[r['scenario']]=r
pairs=list(matched.values())
assert all(set(p)==set(groups) for p in pairs)
for p in pairs:
 assert all(r['gross']==p['mixed']['gross'] for r in p.values())
unique={}
for p in pairs:
 state=dict(p['mixed']['state']);state.pop('recentRolls')
 unique.setdefault(json.dumps(state,sort_keys=True),p)
def exact(b,c):
 n=b+c
 if not n:return 1.0
 logs=[math.lgamma(n+1)-math.lgamma(k+1)-math.lgamma(n-k+1)-n*math.log(2) for k in range(min(b,c)+1)]
 top=max(logs)
 return min(1.0,math.exp(math.log(2)+top+math.log(sum(math.exp(x-top) for x in logs))))
def metrics(ps):
 return {g:{'n':len(ps),'bets':sum(p[g]['decisions']['table']['action']=='bet' for p in ps),'correct':sum((p[g]['decisions']['table']['action']=='bet')==(p[g]['ev']>0) for p in ps)} for g in groups}
def tests(ps):
 result=[]
 for metric in ('bet','correct'):
  for a,b in itertools.combinations(groups,2):
   def outcome(r):
    bet=r['decisions']['table']['action']=='bet'
    return bet if metric=='bet' else bet==(r['ev']>0)
   ab=sum(outcome(p[a]) and not outcome(p[b]) for p in ps)
   ba=sum(outcome(p[b]) and not outcome(p[a]) for p in ps)
   result.append({'metric':metric,'a':a,'b':b,'a_only':ab,'b_only':ba,'p':exact(ab,ba),'a_minus_b_percentage_points':100*(ab-ba)/len(ps)})
 ordered=sorted(result,key=lambda r:r['p']);last=0
 for i,r in enumerate(ordered):
  last=max(last,min(1,r['p']*(len(ordered)-i)));r['holm_p']=last
 return result
assert abs(exact(3,0)-.25)<1e-12
assert abs(exact(5,5)-1)<1e-12
assert abs(exact(10,0)-.001953125)<1e-12
out={'source':study['provenance'],'method':'Exact two-sided McNemar; Holm correction across all pairwise tests of bet rate and correct-action rate. Deduplicated analysis retains first matched set for each identical offer state with recentRolls removed. No confidence/choice-probability tests.','all_calls':{'metrics':metrics(pairs),'tests':tests(pairs)},'unique_offers':{'metrics':metrics(list(unique.values())),'tests':tests(list(unique.values()))},'unique_per_magnitude':{m:len({tuple(p['mixed']['gross']) for p in pairs if p['mixed']['magnitude']==m}) for m in (1,5,15)}}
Path('reports/history-significance.json').write_text(json.dumps(out,indent=2))
print(json.dumps(out,indent=2))
