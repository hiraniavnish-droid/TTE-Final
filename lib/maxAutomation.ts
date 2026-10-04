import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import https from 'node:https';
import {canonicalBusinessDate} from './botApiContract';
export class MaxInputError extends Error {status=400;code='invalid_request';}
const bad=(s:string):never=>{throw new MaxInputError(s)};
const num=(v:any,n:string,min:number,max:number,integer=false)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||(integer&&!Number.isInteger(v)))bad(`${n} must be ${integer?'an integer':'a number'} from ${min} to ${max}.`);return v;};
export function messageInput(body:any){const direction={in:'in',inbound:'in',out:'out',outbound:'out'}[body.direction as string];if(!direction)bad('direction must be in/inbound or out/outbound.');if(typeof body.text!=='string'||!body.text.trim()||body.text.length>10000)bad('text must contain 1–10000 characters.');return {direction,text:body.text,...(body.time!==undefined?{time:messageTime(body.time,'time')}:{})};}
export function messageTime(value:any,name:string){if(typeof value!=='string'||!canonicalBusinessDate(value.slice(0,10))||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value)||!Number.isFinite(Date.parse(value))||Date.parse(value)>Date.now()+300000)bad(`${name} must be an ISO timestamp no more than five minutes in the future.`);return value;}
export function quoteInput(body:any){
 const category=body.category||body.tent;if(typeof category!=='string'||!category.trim()||category.length>200)bad('category is required.');
 const check=body.check_in||body.startDate||body.dates?.check_in;if(typeof check!=='string'||!/^\d{4}-\d\d-\d\d$/.test(check)||!canonicalBusinessDate(check))bad('check_in must be a valid YYYY-MM-DD date.');
 const nights=num(body.nights,'nights',1,365,true),rooms=num(body.rooms,'rooms',1,1000,true),total=num(body.total,'total',0,1000000000),discount_percent=num(body.discount_percent??0,'discount_percent',0,100);
 const pax=typeof body.pax==='number'?{adults:body.pax,children_under_6:0}:body.pax;
 if(!pax||typeof pax!=='object'||Array.isArray(pax))bad('pax must be an adult count or an object with adults and children_under_6.');num(pax.adults,'pax.adults',1,1000,true);num(pax.children_under_6??0,'pax.children_under_6',0,1000,true);
 if(body.pdf_url!==undefined&&(typeof body.pdf_url!=='string'||!/^https:\/\//.test(body.pdf_url)||body.pdf_url.length>3000))bad('pdf_url must be an HTTPS URL.');
 return {category:category.trim(),check_in:check,nights,rooms,pax:{adults:pax.adults,children_under_6:pax.children_under_6??0},total,discount_percent,pdf_url:body.pdf_url||null,...(body.created_at!==undefined?{created_at:messageTime(body.created_at,'created_at')}:{})};
}
export function privateAddress(address:string){
 if(net.isIP(address)===4){const [a,b]=address.split('.').map(Number);return a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===100&&b>=64&&b<=127)||(a===198&&(b===18||b===19));}
 const a=address.toLowerCase();return a==='::'||a==='::1'||a.startsWith('fc')||a.startsWith('fd')||a.startsWith('fe80')||a.startsWith('ff')||a.startsWith('::ffff:');
}
export async function validateTarget(value:any){let u:URL;try{u=new URL(value)}catch{bad('target_url must be a public HTTPS URL.');}if(u.protocol!=='https:'||u.username||u.password||u.hash||u.port&&u.port!=='443'||u.hostname==='localhost'||u.hostname.endsWith('.local')||u.href.length>2000)bad('target_url must be a public HTTPS URL without credentials.');let addresses;try{addresses=await dns.lookup(u.hostname,{all:true})}catch{bad('Webhook hostname could not be resolved.');}if(!addresses.length||addresses.some(a=>privateAddress(a.address)))bad('Webhook target cannot resolve to a private network.');return u.href;}
export async function settingsInput(body:any,current:any={}){if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['enabled','target_url','signing_secret'].includes(k)))bad('Allowed settings: enabled, target_url, signing_secret.');const result:any={};if(body.enabled!==undefined){if(typeof body.enabled!=='boolean')bad('enabled must be boolean.');result.enabled=body.enabled;}if(body.target_url!==undefined)result.target_url=await validateTarget(body.target_url);if(body.signing_secret!==undefined){if(typeof body.signing_secret!=='string'||body.signing_secret.length<32||body.signing_secret.length>256)bad('signing_secret must contain 32–256 characters.');result.signing_secret=body.signing_secret;}if(!Object.keys(result).length)bad('No settings changes supplied.');if(result.enabled&&(!(result.target_url||current.target_url)||!(result.signing_secret||current.signing_secret)))bad('Configure target_url and signing_secret before enabling events.');return result;}
export function signWebhook(raw:string,secret:string,timestamp:number){return `t=${timestamp},v1=${crypto.createHmac('sha256',secret).update(`${timestamp}.${raw}`).digest('hex')}`;}
export const safeWebhookRequest:typeof fetch=async(input:any,init:any={})=>{
 const url=new URL(String(input));
 return await new Promise<Response>((resolve,reject)=>{
  const req=https.request(url,{method:'POST',headers:init.headers,signal:init.signal,lookup:((hostname:any,options:any,callback:any)=>{dns.lookup(hostname,{all:true}).then(addresses=>{if(!addresses.length||addresses.some(a=>privateAddress(a.address)))return callback(Error('Private webhook target'));const first=addresses[0];if(options?.all)callback(null,[first]);else callback(null,first.address,first.family);}).catch(callback);}) as any},response=>{response.destroy();resolve(new Response(null,{status:response.statusCode||500}));});req.on('error',reject);req.end(init.body);
 });
};
export async function dispatchWebhooks(db:(path:string,init?:any)=>Promise<any>,request:typeof fetch=safeWebhookRequest){
 const jobs=await db('rpc/crm_max_claim',{method:'POST',body:JSON.stringify({p_limit:20})});let delivered=0,failed=0,skipped=0;
 await Promise.all((jobs||[]).map(async(job:any)=>{
  const event=await db('rpc/crm_max_preflight',{method:'POST',body:JSON.stringify({p_id:job.id,p_lease:job.lease_token})});if(!event){skipped++;return;}
  let status=0,error='';try{const target=await validateTarget(event.target_url),raw=JSON.stringify(event.body),timestamp=Math.floor(Date.now()/1000);
   const response=await request(target,{method:'POST',body:raw,headers:{'Content-Type':'application/json','X-MAX-Signature':signWebhook(raw,event.signing_secret,timestamp),'X-MAX-Event-Id':job.id,'X-MAX-Event':job.event,...(process.env.MAX_WEBHOOK_AUTHORIZATION && target===process.env.MAX_WEBHOOK_AUTH_TARGET_URL?{Authorization:process.env.MAX_WEBHOOK_AUTHORIZATION}:{})},redirect:'error',signal:AbortSignal.timeout(10000)});status=response.status;if(response.body)await response.body.cancel();if(status<200||status>=300)error=`Receiver returned HTTP ${status}`;
  }catch(e){error=e instanceof MaxInputError?e.message:'Webhook network request failed or timed out';}
  await db('rpc/crm_max_finish',{method:'POST',body:JSON.stringify({p_id:job.id,p_lease:job.lease_token,p_status:status,p_error:error})});if(status>=200&&status<300)delivered++;else failed++;
 }));return {claimed:(jobs||[]).length,delivered,failed,skipped};
}
