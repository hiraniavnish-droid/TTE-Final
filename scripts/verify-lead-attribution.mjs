import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const dir = await mkdtemp(path.join(tmpdir(), 'tte-source-test-'));
try {
 process.env.SUPABASE_URL = 'https://fixture.invalid';
 process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture';
 process.env.LEADS_WEBHOOK_SECRET = 'fixture-webhook';
 process.env.WEBSITE_LEADS_WEBHOOK_SECRET = 'fixture-website';
 const file = path.join(dir, 'leads.mjs');
 await build({ entryPoints:['api/leads.ts'], outfile:file, platform:'node', format:'esm', logLevel:'silent' });
 const { default:handler, getWebsiteAttribution, parseLeadRouting, normalizeWebsitePayload } = await import(pathToFileURL(file));
 for (const [source,site] of [['tte_website_form','rannutsav.in'],['tte_whatsapp_click','rannutsav.in'],['tte_whatsapp_bot','rannutsav.in'],['tte_email','rannutsav.in'],['website_form','rannutsavtickets.in'],['whatsapp_click','rannutsavtickets.in'],['WhatsApp Click','rannutsavtickets.in'],['tickets_whatsapp_bot','rannutsavtickets.in'],['tickets_email','rannutsavtickets.in']]) {
  const result = getWebsiteAttribution(source);
  assert(result.tags.includes(site));assert(result.source.includes(site));
 }
 assert.equal(getWebsiteAttribution('whatsapp_click','https://www.rannutsav.in/contact').sourceKey,'tte_whatsapp_click');
 assert.equal(getWebsiteAttribution('unrecognized','https://rannutsav.in.attacker.example').tags.length,1);
 const routing = {kind:'lead-routing-v1',fallback:{enabled:true,assignTo:'Fallback'},routes:{rannutsav_website:{enabled:true,assignTo:'Main Agent'},rannutsav_tickets:{enabled:true,assignTo:null}}};
 assert.equal(parseLeadRouting({auto_assign_enabled:true,auto_assign_to:JSON.stringify(routing)}).routes.rannutsav_tickets.assignTo,null);
 assert.equal(parseLeadRouting({auto_assign_enabled:true,auto_assign_to:'Legacy Agent'}).routes.rannutsav_website.assignTo,'Legacy Agent');
 assert.equal(parseLeadRouting({auto_assign_enabled:true,auto_assign_to:'{broken-json'}).fallback.assignTo,null);
 assert.equal(normalizeWebsitePayload({form_fields:{phone:{value:'9000000000'},page_url:{value:'https://rannutsav.in/'},travel_date:{value:'28/12/2026'}}},{source:'tte_website_form'}).travelDate,'2026-12-28');
 let existing=null;let inserted=null;let patch=null;
 globalThis.fetch=async (url,init={})=>{
  const u = new URL(url);
  if (u.pathname.endsWith('/app_settings')) return Response.json([{auto_assign_enabled:true,auto_assign_to:JSON.stringify(routing)}]);
  if (u.pathname.endsWith('/leads')) {
   if (init.method==='POST') { inserted=JSON.parse(init.body)[0];return Response.json([{...inserted,id:'fixture-lead'}]); }
   if (init.method==='PATCH') { patch=JSON.parse(init.body);return new Response(null,{status:204}); }
   return Response.json(existing?[existing]:[]);
  }
  return new Response(null,{status:201});
 };
 const send=async(source,header='fixture-webhook')=>{
  const res={code:0,status(code){this.code=code;return this;},json(body){this.body=body;return this;},end(){return this;}};
  await handler({method:'POST',headers:{authorization:'Bearer '+header},query:{},body:{phone:'9000000000',source,name:'Synthetic traveller'}},res);return res;
 };
 assert.equal((await send('whatsapp_click')).code,200);assert.equal(inserted.assigned_to,null);assert(inserted.tags.includes('rannutsavtickets.in'));
 assert.equal((await send('tte_website_form','fixture-website')).code,200);assert.equal(inserted.assigned_to,'Main Agent');assert(inserted.tags.includes('rannutsav.in'));
 assert.equal((await send('website_form','fixture-website')).code,200);assert.equal(inserted.source,'Website - rannutsav.in');
 existing={...inserted,id:'fixture-lead',assigned_to:JSON.stringify(routing)};
 assert.equal((await send('whatsapp_click')).code,200);assert.equal(patch.assigned_to,null);assert(patch.tags.includes('rannutsav.in'));assert(patch.tags.includes('rannutsavtickets.in'));
 existing={...existing,assigned_to:'Staff choice'};patch=null;await send('whatsapp_click');assert(!('assigned_to' in (patch||{})));
 assert.equal((await send('website_form','wrong')).code,401);
 console.log('PASS: two-site/channel attribution, hostname checks, legacy/structured routing, null assignees, form payloads, corrupt-assignee repair, repeat touches, manual assignments, and webhook authentication');
} finally { await rm(dir,{recursive:true,force:true}); }
