import assert from 'node:assert/strict';
const base=process.env.LAB_TEST_URL||'http://127.0.0.1:3000';
async function post(body){const r=await fetch(`${base}/api/lab`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,...await r.json()};}
const {readFile}=await import('node:fs/promises');
const study=JSON.parse(await readFile('src/data/history-study.json','utf8'));assert.ok(study.rows.length>=270);
assert.equal((await post({action:'create',config:{mode:'recorded',magnitude:99,ending:'mixed'}})).status,400);
for(const magnitude of [1,5,15])for(const ending of ['mixed','win-streak','loss-streak']){
 const made=await post({action:'create',config:{mode:'recorded',magnitude,ending}});assert.equal(made.status,200,JSON.stringify(made));const id=made.session.id;
 assert.equal((await post({action:'roll',id,round:1})).status,400);
 const limit=magnitude===5&&ending==='mixed'?30:1;const evs=[];
 for(let round=1;round<=limit;round++){
  const evaluated=await post({action:'evaluate',id,round});assert.equal(evaluated.status,200,JSON.stringify(evaluated));const r=evaluated.session.round;evs.push(r.ev);assert.equal(r.face,undefined);
  const source=study.rows.find(s=>s.id===r.judgments.table.sourceId);assert.ok(source);
  for(const arm of ['table','calculated']){assert.deepEqual(r.requests[arm],source.decisions[arm].request);assert.deepEqual(r.judgments[arm].raw,source.decisions[arm].response);assert.doesNotMatch(JSON.stringify(r.requests[arm]),/stake|bankroll/i);assert.equal(r.requests[arm].state.recentRolls.count,6);assert.equal(r.requests[arm].state.recentRolls.rolls.filter(h=>h.outcome==='win').length,ending==='mixed'?3:ending==='win-streak'?6:0);}
  assert.equal(r.requests.table.state.calculatedExpectedNetProfit,undefined);assert.ok(Math.abs(r.requests.calculated.state.calculatedExpectedNetProfit.value-r.ev)<1e-8);
  const rolled=await post({action:'roll',id,round});assert.equal(rolled.status,200);assert.equal(rolled.session.ledger.length,round);
  for(const arm of ['table','calculated'])assert.equal(rolled.session.round.returns[arm],r.judgments[arm].action==='bet'?rolled.session.round.net:0);
  assert.deepEqual((await post({action:'roll',id,round})).session,rolled.session);
  if(round<limit){assert.equal((await post({action:'next',id,round})).status,200);assert.equal((await post({action:'roll',id,round})).status,400);}
 }
 if(limit===30){assert.equal((await post({action:'next',id,round:30})).status,400);assert.equal(evs.filter(e=>e>0).length,15);assert.equal(evs.filter(e=>e<0).length,15);}
}
console.log('All 9 range/history combinations: exact recorded inputs/outputs, six-roll treatments, no stake/bankroll, paired settlement, idempotency, stale-round protection and 30-round cap passed.');
