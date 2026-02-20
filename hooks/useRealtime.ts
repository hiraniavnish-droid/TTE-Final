
import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export const useRealtime = (tableName: string, callback: (payload: RealtimePostgresChangesPayload<any>) => void) => {
  // 1. Use a Ref to hold the latest callback function.
  // This is the "Crash-Proof" pattern: it allows the callback to access the latest state
  // WITHOUT forcing the subscription effect (below) to restart.
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    // 2. Static Channel Name. 
    // CRITICAL: Do NOT use Date.now() or random IDs here. 
    // Using a static name ensures we don't open 100s of channels if the component re-renders.
    const channelName = `realtime:${tableName}`; 

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName,
        },
        (payload) => {
          // 3. Call the Ref, not the prop directly.
          if (callbackRef.current) {
            callbackRef.current(payload);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR') {
          console.error(`Realtime connection error for ${tableName}:`, err);
        }
      });

    // 4. Strict Cleanup
    return () => {
      supabase.removeChannel(channel);
    };
    // 5. CRITICAL: Dependency array is strictly [tableName]. 
    // This effect will NEVER re-run when your state updates.
  }, [tableName]);
};
