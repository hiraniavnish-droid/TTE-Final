import {safeWebhookRequest,signWebhook,validateTarget,MaxInputError} from './maxAutomation';
export async function dispatchSonaliWebhook(db:(path:string,init?:any)=>Promise<any>,request:typeof fetch=safeWebhookRequest){
 const rpc=(name:string,body:any)=>db('rpc/crm_sonali_webhook_'+name,{method:'POST',body:JSON.stringify(body)});
 const jobs=await rpc('claim',{p_limit:20});let delivered=0,failed=0,skipped=0;
 await Promise.all((jobs||[]).map(async(job:any)=>{
  const event=await rpc('preflight',{p_id:job.id,p_lease:job.lease_token});if(!event){skipped++;return;}
  let status=0,error='';
  try{
   const target=await validateTarget(event.target_url),raw=JSON.stringify(event.body),timestamp=Math.floor(Date.now()/1000);
   const response=await request(target,{method:'POST',body:raw,headers:{'Content-Type':'application/json','X-TTE-Signature':signWebhook(raw,event.signing_secret,timestamp),'X-TTE-Event-Id':job.id,'X-TTE-Event':job.event,...(process.env.SONALI_WEBHOOK_AUTHORIZATION && target===process.env.SONALI_WEBHOOK_AUTH_TARGET_URL?{Authorization:process.env.SONALI_WEBHOOK_AUTHORIZATION}:{})},redirect:'error',signal:AbortSignal.timeout(10000)});
   status=response.status;if(response.body)await response.body.cancel();if(status<200||status>=300)error=`Receiver returned HTTP ${status}`;
  }catch(e){error=e instanceof MaxInputError?e.message:'Webhook network request failed or timed out';}
  await rpc('finish',{p_id:job.id,p_lease:job.lease_token,p_status:status,p_error:error});if(status>=200&&status<300)delivered++;else failed++;
 }));return {claimed:(jobs||[]).length,delivered,failed,skipped};
}
