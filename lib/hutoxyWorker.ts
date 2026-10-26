import crypto from 'node:crypto';
import {maxDb} from './maxServerDb';
import {safeWebhookRequest,signWebhook,validateTarget} from './maxAutomation';
export async function dispatchHutoxy(db:typeof maxDb=maxDb,request:typeof fetch=safeWebhookRequest){
 const secret=process.env.HUTOXY_WEBHOOK_SECRET;if(!secret)return {claimed:0,delivered:0,failed:0,skipped:0};
 const rpc=(action:string,data:any)=>db('rpc/crm_hutoxy_'+action,{method:'POST',body:JSON.stringify(data)});
 const jobs=await rpc('claim',{p_limit:20});let delivered=0,failed=0,skipped=0;
 await Promise.all(jobs.map(async(job:any)=>{
  const event=await rpc('preflight',{p_id:job.id,p_lease:job.lease_token});if(!event){skipped++;return;}
  let status=0,error='';try{const target=await validateTarget(event.target_url),raw=JSON.stringify(event.body),stamp=Math.floor(Date.now()/1000);
   const response=await request(target,{method:'POST',body:raw,headers:{'Content-Type':'application/json','X-TTE-Signature':signWebhook(raw,secret,stamp),'X-TTE-Event-Id':job.id,'X-TTE-Event':job.event},redirect:'error',signal:AbortSignal.timeout(10000)});status=response.status;await response.body?.cancel();if(status<200||status>=300)error='Receiver HTTP '+status;
  }catch{error='Receiver network request failed or timed out';}
  await rpc('finish',{p_id:job.id,p_lease:job.lease_token,p_status:status,p_error:error});if(status>=200&&status<300)delivered++;else failed++;
 }));return {claimed:jobs.length,delivered,failed,skipped};
}
export default async function handler(req:any,res:any){
 res.setHeader('Cache-Control','no-store');const secret=process.env.CRON_SECRET||'',given=Buffer.from(String(req.headers?.authorization||'')),expected=Buffer.from('Bearer '+secret);
 if(req.method!=='GET')return res.status(405).json({error:{code:'method_not_allowed'}});
 if(!secret||given.length!==expected.length||!crypto.timingSafeEqual(given,expected))return res.status(401).json({error:{code:'unauthorized'}});
 try{return res.status(200).json(await dispatchHutoxy());}catch{return res.status(503).json({error:{code:'hutoxy_worker_unavailable'}});}
}
