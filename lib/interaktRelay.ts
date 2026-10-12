import crypto from 'node:crypto';
import {maxDb} from './maxServerDb';
import {safeWebhookRequest, validateTarget} from './maxAutomation';

export function validInteraktSignature(raw: Buffer, signature: unknown, secret: string): boolean {
  if (!secret || typeof signature !== 'string' || !/^sha256=[a-fA-F0-9]{64}$/.test(signature)) return false;
  return crypto.timingSafeEqual(crypto.createHmac('sha256',secret).update(raw).digest(),Buffer.from(signature.slice(7),'hex'));
}
export async function relayRequest(raw: Buffer, signature: unknown, db=maxDb, secret=process.env.INTERAKT_WEBHOOK_SECRET || '', forwardSecret=process.env.CRM_INTERAKT_RELAY_SECRET || '', request:typeof fetch=safeWebhookRequest) {
  if (!validInteraktSignature(raw,signature,secret) && !validInteraktSignature(raw,signature,forwardSecret)) return {status:401,body:{error:'Invalid Interakt signature'}};
  let body:any;
  try {body=JSON.parse(raw.toString('utf8'));} catch {return {status:400,body:{error:'Invalid JSON'}};}
  if (body?.type === 'message_echo') return forwardInteraktEcho(raw,db,request);
  if (body?.type !== 'message_received' || body?.data?.message?.chat_message_type !== 'CustomerMessage') return {status:200,body:{dropped:typeof body?.type === 'string' ? body.type : 'unknown'}};
  const phone=body?.data?.customer?.channel_phone_number, id=body?.data?.message?.id;
  if (typeof phone !== 'string' || !/^\d{10,15}$/.test(phone) || typeof id !== 'string' || !id.trim() || id.length>200) return {status:400,body:{error:'Customer phone and message id are required'}};
  const result=await db('rpc/crm_interakt_enqueue',{method:'POST',body:JSON.stringify({p_body:body})});
  return {status:200,body:result};
}

// Outbound echoes bypass the customer queue and never update inbound history.
export async function forwardInteraktEcho(raw:Buffer,db=maxDb,request:typeof fetch=safeWebhookRequest) {
  try {
    const target=process.env.INTERAKT_MAX_WEBHOOK_URL,authorization=process.env.INTERAKT_MAX_WEBHOOK_AUTHORIZATION;
    if (process.env.INTERAKT_MAX_RELAY_ENABLED !== 'true' || !target || !authorization) return {status:503,body:{error:'MAX relay unavailable'}};
    const validated=await validateTarget(target);
    const response=await request(validated,{method:'POST',headers:{'Content-Type':'application/json',Authorization:authorization,'X-Relay':'interakt'},body:raw,redirect:'error',signal:AbortSignal.timeout(3000)});
    const success=response.status>=200&&response.status<300;
    if(response.body)await response.body.cancel();
    return success ? {status:200,body:{forwarded:'message_echo'}} : {status:503,body:{error:'MAX echo delivery failed'}};
  } catch {return {status:503,body:{error:'MAX echo delivery failed'}};}
}

// This server-only URL and token belong to Interakt; never fall back to CRM event settings.
export async function dispatchInteraktRelay(db=maxDb,request:typeof fetch=safeWebhookRequest) {
  const target=process.env.INTERAKT_MAX_WEBHOOK_URL,authorization=process.env.INTERAKT_MAX_WEBHOOK_AUTHORIZATION;
  if (process.env.INTERAKT_MAX_RELAY_ENABLED !== 'true' || !target || !authorization) return {claimed:0,delivered:0,failed:0,disabled:true};
  const validated=await validateTarget(target);
  const jobs=await db('rpc/crm_interakt_claim',{method:'POST',body:JSON.stringify({p_limit:20})});
  let delivered=0,failed=0;
  await Promise.all((jobs||[]).map(async(job:any)=>{
    let status=0,error='';
    try {
      const response=await request(validated,{method:'POST',headers:{'Content-Type':'application/json',Authorization:authorization,'X-Relay':'interakt'},body:JSON.stringify({...job.body,relay:{bundled:job.messages.length,first_at:job.first_at,last_at:job.last_at,messages:job.messages}}),redirect:'error',signal:AbortSignal.timeout(10000)});
      status=response.status;if(response.body)await response.body.cancel();
      if(status<200||status>=300)error=`Receiver returned HTTP ${status}`;
    }catch{error='MAX request failed or timed out';}
    await db('rpc/crm_interakt_finish',{method:'POST',body:JSON.stringify({p_phone:job.phone,p_lease:job.lease_token,p_status:status,p_error:error})});
    if(status>=200&&status<300)delivered++;else {failed++;if(job.attempts>=10)console.error('Interakt relay exhausted retry limit; retained for review');}
  }));
  return {claimed:jobs?.length||0,delivered,failed};
}
