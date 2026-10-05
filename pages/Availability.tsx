import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {BadgeCheck,CalendarDays,ChevronLeft,ChevronRight,Clock3,History,RefreshCw,ShieldCheck,X} from 'lucide-react';
import {useAuth} from '../contexts/AuthContext';
import {useLeads} from '../contexts/LeadContext';
import {RannAudit,RannAvailabilityDay,RannAvailabilitySnapshot,RannHold,RannTent,availabilityApi,formatINR,formatRannDate,holdTimeLeft} from '../lib/availability';
import './availability.css';

type Tab='desk'|'holds'|'history';
type View='month'|'season';
type Modal={kind:'hold';tent:RannTent;day:RannAvailabilityDay}|{kind:'action';action:'extend_hold'|'release_hold'|'confirm_hold';hold:RannHold};
const SEASON_START='2026-11-01',SEASON_END='2027-03-07';
const MONTHS=['2026-11-01','2026-12-01','2027-01-01','2027-02-01','2027-03-01'];
const monthStart=(date:string)=>`${date.slice(0,7)}-01`;
const daysInMonth=(date:string)=>{const [year,month]=date.slice(0,7).split('-').map(Number);return new Date(Date.UTC(year,month,0)).getUTCDate()};
const shiftMonth=(date:string,amount:number)=>{const [year,month]=date.slice(0,7).split('-').map(Number);return new Date(Date.UTC(year,month-1+amount,1)).toISOString().slice(0,10)};
const dtLocal=(date:Date)=>new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
const shortDate=(date:string)=>new Date(`${date}T12:00:00Z`).toLocaleDateString('en-IN',{day:'numeric',month:'short'});
const isSeasonDate=(date:string)=>date>=SEASON_START&&date<=SEASON_END;

function Dialog({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}){
 return <div className="ru-overlay" role="presentation" onMouseDown={event=>event.target===event.currentTarget&&onClose()}><section className="ru-dialog" role="dialog" aria-modal="true" aria-label={title}><header><div><span>RANN UTSAV CONTROL</span><h2>{title}</h2></div><button aria-label="Close dialog" onClick={onClose}><X size={18}/></button></header><div className="ru-dialog-body">{children}</div></section></div>;
}

function stockTone(day:RannAvailabilityDay|undefined){
 if(!day?.checked)return 'unknown';
 if(day.totalSafeAvailable===0)return 'gone';
 if(day.totalSafeAvailable<=25)return 'scarce';
 if(day.totalSafeAvailable<=90)return 'limited';
 return 'open';
}

function DeskCalendar({month,days,selectedDate,onSelect,compact=false}:{month:string;days:RannAvailabilityDay[];selectedDate:string;onSelect:(date:string)=>void;compact?:boolean}){
 const [year,monthNumber]=month.slice(0,7).split('-').map(Number),count=daysInMonth(month),first=new Date(Date.UTC(year,monthNumber-1,1)).getUTCDay(),byDate=new Map(days.map(day=>[day.date,day]));
 const title=new Date(`${month}T12:00:00Z`).toLocaleDateString('en-IN',{month:'long',year:'numeric'});
 return <section className={`desk-calendar ${compact?'compact':''}`} aria-label={compact?`${title} availability`:'Monthly live availability calendar'}>
  <header><div><h2>{title}</h2><span>{compact?'Saved inventory':'Click a date to inspect each tent category'}</span></div>{!compact&&<div className="desk-key"><i className="open"/>Good <i className="limited"/>Filling <i className="scarce"/>Last few <i className="gone"/>Sold out</div>}</header>
  <div className="desk-dow">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day=><span key={day}>{day}</span>)}</div>
  <div className="desk-grid">{Array.from({length:first},(_,index)=><i key={`blank-${index}`}/>) }{Array.from({length:count},(_,index)=>{
   const date=`${month.slice(0,7)}-${String(index+1).padStart(2,'0')}`,day=byDate.get(date),outside=!isSeasonDate(date),tone=outside?'outside':stockTone(day),amount=day?.checked?day.totalSafeAvailable:null;
   return <button key={date} type="button" disabled={outside} className={`${tone} ${selectedDate===date?'selected':''}`} onClick={()=>onSelect(date)} aria-label={`${formatRannDate(date,true)}: ${outside?'outside season':amount===null?'not checked':`${amount} tents safe to quote`}`}><small>{index+1}</small><b>{outside?'—':amount===null?'·':amount}</b>{!compact&&<em>{outside?'Out':amount===null?'Not checked':day?.soldOut?`${day.soldOut} sold out`:'ready'}</em>}</button>;
  })}</div>
 </section>;
}

