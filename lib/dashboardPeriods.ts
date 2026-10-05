export type DashboardPeriod = 'This Month' | 'Last Month' | 'All Time';
export const businessDate = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export const dateBoundary = (day: string, end = false) => new Date(`${day}T${end?'23:59:59.999':'00:00:00.000'}+05:30`);
export const validDateRange = (start:string,end:string) => /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && Number.isFinite(dateBoundary(start).getTime()) && Number.isFinite(dateBoundary(end).getTime()) && businessDate(dateBoundary(start))===start && businessDate(dateBoundary(end))===end && start<=end;
export function getPeriodRange(period:DashboardPeriod,ref=new Date()) {
 const [year,month,day]=businessDate(ref).split('-').map(Number);
 const monthDay=(offset:number,last=false)=>{const date=new Date(Date.UTC(year,month-1+offset+(last?1:0),last?0:1));return date.toISOString().slice(0,10)};
 if(period==='All Time')return {start:null,end:null,prevStart:null,prevEnd:null,label:''};
 if(period==='Last Month')return {start:dateBoundary(monthDay(-1)),end:dateBoundary(monthDay(-1,true),true),prevStart:dateBoundary(monthDay(-2)),prevEnd:dateBoundary(monthDay(-2,true),true),label:'the month before'};
 // Compare month-to-date with the same number of days last month, capped at its end.
 const prevLast=Number(monthDay(-1,true).slice(-2));
 return {start:dateBoundary(monthDay(0)),end:dateBoundary(businessDate(ref),true),prevStart:dateBoundary(monthDay(-1)),prevEnd:dateBoundary(monthDay(-1).slice(0,8)+String(Math.min(day,prevLast)).padStart(2,'0'),true),label:'last month, same period'};
}
