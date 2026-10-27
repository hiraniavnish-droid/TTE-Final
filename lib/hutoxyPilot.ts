import crypto from 'node:crypto';
import {maxDb} from './maxServerDb';
import {messageInput,quoteInput,MaxInputError,safeWebhookRequest,signWebhook,validateTarget} from './maxAutomation';
import {catalog,rannQuote,QuoteInputError} from './botItinerary';
import {createRannQuotationPdf} from '../services/rannQuotationPdf';
import {quoteStorage,QuoteStorageError} from './quoteStorage';

export class HutoxyError extends Error { constructor(public status:number,public code:string,message:string){super(message);} }
const hash=(v:string)=>crypto.createHash('sha256').update(v).digest('hex');
const equal=(a:string,b:string)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&crypto.timingSafeEqual(x,y);};
const key=()=>process.env.HUTOXY_API_KEY||'';
const signingKey=()=>process.env.HUTOXY_WEBHOOK_SECRET||'';
function publicSettings(value:any){const {test_only,test_phone,...settings}=value;return {...settings,recipient_filter:'bot_managed'};}
const rpc=(db:typeof maxDb,action:string,ref:string|null=null,data:any={})=>db('rpc/crm_hutoxy_api',{method:'POST',body:JSON.stringify({p_action:action,p_ref:ref,p_data:data})});
function body(req:any){let v;try{v=typeof req.body==='string'?JSON.parse(req.body):req.body||{};}catch{throw new HutoxyError(400,'invalid_json','Provide a JSON object.');}if(!v||typeof v!=='object'||Array.isArray(v)||JSON.stringify(v).length>32000)throw new HutoxyError(400,'invalid_request','Provide a JSON object no larger than 32 KB.');return v;}
function cursor(value:any,scope:string){
 if(!value)return {};
 try{const [encoded,signature,...rest]=String(value).split('.');if(rest.length||!equal(signature||'',crypto.createHmac('sha256',key()).update(encoded).digest('hex')))throw Error();const c=JSON.parse(Buffer.from(encoded,'base64url').toString());if(c.scope!==scope||typeof c.time!=='string'||!Number.isFinite(Date.parse(c.time))||typeof c.id!=='string'||c.id.length>200)throw Error();return {after_time:c.time,after_id:c.id};}catch{throw new HutoxyError(400,'invalid_cursor','Invalid cursor for this resource.');}
}
function encodeCursor(v:any,scope:string){if(!v)return null;const encoded=Buffer.from(JSON.stringify({...v,scope})).toString('base64url');return encoded+'.'+crypto.createHmac('sha256',key()).update(encoded).digest('hex');}
function page(query:any,scope:string){const limit=Number(query?.limit||50);if(!Number.isInteger(limit)||limit<1||limit>100)throw new HutoxyError(400,'invalid_limit','limit must be 1-100.');const since=query?.updated_since;if(since&&!Number.isFinite(Date.parse(String(since))))throw new HutoxyError(400,'invalid_timestamp','updated_since must be an ISO timestamp.');return {limit,...cursor(query?.cursor,scope),...(since?{updated_since:String(since)}:{})};}
export function leadUpdateInput(b:any){
 const allowed=['check_in','nights','adults','child_ages','tent_category','tent_count','status','temperature','note','next_follow_up_at','human_takeover','bot_paused','expected_updated_at'];
 const fail=()=>{throw new HutoxyError(400,'invalid_update','Provide only supported lead fields with valid values.');};
 if(Object.keys(b).some(k=>!allowed.includes(k))||!Object.keys(b).some(k=>k!=='expected_updated_at'))fail();
 const integer=(k:string,min:number,max:number)=>{if(k in b&&(!Number.isInteger(b[k])||b[k]<min||b[k]>max))fail();};
 integer('nights',1,365);integer('adults',1,1000);integer('tent_count',1,1000);
 if('check_in' in b&& (typeof b.check_in!=='string'||!/^\d{4}-\d\d-\d\d$/.test(b.check_in)||!Number.isFinite(Date.parse(b.check_in+'T12:00:00Z'))||new Date(b.check_in+'T12:00:00Z').toISOString().slice(0,10)!==b.check_in))fail();
 if('child_ages' in b&&(!Array.isArray(b.child_ages)||b.child_ages.length>1000||b.child_ages.some((v:any)=>!Number.isInteger(v)||v<0||v>17)))fail();
 if('tent_category' in b&&!['Non-AC Swiss Cottage','Deluxe AC Swiss Cottage','Premium Tent','Super Premium Tent','Rajwadi Suite','Darbari Suite'].includes(b.tent_category))fail();
 if('status' in b&&!['New','Contacted','Proposal Sent','Discussion','Won','Lost'].includes(b.status))fail();
 if('temperature' in b&&!['Hot','Warm','Cold'].includes(b.temperature))fail();
 if('note' in b&&(typeof b.note!=='string'||!b.note.trim()||b.note.length>10000))fail();
 for(const k of ['human_takeover','bot_paused'])if(k in b&&typeof b[k]!=='boolean')fail();
 for(const k of ['expected_updated_at','next_follow_up_at'])if(k in b&&!(k==='next_follow_up_at'&&b[k]===null)&&(typeof b[k]!=='string'||!/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(b[k])||!Number.isFinite(Date.parse(b[k]))))fail();
 return b;
}
async function lead(db:typeof maxDb,ref:string){const value=await rpc(db,'lead',ref);if(value?.error)throw new HutoxyError(404,'lead_not_in_pilot','Lead not found in the Hutoxy pilot.');return value;}
async function audit(db:typeof maxDb,req:any,rid:string,action:string){await db('crm_api_audit',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({request_id:rid,client_id:'hutoxy-pilot',method:req.method,path:new URL(req.url||'/','https://ttecrm.vercel.app').pathname,action,metadata:{}})});}
const assets=new Map<string,Promise<string>>();
function asset(name:string){if(!assets.has(name)){assets.set(name,fetch('https://ttecrm.vercel.app/quotation-assets/'+encodeURIComponent(name),{signal:AbortSignal.timeout(20000)}).then(async r=>{if(!r.ok)throw new HutoxyError(503,'asset_unavailable','Quotation image/font unavailable.');return Buffer.from(await r.arrayBuffer()).toString('base64');}).catch(e=>{assets.delete(name);throw e;}));}return assets.get(name)!;}

