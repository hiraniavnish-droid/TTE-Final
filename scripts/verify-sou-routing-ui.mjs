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

let config={kind:'lead-routing-v1',fallback:{enabled:true,assignTo:'Sonali'},routes:{rannutsav_website:{enabled:true,assignTo:'Main Agent'},rannutsav_tickets:{enabled:true,assignTo:'Tickets Agent'}}};
let failSave=false;
await context.route('**/rest/v1/**',async route=>{
 const u=new URL(route.request().url()),table=u.pathname.split('/').pop();
 if(table==='users') return route.fulfill({json:u.searchParams.get('select')==='session_version'?{session_version:1}:[{...session,created_at:new Date().toISOString()},{id:'sonali',name:'Sonali',role:'agent'},{id:'prakash',name:'Prakash',role:'agent'}]});
 if(table==='app_settings'){
  if(route.request().method()==='PATCH'){
   if(failSave) return route.fulfill({status:500,json:{message:'fixture failure'}});
   config=JSON.parse(route.request().postDataJSON().auto_assign_to);
   return route.fulfill({json:{id:true}});
  }
  return route.fulfill({json:{auto_assign_enabled:true,auto_assign_to:JSON.stringify(config)}});
 }
 return route.fulfill({json:[]});
});
await context.route('**/api/**',r=>r.fulfill({json:{ok:true,records:[]}}));
const page=await context.newPage();
try{
 await page.goto(`${base}/#/team-settings`);
 const select=page.getByRole('combobox',{name:'SOU Booking website assignee',exact:true});
 await select.waitFor();assert.equal(await select.inputValue(),'Sonali');
 await select.selectOption('Prakash');await page.getByText('Saved',{exact:true}).waitFor();
 assert.equal(config.routes.soubooking.assignTo,'Prakash');assert.equal(config.routes.rannutsav_website.assignTo,'Main Agent');assert.equal(config.routes.rannutsav_tickets.assignTo,'Tickets Agent');
 await page.reload();await select.waitFor();assert.equal(await select.inputValue(),'Prakash');
 failSave=true;await select.selectOption('Sonali');await page.getByRole('alert').getByText('Could not save routing. Please try again.').waitFor();assert.equal(await select.inputValue(),'Prakash');
 failSave=false;await select.selectOption('');await page.getByText('Saved',{exact:true}).waitFor();assert.equal(config.routes.soubooking.assignTo,null);
 await page.setViewportSize({width:390,height:844});await select.scrollIntoViewIfNeeded();const box=await select.boundingBox();assert(box.x>=0&&box.x+box.width<=391);
 console.log('PASS: SOU control inherits prior fallback, saves selected employee, preserves other routes, persists on reload, rolls back failed saves, supports unassigned and fits mobile.');
}finally{await browser.close();}
