import {build} from 'esbuild';import assert from 'node:assert/strict';import crypto from 'node:crypto';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(join(tmpdir(),'tte-google-auth-'));
try{
 const file=join(dir,'handler.mjs');await build({entryPoints:['lib/googleContactsHandler.ts'],bundle:true,platform:'node',format:'esm',outfile:file,logLevel:'silent'});const {default:handler,callback}=await import(pathToFileURL(file).href);
 process.env.SUPABASE_URL='https://contacts-auth-test.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='fixture';process.env.SUPABASE_JWT_SECRET='fixture-jwt';process.env.GOOGLE_CONTACTS_ENCRYPTION_KEY=crypto.randomBytes(32).toString('base64');
 const claims={app_user_id:'test-admin',app_role:'admin',session_version:1,exp:Math.floor(Date.now()/1000)+3600},head=Buffer.from(JSON.stringify({alg:'HS256'})).toString('base64url'),body=Buffer.from(JSON.stringify(claims)).toString('base64url');const token=head+'.'+body+'.'+crypto.createHmac('sha256',process.env.SUPABASE_JWT_SECRET).update(head+'.'+body).digest('base64url');
 let settings={enabled:false,client_id:'test.apps.googleusercontent.com',expected_email:'booking@thetourismexperts.com'},states=[],userRole='admin',email='booking@thetourismexperts.com',version=1;
 const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async(input,init={})=>{const url=new URL(input),method=init.method||'GET';
  if(url.hostname==='oauth2.googleapis.com'){const form=new URLSearchParams(init.body);assert.equal(form.get('redirect_uri'),'https://ttecrm.vercel.app/api/google-contacts-callback');assert.ok(form.get('code_verifier'));return json({access_token:'fixture-access',refresh_token:'fixture-refresh',scope:'openid email https://www.googleapis.com/auth/contacts'});}
  if(url.hostname==='openidconnect.googleapis.com')return json({email,email_verified:true,sub:'fixture-google-id'});
  assert.equal(url.hostname,'contacts-auth-test.invalid');const path=url.pathname.replace('/rest/v1/',''),payload=init.body?JSON.parse(init.body):{};
  if(path==='users')return json([{id:'test-admin',role:userRole,session_version:version}]);
  if(path==='crm_google_settings'){if(method==='PATCH')Object.assign(settings,payload);return json([settings]);}
  if(path==='crm_google_oauth_states'){if(method==='POST')states.push(payload);return json(null);}
  if(path==='rpc/crm_google_oauth_consume'){const match=states.find(s=>s.state_hash===payload.p_hash);states=states.filter(s=>s!==match);return json(match?[match]:[]);}
  if(path==='rpc/crm_google_status')return json({pending:0,synced:0,failed:0,skipped:0});
  if(path==='crm_google_queue')return json([]);throw Error('Unexpected '+path);
 };
 const invoke=async(fn,req)=>{const result={headers:{},statusCode:200};const res={setHeader:(key,val)=>result.headers[key]=val,status:code=>(result.statusCode=code,res),json:data=>(result.data=data,result),redirect:(code,url)=>(result.statusCode=code,result.url=url,result),end:()=>result};await fn({headers:{},...req},res);return result;};
 const request=(action,extra={})=>invoke(handler,{method:'POST',headers:{authorization:'Bearer '+token},body:{action,...extra}});
 try{
  assert.equal((await invoke(handler,{method:'GET'})).statusCode,401);
  userRole='agent';assert.equal((await request('pause')).statusCode,401);userRole='admin';version=2;assert.equal((await request('pause')).statusCode,401);version=1;
  assert.equal((await request('configure',{client_id:'test.apps.googleusercontent.com',client_secret:'fixture-secret',expected_email:email})).statusCode,200);assert.ok(settings.client_secret_encrypted&&!settings.client_secret_encrypted.includes('fixture-secret'));
  const publicSettings=await invoke(handler,{method:'GET',headers:{authorization:'Bearer '+token}});assert.ok(!JSON.stringify(publicSettings.data).includes(settings.client_secret_encrypted));
  const connect=await request('connect');assert.equal(connect.statusCode,200);assert.ok(connect.headers['Set-Cookie'].includes('HttpOnly; Secure; SameSite=Lax'));const auth=new URL(connect.data.url),state=auth.searchParams.get('state');assert.equal(auth.searchParams.get('code_challenge_method'),'S256');assert.equal(auth.searchParams.get('access_type'),'offline');assert.equal(auth.searchParams.get('login_hint'),email);
  const invalid=await invoke(callback,{method:'GET',query:{state,code:'fixture'},headers:{cookie:'tte_google_state=wrong'}});assert.ok(invalid.url.endsWith('invalid_state'));assert.equal(states.length,1);
  const done=await invoke(callback,{method:'GET',query:{state,code:'fixture'},headers:{cookie:'tte_google_state='+state}});assert.ok(done.url.includes('/#/team-settings?google_contacts=connected'));assert.equal(states.length,0);assert.equal(settings.enabled,true);assert.ok(settings.refresh_token_encrypted&&!settings.refresh_token_encrypted.includes('fixture-refresh'));
  assert.ok((await invoke(callback,{method:'GET',query:{state,code:'fixture'},headers:{cookie:'tte_google_state='+state}})).url.endsWith('expired'));
  const snapshot=await invoke(handler,{method:'GET',headers:{authorization:'Bearer '+token}});assert.ok(!JSON.stringify(snapshot.data).includes(settings.refresh_token_encrypted));
  assert.equal((await request('configure',{client_id:'other.apps.googleusercontent.com',client_secret:'fixture-other',expected_email:email})).statusCode,409);
  const wrong=await request('connect');const wrongState=new URL(wrong.data.url).searchParams.get('state');email='other@example.com';assert.ok((await invoke(callback,{method:'GET',query:{state:wrongState,code:'fixture'},headers:{cookie:'tte_google_state='+wrongState}})).url.endsWith('wrong_account'));
 }finally{globalThis.fetch=originalFetch;}
 console.log('PASS: signed/current admin sessions, role/session rejection, encrypted secrets omitted from responses, PKCE/offline OAuth, HttpOnly state binding, single-use state, correct callback route, account restriction, no cross-account reconfiguration.');
}finally{await rm(dir,{recursive:true,force:true});}
