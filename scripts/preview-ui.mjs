// A localhost-only, read-only test server. No upstream proxy and no real credentials.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {user,tables,records,token,availabilitySnapshot,attendanceSnapshot} from '../tests/fixtures/crm.mjs';
const root=path.resolve('.ui-preview');
await fs.access(path.join(root,'index.html'));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2'};
const json=(res,data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'});res.end(JSON.stringify(data));};
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:3187');
 if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS'});return res.end();}
 if(url.pathname==='/api/login'&&req.method==='POST'){
  let body='';for await(const chunk of req)body+=chunk;
  try{if(JSON.parse(body).passcode==='preview')return json(res,{user,token:token()});}catch{}
  return json(res,{error:'Use the fictional preview access code.'},401);
 }
 if(!['GET','HEAD'].includes(req.method))return json(res,{error:'Read-only fictional preview: writes are disabled.'},403);
 if(url.pathname.startsWith('/rest/v1/')){
  let rows=tables[url.pathname.split('/').pop()]||[];
  const select=url.searchParams.get('select');
  for(const [key,value]of url.searchParams){if(value.startsWith('eq.'))rows=rows.filter(row=>String(row[key])===value.slice(3));}
  const single=req.headers.accept?.includes('vnd.pgrst.object');
  return json(res,single?(rows[0]||null):rows);
 }
 if(url.pathname==='/api/razorpay-link')return json(res,{records});
 if(url.pathname==='/api/documents')return json(res,{documents:[]});
 if(url.pathname==='/api/availability')return json(res,availabilitySnapshot());
 if(url.pathname==='/api/attendance')return json(res,attendanceSnapshot());
 if(url.pathname.startsWith('/api/'))return json(res,{error:'This integration is not active in the fictional preview.'},503);
 if(url.pathname.startsWith('/realtime/'))return json(res,{},404);
 try {
  const clean=decodeURIComponent(url.pathname);
  let file=path.resolve(root,'.'+clean);
  if(file!==root&&!file.startsWith(root+path.sep))return json(res,{},403);
  if(clean.endsWith('/'))file=path.join(file,'index.html');
  let body=await fs.readFile(file);
  if(file.endsWith('index.html')){
   // Reproduce legacy caches before React mounts, without modifying real users' storage.
   const corrupt=url.searchParams.get('fixture')==='legacy'?`<script>localStorage.setItem('tte_team_tasks','null');localStorage.setItem('tte_task_messages','{}');localStorage.setItem('tte-lead-workspace:${user.id}:views','null');sessionStorage.setItem('tte-lead-workspace:${user.id}:scroll:','null');</script>`:'';
   body=Buffer.from(body.toString().replace('<head>','<head>'+corrupt).replace('</body>','<div style="position:fixed;bottom:2px;right:8px;z-index:90;font:9px system-ui;color:#52617a;pointer-events:none">LOCAL PREVIEW · FICTIONAL DATA</div></body>'));
  }
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(req.method==='HEAD'?null:body);
 } catch {json(res,{error:'Not found'},404);}
});
server.listen(3187,'127.0.0.1',()=>console.log('Fictional, read-only UI preview: http://127.0.0.1:3187 · access code: preview'));