function HoldList({holds,now,onAction}:{holds:RannHold[];now:number;onAction:(action:'extend_hold'|'release_hold'|'confirm_hold',hold:RannHold)=>void}){
 return <div className="desk-holds">{holds.map(hold=>{const left=holdTimeLeft(hold.expires_at,now);return <article key={hold.id} className={left.urgent&&hold.status==='active'?'urgent':''}><div className="desk-hold-date"><small>{new Date(`${hold.check_in_date}T12:00:00Z`).toLocaleDateString('en-IN',{month:'short'}).toUpperCase()}</small><b>{new Date(`${hold.check_in_date}T12:00:00Z`).getUTCDate()}</b></div><div><small>{hold.current_lead_code||'DIRECT GUEST'} · {hold.package_night}</small><h3>{hold.current_lead_name}</h3><p>{hold.tent_name} · {hold.units} tent{hold.units===1?'':'s'} · {hold.status==='active'?left.label:hold.supplier_reference||hold.status}</p></div><div className="desk-hold-actions">{hold.status==='active'&&<><button onClick={()=>onAction('extend_hold',hold)}>Extend</button><button onClick={()=>onAction('release_hold',hold)}>Release</button><button className="primary" onClick={()=>onAction('confirm_hold',hold)}>Confirm</button></>}</div></article>})}{!holds.length&&<Empty title="No holds in this view." copy="A hold created from the inventory desk appears here with its expiry and follow-up actions."/>}</div>;
}

