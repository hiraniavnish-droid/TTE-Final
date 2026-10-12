import {build} from 'esbuild';import assert from 'node:assert/strict';import crypto from 'node:crypto';
await build({entryPoints:['lib/interaktRelay.ts','lib/interaktRelayHandler.ts'],bundle:true,platform:'node',format:'esm',packages:'external',outdir:'.tmp/relay-test'});
const {relayRequest,validInteraktSignature,dispatchInteraktRelay}=await import('../.tmp/relay-test/interaktRelay.js');
const secret='fixture-interakt-secret',sign=raw=>'sha256='+crypto.createHmac('sha256',secret).update(raw).digest('hex');
const payload=(id,text='Hello')=>({version:'1.0',type:'message_received',data:{customer:{channel_phone_number:'919800000001'},message:{id,chat_message_type:'CustomerMessage',message:text,message_content_type:'Text',media_url:null,received_at_utc:'2026-10-12T06:00:00'}}});
let count=0;const noDb=async()=>{throw Error('Dropped event touched DB');};
for(const type of ['message_api_sent','message_api_delivered','message_api_read','message_api_failed','message_echo','message_campaign_sent','message_campaign_delivered','message_campaign_read','message_campaign_failed','message_campaign_clicked','message_template_status_update','Webhook Test']){
 const raw=Buffer.from(JSON.stringify({...payload('status'),type}));assert.deepEqual(await relayRequest(raw,sign(raw),noDb,secret),{status:200,body:{dropped:type}});
}
let raw=Buffer.from(JSON.stringify(payload('one')));
assert.equal(validInteraktSignature(raw,sign(raw),secret),true);assert.equal(validInteraktSignature(Buffer.from(raw+' '),sign(raw),secret),false);
for(const signature of ['',sign(raw).slice(0,-1),'sha256='+'a'.repeat(64)])assert.equal((await relayRequest(raw,signature,noDb,secret)).status,401);
assert.equal((await relayRequest(Buffer.from('{'),sign(Buffer.from('{')),noDb,secret)).status,400);
const seen=new Set(),messages=[];let latest;
const db=async(path,init)=>{
 if(path==='rpc/crm_interakt_enqueue'){const {p_body:body}=JSON.parse(init.body),m=body.data.message;if(seen.has(m.id))return {duplicate:true};seen.add(m.id);messages.push({id:m.id,text:m.message,type:m.message_content_type,media_url:m.media_url,received_at_utc:m.received_at_utc});latest=body;return {queued:true};}
 if(path.startsWith('crm_max_settings'))return [{enabled:true,target_url:'https://example.com/'}];
 if(path==='rpc/crm_interakt_claim'){count++;return [{phone:'919800000001',lease_token:'fixture-lease',attempts:1,body:latest,messages,first_at:'2026-10-12T06:00:00Z',last_at:'2026-10-12T06:00:20Z'}];}
 if(path==='rpc/crm_interakt_finish'){return JSON.parse(init.body);}
 throw Error('Unexpected path '+path);
};
for(const id of ['one','two','three']){raw=Buffer.from(JSON.stringify(payload(id)));assert.equal((await relayRequest(raw,sign(raw),db,secret)).body.queued,true);}
assert.equal((await relayRequest(raw,sign(raw),db,secret)).body.duplicate,true);assert.equal(messages.length,3);
process.env.MAX_WEBHOOK_AUTH_TARGET_URL='https://example.com/';process.env.MAX_WEBHOOK_AUTHORIZATION='Bearer fixture-only';
let requests=0;const result=await dispatchInteraktRelay(db,async(target,init)=>{requests++;assert.equal(target,'https://example.com/');assert.equal(init.headers.Authorization,'Bearer fixture-only');assert.equal(init.headers['X-Relay'],'interakt');const body=JSON.parse(init.body);assert.equal(body.relay.bundled,3);assert.deepEqual(body.data,latest.data);assert.deepEqual(body.relay.messages,messages);return new Response(null,{status:200});});
assert.equal(result.delivered,1);assert.equal(requests,1);
process.env.MAX_WEBHOOK_AUTH_TARGET_URL='https://other.example/';assert.equal((await dispatchInteraktRelay(db,noDb)).disabled,true);assert.equal(count,1);
delete process.env.MAX_WEBHOOK_AUTH_TARGET_URL;delete process.env.MAX_WEBHOOK_AUTHORIZATION;
console.log('PASS: HMAC/raw bytes, invalid signatures, all status drops without DB, dedupe, 3-message bundle preserving newest raw data, pinned Authorization and disabled target.');
