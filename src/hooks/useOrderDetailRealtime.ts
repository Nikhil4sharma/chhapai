import { useEffect, useRef, useState, useCallback } from 'react';
import { useOrderRealtime } from './useOrderRealtime';
import { useOrderTimelineRealtime } from './useOrderTimelineRealtime';
import { useOrderItemsRealtime } from './useOrderItemsRealtime';
import { useOrderFilesRealtime } from './useOrderFilesRealtime';
import { Order, OrderItem, TimelineEntry, OrderFile } from '@/types/order';

interface UseOrderDetailRealtimeOptions {
  orderId: string;
  onOrderUpdate?: (updates: Partial<Order>) => void;
  onItemUpdate?: (updates: Partial<OrderItem>) => void;
  onItemInsert?: (item: OrderItem) => void;
  onItemDelete?: (itemId: string) => void;
  onTimelineEntry?: (entry: TimelineEntry) => void;
  onFileInsert?: (file: OrderFile) => void;
  onFileDelete?: (fileId: string) => void;
  onOrderDelete?: () => void;
  onForceRefresh?: () => void;
  enabled?: boolean;
}

/**
 * Comprehensive real-time hook for Order Detail page
 * Manages all subscriptions (orders, items, timeline, files)
 * Handles tab visibility and background refresh fallback
 */
export function useOrderDetailRealtime({
  orderId,
  onOrderUpdate,
  onItemUpdate,
  onItemInsert,
  onItemDelete,
  onTimelineEntry,
  onFileInsert,
  onFileDelete,
  onOrderDelete,
  onForceRefresh,
  enabled = true,
}: UseOrderDetailRealtimeOptions) {
  const [isTabVisible, setIsTabVisible] = useState(true);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const lastSyncRef = useRef<Date>(new Date());
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const forceRefreshCallbackRef = useRef<(() => void) | null>(null);

  // Track real-time connection status
  const orderRealtime = useOrderRealtime({
    orderId,
    onUpdate: onOrderUpdate,
    onDelete: onOrderDelete,
    enabled: enabled && isTabVisible,
  });

  const timelineRealtime = useOrderTimelineRealtime({
    orderId,
    onNewEntry: onTimelineEntry,
    enabled: enabled && isTabVisible,
  });

  const itemsRealtime = useOrderItemsRealtime({
    orderId,
    onUpdate: onItemUpdate,
    onInsert: onItemInsert,
    onDelete: onItemDelete,
    enabled: enabled && isTabVisible,
  });

  // Subscribe to files for all items in the order
  const filesRealtime = useOrderFilesRealtime({
    orderId,
    onInsert: onFileInsert,
    onDelete: onFileDelete,
    enabled: enabled && isTabVisible,
  });

  // Update real-time connection status
  useEffect(() => {
    const allConnected = 
      orderRealtime.isConnected &&
      timelineRealtime.isConnected &&
      itemsRealtime.isConnected &&
      filesRealtime.isConnected;
    
    setRealtimeConnected(allConnected);
  }, [
    orderRealtime.isConnected,
    timelineRealtime.isConnected,
    itemsRealtime.isConnected,
    filesRealtime.isConnected,
  ]);

  // Handle tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      setIsTabVisible(isVisible);

      if (isVisible) {
        // Tab became visible - force a silent sync
        console.log('[useOrderDetailRealtime] Tab became visible, forcing sync');
        if (forceRefreshCallbackRef.current) {
          forceRefreshCallbackRef.current();
        } else if (onForceRefresh) {
          onForceRefresh();
        }
        lastSyncRef.current = new Date();
      } else {
        // Tab hidden - clear any pending refresh
        if (refreshTimerRef.current) {
          clearTimeout(refreshTimerRef.current);
          refreshTimerRef.current = null;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Background refresh fallback (only if realtime disconnected or tab was inactive)
  useEffect(() => {
    if (!enabled || !orderId) {
      return;
    }

    // Only use polling if realtime is disconnected
    if (realtimeConnected && isTabVisible) {
      // Clear any pending refresh if realtime is connected
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      return;
    }

    // Set up background refresh (300ms debounced)
    const scheduleRefresh = () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }

      refreshTimerRef.current = setTimeout(() => {
        if (isTabVisible) {
          console.log('[useOrderDetailRealtime] Background refresh triggered');
          if (forceRefreshCallbackRef.current) {
            forceRefreshCallbackRef.current();
          } else if (onForceRefresh) {
            onForceRefresh();
          }
          lastSyncRef.current = new Date();
        }
        scheduleRefresh(); // Schedule next refresh
      }, 300);
    };

    scheduleRefresh();

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [enabled, orderId, realtimeConnected, isTabVisible, onForceRefresh]);

  // Expose function to set the force refresh callback
  const setForceRefreshCallback = useCallback((callback: () => void) => {
    forceRefreshCallbackRef.current = callback;
  }, []);

  return {
    isConnected: realtimeConnected,
    isTabVisible,
    lastSync: lastSyncRef.current,
    setForceRefreshCallback, // Expose setter for force refresh
    // Individual connection statuses for debugging
    connections: {
      order: orderRealtime.isConnected,
      timeline: timelineRealtime.isConnected,
      items: itemsRealtime.isConnected,
      files: filesRealtime.isConnected,
    },
  };
}

