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
await page.goto(`${base}/#/leads`);
await page.getByText('Test traveller 0',{exact:true}).waitFor();
assert.equal(interactionDone,false,'lead board waits on interactions');
await page.waitForFunction(()=>!document.body.textContent.includes('Loading older leads'));
assert.equal(requests.filter(r=>r.offset===2400).length,1,'last page above Supabase row cap was loaded');
assert(requests.every(r=>r.limit===100),'unbounded lead requests');
let mounted=await page.getByText(/^Test traveller \d+$/).count();assert(mounted<=60&&mounted>=30,`mounted ${mounted} cards`);
console.log(JSON.stringify({check:'2407 leads, partial trip objects, independent first paint',mounted,leadRequests:requests.length}));
const more=page.getByRole('button',{name:/Show more leads/}).first();await more.evaluate(e=>{const p=e.parentElement;p.scrollTop=p.scrollHeight;});
await page.waitForFunction(()=>Array.from(document.querySelectorAll('*')).filter(e=>e.childElementCount===0&&/^Test traveller \d+$/.test(e.textContent||'')).length>30);
console.log('PASS scrolling mounts next batch');
await page.getByRole('button',{name:/Overview/}).click();await page.waitForURL('**/leads?view=overview');await page.getByText('Test traveller 0',{exact:true}).waitFor();
mounted=await page.getByText(/^Test traveller \d+$/).count();assert(mounted<=72,`overview mounted ${mounted}`);console.log('PASS overview bounded cards: '+mounted);
if (process.env.CRM_TEST_SCREENSHOTS) await page.screenshot({path:process.env.CRM_TEST_SCREENSHOTS+'/desktop.png'});
await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:/Kanban/}).click();await page.waitForURL('**/leads?view=kanban');await page.getByText('Test traveller 0',{exact:true}).waitFor();
mounted=await page.getByText(/^Test traveller \d+$/).count();assert(mounted<=60,`mobile duplicate ${mounted}`);if (process.env.CRM_TEST_SCREENSHOTS) await page.screenshot({path:process.env.CRM_TEST_SCREENSHOTS+'/mobile.png'});console.log('PASS mobile mounts one list: '+mounted);
await page.goto(`${base}/#/leads/fixture-2406`);await page.getByText('Test traveller 2406',{exact:true}).first().waitFor();console.log('PASS older lead direct link');
assert.equal(await page.getByText('Invalid Date',{exact:true}).count(),0);assert.deepEqual(errors,[]);console.log('PASS no runtime render errors');
failLeads=true;await page.goto(`${base}/#/leads`);await page.reload();await page.getByRole('button',{name:'Retry',exact:true}).waitFor();assert.equal(await page.getByText('No leads yet',{exact:true}).count(),0);failLeads=false;await page.getByRole('button',{name:'Retry',exact:true}).click();await page.getByText('Test traveller 0',{exact:true}).waitFor();console.log('PASS failure shows Retry, retries successfully');
await page.evaluate(()=>localStorage.setItem('tte_token','e30.'+btoa(JSON.stringify({exp:1}))+'.test'));await page.reload();await page.waitForURL('**/#/login');console.log('PASS expired stored JWT redirects to login');
await browser.close();
