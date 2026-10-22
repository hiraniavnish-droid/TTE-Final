import assert from 'node:assert/strict';import crypto from 'node:crypto';import {build} from 'esbuild';
await build({entryPoints:['lib/sonaliWebhookSettings.ts'],bundle:true,platform:'node',format:'esm',packages:'external',outfile:'.tmp/sonali-settings-test.mjs'});
const {default:handler}=await import('../.tmp/sonali-settings-test.mjs');
process.env.SUPABASE_JWT_SECRET='test-jwt-secret';process.env.SUPABASE_URL='https://database.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='test-service-key';
const jwt=()=>{const h=Buffer.from('{"alg":"HS256"}').toString('base64url'),b=Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+600,app_user_id:'admin-id',app_role:'admin',session_version:1})).toString('base64url');return h+'.'+b+'.'+crypto.createHmac('sha256',process.env.SUPABASE_JWT_SECRET).update(h+'.'+b).digest('base64url');};
let role='admin',writes=[];let settings={id:true,enabled:false,target_url:null,owner_id:'2',signing_secret:'s'.repeat(64)};
globalThis.fetch=async(input,init)=>{const path=String(input).split('/rest/v1/')[1];let result;if(path.startsWith('users?'))result=[{id:'admin-id',role,session_version:1}];else if(path==='rpc/crm_api_consume_rate_limit')result={allowed:true};else if(path==='rpc/crm_sonali_webhook_settings_write'){writes.push(JSON.parse(init.body));result=null;}else if(path.startsWith('crm_sonali_webhook_settings?')){result=[path.includes('select=*')?settings:Object.fromEntries(Object.entries(settings).filter(([k])=>k!=='signing_secret'))];}else if(path.startsWith('crm_sonali_webhook_outbox?'))result=[];else throw Error('Unexpected database access: '+path);return new Response(JSON.stringify(result),{status:200});};
async function run(method,body,auth=true){let status=0,result;const res={setHeader(){},status(n){status=n;return this;},json(j){result=j;return this;}};await handler({method,body,headers:auth?{authorization:'Bearer '+jwt()}:{}},res);return {status,result};}
assert.equal((await run('GET',null,false)).status,401);role='agent';assert.equal((await run('GET')).status,403);role='admin';
const get=await run('GET');assert.equal(get.status,200);assert.equal(get.result.data.enabled,false);assert.equal(get.result.data.signing_secret,undefined);
assert.equal((await run('POST',{enabled:true})).status,400);assert.equal((await run('POST',{owner_id:'another-user'})).status,400);
assert.equal((await run('POST',{enabled:false})).status,200);assert.deepEqual(writes,[{p_data:{enabled:false}}]);
console.log('Sonali settings authentication, admin restriction, secret redaction, owner lock and enable validation passed.');
