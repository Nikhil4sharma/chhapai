import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Order } from '@/types/order';

interface UseOrderRealtimeOptions {
  orderId: string;
  onUpdate?: (order: Partial<Order>) => void;
  onDelete?: () => void;
  enabled?: boolean;
}

/**
 * Real-time subscription hook for a single order
 * Subscribes to orders table changes for the specified order_id
 */
export function useOrderRealtime({
  orderId,
  onUpdate,
  onDelete,
  enabled = true,
}: UseOrderRealtimeOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastUpdateRef = useRef<Date | null>(null);

  useEffect(() => {
    if (!enabled || !orderId) {
      return;
    }

    // Create channel for this specific order
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          console.log('[useOrderRealtime] Order change detected:', payload.eventType, payload.new);
          
          lastUpdateRef.current = new Date();

          if (payload.eventType === 'DELETE') {
            onDelete?.();
            return;
          }

          if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedOrder = payload.new as any;
            onUpdate?.({
              id: updatedOrder.id,
              order_id: updatedOrder.order_id,
              priority_computed: updatedOrder.priority_computed as any,
              current_department: updatedOrder.current_department,
              delivery_date: updatedOrder.delivery_date ? new Date(updatedOrder.delivery_date) : null,
              global_notes: updatedOrder.global_notes,
              is_completed: updatedOrder.is_completed,
              updated_at: updatedOrder.updated_at,
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('[useOrderRealtime] Subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      console.log('[useOrderRealtime] Cleaning up subscription');
      channel.unsubscribe();
      channelRef.current = null;
      setIsConnected(false);
    };
  }, [orderId, enabled, onUpdate, onDelete]);

  return {
    isConnected,
    lastUpdate: lastUpdateRef.current,
  };
}