// Read the same saved inventory and active holds as the existing availability
// route. This never refreshes supplier inventory or creates a hold.
export async function hutoxyAvailability(query:any,db:typeof maxDb=maxDb){
 const check=String(query.check_in||''),nights=Number(query.nights);
 if(!/^\d{4}-\d\d-\d\d$/.test(check)||!Number.isFinite(Date.parse(check+'T12:00:00Z'))||new Date(check+'T12:00:00Z').toISOString().slice(0,10)!==check||![1,2,3].includes(nights))throw new HutoxyError(400,'invalid_request','Provide valid check_in and nights=1,2,3.');
 const names:Record<string,string>={'161':'Non-AC Swiss Cottage','162':'Deluxe AC Swiss Cottage','163':'Premium Tent','164':'Super Premium Tent','165':'Rajwadi Suite','166':'Darbari Suite'};
 const category=String(query.category||''),tent=Object.keys(names).find(k=>k===category||names[k].toLowerCase()===category.toLowerCase());if(!tent)throw new HutoxyError(400,'invalid_category','Unknown Tent City category.');
 const pkg=String(259+nights),snapshots=await db(`crm_rann_inventory_snapshots?package_id=eq.${pkg}&check_in_date=eq.${check}&tent_id=eq.${tent}&order=captured_at.desc,id.desc&limit=1`);
 if(!snapshots[0])throw new HutoxyError(404,'availability_not_checked','No saved check for this date/package/category. Refresh availability in the CRM first.');
 const snapshot=snapshots[0],holds=await db(`crm_rann_holds?package_id=eq.${pkg}&check_in_date=eq.${check}&tent_id=eq.${tent}&status=in.(active,confirmed)&select=units,status,expires_at`);
 const held=holds.filter((h:any)=>h.status==='confirmed'||Date.parse(h.expires_at)>Date.now()).reduce((sum:number,h:any)=>sum+Number(h.units),0);
 return {check_in:check,nights,category:names[tent],package_id:pkg,supplier_available:snapshot.available,crm_held:held,tents_left:Number(snapshot.status)===0?Math.max(0,snapshot.available-held):0,checked_at:snapshot.captured_at,source:'saved_supplier_snapshot',live:false,hold_created:false};
}

