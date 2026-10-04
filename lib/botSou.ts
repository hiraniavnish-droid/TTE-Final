import { whole, dateOnly, hotels, itineraryQuote, QuoteInputError } from './botItinerary';
import { SOU_ITINERARIES, RAILWAY_TRANSFER_PER_PERSON, TRANSPORT_REFERENCE, ITINERARY_MARKUP_PER_PAX_PER_DAY, priceSouItinerary } from '../services/souItinerary';
import { souTentCityRateCard } from '../services/souTentCityRates';
import { buildInlandWall } from '../services/inlandWall';
import { SOU_CITY } from '../services/souHotelOptions';
const fail = (message:string):never => { throw new QuoteInputError(message); };
const transfer = (v:unknown) => v === undefined ? false : typeof v === 'boolean' ? v : fail('include_railway_transfer must be a boolean.');
export function souCatalog(section='catalog') {
  const itineraries=Object.values(SOU_ITINERARIES).map(p=>({...p,days:p.nights+1,ticket_net_per_person:p.ticketItems.reduce((n,t)=>n+t.costPerPerson,0),service_charge_per_person:ITINERARY_MARKUP_PER_PAX_PER_DAY*(p.nights+1)}));
  const transfers={railway:{net_per_person:RAILWAY_TRANSFER_PER_PERSON,optional:true},reference_only:TRANSPORT_REFERENCE,reference_transport_included_in_total:false};
  const data:any={currency:'INR',rate_source:'Existing CRM supplier sheets and SOU builder; not live ticket availability',itineraries,transfers,tentcity:souTentCityRateCard(),hotels:hotels({supplier:'sou-hotels'}),notes:['Ticket bundles use one per-person rate; no separate child concession is published in this sheet.','Laser show is subject to availability.','Sightseeing lists are bundle inclusions, not a guaranteed day-by-day timetable.','Experiential Tent City includes sightseeing and pickup/drop; do not add the hotel sightseeing bundle again.']};
  if(section==='catalog')return data;
  return {currency:data.currency,rate_source:data.rate_source,data:data[section],notes:data.notes};
}
export function souItineraryQuote(input:any) {
  const nights=whole(input.nights,'nights',1,2) as 1|2,pax=whole(input.pax,'pax',1,1000);
  return {currency:'INR',...priceSouItinerary({nights,pax,includeRailwayTransfer:transfer(input.include_railway_transfer)}),reference_transport:TRANSPORT_REFERENCE,reference_transport_included_in_total:false,availability:'not_checked'};
}
export function souHotelRates(input:any) {
  const checkIn=dateOnly(input.check_in),nights=whole(input.nights,'nights',1,30),rooms=whole(input.rooms,'rooms',1,100),pax=whole(input.pax,'pax',1,1000),extraMattress=whole(input.extra_mattresses,'extra_mattresses',0,100,0);
  const markupMode=input.markup_mode ?? 'percent';if(!['percent','flat'].includes(markupMode))fail('markup_mode must be percent or flat.');
  const markupValue=input.markup_value === undefined ? 0 : Number(input.markup_value);
  if(input.markup_value===null || input.markup_value==='' || typeof input.markup_value==='boolean' || !Number.isFinite(markupValue)||markupValue<0||markupValue>100000)fail('markup_value must be from 0 to 100000.');
  const known=hotels({supplier:'sou-hotels'});if(input.hotel_id!==undefined&&!known.some(h=>h.id===input.hotel_id))fail('Unknown SOU hotel_id.');
  return {currency:'INR',check_in:checkIn,nights,rooms,pax,extra_mattresses:extraMattress,availability:'not_checked',hotels:buildInlandWall({city:SOU_CITY,checkIn,nights,rooms,pax,extraMattress,markupMode,markupValue}).filter(h=>!input.hotel_id||h.hotelId===input.hotel_id)};
}
export function souQuote(input:any) {
  if(input.product==='sou-tentcity') {
    if(input.include_itinerary===true||transfer(input.include_railway_transfer))fail('Quote Tent City separately from hotel sightseeing bundles to avoid duplicating Experiential inclusions.');
    return itineraryQuote({...input,extra_persons:whole(input.extra_mattresses,'extra_mattresses',0,100,0)});
  }
  if(input.product!==undefined&&input.product!=='sou-hotels')fail('product must be sou-hotels or sou-tentcity.');
  if(input.include_itinerary!==undefined&&typeof input.include_itinerary!=='boolean')fail('include_itinerary must be a boolean.');
  const addTransfer=transfer(input.include_railway_transfer);
  if(addTransfer&&!input.include_itinerary)fail('Railway transfer requires include_itinerary=true.');
  const stay=souHotelRates(input),itinerary=input.include_itinerary?souItineraryQuote(input):null;
  return {...stay,itinerary,hotels:stay.hotels.map(h=>({...h,rows:h.rows.map(r=>r.quotable?{...r,hotel_selling_total:r.sellingTotal,itinerary_selling_total:itinerary?.sellingTotal??0,package_selling_total:r.sellingTotal+(itinerary?.sellingTotal??0),package_selling_per_person:(r.sellingTotal+(itinerary?.sellingTotal??0))/stay.pax}:r)})),reference_transport:TRANSPORT_REFERENCE,reference_transport_included_in_total:false};
}
