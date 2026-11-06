import React from 'react';
interface RadialGaugeProps { value:number; label:string; subtext?:string; colorFrom?:string; colorTo?:string; onClick?:()=>void; }
export const RadialGauge: React.FC<RadialGaugeProps> = ({value,label,subtext,onClick}) => {
  const percent = Number.isFinite(value) ? Math.max(0,Math.min(100,value)) : 0;
  const circumference = 2*Math.PI*25;
  return <div className="crm-kpi" onClick={onClick} role={onClick?'button':undefined} tabIndex={onClick?0:undefined}
    onKeyDown={event=>{if(onClick && (event.key==='Enter'||event.key===' ')){event.preventDefault();onClick();}}}>
    <div className="crm-kpi-title"><span>{label}</span><span className="text-xs">%</span></div>
    <div className="flex items-center justify-between gap-2"><h3 className="crm-kpi-value">{percent.toFixed(1)}%</h3>
      <svg width="56" height="56" viewBox="0 0 60 60" aria-hidden="true" className="shrink-0"><circle cx="30" cy="30" r="25" fill="none" stroke="var(--crm-border)" strokeWidth="5"/><circle cx="30" cy="30" r="25" fill="none" stroke="var(--crm-accent)" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${circumference*percent/100} ${circumference}`} transform="rotate(-90 30 30)"/></svg>
    </div>
    {subtext && <p className="crm-kpi-caption">{subtext}</p>}
  </div>;
};