export function createHutoxyHandler(db:typeof maxDb=maxDb,request:typeof fetch=safeWebhookRequest){
 return async function handler(req:any,res:any){
 const rid='hutoxy_'+crypto.randomUUID();res.setHeader('Cache-Control','no-store');
 const respond=(status:number,data:any)=>res.status(status).json({...data,request_id:rid});
 try{
  const supplied=String(req.headers?.['x-api-key']||'');if(!supplied)throw new HutoxyError(401,'missing_api_key','x-api-key is required.');if(!key()||!equal(key(),supplied))throw new HutoxyError(401,'invalid_api_key','Invalid Hutoxy API key.');
  const limit=await db('rpc/crm_api_consume_rate_limit',{method:'POST',body:JSON.stringify({p_client_id:'hutoxy-pilot',p_window_seconds:60,p_limit:120})});if(!limit?.allowed)throw new HutoxyError(429,'rate_limited','Retry after the current minute.');
  const pathname=new URL(req.url||'/','https://ttecrm.vercel.app').pathname;
  const segments=(pathname.startsWith('/api/hutoxy/v1/')?pathname.slice('/api/hutoxy/v1/'.length).split('/'):[req.query?.path||''].flatMap(v=>String(v).split('/'))).filter(Boolean).map(decodeURIComponent);
  if(segments.some(s=>s==='..'||s==='.'||s.includes('/')))throw new HutoxyError(400,'invalid_path','Invalid path.');
  const endpoint=segments.join('/'),method=String(req.method||'GET').toUpperCase();
  if(method==='GET'&&endpoint==='health'){const s=await rpc(db,'settings');return respond(200,{data:{status:'ok',service:'tte-crm-hutoxy-pilot',owner:s.owner_id,owner_name:'Hutoxy Pilot',webhook_enabled:s.enabled,recipient_filter:'bot_managed',poll_interval_seconds:120}});}
  if(endpoint==='automation/settings'&&method==='GET')return respond(200,{data:publicSettings(await rpc(db,'settings'))});
  if(endpoint==='automation/settings'&&method==='PATCH'){
   const b=body(req),s=await rpc(db,'settings');if(Object.keys(b).some(k=>!['enabled','target_url'].includes(k))||!Object.keys(b).length)throw new HutoxyError(400,'invalid_settings','Only enabled and target_url can be changed.');
   if(b.enabled!==undefined&&typeof b.enabled!=='boolean')throw new HutoxyError(400,'invalid_settings','enabled must be boolean.');
   if(b.target_url!==undefined)b.target_url=await validateTarget(b.target_url);
   if(b.enabled&&(!signingKey()||!(b.target_url||s.target_url)))throw new HutoxyError(400,'not_configured','Configure the receiver URL and signing secret first.');
   await audit(db,req,rid,'hutoxy_settings_change');return respond(200,{data:publicSettings(await rpc(db,'settings_write',null,b))});
  }
  if(endpoint==='automation/deliveries'&&method==='GET')return respond(200,{data:await rpc(db,'deliveries',null,page(req.query,'deliveries'))});
  if(endpoint==='automation/test'&&method==='POST'){
   const b=body(req);if(Object.keys(b).length)throw new HutoxyError(400,'invalid_request','Send an empty JSON object. This is a receiver test only.');
   const s=await rpc(db,'settings');if(!s.target_url||!signingKey())throw new HutoxyError(409,'webhook_not_configured','Configure Hutoxy receiver URL first.');
   const target=await validateTarget(s.target_url),now=Math.floor(Date.now()/1000),payload={id:crypto.randomUUID(),event:'connection.test',test:true,dry_run:true,occurred_at:new Date().toISOString(),data:{owner:s.owner_id,owner_name:'Hutoxy Pilot',phone:null,message:'Connection test only; do not contact a customer.'}};
   let status=0;try{const response=await request(target,{method:'POST',headers:{'Content-Type':'application/json','X-TTE-Signature':signWebhook(JSON.stringify(payload),signingKey(),now),'X-TTE-Event-Id':payload.id,'X-TTE-Event':payload.event},body:JSON.stringify(payload),redirect:'error',signal:AbortSignal.timeout(10000)});status=response.status;await response.body?.cancel();}catch{/* Report receiver failure without exposing private network details. */}
   await audit(db,req,rid,'hutoxy_connection_test');return respond(200,{data:{event_id:payload.id,test:true,dry_run:true,http_status:status,accepted:status>=200&&status<300,customer_contacted:false}});
  }
  if(method==='GET'&&endpoint==='itinerary/catalog'){const c=catalog();return respond(200,{data:{...c,modules:c.modules.filter(m=>m.id==='rann-tentcity')}});}
  if(method==='GET'&&endpoint==='availability')return respond(200,{data:await hutoxyAvailability(req.query||{},db)});
  if(method==='GET'&&endpoint==='leads'){const result=await rpc(db,'leads',null,page(req.query,'leads'));return respond(200,{...result,next_cursor:encodeCursor(result.next_cursor,'leads')});}
  if(segments[0]==='leads'&&segments[1]&&segments.length===2&&method==='PATCH'){
   const b=leadUpdateInput(body(req)),idem=String(req.headers?.['idempotency-key']||'');
   if(idem.length<8||idem.length>200)throw new HutoxyError(400,'idempotency_key_required','Provide a unique Idempotency-Key of 8-200 characters.');
   const record=await lead(db,segments[1]);
   const output=await db('rpc/crm_hutoxy_update_lead',{method:'POST',body:JSON.stringify({p_ref:record.id,p_patch:b,p_request_id:rid,p_idempotency_id:hash(record.id+':update:'+idem),p_request_hash:hash(JSON.stringify(b))})});
   if(output.error)throw new HutoxyError(output.error==='lead_not_in_pilot'?404:409,output.error,'Lead update was rejected. Refresh the lead before retrying.');
   return respond(200,{data:output});
  }
  if(segments[0]==='leads'&&segments[1]&&segments.length===2&&method==='GET')return respond(200,{data:await lead(db,segments[1])});
  if(segments[0]==='leads'&&segments[1]&&segments.length===3&&segments[2]==='messages'&&method==='GET'){
   await lead(db,segments[1]);const scope='messages:'+segments[1],result=await rpc(db,'messages',segments[1],page(req.query,scope));if(result.error)throw new HutoxyError(404,'lead_not_in_pilot','Lead not found in the Hutoxy pilot.');return respond(200,{...result,next_cursor:encodeCursor(result.next_cursor,scope)});
  }
  if(segments[0]==='leads'&&segments[1]&&segments.length===3&&['messages','quotes'].includes(segments[2])&&method==='POST'){
   const record=await lead(db,segments[1]),b=body(req),kind=segments[2]==='messages'?'message':'quote';
   const message=kind==='message'?messageInput(b):null,quote=kind==='quote'?quoteInput(b):null,input=message||quote!;
   if(message&&message.direction!=='out')throw new HutoxyError(400,'outbound_log_only','Log sent outbound messages only. Customer messages are relayed by the CRM.');
   const idem=String(req.headers?.['idempotency-key']||'');if(idem.length<8||idem.length>200)throw new HutoxyError(400,'idempotency_key_required','Provide a unique Idempotency-Key of 8-200 characters.');
   const output=await rpc(db,'record_'+kind,segments[1],{body:input,idempotency_id:hash(record.id+':'+kind+':'+idem),request_hash:hash(JSON.stringify(input))});
   if(output.error)throw new HutoxyError(output.error==='idempotency_conflict'?409:404,output.error,'Record could not be written to this pilot lead.');
   await audit(db,req,rid,'hutoxy_'+kind+'_recorded');return respond(200,{data:output});
  }
  if(method==='POST'&&['rann/quote','rann/quote/pdf','rann/quote/pdf-link'].includes(endpoint)){
   const b=body(req),record=await lead(db,String(b.lead_ref||''));const {lead_ref,...input}=b;
   const {model,data}=rannQuote({...input,guest_name:record.name,reference:record.ref_id});
   if(endpoint==='rann/quote')return respond(200,{data});
   const document=await createRannQuotationPdf(model,asset),bytes=Buffer.from(document.output('arraybuffer'));
   if(endpoint.endsWith('pdf-link')){const storage=quoteStorage(process.env.SUPABASE_URL||'',process.env.SUPABASE_SERVICE_ROLE_KEY||'');const link=await storage.upload(bytes);try{await audit(db,req,rid,'hutoxy_pdf_link_generated');}catch(e){await storage.remove([link.filename]).catch(()=>{});throw e;}return respond(200,link);}
   if(bytes.length>4400000)throw new HutoxyError(413,'pdf_too_large','PDF exceeds delivery limit; use the PDF-link endpoint.');
   await audit(db,req,rid,'hutoxy_pdf_generated');res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition','attachment; filename="rann-utsav-quotation.pdf"');return res.status(200).send(bytes);
  }
  throw new HutoxyError(404,'not_found','Endpoint not available to Hutoxy.');
 }catch(e:any){const known=e instanceof HutoxyError||e instanceof MaxInputError||e instanceof QuoteInputError||e instanceof QuoteStorageError;return respond(known?(e.status||400):503,{error:{code:known?e.code:'pilot_unavailable',message:known?e.message:'Hutoxy CRM service is temporarily unavailable.'}});}
 };
}
export default createHutoxyHandler();
