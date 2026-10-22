import assert from 'node:assert/strict';import {build} from 'esbuild';
for(const slug of ['sonali','jigar','prakash']){
 const name=slug[0].toUpperCase()+slug.slice(1);await build({entryPoints:[`lib/${slug}Webhook.ts`],bundle:true,platform:'node',format:'esm',packages:'external',outfile:`.tmp/${slug}-team-test.mjs`});const {[`dispatch${name}Webhook`]:dispatch}=await import(`../.tmp/${slug}-team-test.mjs`);
 let cancelled=false;const calls=[];const db=async(path,init)=>{assert.ok(path.startsWith(`rpc/crm_${slug}_webhook_`));const b=JSON.parse(init.body);calls.push({path,b});if(path.endsWith('_claim'))return[{id:`${slug}-event`,event:'lead.assigned',lease_token:'lease'}];if(path.endsWith('_preflight'))return cancelled?null:{target_url:'https://example.com/webhook',signing_secret:slug.repeat(32),authorization:`Bearer ${slug}-only`,body:{id:`${slug}-event`,event:'lead.assigned',data:{source_website:'rannutsav.in'}}};};
 process.env.MAX_WEBHOOK_AUTHORIZATION='never-share-main-token';let sent=0;
 const result=await dispatch(db,async(url,init)=>{sent++;assert.equal(init.headers.Authorization,`Bearer ${slug}-only`);assert.equal(init.headers['X-TTE-Event-Id'],`${slug}-event`);assert.match(init.headers['X-TTE-Signature'],/^t=\d+,v1=[a-f0-9]{64}$/);assert.equal(JSON.parse(init.body).data.source_website,'rannutsav.in');return new Response(null,{status:200});});assert.equal(result.delivered,1);
 assert.equal((await dispatch(db,async()=>new Response(null,{status:503}))).failed,1);assert.equal(calls.at(-1).b.p_status,503);
 cancelled=true;assert.equal((await dispatch(db,async()=>{throw Error('Cancelled event sent');})).skipped,1);
 console.log(`${name}: independent queue, receiver token, signature, website payload, retries and cancellation passed.`);
}
