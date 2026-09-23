import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setEnvironmentContext } from '@netlify/blobs';
import { readStoredSession, saveStoredSession, lockSession, logSession, SessionNotFoundError } from '../src/lib/session-store.ts';
import type { LabSession } from '../src/lib/lab-types.ts';
test('deployed sessions survive separate store clients and lock concurrent requests',async t=>{
 const previous=process.env.NETLIFY;process.env.NETLIFY='true';
 setEnvironmentContext({siteID:'test',token:'test',edgeURL:'https://blobs.test',uncachedEdgeURL:'https://blobs.test'});
 t.after(()=>{if(previous===undefined)delete process.env.NETLIFY;else process.env.NETLIFY=previous;setEnvironmentContext({});});
 const blobs=new Map<string,{body:string;etag:string}>();let version=0;
 t.mock.method(globalThis,'fetch',async(input:RequestInfo|URL,init?:RequestInit)=>{
  const request=new Request(input,init),key=new URL(request.url).pathname,existing=blobs.get(key);
  if(request.method==='GET')return existing?new Response(existing.body,{headers:{etag:existing.etag}}):new Response(null,{status:404});
  if(request.method==='PUT'){
   if((request.headers.get('if-none-match')==='*'&&existing)||(request.headers.has('if-match')&&request.headers.get('if-match')!==existing?.etag))return new Response(null,{status:412});
   const etag=`"${++version}"`;blobs.set(key,{body:await request.text(),etag});return new Response(null,{headers:{etag}});
  }
  throw Error(`Unexpected method ${request.method}`);
 });
 const session={id:randomUUID(),totals:{table:0,calculated:0}} as LabSession;
 await saveStoredSession(session);assert.deepEqual(await readStoredSession(session.id),session);
 const release=await lockSession(session.id);
 await assert.rejects(lockSession(session.id),/busy/);
 session.totals.table=12;await saveStoredSession(session);await logSession(session.id,{event:'test'});
 await release();const secondRelease=await lockSession(session.id);await secondRelease();
 assert.equal((await readStoredSession(session.id)).totals.table,12);
 await assert.rejects(readStoredSession(randomUUID()),SessionNotFoundError);
 assert.ok([...blobs.keys()].some(k=>k.includes('logs/')));
});
