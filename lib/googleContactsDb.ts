import crypto from 'node:crypto';
export async function contactsDb(path:string,init:any={}) {
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw Error('Contacts database is not configured.');
 const r=await fetch(url+'/rest/v1/'+path,{...init,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',...init.headers},signal:AbortSignal.timeout(15000)});
 const data=await r.json().catch(()=>null);
 if(!r.ok)throw Error('Contacts database request failed ('+r.status+').');
 return data;
}
export const rpc=(name:string,data:any={})=>contactsDb('rpc/'+name,{method:'POST',body:JSON.stringify(data)});
function encryptionKey(){const key=Buffer.from(process.env.GOOGLE_CONTACTS_ENCRYPTION_KEY||'','base64');if(key.length!==32)throw Error('Contact token encryption is not configured.');return key;}
export function seal(value:string){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',encryptionKey(),iv);const text=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return [iv,cipher.getAuthTag(),text].map(b=>b.toString('base64url')).join('.');}
export function unseal(value:string){const [iv,tag,text]=value.split('.').map(s=>Buffer.from(s,'base64url'));const decipher=crypto.createDecipheriv('aes-256-gcm',encryptionKey(),iv);decipher.setAuthTag(tag);return Buffer.concat([decipher.update(text),decipher.final()]).toString('utf8');}
export const getContactSettings=async()=> (await contactsDb('crm_google_settings?id=eq.true&select=*'))[0];
export const saveContactSettings=(patch:any)=>contactsDb('crm_google_settings?id=eq.true',{method:'PATCH',body:JSON.stringify({...patch,updated_at:new Date().toISOString()})});
export function cronAuthorized(value:unknown){const secret=process.env.CRON_SECRET,provided=Buffer.from(String(value||'')),expected=Buffer.from('Bearer '+secret);return !!secret&&provided.length===expected.length&&crypto.timingSafeEqual(provided,expected);}
