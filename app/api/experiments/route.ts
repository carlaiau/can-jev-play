import { selectExperimentRows, historyMetrics, type HistoryGroup } from '../../../src/lib/history-experiment';
import { readHistoryStudy } from '../../../src/lib/lab-server';
export const runtime='nodejs';
export async function GET(request: Request) {
 try {
  const url=new URL(request.url),magnitude=Number(url.searchParams.get('magnitude')??5),scenario=url.searchParams.get('scenario')??'mixed';
  if(![1,5,15].includes(magnitude)||!['all','mixed','wins','losses','no-history'].includes(scenario))return Response.json({error:'Invalid experiment selection.'},{status:400});
  const study=await readHistoryStudy();
  const counts=[1,5,15].flatMap(m=>['all','mixed','wins','losses','no-history'].map(s=>{const r=study.rows.filter(r=>r.magnitude===m&&(s==='all'||r.scenario===s));return {magnitude:m,scenario:s,calls:r.length,tableCorrect:r.filter(r=>(r.decisions.table.action==='bet')===(r.ev>0)).length,calculatedCorrect:r.filter(r=>r.decisions.calculated&&(r.decisions.calculated.action==='bet')===(r.ev>0)).length};}));
  return Response.json({...study,metrics:historyMetrics(study.rows.filter(r=>r.magnitude===magnitude)),totalCalls:study.rows.reduce((n,r)=>n+Object.keys(r.decisions).length,0),counts,rows:selectExperimentRows(study.rows,magnitude,scenario as HistoryGroup)},{headers:{'Cache-Control':'no-store'}});
 } catch {return Response.json({error:'The study could not be loaded. Try again shortly.'},{status:503});}
}
