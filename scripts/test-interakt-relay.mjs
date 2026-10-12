import {build} from 'esbuild';import assert from 'node:assert/strict';import crypto from 'node:crypto';
await build({entryPoints:['lib/interaktRelay.ts','lib/interaktRelayHandler.ts'],bundle:true,platform:'node',format:'esm',packages:'external',outdir:'.tmp/relay-test'});
const {relayRequest,validInteraktSignature,dispatchInteraktRelay}=await import('../.tmp/relay-test/interaktRelay.js');
const secret='fixture-interakt-secret',sign=raw=>'sha256='+crypto.createHmac('sha256',secret).update(raw).digest('hex');
const payload=(id,text='Hello')=>({version:'1.0',type:'message_received',data:{customer:{channel_phone_number:'919800000001'},message:{id,chat_message_type:'CustomerMessage',message:text,message_content_type:'Text',media_url:null,received_at_utc:'2026-10-12T06:00:00'}}});
let count=0;const noDb=async()=>{throw Error('Dropped event touched DB');};
for(const type of ['message_api_sent','message_api_delivered','message_api_read','message_api_failed','message_campaign_sent','message_campaign_delivered','message_campaign_read','message_campaign_failed','message_campaign_clicked','message_template_status_update','Webhook Test']){
 const raw=Buffer.from(JSON.stringify({...payload('status'),type}));assert.deepEqual(await relayRequest(raw,sign(raw),noDb,secret),{status:200,body:{dropped:type}});
}
const forwarded=Buffer.from(JSON.stringify({...payload('forwarded'),type:'message_api_read'}));
const forwardSecret='fixture-website-hop';
const forwardSignature='sha256='+crypto.createHmac('sha256',forwardSecret).update(forwarded).digest('hex');
assert.equal((await relayRequest(forwarded,forwardSignature,noDb,'different-interakt-secret',forwardSecret)).body.dropped,'message_api_read');
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
const echo=Buffer.from('{ "type":"message_echo", "data":{"message":{"id":"echo-fixture","chat_message_type":"MessageEchoes","message":"Agent reply"}}}');
let echoRequests=0,echoDbPaths=[];
const echoDb=async(path)=>{echoDbPaths.push(path);assert.ok(path.startsWith('crm_max_settings'));return [{enabled:true,target_url:'https://example.com/'}]};
const echoResult=await relayRequest(echo,sign(echo),echoDb,secret,'',async(target,init)=>{echoRequests++;assert.equal(init.body,echo);assert.equal(init.headers.Authorization,'Bearer fixture-only');assert.equal(init.headers['X-Relay'],'interakt');assert.equal(JSON.parse(init.body).relay,undefined);return new Response(null,{status:200})});
assert.deepEqual(echoResult,{status:200,body:{forwarded:'message_echo'}});assert.equal(echoRequests,1);assert.equal(echoDbPaths.length,1);
assert.equal((await relayRequest(echo,'invalid',noDb,secret,'',async()=>{throw Error('Unauthenticated echo sent')})).status,401);
assert.equal((await relayRequest(echo,sign(echo),echoDb,secret,'',async()=>new Response(null,{status:503}))).status,503);
assert.equal((await relayRequest(echo,sign(echo),echoDb,secret,'',async()=>{throw Error('Timeout')})).status,503);
const disabledEcho=async()=>[{enabled:false,target_url:'https://example.com/'}];
assert.equal((await relayRequest(echo,sign(echo),disabledEcho,secret,'',async()=>{throw Error('Disabled echo sent')})).status,503);
process.env.MAX_WEBHOOK_AUTH_TARGET_URL='https://other.example/';assert.equal((await dispatchInteraktRelay(db,noDb)).disabled,true);assert.equal(count,1);
assert.equal((await relayRequest(echo,sign(echo),echoDb,secret,'',async()=>{throw Error('Wrong target echo sent')})).status,503);
delete process.env.MAX_WEBHOOK_AUTH_TARGET_URL;delete process.env.MAX_WEBHOOK_AUTHORIZATION;
console.log('PASS: HMAC/raw bytes, invalid signatures, immediate raw echo forwarding without queue/history, echo auth/failure checks, other status drops without DB, dedupe, 3-message bundle preserving newest raw data, pinned Authorization and disabled target.');
