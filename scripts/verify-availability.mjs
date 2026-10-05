import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import ts from 'typescript';
import {chromium} from '/Users/avnish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const importTS=async path=>import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
const api=await importTS('api/availability.ts'),secret='rann-availability-test-only';
const mint=claims=>{const body=Buffer.from(JSON.stringify(claims)).toString('base64url'),head=Buffer.from('{"alg":"HS256"}').toString('base64url');return `${head}.${body}.${crypto.createHmac('sha256',secret).update(`${head}.${body}`).digest('base64url')}`};
const adminClaims={app_user_id:'admin',app_role:'admin',session_version:1,exp:Math.floor(Date.now()/1000)+600};
assert(api.verifyAvailabilitySession(`Bearer ${mint(adminClaims)}`,secret));
assert(api.verifyAvailabilitySession(`Bearer ${mint({...adminClaims,app_role:'agent'})}`,secret));
assert.equal(api.verifyAvailabilitySession(`Bearer ${mint({...adminClaims,exp:1})}`,secret),null);
assert.equal(api.verifyAvailabilitySession(`Bearer ${mint(adminClaims)}x`,secret),null);

const admin={id:'admin',name:'Admin',role:'admin'},base=process.env.TTE_TEST_BASE||'http://127.0.0.1:3021';
const agent={id:'jigar',name:'Jigar',role:'agent'};
const leads=[{id:'11111111-1111-4111-8111-111111111111',name:'Aarav Mehta',lead_code:'TTE-0248',leadCode:'TTE-0248',destination:'Rann Utsav',tripDetails:{destination:'Rann Utsav'},created_at:'2026-09-10T10:00:00Z',createdAt:'2026-09-10T10:00:00Z'}];
const packages=[{id:'260',night:'1N2D',name:'1N / 2D Rann Utsav'},{id:'261',night:'2N3D',name:'2N / 3D Rann Utsav'}];
const roomSeed=[['161','Non AC Swiss Cottage','Non AC Swiss',64,58,12600,9450,4500],['162','Deluxe AC Swiss Cottage','Deluxe AC Swiss',187,171,16600,12450,5500],['163','Premium Tent','Premium',137,94,18600,13950,5500],['164','Super Premium Tents','Super Premium',20,4,20600,15450,5500],['165','Rajwadi Suite','Rajwadi',10,2,35000,35000,7750],['166','Darbari Suite','Darbari',2,0,70000,70000,7750]];
const rooms=roomSeed.map(([id,name,shortName,capacity,available,rate,singleRate,extraAdult])=>({id,name,shortName,capacity,available,crmHeld:0,crmConfirmed:0,safeAvailable:available,status:0,open:Number(available)>0,rate,rateWithTax:Math.round(Number(rate)*1.18),singleRate,extraAdult,extraChild:extraAdult,tax:18}));
const allDays=Array.from({length:127},(_,index)=>{const date=new Date(Date.UTC(2026,10,1+index)).toISOString().slice(0,10),dayRooms=structuredClone(rooms);dayRooms.forEach(room=>{room.available=Math.max(0,Number(room.available)-Math.abs(index-14)%9);room.safeAvailable=room.available;room.open=room.available>0});return{date,checked:true,checkedAt:new Date().toISOString(),rooms:dayRooms,totalAvailable:dayRooms.reduce((sum,room)=>sum+room.available,0),totalSafeAvailable:dayRooms.reduce((sum,room)=>sum+room.safeAvailable,0),soldOut:dayRooms.filter(room=>!room.open).length}});
let seq=0,actions=[];
const data={serverTime:new Date().toISOString(),fetchedAt:new Date().toISOString(),viewer:admin,source:{name:'The Tent City booking inventory',propertyId:'257',mode:'live',note:'Live'},package:packages[0],packages,holds:[],audit:[]};
const enrich=()=>{for(const day of allDays){for(const room of day.rooms){const matching=data.holds.filter(hold=>hold.package_id===data.package.id&&hold.check_in_date===day.date&&hold.tent_id===room.id&&['active','confirmed'].includes(hold.status));room.crmHeld=matching.filter(h=>h.status==='active').reduce((sum,h)=>sum+h.units,0);room.crmConfirmed=matching.filter(h=>h.status==='confirmed').reduce((sum,h)=>sum+h.units,0);room.safeAvailable=Math.max(0,room.available-room.crmHeld-room.crmConfirmed)}day.totalSafeAvailable=day.rooms.reduce((sum,room)=>sum+room.safeAvailable,0)}};
const snapshot=(startDate='2026-11-15',count=7)=>{enrich();return structuredClone({...data,startDate,days:allDays.filter(day=>day.date>=startDate).slice(0,count),cachedDays:allDays,serverTime:new Date().toISOString(),fetchedAt:new Date().toISOString(),lastRefresh:null,refreshRuns:[]})};
const addAudit=(action,hold,detail={})=>data.audit.unshift({id:++seq,hold_id:hold.id,actor_id:'admin',action,detail,created_at:new Date().toISOString()});

