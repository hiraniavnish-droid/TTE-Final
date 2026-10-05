export type RannHoldStatus='active'|'confirmed'|'released'|'expired';

export interface RannPackage{id:string;night:string;name:string}
export interface RannTent{
  id:string;name:string;shortName:string;capacity:number;available:number;crmHeld:number;crmConfirmed:number;
  safeAvailable:number;status:number;open:boolean;rate:number;rateWithTax:number;singleRate:number;
  extraAdult:number;extraChild:number;tax:number;
}
export interface RannAvailabilityDay{date:string;checked:boolean;checkedAt?:string|null;rooms:RannTent[];totalAvailable:number;totalSafeAvailable:number;soldOut:number;error?:string}
export interface RannRefreshRun{id:string;package_id:string;scope:'day'|'season';requested_start:string;requested_end:string;room_nights_available:number;categories_checked:number;created_at:string;previous_room_nights?:number|null;booked_since_previous?:number}
export interface RannHold{
  id:string;package_id:string;package_name:string;package_night:string;check_in_date:string;tent_id:string;tent_name:string;
  units:number;source_availability:number;lead_id:string|null;customer_name:string|null;customer_phone:string|null;
  current_lead_name:string;current_lead_code:string|null;current_lead_phone:string|null;status:RannHoldStatus;
  expires_at:string|null;supplier_reference:string|null;notes:string;created_by:string;resolved_by:string|null;
  resolved_at:string|null;resolution_note:string|null;created_at:string;updated_at:string;
}
export interface RannAudit{id:number;hold_id:string|null;actor_id:string;action:string;detail:Record<string,any>;created_at:string}
export interface RannAvailabilitySnapshot{
  serverTime:string;fetchedAt:string;viewer:{id:string;name:string;role:'admin'|'agent'};
  source:{name:string;propertyId:string;mode:'live';note:string};package:RannPackage;packages:RannPackage[];
  startDate:string;days:RannAvailabilityDay[];cachedDays:RannAvailabilityDay[];holds:RannHold[];audit:RannAudit[];
  lastRefresh:RannRefreshRun|null;refreshRuns:RannRefreshRun[];
}

export async function availabilityApi(action='snapshot',data:Record<string,unknown>={}){
  const token=localStorage.getItem('tte_token');
  const base=(import.meta as any).env?.DEV?'https://ttecrm.vercel.app':'';
  const query=action==='snapshot'?`?${new URLSearchParams(Object.entries(data).filter(([,v])=>v!=null&&v!=='').map(([k,v])=>[k,String(v)])).toString()}`:'';
  const response=await fetch(`${base}/api/availability${query}`,{
    method:action==='snapshot'?'GET':'POST',headers:{Authorization:`Bearer ${token||''}`,'Content-Type':'application/json'},
    ...(action==='snapshot'?{}:{body:JSON.stringify({...data,action})}),cache:'no-store',
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(result?.error||'Live availability could not be loaded.');
  return result as RannAvailabilitySnapshot;
}

export const formatINR=(value:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(value||0);
export const formatRannDate=(value:string,withYear=false)=>new Date(`${value}T12:00:00Z`).toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',...(withYear?{year:'numeric'}:{})});
export const isoDate=(date:Date)=>date.toISOString().slice(0,10);
export const addDays=(value:string,count:number)=>{const date=new Date(`${value}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+count);return isoDate(date)};
export const holdTimeLeft=(value:string|null,now=Date.now())=>{
  if(!value)return{label:'No expiry',urgent:false,expired:false};
  const milliseconds=new Date(value).getTime()-now;
  if(milliseconds<=0)return{label:'Expired',urgent:true,expired:true};
  const minutes=Math.ceil(milliseconds/60000),hours=Math.floor(minutes/60),days=Math.floor(hours/24);
  return{label:days?`${days}d ${hours%24}h left`:hours?`${hours}h ${minutes%60}m left`:`${minutes}m left`,urgent:milliseconds<=3*3600000,expired:false};
};
