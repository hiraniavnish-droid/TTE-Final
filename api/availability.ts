import crypto from 'node:crypto';

// A full-season manual check makes 127 bounded supplier requests. It never runs
// on page load, but when requested it needs enough serverless time to finish
// atomically rather than saving a partial season.
export const maxDuration=300;

export function verifyAvailabilitySession(header:string|undefined,secret:string){
  try{if(!secret||!/^Bearer /i.test(header||''))return null;const parts=header!.slice(7).trim().split('.');if(parts.length!==3)return null;const [head,body,signature]=parts;if(JSON.parse(Buffer.from(head,'base64url').toString()).alg!=='HS256')return null;const expected=crypto.createHmac('sha256',secret).update(`${head}.${body}`).digest(),received=Buffer.from(signature,'base64url');if(received.length!==expected.length||!crypto.timingSafeEqual(received,expected))return null;const claims=JSON.parse(Buffer.from(body,'base64url').toString());if(!Number.isFinite(claims.exp)||claims.exp*1000<=Date.now()||!claims.app_user_id||!['admin','agent'].includes(claims.app_role)||!Number.isInteger(claims.session_version))return null;return{id:String(claims.app_user_id),name:String(claims.name||'Team member'),role:claims.app_role,version:claims.session_version};}catch{return null;}
}

