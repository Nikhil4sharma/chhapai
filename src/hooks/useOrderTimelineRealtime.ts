import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { TimelineEntry } from '@/types/order';

interface UseOrderTimelineRealtimeOptions {
  orderId: string;
  onNewEntry?: (entry: TimelineEntry) => void;
  onUpdate?: (entry: TimelineEntry) => void;
  enabled?: boolean;
}

/**
 * Real-time subscription hook for order timeline/activity logs
 * Subscribes to timeline and order_activity_logs tables
 */
export function useOrderTimelineRealtime({
  orderId,
  onNewEntry,
  onUpdate,
  enabled = true,
}: UseOrderTimelineRealtimeOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastUpdateRef = useRef<Date | null>(null);

  useEffect(() => {
    if (!enabled || !orderId) {
      return;
    }

    // Create channel for timeline updates
    const channel = supabase
      .channel(`order-timeline-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'timeline',
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          console.log('[useOrderTimelineRealtime] New timeline entry:', payload.new);
          
          lastUpdateRef.current = new Date();

          const newEntry = payload.new as any;
          const timelineEntry: TimelineEntry = {
            timeline_id: newEntry.id,
            order_id: newEntry.order_id,
            item_id: newEntry.item_id || undefined,
            stage: newEntry.stage as any,
            substage: newEntry.substage || undefined,
            action: newEntry.action as any,
            performed_by: newEntry.performed_by,
            performed_by_name: newEntry.performed_by_name || 'Unknown',
            notes: newEntry.notes || '',
            attachments: newEntry.attachments || [],
            is_public: newEntry.is_public !== false,
            created_at: newEntry.created_at,
          };

          onNewEntry?.(timelineEntry);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_activity_logs',
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          console.log('[useOrderTimelineRealtime] New activity log:', payload.new);
          
          lastUpdateRef.current = new Date();

          const newLog = payload.new as any;
          
          // Fetch user name from profile if created_by is available
          // Note: In realtime, we can't easily fetch profile, so we'll use a fallback
          // The actual name will be fetched when timeline is refreshed
          const timelineEntry: TimelineEntry = {
            timeline_id: newLog.id,
            order_id: newLog.order_id,
            item_id: newLog.item_id || undefined,
            stage: newLog.department as any,
            action: newLog.action as any,
            performed_by: newLog.created_by,
            performed_by_name: newLog.created_by_name || newLog.created_by || 'Unknown',
            notes: newLog.message || '',
            attachments: [],
            is_public: true,
            created_at: newLog.created_at,
          };

          onNewEntry?.(timelineEntry);
        }
      )
      .subscribe((status) => {
        console.log('[useOrderTimelineRealtime] Subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      console.log('[useOrderTimelineRealtime] Cleaning up subscription');
      channel.unsubscribe();
      channelRef.current = null;
      setIsConnected(false);
    };
  }, [orderId, enabled, onNewEntry, onUpdate]);

  return {
    isConnected,
    lastUpdate: lastUpdateRef.current,
  };
}

