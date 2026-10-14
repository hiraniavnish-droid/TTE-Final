import {unseal,saveContactSettings} from './googleContactsDb';
export const CONTACT_SCOPE='https://www.googleapis.com/auth/contacts';
export const CALLBACK='https://ttecrm.vercel.app/api/google-contacts-callback';
export class GoogleContactsError extends Error {
 constructor(public status:number,public code:string){super(status===401||code==='invalid_grant'?'Google connection expired. Reconnect Google in Settings.':status===403?'Google denied access. Check People API and Contacts permission.':status===429?'Google rate limit reached. Sync will retry.':`Google Contacts request failed (${status}).`);}
}
export async function googleFetch(url:string,init:any={},fetcher:typeof fetch=fetch){
 const response=await fetcher(url,{...init,signal:AbortSignal.timeout(8000)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new GoogleContactsError(response.status,typeof data.error==='string'?data.error:String(data.error?.status||''));
 return data;
}
export async function googleToken(settings:any,extra:Record<string,string>){
 return googleFetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:settings.client_id,client_secret:unseal(settings.client_secret_encrypted),...extra})});
}
export async function contactAccessToken(settings:any){
 try{return (await googleToken(settings,{grant_type:'refresh_token',refresh_token:unseal(settings.refresh_token_encrypted)})).access_token as string;}
 catch(e){if(e instanceof GoogleContactsError && (e.status===401||e.code==='invalid_grant'))await saveContactSettings({enabled:false,last_error:e.message});throw e;}
}
export function peopleClient(token:string,fetcher:typeof fetch=fetch){
 return (path:string,method='GET',body?:any)=>googleFetch('https://people.googleapis.com/v1/'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})},fetcher);
}
