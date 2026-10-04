import crypto from 'node:crypto';
export const QUOTE_RETENTION_MS=7*24*60*60*1000;
export class QuoteStorageError extends Error {status=503;code='quote_storage_unavailable';}
const generatedQuote=/^Rann-Quotation-[0-9a-f-]{36}\.pdf$/i;
export function expiredQuoteNames(rows:any[],now=Date.now()):string[]{return rows.filter(r=>generatedQuote.test(r.name||'')&&Number.isFinite(Date.parse(r.created_at))&&Date.parse(r.created_at)<now-QUOTE_RETENTION_MS).map(r=>r.name);}
export function quoteStorage(url:string,key:string,request:typeof fetch=fetch){
 const base=url.replace(/\/$/,'')+'/storage/v1';
 async function call(path:string,init:RequestInit={}){
  let response:Response;try{response=await request(base+path,{...init,signal:AbortSignal.timeout(20000),headers:{apikey:key,Authorization:`Bearer ${key}`,...init.headers}});}catch{throw new QuoteStorageError('Quotation storage could not connect.');}
  if(!response.ok)throw new QuoteStorageError('Quotation storage request failed.');return response;
 }
 async function remove(names:string[]){for(let i=0;i<names.length;i+=100)await call('/object/quotes',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:names.slice(i,i+100)})});}
 return {
  async cleanup(now=Date.now()){
   // Gather before deleting so offset pagination cannot skip shifted rows.
   const expired:string[]=[];let offset=0;
   for(;;){const response=await call('/object/list/quotes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefix:'',limit:200,offset,sortBy:{column:'created_at',order:'asc'}})});const rows=await response.json();if(!Array.isArray(rows))throw new QuoteStorageError('Quotation storage returned an invalid listing.');expired.push(...expiredQuoteNames(rows,now));if(rows.length<200)break;offset+=rows.length;}
   await remove(expired);return expired.length;
  },
  async upload(bytes:Buffer,now=Date.now()){
   const filename=`Rann-Quotation-${crypto.randomUUID()}.pdf`;
   await call('/object/quotes/'+filename,{method:'POST',headers:{'Content-Type':'application/pdf','Cache-Control':'max-age=0','x-upsert':'false'},body:bytes as unknown as BodyInit});
   return {url:base+'/object/public/quotes/'+filename,filename,expires_at:new Date(now+QUOTE_RETENTION_MS).toISOString()};
  },remove
 };
}
