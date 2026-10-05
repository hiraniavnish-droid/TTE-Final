export async function maxDb(path:string,init:any={}){
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw Error('MAX database is not configured.');
 const r=await fetch(url+'/rest/v1/'+path,{...init,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',...(init.headers||{})},signal:AbortSignal.timeout(20000)});const value=await r.json().catch(()=>null);if(!r.ok)throw Error('MAX database request failed: '+(value?.code||r.status));return value;
}
