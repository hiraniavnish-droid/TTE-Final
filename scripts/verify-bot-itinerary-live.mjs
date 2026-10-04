import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const key=await fs.readFile(process.env.HOME+'/.config/tte-crm/bot-api-key','utf8');
const base='https://ttecrm.vercel.app/api/v1';
async function get(path,auth=true){const response=await fetch(base+'/'+path,{headers:auth?{'x-api-key':key}:{}});const raw=await response.text();let body;try{body=JSON.parse(raw);}catch{throw new Error(path+" HTTP "+response.status+" "+raw.slice(0,300));}console.log(path,response.status);return {status:response.status,body};}
async function post(path,input){const response=await fetch(base+'/'+path,{method:'POST',headers:{'x-api-key':key,'Content-Type':'application/json'},body:JSON.stringify(input)});if(response.headers.get('content-type')?.includes('application/pdf'))return {status:response.status,bytes:Buffer.from(await response.arrayBuffer())};return {status:response.status,body:await response.json()};}
assert.equal((await get('health',false)).status,401);
assert.equal((await get('health')).status,200);
assert.equal((await get('leads?limit=1')).status,200);
assert.equal((await get('itinerary/catalog')).status,200);
const first=await get('itinerary/hotels?supplier=inland&limit=1');assert.equal(first.status,200);assert.ok(first.body.next_cursor);
const next=await get('itinerary/hotels?supplier=inland&limit=1&cursor='+encodeURIComponent(first.body.next_cursor));assert.equal(next.status,200);assert.notEqual(first.body.data[0].id,next.body.data[0].id);
assert.equal((await get('itinerary/packages')).body.data.length,5);
const input={check_in:'2026-11-15',nights:2,rooms:1,category:'Premium Tent',discount_percent:5,guest_name:'API Verification Guest'};
const quote=await post('rann/quote',input);assert.equal(quote.status,200);assert.equal(quote.body.data.price.total,41701);
const bad=await post('rann/quote',{...input,check_in:'2026-02-30'});assert.equal(bad.status,400);
const pdf=await post('rann/quote/pdf',input);assert.equal(pdf.status,200,JSON.stringify(pdf.body));assert.equal(pdf.bytes.subarray(0,5).toString(),'%PDF-');await fs.writeFile('output/pdf/rann-api-live-verification.pdf',pdf.bytes);
const hotel=await post('itinerary/quote',{product:'rajarshi',hotel_id:'time-square-club-resort-spa',room_index:0,plan:'CPAI',check_in:'2026-11-18',nights:2,rooms:1,markup_value:10});assert.equal(hotel.status,200);assert.equal(hotel.body.data.quotable,true);
console.log('Live authentication, clean paths, catalog pagination, packages, rate parity, invalid input and binary PDF passed. PDF bytes:',pdf.bytes.length);
