import { canonicalBusinessDate } from './botApiContract';
import { RAJARSHI_HOTELS, RAJARSHI_SUPPLIER, type RajPlan } from '../services/rajarshiData';
import { INLAND_HOTELS, INLAND_SUPPLIER } from '../services/inlandData';
import { quoteStay } from '../services/rajarshiRates';
import { quoteInlandStay } from '../services/inlandRates';
import { RAJARSHI_READY_PACKAGES, formatRajarshiPackageWhatsApp } from '../services/rajarshiReadyPackages';
import { TC_TENT_TYPES, TC_SEASON, RESORT_SEASON, quoteResort } from '../services/rannUtsavRates';
import { COTTAGE_TYPES, VILLA_TYPES, PLANS, FULL_SEASON, quoteCottage, quoteVilla } from '../services/souTentCityRates';
import { buildRannQuotationModel, type RannQuotationInput } from '../services/rannQuotationPdf';

export class QuoteInputError extends Error { status = 400; code = 'invalid_quote_input'; }
function fail(message: string): never { throw new QuoteInputError(message); }
export function whole(value: unknown, name: string, min: number, max: number, fallback?: number): number {
  const n = value === undefined ? fallback : Number(value);
  if (value === null || value === '' || typeof value === 'boolean' || !Number.isInteger(n) || n! < min || n! > max) fail(`${name} must be an integer from ${min} to ${max}.`);
  return n!;
}
function decimal(value: unknown, name: string, max: number, fallback = 0): number {
  const n = value === undefined ? fallback : Number(value);
  if (value === null || value === '' || typeof value === 'boolean' || !Number.isFinite(n) || n < 0 || n > max) fail(`${name} must be a number from 0 to ${max}.`);
  return n;
}
export function dateOnly(value: unknown): string { return canonicalBusinessDate(value) || fail('check_in must be a valid YYYY-MM-DD date.'); }
export function localDate(iso: string): Date { const [y,m,d] = iso.split('-').map(Number); return new Date(y,m-1,d); }
function dateKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function ensureSeason(date: Date, nights: number, season: {start: Date; end: Date}) {
  const last = new Date(date); last.setDate(last.getDate()+nights-1);
  if (date < season.start || last > season.end) fail('Every stay night must fall within the published season.');
}
function occupancy(value: unknown) { if (value !== undefined && !['single','double'].includes(String(value))) fail('occupancy must be single or double.'); return value === 'single'; }
export function catalog() {
  return { currency: 'INR', source: 'CRM supplier rate cards; no live inventory refresh', modules: [
    {id:'rajarshi', supplier:RAJARSHI_SUPPLIER, hotels:RAJARSHI_HOTELS.length, pricing:'net cost plus markup'},
    {id:'inland', supplier:INLAND_SUPPLIER, hotels:INLAND_HOTELS.length, pricing:'explicit rate column; net cost plus markup'},
    {id:'rann-tentcity', categories:TC_TENT_TYPES, nights:[1,2,3], season:{from:dateKey(TC_SEASON.start),to:dateKey(TC_SEASON.end)}, pdf:true},
    {id:'rann-resort', nights:[1,2], season:{from:dateKey(RESORT_SEASON.start),to:dateKey(RESORT_SEASON.end)}, pdf:false},
    {id:'sou-tentcity', categories:[...COTTAGE_TYPES,...VILLA_TYPES],plans:PLANS,season:{from:dateKey(FULL_SEASON.start),to:dateKey(FULL_SEASON.end)},pdf:false},
  ]};
}
export function hotels(input: any) {
  if (!['rajarshi','inland','sou-hotels'].includes(input.supplier)) fail('supplier must be rajarshi, inland or sou-hotels.');
  const source: any[] = input.supplier === 'rajarshi' ? RAJARSHI_HOTELS : INLAND_HOTELS;
  return source.filter(h => (input.supplier !== 'sou-hotels' || h.city === 'KEVADIYA (Ekta Nagar)') && (!input.city || h.city.toLowerCase() === String(input.city).toLowerCase()) && (!input.hotel_id || h.id === input.hotel_id)).map(h=>({...h, supplier:input.supplier, rooms:h.rooms.map((r:any,i:number)=>({...r,room_index:i}))}));
}
export function packages(input: any) { return RAJARSHI_READY_PACKAGES.filter(p=>!input.package_id || p.id===input.package_id).map(p=>({...p, supplier:'rajarshi',whatsapp_text:formatRajarshiPackageWhatsApp(p)})); }
export function rannInput(input: any): RannQuotationInput {
  const iso=dateOnly(input.check_in), date=localDate(iso), nights=whole(input.nights,'nights',1,3);
  ensureSeason(date,nights,TC_SEASON);
  if (!TC_TENT_TYPES.includes(input.category)) fail('category must match a Rann Tent City category in the catalog.');
  const categories = input.option_categories;
  if (categories !== undefined && (!Array.isArray(categories) || categories.length>6 || categories.some((c: any)=>!TC_TENT_TYPES.includes(c)))) fail('option_categories must contain at most six valid categories.');
  return {guestName:String(input.guest_name||'Guest').slice(0,120),reference:String(input.reference||'').slice(0,100),checkIn:date,nights:nights as 1|2|3,category:input.category,rooms:whole(input.rooms,'rooms',1,100),single:occupancy(input.occupancy),extraMattresses:whole(input.extra_mattresses,'extra_mattresses',0,100,0),childrenUnder6:whole(input.children_under_6,'children_under_6',0,100,0),discountPct:decimal(input.discount_percent,'discount_percent',100),optionCategories:categories ? [...new Set(categories)] as any : undefined};
}
export function rannQuote(input:any) {
  const model=buildRannQuotationModel(rannInput(input));
  return {model,data:{product:'rann-tentcity',currency:'INR',check_in:dateKey(model.checkIn),check_out:dateKey(model.checkOut),nights:model.nights,rooms:model.rooms,category:model.category,guests:model.guests,children_under_6:model.childrenUnder6,price:model.price,room_calculation:model.roomCalculation,alternatives:model.alternatives,availability:'not_checked',hold_created:false,rate_source:'CRM Rann Utsav 2026-27 engine'}};
}
export function itineraryQuote(input:any) {
  const product = input.product;
  if(product==='rann-tentcity') return rannQuote(input).data;
  const iso=dateOnly(input.check_in),date=localDate(iso),nights=whole(input.nights,'nights',1,30),rooms=whole(input.rooms,'rooms',1,100),extra=whole(input.extra_persons,'extra_persons',0,100,0);
  const discount=decimal(input.discount_percent,'discount_percent',100);
  if(product==='rann-resort') { if(nights>2) fail('Rann Resort supports one or two nights.');ensureSeason(date,nights,RESORT_SEASON);const q=quoteResort({checkIn:date,nights,rooms,single:occupancy(input.occupancy),extraPax:extra,commissionPct:0,discountPct:discount});return {product,currency:'INR',room_rent:q.roomRent,discount_amount:q.clientDiscountAmount,extras:q.extras,subtotal:q.clientBeforeTax,gst:q.clientGst,total:q.sellingPrice,availability:'not_checked'}; }
  if(product==='sou-tentcity') {
    ensureSeason(date,nights,FULL_SEASON);const category=input.category,plan=input.plan;
    if(!PLANS.includes(plan))fail('Choose CP, MAP or Experiential.');
    let q;
    if(VILLA_TYPES.includes(category)){if(plan!=='Experiential')fail('Villas require Experiential.');q=quoteVilla({villa:category,checkIn:date,nights,rooms,extraMattress:extra,commissionPct:0,discountPct:discount});}
    else {if(!COTTAGE_TYPES.includes(category))fail('Invalid SOU category.');q=quoteCottage({plan,roomType:category,checkIn:date,nights,rooms,single:occupancy(input.occupancy),extraMattress:extra,commissionPct:0,discountPct:discount});}
    if(!q)fail('No published rate for these dates.');return {product,currency:'INR',room_rent:q.roomRent,extras:q.extras,subtotal:q.clientBeforeTax,gst:q.clientGst,total:q.sellingPrice,availability:'not_checked'};
  }
  if(!['rajarshi','inland','sou-hotels'].includes(product))fail('Unsupported product.');
  if(typeof input.hotel_id!=='string'||!input.hotel_id.trim())fail('hotel_id is required.');
  const hotel:any=hotels({supplier:product,hotel_id:input.hotel_id})[0];if(!hotel)fail('Unknown hotel_id.');
  const idx=whole(input.room_index,'room_index',0,hotel.rooms.length-1), room=hotel.rooms[idx];
  const markupMode=input.markup_mode===undefined?'percent':input.markup_mode;if(!['percent','flat'].includes(markupMode))fail('markup_mode must be percent or flat.');
  const markupValue=decimal(input.markup_value,'markup_value',100000);
  if(hotel.validity){const last=new Date(date);last.setDate(last.getDate()+nights-1);if(iso<hotel.validity.from||dateKey(last)>hotel.validity.to)fail('Outside hotel rate validity.');}
  if(hotel.needsReview?.length) return {product,hotel_id:hotel.id,quotable:false,total:null,warnings:hotel.needsReview};
  let q:any;
  if(product==='rajarshi'){const plan=input.plan;if(!['EPAI','CPAI','MAPAI'].includes(plan))fail('Choose EPAI, CPAI or MAPAI.');if(extra>0&&hotel.extraPerson?.base?.[plan]===undefined)fail('Extra-person rate is on request.');q=quoteStay({hotel,room,plan:plan as RajPlan,checkIn:iso,nights,rooms,extraPersons:extra,markupMode,markupValue});}
  else {const column=whole(input.rate_column,'rate_column',1,2) as 1|2;if(column===2&&!room.axisLabels[1])fail('This room has no second rate column.');if(room.season&&room.season!==((date.getMonth()>=3&&date.getMonth()<=8)?'H1':'H2'))fail('Selected room season does not match check-in.');const extraRate=room.childAdultByPlan?.[room.axisLabels[column-1]] ?? room.childAdult; if(extra>0&&typeof extraRate!=='number')fail('Extra-person supplement needs supplier confirmation.');q=quoteInlandStay({hotel,room:{...room,childAdult:extraRate},column,nights,rooms,extraPersons:extra,markupMode,markupValue});}
  const quotable=!q.anyOnRequest&&!q.isOnRequest&&!hotel.isOnCallOnly;
  return {product,hotel_id:hotel.id,hotel_name:hotel.name,room_index:idx,room_name:room.name,check_in:iso,nights,rooms,currency:'INR',quotable,total:quotable?q.sellingPrice:null,breakdown:q,availability:'not_checked',warnings:[...(hotel.notes||[]),...(hotel.remark?[hotel.remark]:[])]};
}
