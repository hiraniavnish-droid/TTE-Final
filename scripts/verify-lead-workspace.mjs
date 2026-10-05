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
await page.goto(`${base}/#/leads?view=overview`);await page.getByText('Test traveller 0',{exact:true}).waitFor();await page.waitForFunction(()=>!document.body.textContent.includes('Loading older leads'));
await page.getByRole('button',{name:/More filters/}).click();
await page.getByRole('combobox',{name:'Employee',exact:true}).selectOption('Admin');
await page.getByRole('combobox',{name:'Destination',exact:true}).selectOption('SOU');
await page.getByRole('combobox',{name:'Stage',exact:true}).selectOption('New');
await page.getByRole('combobox',{name:'Temperature',exact:true}).selectOption('Warm');
await page.getByRole('textbox',{name:'Search leads',exact:true}).fill('Test traveller 20');
await page.waitForFunction(()=>document.querySelector('input[aria-label="Search leads"]').value==='Test traveller 20');
await page.getByRole('button',{name:'Open lead Test traveller 20',exact:true}).click();
await page.getByRole('dialog',{name:'Lead details: Test traveller 20',exact:true}).waitFor();await page.getByRole('heading',{name:'Test traveller 20',exact:true}).waitFor();
await page.getByRole('button',{name:'Next lead',exact:true}).click();await page.getByRole('dialog',{name:'Lead details: Test traveller 200',exact:true}).waitFor();
await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
await page.getByRole('button',{name:'Save view',exact:true}).click();await page.getByRole('textbox',{name:'View name'}).fill('SOU warm enquiries');await page.getByRole('button',{name:'Save view',exact:true}).last().click();
await page.getByRole('dialog').waitFor({state:'hidden'});
const query=new URL(page.url()).hash;
await page.getByRole('button',{name:'Clear filters',exact:false}).first().click();await page.waitForURL(url=>url.hash!==query);
await page.getByRole('combobox',{name:'Saved views',exact:true}).selectOption('0');await page.waitForURL(url=>url.hash===query);assert.equal(new URL(page.url()).hash,query);
await page.reload();await page.getByRole('textbox',{name:'Search leads'}).waitFor();assert.equal(await page.getByRole('textbox',{name:'Search leads'}).inputValue(),'Test traveller 20');
await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Open lead Test traveller 20',exact:true}).click();await page.getByRole('dialog',{name:'Lead details: Test traveller 20'}).waitFor();const box=await page.getByRole('dialog',{name:'Lead details: Test traveller 20'}).boundingBox();assert(box.x>=0&&box.x+box.width<=391);await page.keyboard.press('Escape');
assert.deepEqual(errors,[]);console.log('PASS: combined owner/destination/stage/temperature/search filters, panel next/Escape, saved-view restore, reload persistence and mobile panel.');
await page.screenshot({path:'/tmp/tte-workspace-filters-mobile.png'});
} finally {await browser.close();}
