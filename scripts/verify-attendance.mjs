import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { chromium } from '/Users/avnish/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const importTS=async path=>import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
const model=await importTS('lib/attendance.ts');
const api=await importTS('api/attendance.ts');
const crypto=await import('node:crypto');
const secret='attendance-test-only';
const mint=(claims)=>{const body=Buffer.from(JSON.stringify(claims)).toString('base64url'),head=Buffer.from('{"alg":"HS256"}').toString('base64url');return `${head}.${body}.${crypto.createHmac('sha256',secret).update(`${head}.${body}`).digest('base64url')}`};
const claims={app_user_id:'admin',app_role:'admin',exp:Math.floor(Date.now()/1000)+600,session_version:1};
assert(api.verifyAttendanceSession(`Bearer ${mint(claims)}`,secret));
assert.equal(api.verifyAttendanceSession(`Bearer ${mint({...claims,exp:1})}`,secret),null);
assert.equal(api.verifyAttendanceSession(`Bearer ${mint(claims)}x`,secret),null);
assert.equal(api.verifyAttendanceSession(`Bearer ${mint({...claims,session_version:undefined})}`,secret),null);
const policy={start:'10:00',end:'19:00',workingDays:[1,2,3,4,5],lateMinutes:30,lateDays:3,halfDayHours:4,fullDayHours:8,quotas:{casual:12,sick:12,earned:15},holidays:[],timezone:'Asia/Kolkata',leaveYearStartMonth:4,leaveAccrualStart:'2026-09-01',leaveAccrualMode:'monthly',governmentHolidaysAdditional:true};
const record=(day,time='10:20',user='admin')=>({id:`${user}-${day}`,user_id:user,day,clock_in:`${day}T${time}:00+05:30`,clock_out:`${day}T19:00:00+05:30`,policy,override:null,note:'',updated_at:`${day}T19:00:00+05:30`});
const fixture={serverTime:new Date().toISOString(),today:model.indiaDate(),startedOn:'2026-01-01',viewer:{id:'admin',name:'Admin',role:'admin'},policy,users:[{id:'admin',name:'Admin',role:'admin'},{id:'jigar',name:'Jigar',role:'agent'},{id:'sonali',name:'Sonali',role:'agent'},{id:'prakash',name:'Prakash',role:'agent'}],records:[],requests:[],entitlements:[],audit:[]};
const lateRecords=['2026-09-01','2026-09-02','2026-09-03','2026-09-04'].map(d=>record(d));
const sample={...fixture,records:lateRecords,today:'2026-09-11'};
for(const r of lateRecords.slice(0,3))assert.equal(model.attendanceStatus(r,r.day,'admin',sample).label,'Late · allowed');
assert.equal(model.attendanceStatus(lateRecords[3],lateRecords[3].day,'admin',sample).label,'Late · review');
const excessive=record('2026-09-07','10:31');assert.equal(model.attendanceStatus(excessive,excessive.day,'admin',{...sample,records:[excessive]}).label,'Late · review');
const cutoff=record('2026-09-07','10:30');assert.equal(model.attendanceStatus(cutoff,cutoff.day,'admin',{...sample,records:[cutoff]}).label,'Late · allowed');
const reset=record('2026-10-01');assert.equal(model.attendanceStatus(reset,reset.day,'admin',{...sample,records:[...lateRecords,reset]}).label,'Late · allowed');
const half={id:'req-1',user_id:'admin',kind:'leave',start_date:'2026-09-07',end_date:'2026-09-07',leave_type:'casual',portion:'morning',days:.5,dates:['2026-09-07'],reason:'Personal appointment',status:'approved',created_at:new Date().toISOString()};
const afternoon=record('2026-09-07','14:00');assert.equal(model.lateMinutes(afternoon,[half]),0);
assert.equal(model.attendanceStatus(afternoon,afternoon.day,'admin',{...sample,requests:[half],records:[afternoon]}).label,'Present');
assert.equal(model.leaveCycleYear(policy,'2027-03-01'),2026);
assert.equal(model.leaveBalance({...sample,requests:[half,{...half,id:'pending',status:'pending'}]},'admin','casual',2026).available,0);
assert.equal(model.leaveBalance({...sample,today:'2027-03-11',requests:[]},'admin','earned',2026).allowance,8.75);
assert.equal(model.leaveBalance({...sample,requests:[{...half,status:'cancelled'}]},'admin','casual',2026).available,1);
assert.equal(model.monthDays('2028-02').length,29);
assert.equal(model.workingDay('2026-09-12',policy),false);
assert.equal(model.duration(1.999),'1h 59m');
console.log('PASS: signed sessions, expiry, tampering, 30-minute boundary, three-day allowance, fourth day, month reset, morning half-day leave, leave reservations, leap year, weekly offs.');

