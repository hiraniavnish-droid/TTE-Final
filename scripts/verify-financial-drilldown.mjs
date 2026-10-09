const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.CRM_TEST_BASE || 'http://localhost:3099';
import assert from 'node:assert/strict';
const browser = await chromium.launch({headless:true});
const context = await browser.newContext({viewport:{width:1440,height:950}});
const session = { id:'test-admin',name:'Admin',role:'admin' };
const token = `e30.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600,session_version:1})).toString('base64url')}.test`;
await context.addInitScript(({session,token})=>{
 if (!sessionStorage.getItem('initialized')) { localStorage.setItem('tte_token',token);localStorage.setItem('voyageos_user',JSON.stringify(session));localStorage.setItem('auth_expiry',String(Date.now()+3600000));localStorage.setItem('is_authenticated','true');sessionStorage.setItem('initialized','true'); }
},{session,token});
let failLeads=false; const requests=[];let interactionDone=false;
const rows=Array.from({length:2407},(_,i)=>({id:`fixture-${i}`,name:`Test traveller ${i}`,status:'New',created_at:new Date(Date.now()-i*60000).toISOString(),contact:i%3?{phone:'',email:''}:{},trip_details:i%2?{}:{destination:'SOU',paxConfig:null},assigned_to:'Admin'}));
await context.route('**/rest/v1/**',async route=>{
 const u=new URL(route.request().url());const table=u.pathname.split('/').pop();
 if(table==='leads'){
  const offset=Number(u.searchParams.get('offset')||0);const limit=Number(u.searchParams.get('limit')||1000);
  requests.push({offset,limit});
  await new Promise(r=>setTimeout(r,40));
  await route.fulfill({status:failLeads?500:200,contentType:'application/json',body:JSON.stringify(failLeads?{message:'fixture failure'}:rows.slice(offset,offset+limit))});
 } else if(table==='users') await route.fulfill({json:u.searchParams.get('select')==='session_version'?{session_version:1}:[{...session,created_at:new Date().toISOString()}]});
 else if(table==='interactions'){ await new Promise(r=>setTimeout(r,3500));interactionDone=true;await route.fulfill({json:[]}); }
 else await route.fulfill({json:[]});
});
await context.route('**/api/razorpay-link**',r=>r.fulfill({json:{records:[]}}));
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
rows.splice(0,rows.length,...[
 {id:'old',name:'Older enquiry won now',status:'Won',created_at:'2026-06-01T00:00:00Z',won_at:'2026-10-02T00:00:00Z'},
 {id:'earlier',name:'New enquiry earlier win',status:'Won',created_at:'2026-10-02T00:00:00Z',won_at:'2026-09-30T00:00:00Z'},
 {id:'legacy',name:'Legacy win',status:'Won',legacy:true,created_at:'2026-10-02T00:00:00Z',won_at:'2026-10-02T00:00:00Z'}
].map(r=>({...r,contact:{phone:'',email:''},trip_details:{destination:'Rann Utsav'},assigned_to:'Admin'})));
await page.goto(`${base}/#/leads?status=Won&report=financial&from=2026-10-01&to=2026-10-09`);
await page.getByRole('button',{name:'Open lead Older enquiry won now',exact:true}).waitFor();
assert.equal(await page.getByRole('button',{name:'Open lead New enquiry earlier win',exact:true}).count(),0);
assert.equal(await page.getByRole('button',{name:'Open lead Legacy win',exact:true}).count(),0);
await page.getByRole('group',{name:'Lead won period'}).waitFor();
await page.getByRole('button',{name:'All Time',exact:true}).click();
await page.getByRole('button',{name:'Open lead New enquiry earlier win',exact:true}).waitFor();
assert.equal(await page.getByRole('button',{name:'Open lead Legacy win',exact:true}).count(),0);
await page.goto(`${base}/#/leads?status=Won&from=2026-10-01&to=2026-10-09`);
await page.getByRole('button',{name:'Open lead New enquiry earlier win',exact:true}).waitFor();
assert.equal(await page.getByRole('button',{name:'Open lead Older enquiry won now',exact:true}).count(),0);
await page.getByRole('group',{name:'Lead creation period'}).waitFor();
assert.deepEqual(errors,[]);
console.log('PASS: financial report displays earlier-created current wins, excludes earlier wins and legacy; All Time preserves financial cohort; ordinary creation filter unchanged.');
} finally {await browser.close();}
