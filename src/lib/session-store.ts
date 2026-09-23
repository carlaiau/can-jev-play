import { getStore } from '@netlify/blobs';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, open, unlink, appendFile } from 'node:fs/promises';
import path from 'node:path';
import type { LabSession } from './lab-types.ts';
const root=path.join(process.cwd(),'reports','web');
const cloud=()=>process.env.NETLIFY==='true'||!!process.env.NETLIFY_BLOBS_CONTEXT||!!globalThis.netlifyBlobsContext;
const store=()=>getStore({name:`jev-sessions-${process.env.CONTEXT??'production'}`,consistency:'strong'});
function key(id:string){if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/.test(id))throw Error('Invalid session. Start a new experiment.');return `${id}.json`;}
export class SessionNotFoundError extends Error {
 constructor(){super('Session not found. Start a new experiment.');}
}
export async function readStoredSession(id:string):Promise<LabSession>{
 const name=key(id);
 if(cloud()){const value=await store().get(name,{type:'json'});if(!value)throw new SessionNotFoundError();return value as LabSession;}
 try{return JSON.parse(await readFile(path.join(root,name),'utf8'));}
 catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')throw new SessionNotFoundError();throw error;}
}
export async function saveStoredSession(session:LabSession){
 const name=key(session.id);
 if(cloud()){await store().setJSON(name,session);return;}
 await mkdir(root,{recursive:true});
 const target=path.join(root,name),temp=`${target}.${randomUUID()}.tmp`;
 await writeFile(temp,JSON.stringify(session));await rename(temp,target);
}
export async function logSession(id:string,event:Record<string,unknown>){
 key(id);
 if(cloud()){await store().setJSON(`logs/${id}/${Date.now()}-${randomUUID()}.json`,event);return;}
 await appendFile(path.join(root,`${id}.jsonl`),JSON.stringify(event)+'\n');
}
/** Shared conditional lock prevents concurrent requests from evaluating a round twice. */
export async function lockSession(id:string):Promise<()=>Promise<void>>{
 const name=`${key(id)}.lock`;
 if(!cloud()){
  await mkdir(root,{recursive:true});
  const target=path.join(root,name);
  const handle=await open(target,'wx').catch(error=>{if(error.code==='EEXIST')throw Error('This session is busy. Wait for the current step to finish.');throw error;});
  return async()=>{await handle.close();await unlink(target);};
 }
 const blobs=store();
 // Locks expire after a crashed function; normal model calls time out after 30 seconds.
 const lease={owner:randomUUID(),expires:Date.now()+120_000};
 const current=await blobs.getWithMetadata(name,{type:'json'});
 if(current && current.data.expires>Date.now())throw Error('This session is busy. Wait for the current step to finish.');
 if(current&&!current.etag)throw Error('Session storage did not return a lock version.');
 const result=await blobs.setJSON(name,lease,current?{onlyIfMatch:current.etag}:{onlyIfNew:true});
 if(!result.modified)throw Error('This session is busy. Wait for the current step to finish.');
 if(!result.etag)throw Error('Session storage did not confirm the lock. Please retry shortly.');
 return async()=>{
  // Conditional release cannot remove a newer owner's lock.
  await blobs.setJSON(name,{...lease,expires:0},{onlyIfMatch:result.etag});
 };
}