const browser=await chromium.launch({headless:true});
const errors=[];let data=structuredClone(fixture),actions=[];
const month=data.today.slice(0,7);
data.records=model.monthDays(month).filter(d=>d<data.today&&model.workingDay(d,policy)).slice(-5).map((d,i)=>record(d,i<3?'10:15':'10:00'));
// An unclosed prior day remains visible for correction, but must never disable
// today's check-in. This mirrors the live employee scenario that caused the
// original block.
const previousOpenDay=model.monthDays(month).filter(d=>d<data.today).at(-1);
if(previousOpenDay)data.records.push({...record(previousOpenDay,'10:00'),clock_out:null});
data.requests=[{...half,id:'pending-jigar',user_id:'jigar',status:'pending',start_date:data.today,end_date:data.today,dates:[data.today],reason:'Family appointment',review_note:null}];
const page=await browser.newPage({viewport:{width:1440,height:1100}});
await page.addInitScript(()=>{localStorage.setItem('tte_token','test.'+btoa(JSON.stringify({session_version:1,exp:Math.floor(Date.now()/1000)+86400}))+'.test');localStorage.setItem('voyageos_user',JSON.stringify({id:'admin',name:'Admin',role:'admin'}));localStorage.setItem('is_authenticated','true');localStorage.setItem('auth_expiry',String(Date.now()+86400000));});
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',async route=>{
 const req=route.request(),url=new URL(req.url());
 const json=value=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(value)});
 if(url.pathname==='/api/attendance'){
   if(req.method()==='GET')return json(data);
   const body=req.postDataJSON();actions.push(body);
   if(body.action==='clock_in'){data.records.push({...record(data.today,'10:00'),clock_in:new Date(Date.now()-3600000).toISOString(),clock_out:null});}
   if(body.action==='clock_out'){data.records.find(r=>r.user_id==='admin'&&r.day===data.today).clock_out=new Date().toISOString();}
   if(body.action==='request')data.requests.unshift({...half,id:'new-request',user_id:'admin',kind:body.kind,status:'pending',reason:body.reason,start_date:body.startDate,end_date:body.endDate});
   if(body.action==='review')data.requests.find(r=>r.id===body.id).status=body.decision;
   if(body.action==='policy')data.policy=body.settings;
   return json({ok:true});
 }
 if(url.pathname.includes('/rest/v1/')){if(url.pathname.endsWith('/users'))return json(url.searchParams.get('select')==='session_version'?{session_version:1}:data.users.map(u=>({...u,session_version:1})));return json([])}
 if(url.pathname.startsWith('/api/')||url.pathname.includes('/functions/v1/'))return json({records:[],documents:[],tasks:[]});
 return route.continue();
});
const overflow=async(label)=>{const width=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert(width.scroll<=width.client+1,`${label} overflow ${JSON.stringify(width)}`)};
try{
 await page.goto('http://127.0.0.1:3020/#/attendance');await page.getByRole('heading',{name:'Time, well accounted for.'}).waitFor();
 await page.getByRole('button',{name:'Check in for today',exact:true}).click();await page.getByRole('dialog',{name:'Confirm check in'}).waitFor();assert.equal(actions.filter(a=>a.action==='clock_in').length,0,'Check-in must not be recorded before confirmation');await page.screenshot({path:'/tmp/tte-attendance-check-in-confirmation.png',fullPage:false});await page.getByRole('button',{name:'Confirm check in',exact:true}).click();await page.getByRole('button',{name:'Check out',exact:true}).waitFor();
 await page.getByRole('button',{name:'Check out',exact:true}).click();await page.getByRole('dialog',{name:'Confirm check out'}).waitFor();assert.equal(actions.filter(a=>a.action==='clock_out').length,0,'Check-out must not be recorded before confirmation');await page.getByRole('button',{name:'Confirm check out',exact:true}).click();await page.getByRole('button',{name:'Workday recorded',exact:true}).waitFor();
 await page.getByRole('button',{name:'Request time off',exact:true}).click();await page.getByLabel('Reason',{exact:true}).fill('Family appointment for next week');await page.getByRole('button',{name:'Submit for approval'}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.getByRole('button',{name:/^Requests/}).click();await page.getByRole('button',{name:'Approve',exact:true}).first().click();await page.getByLabel('Approval note').fill('Approved as requested');await page.getByRole('button',{name:'Approve request',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Team overview',exact:true}).click();await page.locator('.at-table-scroll').getByRole('button',{name:'Correct',exact:true}).first().click();await page.locator('select[name=override]').selectOption('excused');await page.getByLabel('Reason',{exact:true}).fill('Clock verified with the team');await page.getByRole('button',{name:'Save correction',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Leave balances',exact:true}).click();await page.getByRole('button',{name:'Adjust allowance',exact:true}).first().click();await page.getByLabel('Total annual policy allowance (days)').fill('15.5');await page.getByLabel('Reason',{exact:true}).fill('Carry forward approved');await page.getByRole('button',{name:'Update allowance',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByLabel('Maximum minutes late').fill('30');await page.getByLabel('Reason for policy change').fill('Reviewed attendance policy');await page.getByRole('button',{name:'Save policy',exact:false}).click();await page.getByText('Attendance policy updated.',{exact:true}).waitFor();
 await overflow('desktop settings');await page.screenshot({path:'/tmp/tte-attendance-settings.png',fullPage:true});
 await page.getByRole('button',{name:'My attendance',exact:true}).click();await page.locator('main').evaluate(el=>el.scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(250);await overflow('desktop attendance');await page.screenshot({path:'/tmp/tte-attendance-desktop.png',fullPage:true});
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export month',exact:true}).click();assert((await download).suggestedFilename().includes('attendance-'));
 await page.setViewportSize({width:390,height:844});await overflow('mobile attendance');await page.screenshot({path:'/tmp/tte-attendance-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Request time off',exact:true}).click();await page.waitForTimeout(300);const bounds=await page.getByRole('dialog').boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=391);await page.screenshot({path:'/tmp/tte-attendance-mobile-request.png',fullPage:false});await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 await page.setViewportSize({width:1440,height:1100});
 await page.locator('button').filter({has:page.locator('svg.lucide-moon')}).last().click();await page.locator('.at-dark').waitFor();await page.screenshot({path:'/tmp/tte-attendance-dark.png',fullPage:true});
 for(const action of ['clock_in','clock_out','request','review','adjust','entitlement','policy'])assert(actions.some(a=>a.action===action),`Missing ${action} action`);
 data={...data,viewer:{id:'jigar',name:'Jigar',role:'agent'},users:[{id:'jigar',name:'Jigar',role:'agent'}],records:[],requests:[],audit:[]};
 await page.getByRole('button',{name:'Refresh attendance',exact:true}).click();await page.waitForTimeout(200);
 assert.equal(await page.getByRole('button',{name:'Settings',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Team overview',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Audit trail',exact:true}).count(),0);
 assert.deepEqual(errors,[]);console.log('PASS: browser check-in/out, request, review, correction, allowance, settings, export, employee controls, desktop/mobile overflow and dialogs.');
} catch(error) { console.log((await page.locator('dialog').allTextContents()).join(' ')); throw error; } finally {await browser.close()}
