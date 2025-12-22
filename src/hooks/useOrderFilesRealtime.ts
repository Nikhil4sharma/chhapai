import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { OrderFile } from '@/types/order';

interface UseOrderFilesRealtimeOptions {
  orderId: string;
  itemId?: string;
  onInsert?: (file: OrderFile) => void;
  onDelete?: (fileId: string) => void;
  enabled?: boolean;
}

/**
 * Real-time subscription hook for order files
 * Subscribes to order_files table changes
 */
export function useOrderFilesRealtime({
  orderId,
  itemId,
  onInsert,
  onDelete,
  enabled = true,
}: UseOrderFilesRealtimeOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastUpdateRef = useRef<Date | null>(null);

  useEffect(() => {
    if (!enabled || !orderId) {
      return;
    }

    // Build filter - either by order_id or both order_id and item_id
    let filter = `order_id=eq.${orderId}`;
    if (itemId) {
      filter += `&item_id=eq.${itemId}`;
    }

    // Create channel for order files
    const channel = supabase
      .channel(`order-files-${orderId}-${itemId || 'all'}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_files',
          filter: filter,
        },
        (payload) => {
          console.log('[useOrderFilesRealtime] New file uploaded:', payload.new);
          
          lastUpdateRef.current = new Date();

          const newFile = payload.new as any;
          const orderFile: OrderFile = {
            file_id: newFile.id,
            file_name: newFile.file_name,
            url: newFile.url,
            type: newFile.type as any,
            uploaded_by: newFile.uploaded_by,
            uploaded_at: newFile.created_at,
          };

          onInsert?.(orderFile);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'order_files',
          filter: filter,
        },
        (payload) => {
          console.log('[useOrderFilesRealtime] File deleted:', payload.old);
          
          lastUpdateRef.current = new Date();

          const deletedFile = payload.old as any;
          onDelete?.(deletedFile.id);
        }
      )
      .subscribe((status) => {
        console.log('[useOrderTimelineRealtime] Subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      console.log('[useOrderFilesRealtime] Cleaning up subscription');
      channel.unsubscribe();
      channelRef.current = null;
      setIsConnected(false);
    };
  }, [orderId, itemId, enabled, onInsert, onDelete]);

  return {
    isConnected,
    lastUpdate: lastUpdateRef.current,
  };
}

