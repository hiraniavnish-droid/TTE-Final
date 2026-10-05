export type Staff = { id: string; name: string; role: 'admin' | 'agent' };
export type LeaveType = 'casual' | 'sick' | 'earned' | 'unpaid';
export const leaveNames: Record<LeaveType,string> = { casual:'Casual leave', sick:'Sick leave', earned:'Earned leave', unpaid:'Unpaid leave' };
export type AttendancePolicy = { start:string; end:string; workingDays:number[]; lateMinutes:number; lateDays:number; halfDayHours:number; fullDayHours:number; quotas:Record<string,number>; holidays:{date:string;name:string}[]; timezone:string; leaveYearStartMonth?:number; leaveAccrualStart?:string; leaveAccrualMode?:'monthly'; governmentHolidaysAdditional?:boolean };
export type AttendanceDay = { id:string;user_id:string;day:string;clock_in:string|null;clock_out:string|null;policy:AttendancePolicy;override:string|null;note:string;updated_at:string };
export type AttendanceRequest = { id:string;user_id:string;kind:'leave'|'correction'|'outdoor';start_date:string;end_date:string;leave_type:LeaveType|null;portion:string;days:number;dates:string[];reason:string;proposed_in:string|null;proposed_out:string|null;status:'pending'|'approved'|'rejected'|'cancelled';reviewed_by:string|null;reviewed_at:string|null;review_note:string|null;created_at:string };
export type AttendanceSnapshot = {serverTime:string;today:string;viewer:Staff;startedOn:string;policy:AttendancePolicy;users:Staff[];records:AttendanceDay[];requests:AttendanceRequest[];entitlements:{user_id:string;year:number;leave_type:string;days:number}[];audit:{id:number;actor_id:string;user_id:string;action:string;created_at:string;detail:any}[]};
export const indiaDate = (date:Date = new Date()) => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export const timeLabel = (stamp?:string|null) => stamp ? new Date(stamp).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit'}) : '—';
export const dateLabel = (day:string) => new Date(`${day}T12:00:00+05:30`).toLocaleDateString('en-IN',{day:'numeric',month:'short'});
export const localTime = (stamp?:string|null) => stamp ? new Date(stamp).toLocaleTimeString('en-GB',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit'}) : '';
export const isoTime = (day:string,time:string) => time ? `${day}T${time}:00+05:30` : null;
export function monthDays(month:string) { const [y,m]=month.split('-').map(Number); return Array.from({length:new Date(y,m,0).getDate()},(_,i)=>`${month}-${String(i+1).padStart(2,'0')}`); }
export function workingDay(day:string,policy:AttendancePolicy) { const weekday=new Date(`${day}T12:00:00Z`).getUTCDay()||7; return policy.workingDays.includes(weekday)&&!policy.holidays.some(h=>h.date===day); }
export function hours(record:AttendanceDay,now:number=Date.now()) { return record.clock_in ? Math.max(0,((record.clock_out?Date.parse(record.clock_out):now)-Date.parse(record.clock_in))/3600000) : 0; }
export const duration = (value:number) => { const minutes=Math.max(0,Math.floor(value*60));return `${Math.floor(minutes/60)}h ${(minutes%60).toString().padStart(2,'0')}m`; };
export function lateMinutes(record:AttendanceDay,requests:AttendanceRequest[] = []) {
  if(!record.clock_in || !workingDay(record.day,record.policy)) return 0;
  const approved=requests.find(r=>r.user_id===record.user_id&&r.status==='approved'&&r.dates.includes(record.day)&&r.kind!=='correction');
  if(approved?.kind==='outdoor'||approved?.kind==='leave'&&approved.portion==='full')return 0;
  let start=Date.parse(isoTime(record.day,record.policy.start)!);
  if(approved?.kind==='leave'&&approved.portion==='morning')start+=(Date.parse(isoTime(record.day,record.policy.end)!)-start)/2;
  return Math.max(0,Math.ceil((Date.parse(record.clock_in)-start)/60000));
}
export function attendanceStatus(record:AttendanceDay|undefined,day:string,userId:string,data:AttendanceSnapshot) {
  const linked=data.requests.find(r=>r.user_id===userId&&r.status==='approved'&&r.kind!=='correction'&&r.dates.includes(day));
  if(linked?.kind==='leave'&&linked.portion==='full') return {label:'On leave',tone:'violet',detail:leaveNames[linked.leave_type!]};
  if(record?.override) return {label:({present:'Present',half_day:'Half day',absent:'Absent',excused:'Excused',outdoor:'Outdoor duty'} as Record<string,string>)[record.override],tone:record.override==='absent'?'red':'green',detail:record.note||'Admin adjustment'};
  if(linked?.kind==='outdoor') return {label:'Outdoor duty',tone:'blue',detail:linked.reason};
  if(!record?.clock_in) {
    if(linked?.kind==='leave') return {label:'Half-day leave',tone:'violet',detail:`${linked.portion} · ${leaveNames[linked.leave_type!]}`};
    const holiday=data.policy.holidays.find(h=>h.date===day);
    if(holiday) return {label:'Holiday',tone:'neutral',detail:holiday.name};
    if(!workingDay(day,data.policy)) return {label:'Weekly off',tone:'neutral',detail:'Non-working day'};
    if(day<data.startedOn) return {label:'Not tracked',tone:'neutral',detail:'Before attendance module launch'};
    return {label:day>data.today?'Upcoming':day===data.today?'Not checked in':'Missing',tone:day<data.today?'amber':'neutral',detail:day<data.today?'Request a correction if you worked':'No attendance submitted'};
  }
  if(!record.clock_out&&day<data.today) return {label:'Missing checkout',tone:'amber',detail:'Submit a correction for this day'};
  const late=lateMinutes(record,data.requests);
  const eligible=data.records.filter(r=>r.user_id===userId&&r.day.slice(0,7)===day.slice(0,7)&&r.day<=day&&!r.override&&lateMinutes(r,data.requests)>0&&lateMinutes(r,data.requests)<=r.policy.lateMinutes).sort((a,b)=>a.day.localeCompare(b.day));
  if(late>0 && (late>record.policy.lateMinutes || eligible.findIndex(r=>r.id===record.id)>=record.policy.lateDays)) return {label:'Late · review',tone:'red',detail:`${late} minutes late · outside allowance`};
  if(record.clock_out && hours(record)<(linked?.portion!=='full'&&linked?.kind==='leave'?record.policy.halfDayHours:record.policy.fullDayHours)) return {label:hours(record)>=record.policy.halfDayHours?'Half day':'Short hours',tone:'amber',detail:`${duration(hours(record))} recorded · review hours`};
  if(late>0) return {label:'Late · allowed',tone:'amber',detail:`${late} min late · allowance ${eligible.findIndex(r=>r.id===record.id)+1}/${record.policy.lateDays}`};
  return {label:record.clock_out?'Present':'Working',tone:'green',detail:linked?.kind==='leave'?`${linked.portion} leave approved`:'On time'};
}
export function leaveCycleYear(policy:AttendancePolicy,dayOrMonth:string) {
 const year=Number(dayOrMonth.slice(0,4)),month=Number(dayOrMonth.slice(5,7)),start=Math.min(12,Math.max(1,Number(policy.leaveYearStartMonth||4)));
 return month>=start?year:year-1;
}
export const leaveCycleLabel=(year:number)=>`${year}–${String(year+1).slice(-2)}`;
export function annualLeaveAllowance(data:AttendanceSnapshot,userId:string,type:string,cycleYear:number) {
 return data.entitlements.find(e=>e.user_id===userId&&e.leave_type===type&&e.year===cycleYear)?.days??data.policy.quotas[type]??0;
}
export function accruedLeaveAllowance(data:AttendanceSnapshot,userId:string,type:string,cycleYear:number,asOf=data.today) {
 const annual=annualLeaveAllowance(data,userId,type,cycleYear),startMonth=Math.min(12,Math.max(1,Number(data.policy.leaveYearStartMonth||4)));
 const cycleStart=`${cycleYear}-${String(startMonth).padStart(2,'0')}-01`,cycleEndYear=startMonth===1?cycleYear:cycleYear+1,cycleEndMonth=startMonth===1?12:startMonth-1;
 const cycleEnd=`${cycleEndYear}-${String(cycleEndMonth).padStart(2,'0')}-31`,configured=data.policy.leaveAccrualStart||cycleStart,accrualStart=configured>cycleStart?configured:cycleStart;
 if(asOf<accrualStart)return 0;
 const effective=asOf>cycleEnd?cycleEnd:asOf,sy=Number(accrualStart.slice(0,4)),sm=Number(accrualStart.slice(5,7)),ey=Number(effective.slice(0,4)),em=Number(effective.slice(5,7));
 const months=Math.max(0,Math.min(12,(ey-sy)*12+em-sm+1));
 return Math.round((annual/12*months)*100)/100;
}
export function leaveBalance(data:AttendanceSnapshot,userId:string,type:string,cycleYear:number,asOf=data.today) {
 const annualAllowance=annualLeaveAllowance(data,userId,type,cycleYear),allowance=accruedLeaveAllowance(data,userId,type,cycleYear,asOf);
 const items=data.requests.filter(r=>r.user_id===userId&&r.kind==='leave'&&r.leave_type===type&&leaveCycleYear(data.policy,r.start_date)===cycleYear);
 const approved=items.filter(r=>r.status==='approved').reduce((s,r)=>s+Number(r.days),0),pending=items.filter(r=>r.status==='pending').reduce((s,r)=>s+Number(r.days),0);
 return {allowance,annualAllowance,approved,pending,available:Math.round((allowance-approved-pending)*100)/100};
}
export async function attendanceApi(action:string,data:Record<string,unknown>={}) {
 const token=localStorage.getItem('tte_token');
 const base=(import.meta as any).env.DEV?'https://ttecrm.vercel.app':'';
 const response=await fetch(`${base}/api/attendance${action==='snapshot'?`?month=${encodeURIComponent(String(data.month||''))}`:''}`,{method:action==='snapshot'?'GET':'POST',headers:{Authorization:`Bearer ${token||''}`,'Content-Type':'application/json'},...(action!=='snapshot'?{body:JSON.stringify({...data,action})}:{}),cache:'no-store'});
 const body=await response.json().catch(()=>({error:'Attendance is temporarily unavailable.'}));
 if(!response.ok) throw new Error(body.error||'Could not complete the attendance request.');
 return body;
}
