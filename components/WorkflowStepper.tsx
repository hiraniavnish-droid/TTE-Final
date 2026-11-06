import React from 'react';
import { Check, RotateCcw, XCircle, RefreshCw } from 'lucide-react';
import { cn } from '../utils/helpers';
import { LeadStatus } from '../types';
interface WorkflowStepperProps {currentStatus:LeadStatus;onStepClick:(status:LeadStatus,stepName:string,isRevert:boolean)=>void;}
const steps:{label:string;status:LeadStatus}[]=[
  {label:'Requirements Taken',status:'Contacted'},
  {label:'Quote Shared',status:'Proposal Sent'},
  {label:'Discussion',status:'Discussion'},
  {label:'Token Received',status:'Won'},
];
export const WorkflowStepper: React.FC<WorkflowStepperProps> = ({currentStatus,onStepClick}) => {
  const index=steps.findIndex(step=>step.status===currentStatus),lost=currentStatus==='Lost';
  return <div>
    {lost && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 mb-3 text-red-700"><span className="flex items-center gap-2 text-xs font-semibold"><XCircle size={16}/>Lead marked as lost</span><button type="button" onClick={()=>onStepClick('New','Reactivate',false)} className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold"><RefreshCw size={14}/>Reactivate</button></div>}
    <div className="crm-workflow" role="group" aria-label="Lead progress">
      {steps.map((step,i)=>{
        const completed=!lost&&i<=index,current=!lost&&i===index;
        return <button type="button" key={step.status} disabled={lost} aria-current={current?'step':undefined}
          aria-label={`${completed?'Undo step':'Move to'}: ${step.label}`}
          onClick={()=>onStepClick(step.status,step.label,completed)}
          className={cn('crm-workflow-step',completed&&'is-complete',current&&'is-current')}>
          <span className="crm-workflow-number">{completed?<Check size={15}/>:i+1}</span>
          <span><small>STEP {i+1}{completed && <span className="inline-flex items-center gap-1 ml-2"><RotateCcw size={10}/>Undo</span>}</small><strong>{step.label}</strong></span>
        </button>;
      })}
    </div>
  </div>;
};
