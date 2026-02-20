
import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../utils/helpers';
import { Check, ArrowRight, RotateCcw } from 'lucide-react';
import { LeadStatus } from '../types';

interface WorkflowStepperProps {
  currentStatus: LeadStatus;
  onStepClick: (status: LeadStatus, stepName: string, isRevert: boolean) => void;
}

const WORKFLOW_STEPS: { label: string; status: LeadStatus }[] = [
  { label: 'Requirements Taken', status: 'Contacted' },
  { label: 'Quote Shared', status: 'Proposal Sent' },
  { label: 'Discussion', status: 'Discussion' },
  { label: 'Token Received', status: 'Won' },
];

export const WorkflowStepper: React.FC<WorkflowStepperProps> = ({ currentStatus, onStepClick }) => {
  const { theme, getTextColor, getSecondaryTextColor } = useTheme();

  // Helper to determine the index of the current status
  const getCurrentStepIndex = () => {
    // If New, we are at index -1 (before first step)
    if (currentStatus === 'New') return -1;
    if (currentStatus === 'Lost') return -2; // Special case
    
    return WORKFLOW_STEPS.findIndex(step => step.status === currentStatus);
  };

  const currentIndex = getCurrentStepIndex();

  return (
    <div className="w-full overflow-x-auto pb-4 no-scrollbar">
      <div className="flex items-center min-w-[600px] px-2">
        {WORKFLOW_STEPS.map((step, index) => {
          const isCompleted = index <= currentIndex;
          const isCurrent = index === currentIndex;
          
          // Revert logic is handled by parent, but we flag it if clicking an already completed step
          const isRevertAction = isCompleted; 

          return (
            <div key={step.status} className="flex-1 flex items-center relative group">
              
              {/* Step Circle & Label */}
              <button
                onClick={() => onStepClick(step.status, step.label, isRevertAction)}
                className="flex items-center gap-3 relative z-10 focus:outline-none group/btn text-left"
              >
                {/* The Circle */}
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 border-2 shrink-0 relative overflow-hidden",
                  isCompleted && !isCurrent 
                    ? "bg-emerald-500 border-emerald-500 text-white group-hover/btn:bg-red-500 group-hover/btn:border-red-500" // Hover to red if reversible
                    : isCurrent 
                        ? "bg-blue-500 border-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)] animate-pulse group-hover/btn:bg-red-500 group-hover/btn:border-red-500 group-hover/btn:animate-none" // Hover to red to undo
                        : theme === 'light' 
                            ? "bg-white border-slate-300 text-slate-300" 
                            : "bg-white/5 border-white/20 text-white/20" // Future
                )}>
                  {/* Icon Switching Logic */}
                  {isCompleted ? (
                      <>
                        <Check size={14} strokeWidth={3} className="group-hover/btn:hidden" />
                        <RotateCcw size={14} strokeWidth={3} className="hidden group-hover/btn:block" />
                      </>
                  ) : (
                      <span className="text-xs font-bold">{index + 1}</span>
                  )}
                </div>

                {/* The Text */}
                <div className="">
                  <p className={cn(
                    "text-xs font-bold uppercase tracking-wider transition-colors",
                    isCurrent ? "text-blue-500" : (isCompleted ? "text-emerald-500" : getSecondaryTextColor())
                  )}>
                    Step {index + 1}
                  </p>
                  <p className={cn(
                    "text-sm font-semibold whitespace-nowrap transition-colors",
                    isCurrent ? getTextColor() : (isCompleted ? getTextColor() : "opacity-50")
                  )}>
                    {step.label}
                  </p>
                </div>
              </button>

              {/* Connecting Line (except after last item) */}
              {index < WORKFLOW_STEPS.length - 1 && (
                <div className={cn(
                  "h-0.5 flex-1 mx-4 transition-all duration-500",
                  index < currentIndex 
                    ? "bg-emerald-500" // Fully passed
                    : theme === 'light' ? "bg-slate-200" : "bg-white/10" // Future
                )} />
              )}
              
            </div>
          );
        })}
      </div>
    </div>
  );
};
