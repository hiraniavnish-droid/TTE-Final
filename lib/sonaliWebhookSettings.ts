import {verifyAttendanceSession} from '../api/attendance';
import {maxDb} from './maxServerDb';
import {settingsInput,MaxInputError} from './maxAutomation';
export default async function handler(req:any,res:any){
 res.setHeader('Cache-Control','no-store');if(!['GET','POST'].includes(req.method))return res.status(405).json({error:{code:'method_not_allowed'}});
 const session=verifyAttendanceSession(req.headers?.authorization,process.env.SUPABASE_JWT_SECRET||'');if(!session)return res.status(401).json({error:{code:'unauthorized',message:'Please sign in again.'}});
 try{
  const user=(await maxDb(`users?id=eq.${encodeURIComponent(session.id)}&select=id,role,session_version&limit=1`))[0];
  if(!user||Number(user.session_version||0)!==session.version)return res.status(401).json({error:{code:'session_expired'}});
  if(user.role!=='admin')return res.status(403).json({error:{code:'forbidden',message:'Admin access is required.'}});
  if(req.method==='POST'){
   const input=typeof req.body==='string'?JSON.parse(req.body):req.body;
   if(!input||JSON.stringify(input).length>6000)return res.status(400).json({error:{code:'invalid_request'}});
   const limit=await maxDb('rpc/crm_api_consume_rate_limit',{method:'POST',body:JSON.stringify({p_client_id:'sonali-settings:'+user.id,p_window_seconds:60,p_limit:30})});
   if(!limit.allowed)return res.status(429).json({error:{code:'rate_limited'}});
   const current=(await maxDb('crm_sonali_webhook_settings?select=*'))[0];
   const {authorization,...other}=input;
   const data=await settingsInput(Object.keys(other).length||authorization===undefined?other:{enabled:current.enabled},current);
   if(authorization!==undefined){if(typeof authorization!=='string'||authorization.length>2048||/[\r\n]/.test(authorization))throw new MaxInputError('Bearer token is invalid.');data.authorization=authorization.trim()?(authorization.trim().startsWith('Bearer ')?authorization.trim():'Bearer '+authorization.trim()):'';}
   await maxDb('rpc/crm_sonali_webhook_settings_write',{method:'POST',body:JSON.stringify({p_data:data})});
  }
  const settings=(await maxDb('crm_sonali_webhook_settings?select=id,enabled,target_url,owner_id,updated_at,authorization_target_url'))[0];
  const deliveries=await maxDb('crm_sonali_webhook_outbox?select=id,event,state,attempts,last_http_status,last_error,next_attempt_at,occurred_at&order=occurred_at.desc&limit=12');
  return res.status(200).json({data:{...settings,secret_configured:true,authorization_configured:!!settings.authorization_target_url||!!process.env.SONALI_WEBHOOK_AUTHORIZATION},deliveries});
 }catch(e){return res.status(e instanceof MaxInputError||e instanceof SyntaxError?400:503).json({error:{code:'settings_unavailable',message:e instanceof MaxInputError?e.message:'Sonali webhook settings are unavailable.'}});}
}