export const Availability=()=>{
 const {user}=useAuth(),{allLeads}=useLeads();
 const [data,setData]=useState<RannAvailabilitySnapshot|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[checking,setChecking]=useState<'day'|'season'|null>(null);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[packageId,setPackageId]=useState('260'),[startDate,setStartDate]=useState('2026-11-01'),[selectedDate,setSelectedDate]=useState('2026-11-15');
 const [tab,setTab]=useState<Tab>('desk'),[view,setView]=useState<View>('month'),[modal,setModal]=useState<Modal|null>(null),[now,setNow]=useState(Date.now());
 const load=useCallback(async(silent=false,nextPackage=packageId,nextDate=startDate,nextDays=view==='month'?daysInMonth(nextDate):31)=>{
  if(!silent)setLoading(true);setError('');try{setData(await availabilityApi('snapshot',{packageId:nextPackage,date:nextDate,days:nextDays}))}catch(e:any){setError(e.message)}finally{setLoading(false)}
 },[packageId,startDate,view]);
 useEffect(()=>{if(user)load();},[user]);
 useEffect(()=>{const clock=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(clock)},[]);
 const changePackage=(value:string)=>{setPackageId(value);setModal(null);load(false,value,startDate)};
 const jump=(value:string)=>{const date=monthStart(value);setStartDate(date);if(selectedDate.slice(0,7)!==date.slice(0,7))setSelectedDate(date);load(false,packageId,date)};
 const selectDate=(date:string)=>{setSelectedDate(date);if(date.slice(0,7)!==startDate.slice(0,7)){setStartDate(monthStart(date));load(false,packageId,monthStart(date));}};
 const checkLive=async(scope:'day'|'season')=>{setChecking(scope);setError('');try{const result:any=await availabilityApi('refresh_live',{packageId,scope,date:selectedDate});await load(true);setNotice(scope==='season'?`Saved live availability for all ${result.checked} Rann Utsav dates.`:`Saved live availability for ${formatRannDate(selectedDate,true)}.`);setTimeout(()=>setNotice(''),4500)}catch(e:any){setError(e.message)}finally{setChecking(null)}};
 const act=async(action:string,payload:Record<string,unknown>,message:string)=>{setBusy(true);setError('');try{await availabilityApi(action,payload);await load(true);setModal(null);setNotice(message);setTimeout(()=>setNotice(''),3500)}catch(e:any){setError(e.message)}finally{setBusy(false)}};
 if(!user)return null;
 if(loading&&!data)return <div className="desk-page"><div className="desk-loading">Opening Tent City inventory…</div></div>;
 if(!data)return <div className="desk-page"><div className="desk-fatal"><h1>Inventory desk unavailable</h1><p>{error}</p><button onClick={()=>load()}>Try again</button></div></div>;
 const selectedDay=data.cachedDays.find(day=>day.date===selectedDate)||data.cachedDays.find(day=>day.checked)||data.cachedDays[0];
 const rooms=selectedDay?.rooms||[],activeHolds=data.holds.filter(hold=>hold.status==='active'),protectedUnits=activeHolds.reduce((sum,hold)=>sum+hold.units,0),lastFew=rooms.filter(tent=>tent.open&&tent.safeAvailable<=5).length,shownHolds=data.holds.filter(hold=>hold.status==='active'||hold.status==='confirmed');
 const monthLabel=new Date(`${startDate}T12:00:00Z`).toLocaleDateString('en-IN',{month:'long',year:'numeric'});
 return <div className="desk-page">
  <header className="desk-mast">
   <div><span className="desk-eyebrow">RANN UTSAV · DHORDO · PROPERTY 257</span><h1>Tent City <em>inventory desk</em></h1><p>Saved availability only. Supplier inventory is contacted only when you ask it to refresh.</p></div>
   <div className="desk-controls"><label><span>Package</span><select aria-label="Rann Utsav package" value={packageId} onChange={event=>changePackage(event.target.value)}>{data.packages.map(pkg=><option key={pkg.id} value={pkg.id}>{pkg.name}</option>)}</select></label><button onClick={()=>checkLive('day')} disabled={!!checking||!selectedDay}><RefreshCw size={15} className={checking==='day'?'spin':''}/>{checking==='day'?'Checking…':`Check ${shortDate(selectedDay?.date||selectedDate)}`}</button><button className="desk-primary" onClick={()=>checkLive('season')} disabled={!!checking}><CalendarDays size={15} className={checking==='season'?'spin':''}/>{checking==='season'?'Refreshing season…':'Refresh full season'}</button></div>
  </header>
  <div className={`desk-status ${data.fetchedAt?'saved':'idle'}`}><i/><span>{data.fetchedAt?`Last supplier snapshot saved ${new Date(data.fetchedAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} IST`:'No saved supplier snapshot yet — select a date and check live rates.'}</span><b>Manual refresh mode</b></div>
  {error&&<div className="desk-error"><span>{error}</span><button onClick={()=>setError('')} aria-label="Dismiss error"><X size={15}/></button></div>}
  <div className="desk-kpis"><article><small>SAFE TO QUOTE · {shortDate(selectedDay?.date||selectedDate)}</small><b>{selectedDay?.checked?selectedDay.totalSafeAvailable:'—'}</b><span>{selectedDay?.checked?'across all tent categories':'awaiting a live check'}</span></article><article><small>SUPPLIER SHOWING</small><b>{selectedDay?.checked?selectedDay.totalAvailable:'—'}</b><span>before CRM-protected stock</span></article><article><small>ACTIVE CRM HOLDS</small><b>{activeHolds.length}</b><span>{protectedUnits} tent{protectedUnits===1?'':'s'} protected</span></article><article><small>LAST FEW</small><b>{selectedDay?.checked?lastFew:'—'}</b><span>categories with 5 or less</span></article></div>
  <div className="desk-nav"><div><button aria-label="Previous month" disabled={startDate===MONTHS[0]} onClick={()=>jump(shiftMonth(startDate,-1))}><ChevronLeft size={17}/></button><strong>{view==='season'?'Complete 2026–27 season':monthLabel}</strong><button aria-label="Next month" disabled={view==='season'||startDate===MONTHS[MONTHS.length-1]} onClick={()=>jump(shiftMonth(startDate,1))}><ChevronRight size={17}/></button></div><div className="desk-switch" role="group" aria-label="Availability layout"><button className={view==='month'?'active':''} onClick={()=>setView('month')}>Month</button><button className={view==='season'?'active':''} onClick={()=>setView('season')}>Whole season</button></div></div>
  {view==='month'?<DeskCalendar month={startDate} days={data.cachedDays} selectedDate={selectedDay?.date||selectedDate} onSelect={selectDate}/>:<section className="desk-season" aria-label="Rann Utsav season availability calendar"><header><div><span>WHOLE SEASON</span><h2>Availability at a glance</h2></div><p>Each number is safe to quote after CRM holds. A dot means no saved check yet.</p></header><div>{MONTHS.map(month=><DeskCalendar key={month} compact month={month} days={data.cachedDays} selectedDate={selectedDay?.date||selectedDate} onSelect={selectDate}/>)}</div></section>}
  <section className="desk-workspace">
   <div className="desk-tabs" role="tablist"><button role="tab" aria-selected={tab==='desk'} onClick={()=>setTab('desk')}>Availability <span>{selectedDay?.checked?'LIVE':'NOT CHECKED'}</span></button><button role="tab" aria-selected={tab==='holds'} onClick={()=>setTab('holds')}>CRM holds {activeHolds.length>0&&<i>{activeHolds.length}</i>}</button><button role="tab" aria-selected={tab==='history'} onClick={()=>setTab('history')}>History</button></div>
   {tab==='desk'&&<div className="desk-inventory"><header><div><span>{data.package.name} · {data.package.night}</span><h2>{formatRannDate(selectedDay?.date||selectedDate,true)}</h2></div><p>{selectedDay?.checked?'Supplier stock minus protected CRM holds equals the number your team can safely quote.':'No live inventory has been saved for this date.'}</p></header>{selectedDay?.checked?<div className="desk-table-wrap"><table><thead><tr><th>Tent type</th><th>Safe</th><th>Supplier</th><th>CRM held</th><th>Rate</th><th>With GST</th><th/></tr></thead><tbody>{rooms.map(tent=><tr key={tent.id} className={!tent.open?'sold':''}><td><b>{tent.name}</b><small>{tent.capacity} season capacity · extra adult {formatINR(tent.extraAdult)}</small></td><td><strong className={tent.safeAvailable<=5?'low':''}>{tent.safeAvailable}</strong></td><td>{tent.available}</td><td>{tent.crmHeld+tent.crmConfirmed||'—'}</td><td>{formatINR(tent.rate)}</td><td>{formatINR(tent.rateWithTax)}</td><td><button disabled={!tent.open||tent.safeAvailable<1} onClick={()=>setModal({kind:'hold',tent,day:selectedDay})}>{tent.open&&tent.safeAvailable?'Hold':'Sold out'}</button></td></tr>)}</tbody></table></div>:<Empty title="No saved availability for this date." copy="Use Check this date to fetch every tent type, rate and availability from The Tent City, then save it here."/>}</div>}
   {tab==='holds'&&<HoldList holds={shownHolds} now={now} onAction={(action,hold)=>setModal({kind:'action',action,hold})}/>} 
   {tab==='history'&&<AuditList audit={data.audit}/>} 
  </section>
  <footer className="desk-footer"><span><ShieldCheck size={13}/> Shared team desk · all hold activity is audited</span><span>Supplier source: booking.thetentcity.in</span></footer>
  {notice&&<div className="ru-toast" role="status"><BadgeCheck size={17}/>{notice}</div>}
  {modal?.kind==='hold'&&<Dialog title="Protect this availability" onClose={()=>!busy&&setModal(null)}><HoldForm tent={modal.tent} day={modal.day} pkg={data.package} leads={allLeads} busy={busy} onSubmit={payload=>act('create_hold',payload,'CRM hold placed and deducted from safe stock.')}/></Dialog>}
  {modal?.kind==='action'&&<Dialog title={modal.action==='extend_hold'?'Extend CRM hold':modal.action==='confirm_hold'?'Mark supplier confirmation':'Release CRM hold'} onClose={()=>!busy&&setModal(null)}><HoldActionForm action={modal.action} hold={modal.hold} busy={busy} onSubmit={payload=>act(modal.action,payload,modal.action==='extend_hold'?'Hold extended.':modal.action==='confirm_hold'?'Supplier confirmation recorded.':'Hold released.')}/></Dialog>}
 </div>;
};

