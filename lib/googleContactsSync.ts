import {contactsDb,getContactSettings,saveContactSettings,rpc} from './googleContactsDb';
import {peopleClient,contactAccessToken,GoogleContactsError} from './googleContactsGoogle';
import {normalizeContactPhone,contactName,contactNotes} from './googleContactsFormat';
import crypto from 'node:crypto';
type People = ReturnType<typeof peopleClient>;
const fields='names,phoneNumbers,biographies,memberships,metadata';
const resourceOk=(value:any)=>/^people\/[\w-]+$/.test(String(value||''));
const contactPhone=(lead:any)=>normalizeContactPhone(lead.contact?.phone||lead.phone);
// One account-wide lease keeps People API writes sequential, including backfills.
async function refreshIndex(settings:any,people:People,deadline:number){
 for(let page=0;page<3&&Date.now()<deadline;page++){
  const query=new URLSearchParams({personFields:'phoneNumbers,metadata',pageSize:'1000',requestSyncToken:'true',sources:'READ_SOURCE_TYPE_CONTACT'});
  if(settings.index_sync_token)query.set('syncToken',settings.index_sync_token);
  if(settings.index_page_token)query.set('pageToken',settings.index_page_token);
  let result:any;
  try{result=await people('people/me/connections?'+query);}
  catch(e){
   if(e instanceof GoogleContactsError&&e.status===410){
    await saveContactSettings({index_sync_token:null,index_page_token:null,index_ready:false});
    await contactsDb('crm_google_contacts_index?resource_name=not.is.null',{method:'DELETE'});
    return false;
   }throw e;
  }
  await rpc('crm_google_index_page',{p_people:result.connections||[]});
  const patch={index_page_token:result.nextPageToken||null,index_ready:!result.nextPageToken,...(result.nextSyncToken?{index_sync_token:result.nextSyncToken}:{})};
  await saveContactSettings(patch);Object.assign(settings,patch);
  if(!result.nextPageToken)return true;
 }return false;
}
async function ensureGroup(settings:any,people:People){
 if(settings.group_resource){try{await people(settings.group_resource);return settings.group_resource;}catch(e){if(!(e instanceof GoogleContactsError&&e.status===404))throw e;}}
 let token:string|undefined,group:any;
 do{const result=await people('contactGroups?'+new URLSearchParams({pageSize:'1000',...(token?{pageToken:token}:{})}));group=result.contactGroups?.find((g:any)=>g.name==='TTE Leads');token=result.nextPageToken;}while(!group&&token);
 if(!group){try{group=await people('contactGroups','POST',{contactGroup:{name:'TTE Leads'}});}catch(e){if(!(e instanceof GoogleContactsError&&e.status===409))throw e;const result=await people('contactGroups?pageSize=1000');group=result.contactGroups?.find((g:any)=>g.name==='TTE Leads');if(!group)throw e;}}
 await saveContactSettings({group_resource:group.resourceName});return group.resourceName as string;
}
export function contactBody(related:any[],phone:string,group:string,existing:any={}){
 const notes=(existing.biographies||[]).filter((b:any)=>!b.metadata?.source?.type||b.metadata.source.type==='CONTACT').map((b:any)=>b.value||'').join('\n\n');
 const phones=[...(existing.phoneNumbers||[])];
 if(!phones.some((p:any)=>normalizeContactPhone(p.canonicalForm||p.value)===phone))phones.push({value:phone,type:'mobile'});
 const memberships=(existing.memberships||[]).filter((m:any)=>m.contactGroupMembership?.contactGroupResourceName);
 if(!memberships.some((m:any)=>m.contactGroupMembership.contactGroupResourceName===group))memberships.push({contactGroupMembership:{contactGroupResourceName:group}});
 return {names:[{givenName:contactName(related[0])}],phoneNumbers:phones.map((p:any)=>({value:normalizeContactPhone(p.canonicalForm||p.value)||p.value,...(p.type?{type:p.type}:{})})),biographies:[{value:contactNotes(related,notes),contentType:'TEXT_PLAIN'}],memberships};
}
async function syncLead(lead:any,people:People,group:string){
 const phone=contactPhone(lead);
 if(!phone)return {skipped:true,reason:'No valid phone number. Add a phone number to this lead to sync it.'};
 const related=await rpc('crm_google_related',{p_phone:phone});
 if(!related.length)return {skipped:true,reason:'Lead no longer exists.'};
 const indexed=await contactsDb(`crm_google_contacts_index?phone=eq.${encodeURIComponent(phone)}&select=resource_name&order=resource_name&limit=10`);
 let resource=resourceOk(lead.google_contact_id)?lead.google_contact_id:related.map((l:any)=>l.google_contact_id).find(resourceOk)||indexed[0]?.resource_name;
 let existing:any={};
 if(resource){try{existing=await people(resource+'?personFields='+fields);}catch(e){if(!(e instanceof GoogleContactsError&&e.status===404))throw e;await contactsDb(`crm_google_contacts_index?resource_name=eq.${encodeURIComponent(resource)}`,{method:'DELETE'});resource=indexed.map((r:any)=>r.resource_name).find((r:string)=>r!==resource);if(resource)existing=await people(resource+'?personFields='+fields);}}
 // If a lead's number changes after sharing a contact, keep the other person's contact separate.
 if(resource&&!(existing.phoneNumbers||[]).some((p:any)=>normalizeContactPhone(p.canonicalForm||p.value)===phone)){
  const linked=await contactsDb(`leads?google_contact_id=eq.${encodeURIComponent(resource)}&id=neq.${encodeURIComponent(lead.id)}&select=id,phone,contact`);
  if(linked.some((l:any)=>contactPhone(l)!==phone)){resource=indexed[0]?.resource_name;existing=resource?await people(resource+'?personFields='+fields):{};}
 }
 const body=contactBody(related,phone,group,existing);
 let saved:any;
 if(resource){saved=await people(resource+':updateContact?updatePersonFields=names,phoneNumbers,biographies,memberships&personFields='+fields,'PATCH',{...body,resourceName:resource,etag:existing.etag,metadata:{sources:(existing.metadata?.sources||[]).filter((s:any)=>s.type==='CONTACT')}});}
 else {saved=await people('people:createContact?personFields='+fields,'POST',body);}
 if(!resourceOk(saved.resourceName))throw Error('Google did not return a contact ID.');
 // Persist the ID immediately, even if the queue acknowledgement is interrupted.
 await contactsDb('leads?id=in.('+related.map((l:any)=>encodeURIComponent(l.id)).join(',')+')',{method:'PATCH',body:JSON.stringify({google_contact_id:saved.resourceName})});
 await rpc('crm_google_index_page',{p_people:[saved]});
 return {skipped:false};
}
export async function runContactSync(){
 const lease=crypto.randomUUID(),deadline=Date.now()+40000;
 if(!await rpc('crm_google_claim',{p_lease:lease}))return {paused_or_busy:true};
 let processed=0,failed=0;
 try{
  const settings=await getContactSettings(),token=await contactAccessToken(settings),people=peopleClient(token);
  if(!await refreshIndex(settings,people,deadline))return {indexing:true};
  if(Date.now()>deadline)return {indexing:true};
  const group=await ensureGroup(settings,people);
  const jobs=await contactsDb('crm_google_queue?state=eq.pending&next_attempt_at=lte.'+encodeURIComponent(new Date().toISOString())+'&order=requested_at&limit=15');
  for(const job of jobs){
   if(Date.now()>deadline)break;
   const current=await getContactSettings();if(!current.enabled)break;
   const lead=(await contactsDb(`leads?id=eq.${encodeURIComponent(job.lead_id)}&select=*&limit=1`))[0];if(!lead)continue;
   const predicate=`crm_google_queue?lead_id=eq.${encodeURIComponent(job.lead_id)}&revision=eq.${job.revision}`;
   if(job.attempts>=4){await contactsDb(predicate,{method:'PATCH',body:JSON.stringify({state:'failed',last_error:'Contact sync timed out after four attempts. Retry it from Settings.'})});failed++;continue;}
   const attempts=job.attempts+1;
   const started=await contactsDb(predicate+'&state=eq.pending',{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({attempts,next_attempt_at:new Date(Date.now()+180000).toISOString()})});
   if(!started.length)continue;
   try{
    const result=await syncLead(lead,people,group);
    await contactsDb(predicate,{method:'PATCH',body:JSON.stringify({state:result.skipped?'skipped':'synced',synced_at:result.skipped?null:new Date().toISOString(),last_error:result.skipped?result.reason:null})});processed++;
   }catch(e){
    const message=e instanceof GoogleContactsError?e.message:e instanceof Error&&e.message.startsWith('Contact notes are too long')?e.message:'Contact sync failed. It will retry automatically; reconnect Google if the problem persists.';
    await contactsDb(predicate,{method:'PATCH',body:JSON.stringify({state:attempts>=4?'failed':'pending',last_error:message,next_attempt_at:new Date(Date.now()+[60000,180000,600000,600000][Math.min(attempts-1,3)]).toISOString()})});failed++;
   }
  }
  await saveContactSettings({last_error:null});return {processed,failed};
 }catch(e){await saveContactSettings({last_error:e instanceof GoogleContactsError?e.message:'Contact sync is temporarily unavailable. Jobs are kept for the next run.'});throw e;}
 finally{await rpc('crm_google_release',{p_lease:lease});}
}
