
import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../utils/helpers';
import { Check, RotateCcw, XCircle, RefreshCw } from 'lucide-react'; // XCircle used in Lost banner
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

  const isLost = currentStatus === 'Lost';

  return (
    <div className="w-full space-y-3">
      {/* Lost Banner */}
      {isLost && (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700">
          <div className="flex items-center gap-2">
            <XCircle size={15} className="shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider">Lead marked as Lost</span>
          </div>
          <button
            onClick={() => onStepClick('New', 'Reactivate', false)}
            className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-white border border-red-200 hover:bg-red-50 transition-colors"
          >
            <RefreshCw size={12} /> Reactivate
          </button>
        </div>
      )}

      <div className="w-full overflow-x-auto pb-2 no-scrollbar">
        <div className="flex items-center min-w-[600px] px-2">
          {WORKFLOW_STEPS.map((step, index) => {
            const isCompleted = !isLost && index <= currentIndex;
            const isCurrent = !isLost && index === currentIndex;
            const isRevertAction = isCompleted;

            return (
              <div key={step.status} className="flex-1 flex items-center relative group">

                {/* Step Circle & Label */}
                <button
                  onClick={() => onStepClick(step.status, step.label, isRevertAction)}
                  disabled={isLost}
                  className="flex items-center gap-3 relative z-10 focus:outline-none group/btn text-left disabled:cursor-not-allowed"
                >
                  {/* The Circle */}
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 border-2 shrink-0 relative overflow-hidden",
                    isLost
                      ? theme === 'light' ? "bg-white border-slate-200 text-slate-200" : "bg-white/5 border-white/10 text-white/10"
                      : isCompleted && !isCurrent
                        ? "bg-emerald-500 border-emerald-500 text-white group-hover/btn:bg-red-500 group-hover/btn:border-red-500"
                        : isCurrent
                            ? "bg-blue-500 border-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)] animate-pulse group-hover/btn:bg-red-500 group-hover/btn:border-red-500 group-hover/btn:animate-none"
                            : theme === 'light'
                                ? "bg-white border-slate-300 text-slate-300"
                                : "bg-white/5 border-white/20 text-white/20"
                  )}>
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
                  <div>
                    <p className={cn(
                      "text-xs font-bold uppercase tracking-wider transition-colors",
                      isLost ? "opacity-30" : isCurrent ? "text-blue-500" : (isCompleted ? "text-emerald-500" : getSecondaryTextColor())
                    )}>
                      Step {index + 1}
                    </p>
                    <p className={cn(
                      "text-sm font-semibold whitespace-nowrap transition-colors",
                      isLost ? "opacity-30" : isCurrent ? getTextColor() : (isCompleted ? getTextColor() : "opacity-50")
                    )}>
                      {step.label}
                    </p>
                  </div>
                </button>

                {/* Connecting Line */}
                {index < WORKFLOW_STEPS.length - 1 && (
                  <div className={cn(
                    "h-0.5 flex-1 mx-4 transition-all duration-500",
                    isLost ? (theme === 'light' ? "bg-slate-200" : "bg-white/10")
                      : index < currentIndex
                        ? "bg-emerald-500"
                        : theme === 'light' ? "bg-slate-200" : "bg-white/10"
                  )} />
                )}
              </div>
            );
          })}

        </div>
      </div>
    </div>
  );
};
