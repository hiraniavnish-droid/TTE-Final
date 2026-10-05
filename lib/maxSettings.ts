import crypto from 'node:crypto';
import {verifyAttendanceSession} from '../api/attendance';
import {maxDb} from './maxServerDb';
import {settingsInput,MaxInputError} from './maxAutomation';
export default async function handler(req:any,res:any){
 res.setHeader('Cache-Control','no-store');if(!['GET','POST'].includes(req.method))return res.status(405).json({error:{code:'method_not_allowed'}});
 const session=verifyAttendanceSession(req.headers?.authorization,process.env.SUPABASE_JWT_SECRET||'');if(!session)return res.status(401).json({error:{code:'unauthorized',message:'Please sign in again.'}});
 try{
 const users=await maxDb(`users?id=eq.${encodeURIComponent(session.id)}&select=id,role,session_version&limit=1`);const user=users[0];if(!user||Number(user.session_version||0)!==session.version)return res.status(401).json({error:{code:'session_expired'}});if(user.role!=='admin')return res.status(403).json({error:{code:'forbidden',message:'Admin access is required.'}});
 if(req.method==='GET'){const settings=(await maxDb('crm_max_settings?select=*'))[0];const rows=await maxDb('crm_max_outbox?select=id,event,state,attempts,last_http_status,last_error,next_attempt_at,created_at&order=created_at.desc&limit=8');return res.status(200).json({data:{enabled:settings.enabled,target_url:settings.target_url,secret_configured:!!settings.signing_secret,updated_at:settings.updated_at},deliveries:rows});}
 const input=typeof req.body==='string'?JSON.parse(req.body):req.body;if(JSON.stringify(input).length>6000)return res.status(413).json({error:{code:'request_too_large'}});const data=await settingsInput(input,(await maxDb('crm_max_settings?select=*'))[0]);
 const key=req.headers?.['idempotency-key'];if(typeof key!=='string'||!key||key.length>300)return res.status(400).json({error:{code:'missing_idempotency_key'}});
 const client='admin:'+user.id,keyHash=crypto.createHash('sha256').update(key).digest('hex'),requestHash=crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex'),path='/api/max-settings';
 const limit=await maxDb('rpc/crm_api_consume_rate_limit',{method:'POST',body:JSON.stringify({p_client_id:client,p_window_seconds:60,p_limit:120})});if(!limit.allowed)return res.status(429).json({error:{code:'rate_limited'}});
 const existing=(await maxDb(`crm_api_idempotency?client_id=eq.${encodeURIComponent(client)}&key_hash=eq.${keyHash}&select=*&limit=1`))[0];if(existing){if(existing.request_hash!==requestHash)return res.status(409).json({error:{code:'idempotency_conflict'}});if(existing.state==='completed')return res.status(existing.response_status).json(existing.response_body);return res.status(409).json({error:{code:'idempotency_in_progress'}});}
 const reservation=(await maxDb('crm_api_idempotency',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({client_id:client,key_hash:keyHash,method:'PATCH',path,request_hash:requestHash,state:'processing'})}))[0];
 const output=await maxDb('rpc/crm_max_write',{method:'POST',body:JSON.stringify({p_action:'settings',p_lead_id:null,p_data:data,p_request:crypto.randomUUID(),p_client:client,p_path:path,p_reservation:reservation.id})});return res.status(output.status).json(output.body);
 }catch(e){return res.status(e instanceof MaxInputError?400:503).json({error:{code:e instanceof MaxInputError?e.code:'settings_unavailable',message:e instanceof MaxInputError?e.message:'MAX settings could not be saved. Check the webhook URL and secret.'}});}
}
