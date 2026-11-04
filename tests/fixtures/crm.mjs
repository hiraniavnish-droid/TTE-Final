// Entirely fictional records. Never imported by the production application.
const date = days => new Date(Date.now() + days * 86400000).toISOString();
export const user = {id:'00000000-0000-4000-8000-000000000001',name:'Design Reviewer',role:'admin',session_version:1,created_at:date(-60)};
const names=['Demo · Aarav Shah','Demo · Meera & family','Demo · Vikram Patel','Demo · Riya Desai','Demo · Kunal Mehta','Demo · The West Coast Travellers — group enquiry','Demo · Neha Shah','Demo · Sameer Joshi','Demo · Devika Rao','Demo · Kabir Shah','Demo · Tara & friends','Demo · Long international group name for mobile layout verification'];
const stages=['New','Contacted','Proposal Sent','Discussion','Won','Lost'];
export const leads=names.map((name,i)=>({
  id:`00000000-0000-4000-8000-${String(i+10).padStart(12,'0')}`,name,
  contact:{phone:'+910000000000',email:'demo@example.invalid'},
  trip_details:{destination:['Rann Utsav','Kutch','Statue of Unity'][i%3],startDate:date(30+i).slice(0,10),budget:65000+i*12500,duration:3,nights:3,paxConfig:{adults:2+i%3,children:i%2,childAges:i%2?[7]:[]}},
  status:stages[i%6],temperature:i%3?'Warm':'Hot',assigned_to:user.name,source:['Website','WhatsApp','Reference'][i%3],tags:[],preferences:{},commercials:i%6===4?{sellingPrice:180000+i*1000,netCost:130000,vendorId:'demo-vendor'}:undefined,vendors:i%6===4?[{id:'demo-vendor-'+i,name:'Demo Tent Supplier',cost:130000,price:180000+i*1000,payments:[{id:'demo-vendor-payment-'+i,amount:50000,date:date(-1),mode:'Bank Transfer'}]}]:[],
  created_at:date(-i%5),last_status_update:date(-i%4),won_at:i%6===4?date(-1):null,lead_code:`TTE-${1000+i}`,
}));
export const tables={
  users:[user],leads,
  interactions:leads.slice(0,4).map((l,i)=>({id:`interaction-${i}`,lead_id:l.id,type:'Note',content:'Fictional enquiry: traveller requested the itinerary and tent options.',author:user.name,sentiment:'Neutral',timestamp:date(-i)})),
  reminders:[{id:'reminder-1',lead_id:leads[0].id,task:'Follow up on the fictional quotation',due_date:date(-1),is_completed:false,assigned_to:user.name}],
  suppliers:[],activity_logs:[],
};
export const records=leads.filter(l=>l.status==='Won').map((l,i)=>({id:`payment-${i}`,leadId:l.id,amount:65000+i*5000,status:'paid',source:'manual',manual_reference:`DEMO-${i}`,created_at:date(-1),paid_at:date(-1)}));
export function token(){return `${Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:user.id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600,session_version:1})).toString('base64url')}.fictional-preview-only`;}

export function availabilitySnapshot(){
 const start='2026-11-01';
 const packages=[{id:'preview-3n',night:'3',name:'3 Nights / 4 Days'}];
 const days=Array.from({length:30},(_,i)=>{
  const date=`2026-11-${String(i+1).padStart(2,'0')}`;
  const rooms=['Non-AC Swiss Cottage','AC Swiss Cottage','Premium Tent'].map((name,j)=>({id:`preview-tent-${j}`,name,shortName:name,capacity:3,available:12,crmHeld:1,crmConfirmed:0,safeAvailable:11,status:1,open:true,rate:10000,rateWithTax:11800,singleRate:9000,extraAdult:3500,extraChild:2000,tax:18}));
  return {date,checked:true,checkedAt:new Date().toISOString(),rooms,totalAvailable:36,totalSafeAvailable:33,soldOut:0};
 });
 return {serverTime:new Date().toISOString(),fetchedAt:new Date().toISOString(),viewer:user,source:{name:'Fictional inventory preview',propertyId:'preview-only',mode:'live',note:'Synthetic test inventory. No connection to booking systems.'},package:packages[0],packages,startDate:start,days,cachedDays:days,holds:[],audit:[],lastRefresh:null,refreshRuns:[]};
}
export function attendanceSnapshot(){
 return {serverTime:new Date().toISOString(),today:new Date().toISOString().slice(0,10),viewer:user,startedOn:'2026-11-01',users:[user],policy:{start:'10:00',end:'19:00',workingDays:[1,2,3,4,5,6],lateMinutes:15,lateDays:3,halfDayHours:4,fullDayHours:8,quotas:{casual:12,sick:6,earned:12,unpaid:0},holidays:[],timezone:'Asia/Kolkata',leaveYearStartMonth:4},records:[],requests:[],entitlements:[],audit:[]};
}