const browser=await chromium.launch({headless:true});
try{
 const errors=[],page=await browser.newPage({viewport:{width:1440,height:1050}});
 await page.addInitScript(()=>{localStorage.setItem('tte_token','test.'+btoa(JSON.stringify({session_version:1,exp:Math.floor(Date.now()/1000)+86400}))+'.test');localStorage.setItem('voyageos_user',JSON.stringify({id:'admin',name:'Admin',role:'admin'}));localStorage.setItem('is_authenticated','true');localStorage.setItem('auth_expiry',String(Date.now()+86400000));});
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',async route=>{const request=route.request(),url=new URL(request.url()),json=(value,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
  if(url.pathname==='/api/availability'){
   if(request.method()==='GET')return json(snapshot(url.searchParams.get('date')||'2026-11-15',Number(url.searchParams.get('days')||7)));
   const body=request.postDataJSON();actions.push(body.action);
   if(body.action==='refresh_live')return json({checked:body.scope==='season'?127:1,scope:body.scope});
   if(body.action==='create_hold'){const tent=allDays.find(day=>day.date===body.checkInDate).rooms.find(room=>room.id===body.tentId),lead=leads[0],hold={id:`hold-${++seq}`,package_id:body.packageId,package_name:data.package.name,package_night:data.package.night,check_in_date:body.checkInDate,tent_id:body.tentId,tent_name:tent.name,units:Number(body.units),source_availability:tent.available,lead_id:body.leadId,current_lead_name:lead.name,current_lead_code:lead.leadCode,current_lead_phone:null,customer_name:null,customer_phone:null,status:'active',expires_at:body.expiresAt,supplier_reference:null,notes:body.notes||'',created_by:'admin',resolved_by:null,resolved_at:null,resolution_note:null,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};data.holds.push(hold);addAudit('hold_created',hold,{tent:hold.tent_name});return json(hold)}
   const hold=data.holds.find(value=>value.id===body.id);
   if(body.action==='extend_hold')hold.expires_at=body.expiresAt;
   if(body.action==='release_hold')Object.assign(hold,{status:'released',expires_at:null,resolution_note:body.reason});
   if(body.action==='confirm_hold')Object.assign(hold,{status:'confirmed',expires_at:null,supplier_reference:body.supplierReference,resolution_note:body.reason});
   addAudit(body.action,hold,{reason:body.reason});return json(hold);
  }
  if(url.pathname.includes('/rest/v1/users'))return json(url.searchParams.get('select')==='session_version'?{session_version:1}:[agent,admin]);
  if(url.pathname.includes('/rest/v1/leads'))return json(leads);
  if(url.pathname.includes('/rest/v1/'))return json([]);
  if(url.pathname.startsWith('/api/')||url.pathname.includes('/functions/v1/'))return json({});
  return route.continue();
 });
 const noOverflow=async label=>{const width=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert(width.scroll<=width.client+1,`${label} overflow ${JSON.stringify(width)}`)};
 await page.goto(`${base}/#/availability`);
 await page.getByRole('heading',{name:/Tent City inventory desk/i}).waitFor();
 await page.getByText(/RANN UTSAV · DHORDO · PROPERTY 257/).waitFor();
 await page.getByText('Super Premium Tents',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Hold',exact:true}).nth(3).click();
 await page.getByLabel('Lead or customer').selectOption(leads[0].id);
 await page.getByLabel('Hold tents').fill('2');
 await page.getByLabel('Internal note').fill('Confirm the block with The Tent City supplier.');
 await page.getByRole('button',{name:'Check again & place hold'}).click();
 await page.locator('.desk-table-wrap').filter({hasText:'Super Premium Tents'}).waitFor();
 await page.getByRole('tab',{name:/CRM holds/}).click();
 await page.getByText('Aarav Mehta').waitFor();
 await page.getByRole('button',{name:'Extend'}).click();
 await page.getByLabel('Reason for extension').fill('Client needs additional time');
 await page.getByRole('button',{name:'Extend hold'}).click();
 await page.getByRole('button',{name:'Confirm'}).click();
 await page.getByLabel('Supplier confirmation reference').fill('TC-90482');
 await page.getByLabel('Confirmation note').fill('Confirmed directly with supplier');
 await page.getByRole('button',{name:'Record supplier confirmation'}).click();
 await page.getByText('TC-90482').waitFor();
 await page.getByRole('tab',{name:'Availability'}).click();
 await page.getByRole('region',{name:'Monthly live availability calendar'}).waitFor();
 await page.getByLabel(/15 Nov/).click();
 await page.getByRole('button',{name:/^Check /}).click();
 await page.getByText(/Saved live availability/).waitFor();
 await page.getByRole('button',{name:'Whole season',exact:true}).click();
 await page.getByRole('region',{name:'Rann Utsav season availability calendar'}).waitFor();
 await noOverflow('desktop');await page.screenshot({path:'/tmp/tte-rann-availability-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await noOverflow('mobile');await page.screenshot({path:'/tmp/tte-rann-availability-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);for(const action of ['create_hold','extend_hold','confirm_hold','refresh_live'])assert(actions.includes(action));
 console.log('PASS: inventory desk, month and full-season calendars, six tent categories, supplier/CRM stock math, linked hold, extension, supplier confirmation, desktop/mobile layout and no page errors.');

}finally{await browser.close()}
