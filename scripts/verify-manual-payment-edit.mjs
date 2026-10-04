import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(path.join(tmpdir(),'tte-payment-test-'));
try {
 process.env.SUPABASE_URL='https://fixture.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='fixture';process.env.SUPABASE_JWT_SECRET='fixture-signing-secret';
 const file=path.join(dir,'api.mjs');await build({entryPoints:['api/razorpay-link.ts'],outfile:file,platform:'node',format:'esm',logLevel:'silent'});
 const {default:handler}=await import(pathToFileURL(file));
 const token=(overrides={})=>{const h=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');const p=Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600,app_user_id:'fixture-user',session_version:1,...overrides})).toString('base64url');return `${h}.${p}.`+crypto.createHmac('sha256',process.env.SUPABASE_JWT_SECRET).update(`${h}.${p}`).digest('base64url');};
 const original={id:'manual_fixture',source:'manual',amount:300000,method:'UPI',paid_at:'2026-10-04T00:00:00.000Z',manual_reference:'old-ref',notes:'original',customer_name:'Synthetic customer',customer_phone:'',customer_email:'',lead_id:'fixture-lead',reference_id:'TTE-MAN-fixture',status:'paid',created_at:'2026-10-04T12:00:00.000Z',created_by:'Original agent'};
 let current={...original},written=null,audit=null,race=false,auditFailure=false;
 globalThis.fetch=async(url,init={})=>{const u=new URL(url);if(u.pathname.endsWith('/users'))return Response.json([{name:'Verified Editor',role:'agent',session_version:1}]);if(u.pathname.endsWith('/activity_logs')){audit=JSON.parse(init.body);if(auditFailure)throw new Error('fixture audit failure');return new Response(null,{status:201});}if(init.method==='PATCH'){written=JSON.parse(init.body);assert(u.searchParams.has('amount'));return Response.json(race?[]:[{...current,...written}]);}return Response.json([current]);};
 const expected=()=>Object.fromEntries(['amount','method','paid_at','manual_reference','notes','customer_name','customer_phone','customer_email'].map(k=>[k,current[k]]));
 const body=()=>({action:'edit_manual',id:current.id,amount:250000,method:'Bank Transfer',paidAt:'2026-09-02',manualReference:'new-ref',notes:'corrected',name:'Corrected customer',phone:'',email:'',expected:expected()});
 async function send(changes={},auth=token()){const res={setHeader(){},status(c){this.code=c;return this;},json(b){this.body=b;return this;}};await handler({method:'PATCH',headers:{authorization:auth?'Bearer '+auth:undefined},body:{...body(),...changes}},res);return res;}
 let r=await send();assert.equal(r.code,200);assert.equal(r.body.record.amount,250000);assert.equal(r.body.record.paid_at,'2026-09-02T00:00:00.000Z');assert.equal(r.body.record.reference_id,original.reference_id);assert.equal(r.body.record.created_by,'Original agent');assert(!('lead_id' in written));assert.equal(audit.agent_name,'Verified Editor');assert.equal(audit.metadata.before.amount,300000);assert.equal(audit.metadata.after.amount,250000);
 assert.equal((await send({},'')).code,401);assert.equal((await send({},token({exp:1}))).code,401);assert.equal((await send({},token({session_version:99}))).code,401);
 for(const amount of [0,-1,Infinity,NaN,1.111])assert.equal((await send({amount})).code,400);
 for(const paidAt of ['','2026-02-30','not-a-date'])assert.equal((await send({paidAt})).code,400);
 assert.equal((await send({method:'Invalid'})).code,400);assert.equal((await send({expected:{...expected(),amount:999}})).code,409);
 current={...original,source:'razorpay'};assert.equal((await send()).code,400);current={...original};race=true;assert.equal((await send()).code,409);race=false;auditFailure=true;r=await send();assert.equal(r.code,200);assert(r.body.warning);
 console.log('PASS: authenticated manual corrections, amounts/dates, linked-record preservation, audit metadata, gateway protection, expired/revoked sessions, optimistic conflicts and post-save audit failure');
} finally {await rm(dir,{recursive:true,force:true});}