function AuditList({audit}:{audit:RannAudit[]}){return <div className="desk-audit">{audit.map(entry=><article key={entry.id}><i><History size={14}/></i><div><b>{entry.action.replaceAll('_',' ')}</b><span>{entry.detail?.reason||entry.detail?.tent||'Rann Utsav hold updated.'}</span></div><time>{new Date(entry.created_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</time></article>)}{!audit.length&&<Empty title="No history yet." copy="Hold creations, extensions, releases, confirmations and expiries are recorded here."/>}</div>}
function Empty({title,copy}:{title:string;copy:string}){return <div className="desk-empty"><CalendarDays size={22}/><h2>{title}</h2><p>{copy}</p></div>}

function HoldForm({tent,day,pkg,leads,busy,onSubmit}:{tent:RannTent;day:RannAvailabilityDay;pkg:any;leads:any[];busy:boolean;onSubmit:(payload:any)=>void}){
 const [leadId,setLeadId]=useState('');const ordered=useMemo(()=>[...leads].sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()).slice(0,500),[leads]);
 const submit=(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();const form=Object.fromEntries(new FormData(event.currentTarget));onSubmit({...form,packageId:pkg.id,checkInDate:day.date,tentId:tent.id,leadId,units:Number(form.units),expiresAt:new Date(String(form.expiresAt)).toISOString()})};
 return <form className="ru-form" onSubmit={submit}><div className="ru-selection"><i><CalendarDays size={17}/></i><span><small>{formatRannDate(day.date,true)} · {pkg.night}</small><b>{tent.name}</b></span><strong>{tent.safeAvailable} safe</strong></div><label>Lead or customer<select aria-label="Lead or customer" value={leadId} onChange={event=>setLeadId(event.target.value)}><option value="">Direct guest · enter details</option>{ordered.map(lead=><option key={lead.id} value={lead.id}>{lead.leadCode?`${lead.leadCode} · `:''}{lead.name} · {lead.tripDetails?.destination||'No destination'}</option>)}</select></label>{!leadId&&<div className="ru-form-grid"><label>Customer name<input name="customerName" required minLength={2} maxLength={140}/></label><label>Phone · optional<input name="customerPhone" inputMode="tel" maxLength={30}/></label></div>}<div className="ru-form-grid"><label>Tents<input aria-label="Hold tents" name="units" type="number" min="1" max={tent.safeAvailable} defaultValue="1" required/></label><label>Hold expires · IST<input name="expiresAt" type="datetime-local" min={dtLocal(new Date(Date.now()+15*60000))} max={dtLocal(new Date(Date.now()+14*86400000))} defaultValue={dtLocal(new Date(Date.now()+24*3600000))} required/></label></div><label>Internal note<textarea name="notes" maxLength={2000} placeholder="Supplier contact, guest requirement or follow-up note"/></label><div className="ru-form-help"><ShieldCheck size={15}/><span>This protects stock inside your CRM. Confirm the actual block with The Tent City supplier.</span></div><button className="ru-submit" disabled={busy||tent.safeAvailable<1}>{busy?'Checking live stock…':'Check again & place hold'}<ChevronRight size={16}/></button></form>;
}
function HoldActionForm({action,hold,busy,onSubmit}:{action:'extend_hold'|'release_hold'|'confirm_hold';hold:RannHold;busy:boolean;onSubmit:(payload:any)=>void}){
 const submit=(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();const form=Object.fromEntries(new FormData(event.currentTarget));onSubmit({...form,id:hold.id,...(form.expiresAt?{expiresAt:new Date(String(form.expiresAt)).toISOString()}:{})})};
 return <form className="ru-form" onSubmit={submit}><div className="ru-selection"><i><Clock3 size={17}/></i><span><small>{formatRannDate(hold.check_in_date,true)} · {hold.units} tent{hold.units===1?'':'s'}</small><b>{hold.current_lead_name} · {hold.tent_name}</b></span></div>{action==='extend_hold'&&<label>New expiry · IST<input name="expiresAt" type="datetime-local" required min={dtLocal(new Date(Date.now()+15*60000))} max={dtLocal(new Date(Date.now()+14*86400000))} defaultValue={dtLocal(new Date(Date.now()+24*3600000))}/></label>}{action==='confirm_hold'&&<label>Supplier confirmation reference<input name="supplierReference" required minLength={2} maxLength={100} placeholder="Booking ID, confirmation number or supplier name"/></label>}<label>{action==='release_hold'?'Reason for release':action==='confirm_hold'?'Confirmation note':'Reason for extension'}<textarea name="reason" required minLength={3} maxLength={1000}/></label><button className={`ru-submit ${action==='release_hold'?'danger':''}`} disabled={busy}>{busy?'Saving…':action==='extend_hold'?'Extend hold':action==='confirm_hold'?'Record supplier confirmation':'Release hold'}<ChevronRight size={16}/></button></form>;
}
