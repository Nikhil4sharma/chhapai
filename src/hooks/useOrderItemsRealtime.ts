import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { OrderItem } from '@/types/order';

interface UseOrderItemsRealtimeOptions {
  orderId: string;
  onUpdate?: (item: Partial<OrderItem>) => void;
  onInsert?: (item: OrderItem) => void;
  onDelete?: (itemId: string) => void;
  enabled?: boolean;
}

/**
 * Real-time subscription hook for order items
 * Subscribes to order_items table changes for the specified order_id
 */
export function useOrderItemsRealtime({
  orderId,
  onUpdate,
  onInsert,
  onDelete,
  enabled = true,
}: UseOrderItemsRealtimeOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastUpdateRef = useRef<Date | null>(null);

  useEffect(() => {
    if (!enabled || !orderId) {
      return;
    }

    // Create channel for order items
    const channel = supabase
      .channel(`order-items-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_items',
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          console.log('[useOrderItemsRealtime] Order item change:', payload.eventType, payload.new);
          
          lastUpdateRef.current = new Date();

          if (payload.eventType === 'DELETE' && payload.old) {
            const deletedItem = payload.old as any;
            onDelete?.(deletedItem.id);
            return;
          }

          if (payload.eventType === 'INSERT' && payload.new) {
            const newItem = payload.new as any;
            // Transform to OrderItem format (simplified - full transform would need files)
            const orderItem: OrderItem = {
              item_id: newItem.id,
              order_id: newItem.order_id,
              product_name: newItem.product_name,
              quantity: newItem.quantity,
              current_stage: newItem.current_stage as any,
              current_substage: newItem.current_substage || undefined,
              assigned_department: newItem.assigned_department,
              assigned_to: newItem.assigned_to || undefined,
              delivery_date: newItem.delivery_date ? new Date(newItem.delivery_date) : null,
              priority_computed: newItem.priority_computed as any,
              files: [],
              specifications: newItem.specifications || {},
            };
            onInsert?.(orderItem);
            return;
          }

          if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedItem = payload.new as any;
            onUpdate?.({
              item_id: updatedItem.id,
              current_stage: updatedItem.current_stage as any,
              current_substage: updatedItem.current_substage || undefined,
              assigned_department: updatedItem.assigned_department,
              assigned_to: updatedItem.assigned_to || undefined,
              delivery_date: updatedItem.delivery_date ? new Date(updatedItem.delivery_date) : null,
              priority_computed: updatedItem.priority_computed as any,
              updated_at: updatedItem.updated_at,
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('[useOrderItemsRealtime] Subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      console.log('[useOrderItemsRealtime] Cleaning up subscription');
      channel.unsubscribe();
      channelRef.current = null;
      setIsConnected(false);
    };
  }, [orderId, enabled, onUpdate, onInsert, onDelete]);

  return {
    isConnected,
    lastUpdate: lastUpdateRef.current,
  };
}

