
import React, { useRef } from 'react';
import Draggable from 'react-draggable';
import { Send } from 'lucide-react';
import { useLeads } from '../contexts/LeadContext';
import { cn } from '../utils/helpers';

export const DraggableFab = () => {
  const { setAddLeadModalOpen } = useLeads();
  const nodeRef = useRef(null); // Ref for the draggable node to avoid deprecated findDOMNode
  
  // Track start position to distinguish between a Drag and a Click
  const startPos = useRef({ x: 0, y: 0 });

  const handleStart = (e: any, data: any) => {
    startPos.current = { x: data.x, y: data.y };
  };

  const handleStop = (e: any, data: any) => {
    // Calculate distance moved
    const distance = Math.sqrt(
      Math.pow(data.x - startPos.current.x, 2) + 
      Math.pow(data.y - startPos.current.y, 2)
    );

    // If moved less than 5 pixels, consider it a click and open modal
    if (distance < 5) {
      setAddLeadModalOpen(true);
    }
  };

  return (
    <Draggable
      nodeRef={nodeRef}
      onStart={handleStart}
      onStop={handleStop}
      // bounds="body" // Optional: Keep within screen
    >
      <div 
        ref={nodeRef} 
        className="fixed bottom-10 right-10 z-[9999] group cursor-move touch-none"
        style={{ touchAction: 'none' }} // Prevents scrolling on mobile while dragging
      >
        {/* Desktop Tooltip (Left Side) */}
        <div className="hidden md:block absolute right-full mr-4 top-1/2 -translate-y-1/2 bg-black text-white text-xs px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap font-medium pointer-events-none shadow-lg">
          New Lead
          {/* Tooltip Arrow */}
          <div className="absolute top-1/2 right-[-4px] -translate-y-1/2 w-2 h-2 bg-black rotate-45"></div>
        </div>

        {/* The Button */}
        <div
          className={cn(
            "w-14 h-14 rounded-full bg-slate-900 text-white shadow-2xl shadow-slate-900/40",
            "flex items-center justify-center transition-transform active:scale-95 hover:scale-105",
            "border border-white/10 ring-1 ring-black/5"
          )}
        >
          <Send size={24} className="-ml-0.5 mt-0.5 text-white" />
        </div>
      </div>
    </Draggable>
  );
};
