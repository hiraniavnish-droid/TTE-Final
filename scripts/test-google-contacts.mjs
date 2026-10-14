import {build} from 'esbuild';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import crypto from 'node:crypto';
const dir=await mkdtemp(join(tmpdir(),'tte-google-test-'));
try {
 const bundle=async(entry,name)=>{const file=join(dir,name+'.mjs');await build({entryPoints:[entry],bundle:true,platform:'node',format:'esm',outfile:file,logLevel:'silent'});return import(pathToFileURL(file).href);};
 const format=await bundle('lib/googleContactsFormat.ts','format'),db=await bundle('lib/googleContactsDb.ts','db'),sync=await bundle('lib/googleContactsSync.ts','sync');
 process.env.GOOGLE_CONTACTS_ENCRYPTION_KEY=crypto.randomBytes(32).toString('base64');process.env.SUPABASE_URL='https://contacts-test.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='test-only';
 for(const [input,expected] of [['9876543210','+919876543210'],['+91 98765 43210','+919876543210'],['00919876543210','+919876543210'],['+442079460958','+442079460958'],['123',null],['',null]])assert.equal(format.normalizeContactPhone(input),expected);
 assert.equal(format.contactTravelDate('2026-02-31'),'NoDate');assert.equal(format.contactTravelDate('2026-02-18'),'18Feb');
 const base={id:'11111111-1111-1111-1111-111111111111',lead_code:'TTE-1530',name:'Deepak Shah',status:'Won',phone:'9876543210',trip_details:{destination:'Rann Utsav',startDate:'2027-02-18',paxConfig:{adults:2,children:1,childAges:[7]}},created_at:'2026-10-10T00:00:00Z'};
 assert.equal(format.contactName(base),'1530 Deepak RU Conf 18Feb');
 for(const [status,code] of [['New','New'],['Contacted','Cont'],['Discussion','Disc'],['Proposal Sent','Quote'],['Won','Conf'],['Lost','Lost']])assert.ok(format.contactName({...base,status}).includes(' '+code+' '));
 assert.ok(Array.from(format.contactName({...base,name:'A'.repeat(100),lead_code:'TTE-1234567890123456789',trip_details:{destination:'Ahmedabad'}})).length<40);
 assert.equal(format.contactName({...base,trip_details:{destination:'Statue of Unity'}}),'1530 Deepak SOU Conf NoDate');
 const sealed=db.seal('refresh-token-test');assert.ok(!sealed.includes('refresh-token-test'));assert.equal(db.unseal(sealed),'refresh-token-test');assert.throws(()=>db.unseal(sealed.slice(0,-2)+'xx'));
 let settings,leads,jobs,people,index,creates,updates,fail,concurrent;
 const reset=()=>{settings={enabled:true,client_id:'test.apps.googleusercontent.com',client_secret_encrypted:db.seal('test-secret'),refresh_token_encrypted:db.seal('test-refresh'),group_resource:'contactGroups/tte',index_ready:false};leads=[structuredClone(base),{...structuredClone(base),id:'22222222-2222-2222-2222-222222222222',lead_code:'TTE-1499',name:'Old Enquiry',created_at:'2026-08-01T00:00:00Z'}];jobs=[{lead_id:base.id,revision:1,state:'pending',attempts:0}];people=new Map();index=[];creates=updates=0;fail=concurrent=false;};
 reset();
 const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async(input,init={})=>{
  const url=new URL(input),method=init.method||'GET',body=typeof init.body==='string'?JSON.parse(init.body):{};
  if(url.hostname==='oauth2.googleapis.com')return response({access_token:'fixture-access'});
  if(url.hostname==='people.googleapis.com'){
   const path=url.pathname.replace('/v1/','');
   if(path==='people/me/connections')return response({connections:[...people.values()],nextSyncToken:'fixture-sync-token'});
   if(path==='contactGroups/tte')return response({resourceName:path,name:'TTE Leads'});
   if(path.startsWith('contactGroups'))throw Error('Group should be reused');
   const updating=path.endsWith(':updateContact'),resource=updating?path.slice(0,-14):path;
   if(method==='GET')return people.has(resource)?response(people.get(resource)):response({error:{status:'NOT_FOUND'}},404);
   if(fail)return response({error:{status:'UNAVAILABLE'}},503);
   if(updating){assert.ok(people.has(resource));assert.equal(body.metadata.sources[0].etag,people.get(resource).metadata.sources[0].etag);updates++;}
   else {assert.equal(path,'people:createContact');creates++;}
   const key=updating?resource:'people/new'+creates;
   const person={...body,resourceName:key,metadata:{sources:[{type:'CONTACT',etag:'e'+(updates+creates)}]}};people.set(key,person);
   if(concurrent){jobs[0].revision++;jobs[0].attempts=0;concurrent=false;}
   return response(person);
  }
  assert.equal(url.hostname,'contacts-test.invalid','No bot/webhook/other network requests');
  const path=url.pathname.replace('/rest/v1/','');
  if(path==='rpc/crm_google_claim')return response(settings.enabled&&!settings.lease_token?(settings.lease_token=body.p_lease,true):false);
  if(path==='rpc/crm_google_release'){settings.lease_token=null;return response(null);}
  if(path==='rpc/crm_google_index_page'){for(const p of body.p_people){index=index.filter(r=>r.resource_name!==p.resourceName);for(const num of p.phoneNumbers||[])index.push({phone:format.normalizeContactPhone(num.value),resource_name:p.resourceName});}return response(null);}
  if(path==='rpc/crm_google_related')return response(leads.filter(l=>format.normalizeContactPhone(l.contact?.phone||l.phone)===body.p_phone).sort((a,b)=>b.created_at.localeCompare(a.created_at)));
  if(path==='crm_google_settings'){if(method==='PATCH')Object.assign(settings,body);return response([settings]);}
  if(path==='crm_google_contacts_index'){const resource=url.searchParams.get('resource_name')?.slice(3);if(method==='DELETE'){index=index.filter(r=>r.resource_name!==resource);return response(null);}return response(index.filter(r=>r.phone===url.searchParams.get('phone')?.slice(3)));}
  if(path==='crm_google_queue'){
   if(method==='GET')return response(jobs.filter(j=>j.state==='pending').map(j=>({...j})));
   const job=jobs.find(j=>j.lead_id===url.searchParams.get('lead_id')?.slice(3)&&j.revision===Number(url.searchParams.get('revision')?.slice(3)));
   if(job)Object.assign(job,body);return response(job?[job]:[]);
  }
  if(path==='leads'){
   const filter=url.searchParams.get('id');
   if(method==='PATCH'){const ids=filter?.slice(4,-1).split(',');leads.filter(l=>ids?.includes(l.id)).forEach(l=>Object.assign(l,body));return response(null);}
   if(filter?.startsWith('eq.'))return response(leads.filter(l=>l.id===filter.slice(3)));
   return response(leads.filter(l=>l.google_contact_id===url.searchParams.get('google_contact_id')?.slice(3)&&l.id!==filter?.slice(4)));
  }
  throw Error('Unexpected request '+method+' '+path);
 };
 try {
  people.set('people/existing',{resourceName:'people/existing',phoneNumbers:[{value:'+919876543210'}],biographies:[{value:'Personal notes to keep'}],memberships:[{contactGroupMembership:{contactGroupResourceName:'contactGroups/friends'}}],metadata:{sources:[{type:'CONTACT',etag:'original'}]}});
  await sync.runContactSync();assert.equal(creates,0);assert.equal(updates,1);assert.equal(jobs[0].state,'synced');assert.ok(leads.every(l=>l.google_contact_id==='people/existing'));
  const saved=people.get('people/existing');assert.equal(saved.names[0].givenName,'1530 Deepak RU Conf 18Feb');assert.ok(saved.biographies[0].value.includes('Personal notes to keep'));assert.ok(saved.biographies[0].value.includes('TTE-1499'));assert.ok(saved.biographies[0].value.includes('#/leads/'+base.id));assert.equal(saved.memberships.length,2);
  jobs[0].state='pending';jobs[0].revision++;leads[0].status='Lost';await sync.runContactSync();assert.equal(creates,0);assert.equal(people.get('people/existing').names[0].givenName,'1530 Deepak RU Lost 18Feb');assert.equal(people.get('people/existing').biographies[0].value.match(/\[TTE CRM Leads\]/g).length,1);
  reset();await sync.runContactSync();await (jobs[0].state='pending',jobs[0].revision++,sync.runContactSync());assert.equal(creates,1);assert.equal(updates,1);
  reset();settings.enabled=false;await sync.runContactSync();assert.equal(creates+updates,0);assert.equal(jobs[0].attempts,0);
  reset();fail=true;for(let i=0;i<4;i++)await sync.runContactSync();assert.equal(jobs[0].attempts,4);assert.equal(jobs[0].state,'failed');assert.ok(jobs[0].last_error);
  reset();concurrent=true;await sync.runContactSync();assert.equal(jobs[0].revision,2);assert.equal(jobs[0].state,'pending');await sync.runContactSync();assert.equal(creates,1);assert.equal(jobs[0].state,'synced');
  reset();leads[0].phone='';await sync.runContactSync();assert.equal(jobs[0].state,'skipped');assert.equal(creates,0);
 } finally{globalThis.fetch=originalFetch;}
 console.log('PASS: formatting/39-character limit, phone normalization, encrypted/tamper-resistant secrets, phone dedupe, stable contact IDs, notes/groups preserved, latest enquiry, one create then update, pause, four attempts, concurrent lead changes, missing phone, no MAX/network destinations.');
} finally {await rm(dir,{recursive:true,force:true});}
