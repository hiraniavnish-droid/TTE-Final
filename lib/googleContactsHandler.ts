import crypto from 'node:crypto';
import {verifyAttendanceSession} from '../api/attendance';
import {contactsDb,getContactSettings,saveContactSettings,seal,unseal,rpc} from './googleContactsDb';
import {CALLBACK,CONTACT_SCOPE,googleToken,googleFetch} from './googleContactsGoogle';
const hash=(value:string)=>crypto.createHash('sha256').update(value).digest('hex');
const cookie=(value:string)=>`tte_google_state=${value}; HttpOnly; Secure; SameSite=Lax; Path=/api; Max-Age=${value?900:0}`;
async function adminSession(header:any){
 const session=verifyAttendanceSession(header,process.env.SUPABASE_JWT_SECRET||'');
 if(!session)return null;
 const user=(await contactsDb(`users?id=eq.${encodeURIComponent(session.id)}&select=id,role,session_version&limit=1`))[0];
 return user?.role==='admin'&&Number(user.session_version||0)===session.version?session:null;
}
export default async function handler(req:any,res:any){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Method not allowed.'});
 try{
  const actor=await adminSession(req.headers?.authorization);
  if(!actor)return res.status(401).json({error:'Sign in as an administrator to manage Google Contacts.'});
  const settings=await getContactSettings();
  if(req.method==='GET'){
   const [counts,recent,failures]=await Promise.all([rpc('crm_google_status'),contactsDb('crm_google_queue?select=lead_id,state,attempts,last_error,synced_at,requested_at,lead:leads(lead_code,name)&order=requested_at.desc&limit=10'),contactsDb('crm_google_queue?state=eq.failed&select=lead_id,attempts,last_error,lead:leads(lead_code,name)&order=requested_at.desc&limit=10')]);
   return res.status(200).json({settings:{enabled:settings.enabled,client_id:settings.client_id||'',secret_configured:!!settings.client_secret_encrypted,connected:!!settings.refresh_token_encrypted,expected_email:settings.expected_email,account_email:settings.account_email,index_ready:settings.index_ready,backfill_at:settings.backfill_at,last_run_at:settings.last_run_at,last_error:settings.last_error,callback_url:CALLBACK},counts,recent,failures});
  }
  const body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
  if(JSON.stringify(body).length>6000)return res.status(413).json({error:'Request is too large.'});
  switch(body.action){
   case 'configure': {
    const client=String(body.client_id||'').trim(),secret=String(body.client_secret||'').trim(),email=String(body.expected_email||'').trim().toLowerCase();
    if(!/^[\w-]+\.apps\.googleusercontent\.com$/.test(client)||secret.length>512||(!secret&&!settings.client_secret_encrypted)||!/^\S+@\S+\.\S+$/.test(email))return res.status(400).json({error:'Enter a valid Google OAuth client ID, client secret and contact account email.'});
    if(settings.refresh_token_encrypted&&(client!==settings.client_id||email!==settings.expected_email))return res.status(409).json({error:'Disconnect Google before changing OAuth configuration. Reconnect the same contact account to preserve linked contacts.'});
    await saveContactSettings({client_id:client,expected_email:email,...(secret?{client_secret_encrypted:seal(secret)}:{})});
    return res.status(200).json({message:'Google configuration saved securely.'});
   }
   case 'connect': {
    if(!settings.client_id||!settings.client_secret_encrypted)return res.status(409).json({error:'Save the Google OAuth client details first.'});
    const state=crypto.randomBytes(32).toString('base64url'),verifier=crypto.randomBytes(32).toString('base64url');
    await contactsDb('crm_google_oauth_states?expires_at=lt.'+encodeURIComponent(new Date().toISOString()),{method:'DELETE'});
    await contactsDb('crm_google_oauth_states',{method:'POST',body:JSON.stringify({state_hash:hash(state),actor_id:actor.id,session_version:actor.version,verifier_encrypted:seal(verifier),expires_at:new Date(Date.now()+900000).toISOString()})});
    const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search=new URLSearchParams({client_id:settings.client_id,redirect_uri:CALLBACK,response_type:'code',scope:`openid email ${CONTACT_SCOPE}`,access_type:'offline',prompt:'consent select_account',state,login_hint:settings.expected_email,code_challenge:hashChallenge(verifier),code_challenge_method:'S256'}).toString();
    res.setHeader('Set-Cookie',cookie(state));return res.status(200).json({url:url.toString()});
   }
   case 'pause':await saveContactSettings({enabled:false});return res.status(200).json({message:'Contact syncing paused. Changes will wait in the queue.'});
   case 'resume':if(!settings.refresh_token_encrypted)return res.status(409).json({error:'Connect Google first.'});await saveContactSettings({enabled:true,last_error:null});return res.status(200).json({message:'Contact syncing resumed.'});
   case 'sync_all':return res.status(200).json(await rpc('crm_google_backfill'));
   case 'retry':return res.status(200).json({queued:await rpc('crm_google_retry_failed')});
   case 'disconnect':
    if(settings.locked_until&&new Date(settings.locked_until).getTime()>Date.now())return res.status(409).json({error:'A sync is running. Pause syncing, wait two minutes, then disconnect.'});
    await saveContactSettings({enabled:false,refresh_token_encrypted:null,last_error:null});return res.status(200).json({message:'Disconnected. Existing Google contacts are kept. You can also remove access in your Google account permissions.'});
   default:return res.status(400).json({error:'Unknown contacts action.'});
  }
 }catch{return res.status(503).json({error:'Google Contacts settings are unavailable. Please retry.'});}
}
const hashChallenge=(value:string)=>crypto.createHash('sha256').update(value).digest('base64url');
export async function callback(req:any,res:any){
 res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Set-Cookie',cookie(''));
 const redirect=(code:string)=>res.redirect(303,'https://ttecrm.vercel.app/#/team-settings?google_contacts='+code);
 if(req.method!=='GET')return res.status(405).end();
 try{
  const state=String(req.query?.state||''),given=String(req.headers?.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('tte_google_state='))?.slice('tte_google_state='.length);
  if(!state||state.length>200||given!==state)return redirect('invalid_state');
  const saved=(await rpc('crm_google_oauth_consume',{p_hash:hash(state)}))[0];
  if(!saved)return redirect('expired');
  const actor=(await contactsDb(`users?id=eq.${encodeURIComponent(saved.actor_id)}&select=id,role,session_version&limit=1`))[0];
  if(actor?.role!=='admin'||Number(actor.session_version||0)!==saved.session_version)return redirect('expired');
  if(req.query?.error)return redirect('cancelled');
  const code=String(req.query?.code||'');if(!code||code.length>4096)return redirect('cancelled');
  const settings=await getContactSettings();
  const tokens=await googleToken(settings,{grant_type:'authorization_code',code,redirect_uri:CALLBACK,code_verifier:unseal(saved.verifier_encrypted)});
  if(!String(tokens.scope||'').split(' ').includes(CONTACT_SCOPE))return redirect('permission_required');
  const profile=await googleFetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+tokens.access_token}});
  if(!profile.email_verified||String(profile.email||'').toLowerCase()!==settings.expected_email)return redirect('wrong_account');
  if(settings.google_subject&&settings.google_subject!==profile.sub)return redirect('wrong_account');
  const refresh=tokens.refresh_token?seal(tokens.refresh_token):settings.refresh_token_encrypted;
  if(!refresh)return redirect('offline_required');
  await saveContactSettings({refresh_token_encrypted:refresh,account_email:profile.email,google_subject:profile.sub,enabled:true,connected_at:new Date().toISOString(),last_error:null});
  return redirect('connected');
 }catch{return redirect('connection_failed');}
}
