import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
const port = 3122;
const child = spawn(process.execPath, ['server/index.mjs'], { env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', LOG_DIR: 'test-results/signaling-logs' }, stdio: 'ignore', windowsHide: true });
const sockets = [];
async function client() {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/signal`); sockets.push(ws); await once(ws, 'open');
  const pending = new Map();
  ws.on('message', raw => { const m=JSON.parse(String(raw)); const fn=pending.get(m.requestId); if(fn) { pending.delete(m.requestId); fn(m); } });
  return { ws, request: (m) => new Promise((resolve,reject) => { const requestId=randomUUID(); const timer=setTimeout(()=>reject(Error('signaling timeout')),3000); pending.set(requestId,m=>{clearTimeout(timer);resolve(m);}); ws.send(JSON.stringify({...m,requestId})); }) };
}
try {
  for (let i=0;i<30;i++) { try { if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) break; } catch {} await new Promise(r=>setTimeout(r,100)); }
  const t=await client(); const lessonId=randomUUID(); const room=await t.request({type:'create',lessonId}); assert.match(room.code,/^\d{6}$/);
  const a=await client(); const first=await a.request({type:'join',code:room.code,name:'같은이름'});
  const b=await client(); const second=await b.request({type:'join',code:room.code,name:'같은이름'});
  assert.notEqual(first.id,second.id); assert.notEqual(first.name,second.name);
  assert.ok((await a.request({type:'lock',locked:true})).error);
  assert.ok((await a.request({type:'document-update',text:'not-a-signaling-message'})).error);
  const impostor=await client(); assert.ok((await impostor.request({type:'create',lessonId})).error);
  await t.request({type:'lock',locked:true});
  const fresh=await client(); assert.ok((await fresh.request({type:'join',code:room.code,name:'새친구'})).error);
  a.ws.close(); await once(a.ws,'close');
  const returning=await client(); const resumed=await returning.request({type:'join',code:room.code,name:'가짜이름',token:first.token});
  assert.equal(resumed.id,first.id); assert.equal(resumed.name,first.name);
  t.ws.close(); await once(t.ws,'close');
  const teacher=await client(); const restored=await teacher.request({type:'create',lessonId,token:room.token});
  assert.equal(restored.code,room.code);
  await teacher.request({type:'end'});
  const reopened=await client(); const next=await reopened.request({type:'create',lessonId,members:[{id:first.id,name:first.name,token:first.token}]});
  assert.notEqual(next.code,room.code);
  console.log('PASS: role authorization, document-message rejection, duplicate names, admission lock, student resume, teacher grace period, new room code');
} finally { for(const ws of sockets) ws.terminate(); child.kill(); await once(child,'exit'); }