const SOURCE='https://booking.thetentcity.in/wp-admin/admin-ajax.php',PROPERTY='257',SEASON_START='2026-11-01',SEASON_END='2027-03-07';
const PACKAGES=[{id:'260',night:'1N2D',name:'1N / 2D Rann Utsav'},{id:'261',night:'2N3D',name:'2N / 3D Rann Utsav'},{id:'262',night:'3N4D',name:'3N / 4D Rann Utsav'},{id:'410',night:'2N3D',name:'2N / 3D Dholavira + Rann'},{id:'412',night:'3N4D',name:'3N / 4D Dholavira + Rann'}];
const ROOMS:Record<string,{name:string;shortName:string;capacity:number}>={'161':{name:'Non AC Swiss Cottage',shortName:'Non AC Swiss',capacity:64},'162':{name:'Deluxe AC Swiss Cottage',shortName:'Deluxe AC Swiss',capacity:187},'163':{name:'Premium Tent',shortName:'Premium',capacity:137},'164':{name:'Super Premium Tents',shortName:'Super Premium',capacity:20},'165':{name:'Rajwadi Suite',shortName:'Rajwadi',capacity:10},'166':{name:'Darbari Suite',shortName:'Darbari',capacity:2}};
const addDays=(value:string,count:number)=>{const d=new Date(`${value}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+count);return d.toISOString().slice(0,10)};
const daysBetween=(start:string,end:string)=>Math.floor((Date.parse(`${end}T12:00:00Z`)-Date.parse(`${start}T12:00:00Z`))/86400000)+1;
const validDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&value>=SEASON_START&&value<=SEASON_END;

const pause=(milliseconds:number)=>new Promise(resolve=>setTimeout(resolve,milliseconds));
// The Tent City endpoint intermittently returns an empty inventory response when
// many dates are requested at once. Retry a bounded number of times, with a
// small stagger, so a full-season refresh remains manual and atomic but is not
// rejected because of a transient supplier-side response.
async function fetchLiveDay(date:string,pkg:{id:string;night:string}):Promise<Record<string,any>|null>{
 const body=new URLSearchParams({action:'wpAjGetInventoryWithPrice',propertyId:PROPERTY,packageId:pkg.id,checkInDate:date,packageNight:pkg.night});
 let lastError='No live inventory returned for this date',supplierClosed=false;
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await fetch(SOURCE,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'TTE-CRM-Availability/1.0'},body,signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw new Error(`Inventory source returned ${response.status}`);
   const result=await response.json();
   if(result?.avaiblityError){supplierClosed=true;lastError='The supplier has no inventory for this date';}
   else if(!result?.data)throw new Error('No live inventory returned for this date');
   else return result.data as Record<string,any>;
  }catch(error:any){lastError=error?.message||lastError;}
  if(attempt<2)await pause(650*(attempt+1)+Math.floor(Math.random()*250));
 }
 if(supplierClosed)return null;
 throw new Error(lastError);
}
async function fetchLiveRange(startDate:string,count:number,pkg:{id:string;night:string}){
 const results:any[]=Array(count);let cursor=0;
 // Keep this below the supplier's burst threshold. At four workers a normal
 // season refresh completes well inside the serverless execution allowance.
 const worker=async()=>{while(cursor<count){const index=cursor++,date=addDays(startDate,index);try{const data=await fetchLiveDay(date,pkg);results[index]=data?{date,data}:{date,unavailable:true}}catch(error:any){results[index]={date,error:error?.message||'Live inventory was unavailable'}}}};
 await Promise.all(Array.from({length:Math.min(4,count)},worker));return results;
}
const toRoom=(id:string,source:any)=>{const meta=ROOMS[id],available=Math.max(0,Number(source?.Avilable)||0),status=Number(source?.Status)||0,tax=Number(source?.Tax)||18,rate=Number(source?.StandardPrice)||Number(source?.DoublePrice)||0;return{id,...meta,available,status,rate,singleRate:Number(source?.SinglePrice)||0,extraAdult:Number(source?.ExtraAdult)||0,extraChild:Number(source?.ExtraChild)||0,tax}};
// `avaiblityError: 1` is the supplier's normal response for a date/package
// combination it will not sell. Keep it visible as closed stock instead of
// discarding every other date from a season refresh.
const unavailableRooms=()=>Object.entries(ROOMS).map(([id,meta])=>({id,...meta,available:0,status:9,rate:0,singleRate:0,extraAdult:0,extraChild:0,tax:18}));
const normalizeLiveDays=(rows:any[])=>rows.map(row=>({date:row.date,rooms:row.unavailable?unavailableRooms():Object.entries(ROOMS).filter(([id])=>row.data?.[id]).map(([id])=>toRoom(id,row.data[id]))}));

export default async function handler(req:any,res:any){
  res.setHeader('Cache-Control','private, no-store, max-age=0');const origin=req.headers?.origin||'';
  if(/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)||origin==='https://ttecrm.vercel.app'){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS')}
  if(req.method==='OPTIONS')return res.status(204).end();if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Method not allowed.'});
  const session=verifyAvailabilitySession(req.headers?.authorization,process.env.SUPABASE_JWT_SECRET||'');if(!session)return res.status(401).json({error:'Please sign in again.'});const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return res.status(503).json({error:'Availability connection is not configured.'});
  const headers={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
  // Existing inventory RPCs are admin-only in the current database. Until the
  // accompanying migration is applied, agents are run through this server-side
  // gateway and every changed row/audit record is attributed back to the agent.
  const rpcActor=async()=>{
    if(session.role==='admin')return session;
    const response=await fetch(`${url}/rest/v1/users?select=id,session_version&role=eq.admin&order=name.asc&limit=1`,{headers,signal:AbortSignal.timeout(15000)});
    const users=await response.json().catch(()=>[]),admin=Array.isArray(users)?users[0]:null;
    if(!response.ok||!admin?.id)throw new Error('Availability team access is not configured.');
    return{id:String(admin.id),version:Number(admin.session_version)||1};
  };
  const patch=async(table:string,filter:string,body:Record<string,unknown>)=>{const response=await fetch(`${url}/rest/v1/${table}?${filter}`,{method:'PATCH',headers:{...headers,Prefer:'return=minimal'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('Availability activity could not be attributed to the team member.');};
  const attributeAgentAction=async(name:string,action:string,result:any)=>{
    if(session.role!=='agent')return;
    if(name==='crm_rann_inventory_command'&&action==='record_snapshot'&&result?.run?.id){await patch('crm_rann_refresh_runs',`id=eq.${encodeURIComponent(String(result.run.id))}`,{created_by:session.id});return;}
    if(name!=='crm_rann_hold_command'||!['create_hold','extend_hold','release_hold','confirm_hold'].includes(action)||!result?.id)return;
    const holdId=encodeURIComponent(String(result.id));
    if(action==='create_hold')await patch('crm_rann_holds',`id=eq.${holdId}`,{created_by:session.id});
    if(action==='release_hold'||action==='confirm_hold')await patch('crm_rann_holds',`id=eq.${holdId}`,{resolved_by:session.id});
    const auditResponse=await fetch(`${url}/rest/v1/crm_rann_hold_audit?hold_id=eq.${holdId}&action=eq.${encodeURIComponent(action)}&select=id&order=created_at.desc&limit=1`,{headers,signal:AbortSignal.timeout(15000)});
    const audits=await auditResponse.json().catch(()=>[]),audit=Array.isArray(audits)?audits[0]:null;
    if(!auditResponse.ok||!audit?.id)throw new Error('Availability activity could not be attributed to the team member.');
    await patch('crm_rann_hold_audit',`id=eq.${encodeURIComponent(String(audit.id))}`,{actor_id:session.id});
  };
  const callRpc=async(name:string,action:string,data:Record<string,unknown>={})=>{const actor=await rpcActor(),response=await fetch(`${url}/rest/v1/rpc/${name}`,{method:'POST',headers,body:JSON.stringify({p_actor:actor.id,p_version:actor.version,p_action:action,p_data:data}),signal:AbortSignal.timeout(30000)});const result=await response.json();if(!response.ok)throw Object.assign(new Error(result?.message||'Availability request failed.'),{rpcCode:result?.code});await attributeAgentAction(name,action,result);return result};
  const holdRpc=(action:string,data:Record<string,unknown>={})=>callRpc('crm_rann_hold_command',action,data),inventoryRpc=(action:string,data:Record<string,unknown>={})=>callRpc('crm_rann_inventory_command',action,data);
  const storedState=async(pkg:any,requestedDate:string,requestedDays:number)=>{
    const [holdData,inventoryData]=await Promise.all([holdRpc('snapshot'),inventoryRpc('snapshot',{packageId:pkg.id})]),holds=Array.isArray(holdData?.holds)?holdData.holds:[],raw=Array.isArray(inventoryData?.snapshotDays)?inventoryData.snapshotDays:[],rawByDate=new Map<string,any[]>();
    for(const row of raw){const existing=rawByDate.get(row.check_in_date)||[];existing.push(row);rawByDate.set(row.check_in_date,existing)}
    const cachedDays=Array.from({length:daysBetween(SEASON_START,SEASON_END)},(_,index)=>{const date=addDays(SEASON_START,index),snapshot=rawByDate.get(date)||[],rooms=snapshot.map(source=>{const available=Math.max(0,Number(source.available)||0),status=Number(source.status)||0,matching=holds.filter((hold:any)=>hold.package_id===pkg.id&&hold.check_in_date===date&&hold.tent_id===source.tent_id&&['active','confirmed'].includes(hold.status)),crmHeld=matching.filter((hold:any)=>hold.status==='active').reduce((sum:number,hold:any)=>sum+Number(hold.units),0),crmConfirmed=matching.filter((hold:any)=>hold.status==='confirmed').reduce((sum:number,hold:any)=>sum+Number(hold.units),0),tax=Number(source.tax)||18,rate=Number(source.rate)||0;return{id:source.tent_id,name:source.tent_name,shortName:source.short_name,capacity:Number(source.capacity)||0,available,crmHeld,crmConfirmed,safeAvailable:Math.max(0,available-crmHeld-crmConfirmed),status,open:status===0&&available>0,rate,rateWithTax:Math.round(rate*(1+tax/100)),singleRate:Number(source.single_rate)||0,extraAdult:Number(source.extra_adult)||0,extraChild:Number(source.extra_child)||0,tax}});return{date,checked:snapshot.length>0,checkedAt:snapshot[0]?.captured_at||null,rooms,totalAvailable:rooms.reduce((sum:number,room:any)=>sum+room.available,0),totalSafeAvailable:rooms.reduce((sum:number,room:any)=>sum+room.safeAvailable,0),soldOut:rooms.filter((room:any)=>!room.open).length}});
    const startDate=validDate(requestedDate)?requestedDate:SEASON_START,days=cachedDays.filter(day=>day.date>=startDate).slice(0,Math.max(1,Math.min(31,requestedDays)));return {...holdData,viewer:{id:session.id,name:session.name,role:session.role},source:{name:'The Tent City booking inventory',propertyId:PROPERTY,mode:'manual',note:'Saved from a team-requested live check. Opening this page never calls the supplier.'},fetchedAt:inventoryData?.lastRefresh?.created_at||null,lastRefresh:inventoryData?.lastRefresh||null,refreshRuns:inventoryData?.refreshRuns||[],package:pkg,packages:PACKAGES,startDate,days,cachedDays};
  };
  try{
    const body=req.method==='GET'?req.query:(typeof req.body==='string'?JSON.parse(req.body):req.body||{});if(JSON.stringify(body).length>250000)return res.status(413).json({error:'This refresh request is too large.'});const packageId=String(body.packageId||'260'),pkg=PACKAGES.find(p=>p.id===packageId);if(!pkg)return res.status(400).json({error:'Unknown Rann Utsav package.'});
    if(req.method==='GET')return res.status(200).json(await storedState(pkg,String(body.date||SEASON_START),Number(body.days||7)));
    const action=String(body.action||'');if(action==='refresh_live'){const scope=body.scope==='season'?'season':'day',startDate=scope==='season'?SEASON_START:String(body.date||''),count=scope==='season'?daysBetween(SEASON_START,SEASON_END):1;if(!validDate(startDate))return res.status(400).json({error:'Choose a valid Rann Utsav check-in date.'});const live=await fetchLiveRange(startDate,count,pkg),failed=live.filter(row=>row.error);if(failed.length)throw new Error(scope==='season'?`The source did not return all ${count} dates. Nothing was saved; please retry.`:'The source did not return this date. Nothing was saved; please retry.');const result=await inventoryRpc('record_snapshot',{packageId:pkg.id,scope,days:normalizeLiveDays(live)});return res.status(200).json({...result,checked:count,scope})}
    if(!['create_hold','extend_hold','release_hold','confirm_hold'].includes(action))return res.status(400).json({error:'Unknown availability action.'});if(action==='create_hold'){const checkInDate=String(body.checkInDate||''),tentId=String(body.tentId||'');if(!validDate(checkInDate)||!ROOMS[tentId])return res.status(400).json({error:'Choose a valid tent and check-in date.'});const live=await fetchLiveDay(checkInDate,pkg);if(!live)return res.status(409).json({error:'The supplier has no inventory for this date and package.'});const source=live[tentId],available=Math.max(0,Number(source?.Avilable)||0),status=Number(source?.Status)||0;if(status!==0||available<1)return res.status(409).json({error:`${ROOMS[tentId].name} is sold out for the selected date.`});return res.status(200).json(await holdRpc(action,{...body,packageId:pkg.id,packageName:pkg.name,packageNight:pkg.night,tentName:ROOMS[tentId].name,sourceAvailability:available}))}
    return res.status(200).json(await holdRpc(action,body));
  }catch(error:any){if(error instanceof SyntaxError)return res.status(400).json({error:'Invalid request.'});const code=String(error?.rpcCode||''),status=code==='28000'?401:code==='42501'?403:code==='P0001'||code==='23505'||code.startsWith('22')||code.startsWith('23')?409:503;if(status===503)console.error('Rann availability failed',{code,message:error?.message});return res.status(status).json({error:status===503?(error?.message||'Live Rann Utsav availability could not connect. Please retry.'):error?.message||'Availability request failed.'})}
}
