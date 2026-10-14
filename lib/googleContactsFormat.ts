const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export function normalizeContactPhone(value: unknown): string | null {
 let digits = String(value || '').replace(/\D/g,'');
 if (digits.startsWith('00')) digits=digits.slice(2);
 if (digits.length===10) digits='91'+digits;
 return /^[1-9]\d{7,14}$/.test(digits)?'+'+digits:null;
}
export function contactTravelDate(value: unknown): string {
 const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})/);
 if(!match)return 'NoDate';
 const [,year,month,day]=match, d=new Date(`${year}-${month}-${day}T12:00:00Z`);
 return Number.isFinite(+d)&&d.getUTCMonth()+1===Number(month)&&d.getUTCDate()===Number(day)?`${Number(day)}${months[Number(month)-1]}`:'NoDate';
}
export function contactName(lead:any): string {
 const trip=lead.trip_details||{}, destination=String(trip.destination||lead.destination||'');
 const dest=/rann|dhordo/i.test(destination)?'RU':/statue of unity|\bsou\b|ekta nagar|kevadiya/i.test(destination)?'SOU':destination.replace(/[^\p{L}\p{N}]/gu,'').slice(0,4)||'Trip';
 const status:Record<string,string>={New:'New',Contacted:'Cont',Discussion:'Disc','Proposal Sent':'Quote',Quote:'Quote',Won:'Conf',Confirmed:'Conf',Lost:'Lost'};
 const code=String(lead.lead_code||'').replace(/^TTE-?/i,'')||String(lead.id).slice(0,8);
 const date=contactTravelDate(trip.startDate||lead.travel_date);
 const prefix=Array.from(code).slice(0,12).join(''), suffix=` ${dest} ${status[lead.status]||'New'} ${date}`;
 const budget=39-Array.from(prefix+' '+suffix).length;
 const first=Array.from(String(lead.name||'Guest').trim().split(/\s+/)[0]||'Guest').slice(0,Math.max(1,budget)).join('');
 return `${prefix} ${first}${suffix}`;
}
const start='[TTE CRM Leads]', end='[/TTE CRM Leads]';
export function contactNotes(leads:any[], existing=''): string {
 const lines=leads.map(lead=>{
  const trip=lead.trip_details||{},pax=trip.paxConfig||{};
  return `${lead.lead_code||lead.id} — ${lead.name||'Guest'}\nDestination: ${trip.destination||lead.destination||'Not set'}\nStatus: ${lead.status||'New'}\nDates: ${trip.startDate||lead.travel_date||'No date'}${trip.endDate?' to '+trip.endDate:trip.nights?` · ${trip.nights} nights`:''}\nGuests: ${pax.adults??lead.pax??'Not set'} adults, ${pax.children??0} children${pax.childAges?.length?` (ages ${pax.childAges.join(', ')})`:''}\nCRM: https://ttecrm.vercel.app/#/leads/${encodeURIComponent(lead.id)}`;
 });
 const preserved=existing.replace(/\[TTE CRM Leads\][\s\S]*?\[\/TTE CRM Leads\]/g,'').trim();
 const details=lines.join('\n\n');
 // Keep personal notes intact; fail visibly rather than silently deleting them.
 if(preserved.length+details.length>30000)throw Error('Contact notes are too long. Shorten this contact’s existing notes and retry.');
 return [preserved,`${start}\n${details}\n${end}`].filter(Boolean).join('\n\n');
}
