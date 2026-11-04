import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { readStoredArray, readStoredRecord, storageAdapter } from '../lib/browserStorage.ts';
import { fetchWithTimeout } from '../lib/fetchWithTimeout.ts';
import { cleanLeadWorkspaceQuery } from '../lib/leadWorkspaceQuery.ts';

const from = value => ({getItem:() => value});
const isTask = value => value && typeof value.id === 'string';
test('legacy null/object/string task caches cannot crash the workspace', () => {
  for (const value of ['null', '{}', '"old"', '{broken', '42']) assert.deepEqual(readStoredArray(from(value),'tasks',isTask),[]);
  assert.deepEqual(readStoredArray(from('[null,{"id":"saved"},4]'),'tasks',isTask),[{id:'saved'}]);
});
test('invalid scroll records become an empty preference without deleting tasks', () => {
  assert.deepEqual(readStoredRecord(from('null'),'scroll'),{});
  assert.deepEqual(readStoredRecord(from('[]'),'scroll'),{});
  assert.deepEqual(readStoredRecord(from('{"board":{"top":120}}'),'scroll'),{board:{top:120}});
});
test('disabled browser storage is non-fatal and valid records survive reads', () => {
  const original = globalThis.window;
  globalThis.window = {get localStorage(){throw new Error('SecurityError');}};
  const store = storageAdapter('localStorage');
  assert.equal(store.getItem('tasks'),null);
  assert.equal(store.setItem('theme','dark'),false);
  store.removeItem('filter');
  globalThis.window = original;
  let writes=0;
  const cache={getItem:()=> '[{"id":"keep"}]',setItem:()=>writes++};
  assert.deepEqual(readStoredArray(cache,'tasks',isTask),[{id:'keep'}]);
  assert.equal(writes,0);
});
function recovery({storageBlocked=false,offline=false,last=0}={}) {
  const listeners={}; const replacements=[]; const values=new Map(last?[['tte:asset-recovery',String(last)]]:[]);
  const window={location:{href:'https://crm.example/?view=team#/leads?status=Won',origin:'https://crm.example',replace:url=>replacements.push(url)},addEventListener:(type,listener)=>listeners[type]=listener};
  const sessionStorage={getItem:key=>{if(storageBlocked)throw new Error('blocked');return values.get(key)||null;},setItem:(key,value)=>values.set(key,value)};
  vm.runInNewContext(fs.readFileSync(new URL('../public/app-recovery.js',import.meta.url),'utf8'), {window,navigator:{onLine:!offline},sessionStorage,URL,Date,Error,document:{getElementById:()=>null}});
  return {api:window.TTERecovery,listeners,replacements,values};
}
test('a stale lazy chunk reloads fresh HTML once and preserves route and query',()=>{
  const r=recovery();
  assert.equal(r.api.recover(new Error('Failed to fetch dynamically imported module')),true);
  assert.equal(r.api.recover(new Error('ChunkLoadError')),false);
  const url=new URL(r.replacements[0]);
  assert.equal(url.hash,'#/leads?status=Won');assert.equal(url.searchParams.get('view'),'team');assert.ok(url.searchParams.get('_tte_refresh'));
});
test('a second bad release, disabled storage, offline state and ordinary errors never loop',()=>{
  for(const options of [{last:Date.now()},{storageBlocked:true},{offline:true}]) {
    const r=recovery(options);assert.equal(r.api.recover(new Error('ChunkLoadError')),false);assert.equal(r.replacements.length,0);
  }
  const r=recovery();assert.equal(r.api.recover(new TypeError('tasks.filter is not a function')),false);
});
test('manual fresh reload works even when browser storage is blocked',()=>{
  const r=recovery({storageBlocked:true});r.api.reloadLatest();assert.equal(r.replacements.length,1);
});
test('timeout fetch works without AbortSignal.any/timeout and propagates user cancellation',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=(_input,init)=>new Promise((_resolve,reject)=>{
    if(init.signal.aborted)reject(new Error('aborted'));
    else init.signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true});
  });
  try {
    await assert.rejects(fetchWithTimeout('https://example.invalid',{},5),/aborted/);
    const controller=new AbortController();
    const pending=fetchWithTimeout('https://example.invalid',{signal:controller.signal},1000);
    controller.abort();await assert.rejects(pending,/aborted/);
    const already=new AbortController();already.abort();
    await assert.rejects(fetchWithTimeout('https://example.invalid',{signal:already.signal},1000),/aborted/);
  } finally {globalThis.fetch=original;}
});
test('entry HTML includes early recovery before the bundled module and no runtime Tailwind CDN',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.ok(html.indexOf('/app-recovery.js') < html.indexOf('type="module"'));
  assert.ok(!html.includes('cdn.tailwindcss.com'));
});

test('retired temperature filters and grouping cannot hide leads from legacy views',()=>{
  const params=new URLSearchParams(cleanLeadWorkspaceQuery('view=overview&temperature=Hot&group=temperature&status=Won&report=financial&agent=Test+Agent'));
  assert.equal(params.has('temperature'),false);
  assert.equal(params.has('group'),false);
  assert.equal(params.get('view'),'overview');
  assert.equal(params.get('status'),'Won');
  assert.equal(params.get('report'),'financial');
  assert.equal(params.get('agent'),'Test Agent');
  assert.equal(new URLSearchParams(cleanLeadWorkspaceQuery('group=agent&temperature=Cold')).get('group'),'agent');
});
