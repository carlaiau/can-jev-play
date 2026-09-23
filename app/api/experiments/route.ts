import manifest from '../../../src/data/generated/manifest.json';
export const runtime='nodejs';
export async function GET(request: Request) {
 const url=new URL(request.url),magnitude=Number(url.searchParams.get('magnitude')??5),scenario=url.searchParams.get('scenario')??'mixed',primitive=url.searchParams.get('primitive')??'choice';
 if(![1,5,15].includes(magnitude)||!['all','mixed','wins','losses','no-history'].includes(scenario)||!['choice','noul'].includes(primitive))return Response.json({error:'Invalid experiment selection.'},{status:400});
 return new Response(null,{status:307,headers:{Location:`${manifest.base}/${primitive}/${magnitude}-${scenario}.json`,'Cache-Control':'no-store'}});
}
