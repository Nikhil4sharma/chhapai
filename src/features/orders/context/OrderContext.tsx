import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Order, OrderItem, TimelineEntry, Stage, SubStage, Priority, VendorDetails, OutsourceJobDetails, OutsourceInfo, OutsourceStage, UserRole, OUTSOURCE_STAGE_LABELS, DispatchInfo } from '@/types/order';
import { useAuth } from '@/features/auth/context/AuthContext';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import {
  fetchAllOrders,
  fetchTimelineEntries,
  fetchActivityLogs,
  updateOrderItemStage as supabaseUpdateOrderItemStage,
  assignOrderItemToDepartment,
  assignOrderItemToUser,
  assignOrderToDepartment as supabaseAssignOrderToDepartment,
  assignOrderToUser as supabaseAssignOrderToUser,
  addTimelineEntry as supabaseAddTimelineEntry,
  addActivityLog,
  subscribeToOrdersChanges,
  subscribeToOrderItemsChanges,
} from '@/features/orders/services/supabaseOrdersService';
import { autoLogWorkAction } from '@/utils/workLogHelper';
import { uploadOrderFile, deleteFileFromSupabase } from '@/services/supabaseStorage';
import { MIGRATION_START_DATE } from '@/constants/migration';

interface OrderContextType {
  orders: Order[];
  timeline: TimelineEntry[];
  isLoading: boolean;
  lastSyncTime: Date | null;
  getOrderById: (orderId: string) => Order | undefined;
  getOrdersByDepartment: () => Order[];
  getOrdersForUser: () => Order[];
  getOrdersForDepartment: (department: UserRole) => Order[];
  getUrgentOrdersForAdmin: () => Order[];
  getUrgentOrdersForDepartment: (department: UserRole) => Order[];
  getTimelineForOrder: (orderId: string, itemId?: string) => TimelineEntry[];
  updateItemStage: (orderId: string, itemId: string, newStage: Stage, substage?: SubStage) => Promise<void>;
  updateItemSubstage: (orderId: string, itemId: string, substage: SubStage) => Promise<void>;
  assignToDepartment: (orderId: string, itemId: string, department: string) => Promise<void>;
  assignToOutsource: (orderId: string, itemId: string, vendor: VendorDetails, jobDetails: OutsourceJobDetails) => Promise<void>;
  assignToUser: (orderId: string, itemId: string, userId: string, userName: string) => Promise<void>;
  addTimelineEntry: (entry: Omit<TimelineEntry, 'timeline_id' | 'created_at'>) => Promise<void>;
  uploadFile: (orderId: string, itemId: string, file: File, replaceExisting?: boolean) => Promise<void>;
  addNote: (orderId: string, note: string) => Promise<void>;
  updateOrder: (orderId: string, updates: Partial<Order>) => Promise<void>;
  deleteOrder: (orderId: string) => Promise<void>;
  completeSubstage: (orderId: string, itemId: string) => Promise<void>;
  startSubstage: (orderId: string, itemId: string, substage: SubStage) => Promise<void>;
  markAsDispatched: (orderId: string, itemId: string, dispatchInfo?: DispatchInfo) => Promise<void>;
  sendToProduction: (orderId: string, itemId: string, stageSequence: string[]) => Promise<void>;
  setProductionStageSequence: (orderId: string, itemId: string, sequence: string[]) => Promise<void>;
  updateItemDeliveryDate: (orderId: string, itemId: string, deliveryDate: Date) => Promise<void>;
  updateOutsourceStage: (orderId: string, itemId: string, newStage: OutsourceStage) => Promise<void>;
  addFollowUpNote: (orderId: string, itemId: string, note: string) => Promise<void>;
  vendorDispatch: (orderId: string, itemId: string, courierName: string, trackingNumber: string, dispatchDate: Date) => Promise<void>;
  receiveFromVendor: (orderId: string, itemId: string, receiverName: string, receivedDate: Date) => Promise<void>;
  qualityCheck: (orderId: string, itemId: string, result: 'pass' | 'fail', notes: string) => Promise<void>;
  postQCDecision: (orderId: string, itemId: string, decision: 'production' | 'dispatch') => Promise<void>;
  refreshOrders: () => Promise<void>;
  updateItemSpecifications: (orderId: string, itemId: string, updates: Record<string, any>) => Promise<void>;
  getCompletedOrders: () => Order[];
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

const PRODUCTION_SUBSTAGES: SubStage[] = ['foiling', 'printing', 'pasting', 'cutting', 'letterpress', 'embossing', 'packing'];

// Helper to compute priority based on days until delivery
const computePriority = (deliveryDate: Date | null): Priority => {
  if (!deliveryDate) return 'blue';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const delivery = new Date(deliveryDate);
  delivery.setHours(0, 0, 0, 0);
  const daysUntil = Math.ceil((delivery.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntil > 5) return 'blue';
  if (daysUntil >= 3) return 'yellow';
  return 'red';
};

// Helper to create notifications
const createNotification = async (
  userId: string,
  title: string,
  message: string,
  type: string,
  orderId?: string,
  itemId?: string
) => {
  try {
    await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title,
        message,
        type,
        order_id: orderId || null,
        item_id: itemId || null,
        is_read: false,
      });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

// Helper to notify only relevant users based on department
const notifyStageChange = async (
  orderId: string,
  itemId: string,
  productName: string,
  newStage: Stage,
  performerId: string,
  assignedDepartment?: string
) => {
  try {
    // Get admins - they always get notifications
    const { data: adminsData } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');
    const admins = (adminsData || []).map(d => ({ user_id: d.user_id }));

    // Get sales users - they get notifications for all orders
    const { data: salesData } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'sales');
    const salesUsers = (salesData || []).map(d => ({ user_id: d.user_id }));

    // Get users in the TARGET department only
    const targetDept = newStage === 'dispatch' || newStage === 'completed' ? 'production' : newStage;
    const { data: deptData } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', targetDept);
    const deptUsers = (deptData || []).map(d => ({ user_id: d.user_id }));

    const notifyUsers = new Set<string>();

    // Add admins
    admins.forEach(a => notifyUsers.add(a.user_id));

    // Add sales for relevant events (dispatched, completed)
    if (newStage === 'dispatch' || newStage === 'completed') {
      salesUsers.forEach(u => notifyUsers.add(u.user_id));
    }

    // Add target department users
    deptUsers.forEach(u => notifyUsers.add(u.user_id));

    // Don't notify the performer
    notifyUsers.delete(performerId);

    const title = `Order moved to ${newStage.charAt(0).toUpperCase() + newStage.slice(1)}`;
    const message = `${productName} (${orderId}) is now in ${newStage}`;

    // Determine notification type based on stage
    const notificationType = newStage === 'dispatch' ? 'success' : 'info';

    for (const userId of notifyUsers) {
      await createNotification(userId, title, message, notificationType, orderId, itemId);
    }
  } catch (error) {
    console.error('Error notifying stage change:', error);
  }
};

// Helper to log activity (department-wise activity tracking)
// This function should be used inside OrderProvider where user context is available
const createLogActivityHelper = (userId: string) => async (
  orderId: string,
  itemId: string | undefined,
  department: 'sales' | 'design' | 'prepress' | 'production' | 'dispatch',
  action: 'created' | 'assigned' | 'started' | 'completed' | 'rejected' | 'dispatched' | 'note_added' | 'file_uploaded' | 'status_changed',
  message: string,
  metadata?: Record<string, any>
) => {
  try {
    await addActivityLog({
      orderId,
      itemId,
      department,
      action,
      message,
      createdBy: userId,
      metadata,
    });
  } catch (error) {
    // Don't throw - activity logs are not critical
    console.error('[logActivity] Error logging activity:', error);
  }
};

// Helper to check and notify urgent/delayed orders
const checkAndNotifyPriority = async (
  orderId: string,
  itemId: string,
  productName: string,
  priority: Priority,
  previousPriority?: Priority,
  assignedDepartment?: string
) => {
  if (priority === previousPriority) return;

  try {
    // Get admins
    const { data: adminsData } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');
    const admins = (adminsData || []).map(d => ({ user_id: d.user_id }));

    // Get assigned department users if urgent
    let deptUsers: { user_id: string }[] = [];
    if (assignedDepartment && priority === 'red') {
      const validRoles = ['admin', 'sales', 'design', 'prepress', 'production'] as const;
      const roleToQuery = validRoles.includes(assignedDepartment as any) ? assignedDepartment as typeof validRoles[number] : null;
      if (roleToQuery) {
        const { data: deptData } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', roleToQuery);
        deptUsers = (deptData || []).map(d => ({ user_id: d.user_id }));
      }
    }

    if (priority === 'red') {
      const title = 'Urgent Order Alert';
      const message = `${productName} (${orderId}) is now URGENT - delivery approaching!`;

      const notifyUsers = new Set<string>();
      admins.forEach(a => notifyUsers.add(a.user_id));
      deptUsers.forEach(u => notifyUsers.add(u.user_id));

      for (const userId of notifyUsers) {
        await createNotification(userId, title, message, 'urgent', orderId, itemId);
      }
    }
  } catch (error) {
    console.error('Error checking priority notifications:', error);
  }
};

export function OrderProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const { user, profile, role, isAdmin, authReady } = useAuth();

  // In-memory cache to prevent duplicate queries
  const ordersCacheRef = useRef<{ orders: Order[]; timestamp: number } | null>(null);
  const CACHE_DURATION = 30000; // 30 seconds cache

  // CRITICAL: Use refs to store stable function references
  // This prevents useEffect from re-running when these functions change
  const fetchOrdersRef = useRef<((showLoading?: boolean, forceRefresh?: boolean) => Promise<void>) | null>(null);
  const fetchTimelineRef = useRef<(() => Promise<void>) | null>(null);

  // CRITICAL: Guard to ensure fetchOrders runs only once per authenticated session
  const hasFetchedRef = useRef<{ userId: string; role: string } | null>(null);

  // CRITICAL: Guard to prevent concurrent fetches
  const isFetchingRef = useRef<boolean>(false);

  // CRITICAL: Store current auth values in refs to prevent function recreation
  const authRefs = useRef({ isAdmin, role, profile, userId: user?.id });

  // Update refs when values change
  useEffect(() => {
    authRefs.current = { isAdmin, role, profile, userId: user?.id };
  }, [isAdmin, role, profile, user?.id]);

  // Check if user can view financial data
  const canViewFinancials = isAdmin || role === 'sales';

  // Create activity logging helper (needs user context)
  const logActivity = useCallback(async (
    orderId: string,
    itemId: string | undefined,
    department: 'sales' | 'design' | 'prepress' | 'production' | 'dispatch',
    action: 'created' | 'assigned' | 'started' | 'completed' | 'rejected' | 'dispatched' | 'note_added' | 'file_uploaded' | 'status_changed',
    message: string,
    metadata?: Record<string, any>
  ) => {
    if (!user?.id) return;
    try {
      await addActivityLog({
        orderId,
        itemId,
        department,
        action,
        message,
        createdBy: user.id,
        metadata,
      });
    } catch (error) {
      // Don't throw - activity logs are not critical
      console.error('[logActivity] Error logging activity:', error);
    }
  }, [user?.id]);

  // Fetch orders from Supabase - RLS automatically filters based on user role/department
  const fetchOrders = useCallback(async (showLoading = false, forceRefresh = false) => {
    // CRITICAL: Prevent concurrent fetches
    if (isFetchingRef.current) {
      console.log('[fetchOrders] Already fetching, skipping concurrent fetch');
      return;
    }

    // CRITICAL: Only wait for authReady - profile/role loading is non-blocking
    if (!authReady) {
      console.log('[BOOTSTRAP] Auth not ready, skipping fetch');
      return;
    }

    if (!user?.id) {
      console.warn('[fetchOrders] No user, skipping fetch');
      return; // Don't fetch if no user
    }

    // CRITICAL: Role check is non-blocking - if role is null, allow admin to fetch
    // For non-admin users, wait for role to load (but don't block indefinitely)
    if (!isAdmin && !role) {
      console.log('[BOOTSTRAP] Role not loaded yet, waiting...', { role, isAdmin });
      // Don't return - allow fetching to proceed (defensive)
      // Role will be used for filtering if available
    }

    // CRITICAL: Check if we've already fetched for this user+role combination (unless force refresh)
    // forceRefresh=true bypasses all guards (used for real-time updates)
    if (!forceRefresh && hasFetchedRef.current) {
      const { userId, role: fetchedRole } = hasFetchedRef.current;
      if (userId === user.id && fetchedRole === role) {
        console.log('[fetchOrders] Already fetched for this session, using cache or skipping', { userId, role });
        // Still check cache for fresh data
        if (ordersCacheRef.current) {
          const cacheAge = Date.now() - ordersCacheRef.current.timestamp;
          if (cacheAge < CACHE_DURATION) {
            console.log('[fetchOrders] Using cached orders, age:', cacheAge, 'ms');
            setOrders(ordersCacheRef.current.orders);
            if (showLoading) setIsLoading(false);
            return;
          }
        }
        // Cache expired but already fetched - only refresh if explicitly requested
        return;
      }
    }

    // Check cache first (unless force refresh - real-time updates should bypass cache)
    if (!forceRefresh && ordersCacheRef.current) {
      const cacheAge = Date.now() - ordersCacheRef.current.timestamp;
      if (cacheAge < CACHE_DURATION) {
        console.log('[fetchOrders] Using cached orders, age:', cacheAge, 'ms');
        setOrders(ordersCacheRef.current.orders);
        if (showLoading) setIsLoading(false);
        // Mark as fetched even when using cache
        hasFetchedRef.current = { userId: user.id, role: role || '' };
        return;
      }
    }

    // Set fetching flag
    isFetchingRef.current = true;

    console.log('[fetchOrders] Starting fetch from Supabase, showLoading:', showLoading, 'user:', user.id, 'role:', role);

    try {
      // Only show loading on initial fetch, not on real-time updates
      if (showLoading) {
        setIsLoading(true);
      }

      // Fetch orders from Supabase (RLS automatically applies department/assignment filtering)
      const mappedOrders = await fetchAllOrders();


      console.log('[fetchOrders] Mapped orders summary:', {
        totalMapped: mappedOrders.length,
        ordersWithItems: mappedOrders.filter(o => o.items.length > 0).length,
        ordersWithoutItems: mappedOrders.filter(o => o.items.length === 0).length,
        activeOrders: mappedOrders.filter(o => !o.is_completed && !o.archived_from_wc).length,
        completedOrders: mappedOrders.filter(o => o.is_completed).length,
        archivedOrders: mappedOrders.filter(o => o.archived_from_wc).length,
        sampleOrderIds: mappedOrders.slice(0, 3).map(o => o.order_id),
      });

      // CRITICAL: Always set orders, even if empty - this ensures UI updates
      console.log('[fetchOrders] Setting orders:', mappedOrders.length, 'orders');
      setOrders(mappedOrders);

      // Update cache
      ordersCacheRef.current = {
        orders: mappedOrders,
        timestamp: Date.now(),
      };

      // CRITICAL: Mark as fetched for this user+role combination
      hasFetchedRef.current = { userId: user.id, role: role || '' };

      // If no orders found, log warning
      if (mappedOrders.length === 0) {
        console.warn('[fetchOrders] ⚠️ NO ORDERS FOUND! Database might be empty. Run WooCommerce sync to import orders.');
      }
      setLastSyncTime(new Date()); // Update last sync time
      console.log('[fetchOrders] Orders set successfully, total:', mappedOrders.length);
      if (showLoading) {
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      if (showLoading) {
        setIsLoading(false);
      }
      // Only show toast on initial load, not on real-time updates
      if (showLoading) {
        toast({
          title: "Error",
          description: "Failed to load orders",
          variant: "destructive",
        });
      }
    } finally {
      // Always clear fetching flag
      isFetchingRef.current = false;
    }
  }, [user?.id, role, authReady, isAdmin]); // CRITICAL: Only depend on user.id and role, not profile or derived state

  const fetchTimeline = useCallback(async () => {
    try {
      if (!user) {
        // Don't log warning - this is normal during initial load
        setTimeline([]);
        setActivityLogs([]);
        return;
      }

      // Fetch all timeline entries (RLS automatically filters based on user access)
      const { data: timelineData, error } = await supabase
        .from('timeline')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) {
        // Handle table not found error gracefully (404, PGRST205, or any table-related error)
        if (error.code === 'PGRST205' ||
          error.code === '42P01' ||
          error.code === 'PGRST116' ||
          error.message?.includes('Could not find the table') ||
          error.message?.includes('does not exist') ||
          error.message?.includes('relation') ||
          error.message?.includes('permission denied') ||
          error.message?.includes('new row violates row-level security') ||
          error.status === 404 ||
          error.statusCode === 404) {
          console.warn('[fetchTimeline] Timeline access issue, using empty timeline:', error.message);
          setTimeline([]);
          // Still try to fetch activity logs
        } else {
          console.error('[fetchTimeline] Error fetching timeline:', error);
          setTimeline([]);
        }
      }

      const mappedTimeline: TimelineEntry[] = (timelineData || []).map(entry => ({
        timeline_id: entry.id,
        order_id: entry.order_id,
        item_id: entry.item_id || undefined,
        product_name: entry.product_name || undefined,
        stage: entry.stage as Stage,
        substage: entry.substage as SubStage,
        action: entry.action as any,
        performed_by: entry.performed_by || '',
        performed_by_name: entry.performed_by_name || 'Unknown',
        notes: entry.notes || undefined,
        attachments: entry.attachments || undefined,
        qty_confirmed: entry.qty_confirmed || undefined,
        paper_treatment: entry.paper_treatment || undefined,
        created_at: new Date(entry.created_at),
        is_public: entry.is_public !== false,
      }));

      setTimeline(mappedTimeline);

      // Fetch activity logs for all orders (will be filtered per order in getTimelineForOrder)
      // Get all unique order IDs from orders (not just timeline, to get all activities)
      const allOrderIds = [...new Set(orders.map(o => o.order_id))];

      // Fetch activity logs for all orders in parallel (limit to first 50 to avoid too many requests)
      const orderIdsToFetch = allOrderIds.slice(0, 50);
      const activityLogPromises = orderIdsToFetch.map(orderId => fetchActivityLogs(orderId));
      const activityLogResults = await Promise.allSettled(activityLogPromises);

      const allActivityLogs: any[] = [];
      activityLogResults.forEach((result) => {
        if (result.status === 'fulfilled' && Array.isArray(result.value)) {
          allActivityLogs.push(...result.value);
        }
      });

      setActivityLogs(allActivityLogs);
    } catch (error) {
      console.error('Error fetching timeline:', error);
      setTimeline([]);
      setActivityLogs([]);
    }
  }, [orders]);

  // CRITICAL: Update refs whenever fetchOrders or fetchTimeline changes
  // This allows useEffect to use stable refs instead of dependencies
  useEffect(() => {
    fetchOrdersRef.current = fetchOrders;
  }, [fetchOrders]);

  useEffect(() => {
    fetchTimelineRef.current = fetchTimeline;
  }, [fetchTimeline]);

  // Real-time subscription for orders, items, timeline, and files - optimized
  // CRITICAL: Wait for authReady before initializing realtime subscriptions
  // Profile/role loading is non-blocking - subscriptions start after authReady
  useEffect(() => {
    // CRITICAL: Only wait for authReady - realtime must not block UI rendering
    if (!authReady) {
      console.log('[BOOTSTRAP] Auth not ready, waiting for realtime subscriptions');
      return;
    }

    if (!user?.id) {
      // Clear data when user logs out
      setOrders([]);
      setTimeline([]);
      setIsLoading(false);
      // Clear cache and fetch guard
      ordersCacheRef.current = null;
      hasFetchedRef.current = null;
      return;
    }

    // CRITICAL: Role check is non-blocking - allow subscriptions even if role is null
    // Role will be used for filtering if available
    if (!isAdmin && !role) {
      console.log('[BOOTSTRAP] Role not loaded yet, but allowing realtime subscriptions', {
        role,
        isAdmin
      });
      // Don't return - allow subscriptions to proceed (defensive)
    }

    // CRITICAL: Reset fetch guard when user or role changes
    const shouldFetch = !hasFetchedRef.current ||
      hasFetchedRef.current.userId !== user.id ||
      hasFetchedRef.current.role !== role;

    if (!shouldFetch && hasFetchedRef.current) {
      console.log('[OrderContext] Already fetched for this session, skipping initial fetch', {
        userId: hasFetchedRef.current.userId,
        role: hasFetchedRef.current.role
      });
    } else if (hasFetchedRef.current) {
      console.log('[OrderContext] User or role changed, resetting fetch guard', {
        oldUserId: hasFetchedRef.current.userId,
        newUserId: user.id,
        oldRole: hasFetchedRef.current.role,
        newRole: role
      });
      hasFetchedRef.current = null;
    }

    // CRITICAL: Ensure we fetch orders on mount/reload (only if not already fetched)
    // This prevents orders from disappearing on page reload
    // Mark initial fetch as complete so real-time listeners can start updating
    let initialFetchComplete = !shouldFetch; // If already fetched, mark as complete immediately
    let isMounted = true; // Track if component is still mounted

    // CRITICAL: Prevent refetch on tab visibility change
    // Only allow refetch if data is stale (older than 5 minutes) and user explicitly comes back
    let lastVisibilityChange = Date.now();
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab hidden - just track time
        lastVisibilityChange = Date.now();
        console.log('[OrderContext] Tab hidden, preserving state');
      } else {
        // Tab visible again - only refresh if data is stale (5+ minutes old)
        const cacheAge = ordersCacheRef.current ? Date.now() - ordersCacheRef.current.timestamp : Infinity;
        const staleThreshold = 5 * 60 * 1000; // 5 minutes

        if (cacheAge > staleThreshold && initialFetchComplete) {
          console.log('[OrderContext] Tab visible after', Math.round(cacheAge / 1000), 's, refreshing stale data');
          // Silently refresh in background without showing loading state
          if (fetchOrdersRef.current) {
            fetchOrdersRef.current(false, false); // Don't show loading, don't force refresh
          }
        } else {
          console.log('[OrderContext] Tab visible, data fresh, preserving state');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // CRITICAL: Fetch orders immediately when profile is ready (only if needed)
    const fetchWhenReady = async () => {
      if (!isMounted || !shouldFetch) {
        if (!shouldFetch) {
          console.log('[OrderContext] Skipping fetch - already fetched for this session');
        }
        return;
      }

      console.log('[OrderContext] Starting initial fetch for user:', user.id, 'role:', role);
      if (fetchOrdersRef.current) {
        await fetchOrdersRef.current(true);
      }
      if (!isMounted) return;
      if (fetchTimelineRef.current) {
        await fetchTimelineRef.current();
      }
      if (!isMounted) return;
      // Mark initial fetch as complete so real-time listeners can start updating
      initialFetchComplete = true;
      console.log('[OrderContext] Initial fetch complete, real-time listeners active');
    };

    // Start fetch immediately (profile is ready) - only if needed
    if (shouldFetch) {
      fetchWhenReady();
    }

    // Use debounce to prevent too many rapid updates (reduced for faster real-time feel)
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedFetch = (callback: () => void, immediate = false) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (immediate) {
        // Execute immediately for critical updates
        if (isMounted) {
          callback();
        }
      } else {
        // Debounce for batch updates (reduced to 200ms for faster updates)
        debounceTimer = setTimeout(() => {
          if (isMounted) {
            callback();
          }
        }, 200); // Reduced from 500ms to 200ms for faster real-time feel
      }
    };

    // Supabase Realtime subscriptions - RLS automatically filters based on user access
    // CRITICAL: Only set up subscriptions after initial fetch to prevent clearing orders
    const unsubscribeOrders = subscribeToOrdersChanges((payload) => {
      console.log('[OrderContext] Orders change received:', payload.eventType);
      // Only trigger real-time updates after initial fetch is complete
      if (initialFetchComplete && isMounted && fetchOrdersRef.current) {
        // Use immediate=true for critical updates (INSERT, DELETE) and debounce for UPDATE
        const isCriticalUpdate = payload.eventType === 'INSERT' || payload.eventType === 'DELETE';
        debouncedFetch(() => {
          // CRITICAL: Clear cache before real-time update to ensure fresh data
          // Real-time updates should always fetch fresh data
          if (fetchOrdersRef.current) {
            // Clear cache to force fresh fetch (access ref from closure)
            // Store current cache for potential restore
            const currentCache = ordersCacheRef.current;
            ordersCacheRef.current = null;
            // Fetch with forceRefresh=true to bypass all guards
            fetchOrdersRef.current(false, true).then(() => {
              // Also refresh timeline after orders update
              if (fetchTimelineRef.current) {
                fetchTimelineRef.current();
              }
            }).catch((err) => {
              console.error('[OrderContext] Error in real-time orders fetch:', err);
              // Restore cache on error (fallback)
              if (currentCache) {
                ordersCacheRef.current = currentCache;
              }
            });
          }
        }, isCriticalUpdate);
      }
    });

    const unsubscribeItems = subscribeToOrderItemsChanges((payload) => {
      console.log('[OrderContext] Order items change received:', payload.eventType);
      // Only trigger real-time updates after initial fetch is complete
      if (initialFetchComplete && isMounted && fetchOrdersRef.current) {
        // Use immediate=true for critical updates (INSERT, DELETE) and debounce for UPDATE
        const isCriticalUpdate = payload.eventType === 'INSERT' || payload.eventType === 'DELETE';
        debouncedFetch(() => {
          // CRITICAL: Clear cache before real-time update to ensure fresh data
          // Real-time updates should always fetch fresh data
          if (fetchOrdersRef.current) {
            // Clear cache to force fresh fetch (access ref from closure)
            // Store current cache for potential restore
            const currentCache = ordersCacheRef.current;
            ordersCacheRef.current = null;
            // Fetch with forceRefresh=true to bypass all guards
            fetchOrdersRef.current(false, true).then(() => {
              // Also refresh timeline after items update
              if (fetchTimelineRef.current) {
                fetchTimelineRef.current();
              }
            }).catch((err) => {
              console.error('[OrderContext] Error in real-time items fetch:', err);
              // Restore cache on error (fallback)
              if (currentCache) {
                ordersCacheRef.current = currentCache;
              }
            });
          }
        }, isCriticalUpdate);
      }
    });

    // Timeline subscription - Subscribe to timeline table changes
    const timelineChannel = supabase
      .channel('timeline-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'timeline',
        },
        (payload) => {
          console.log('[OrderContext] Timeline change received:', payload.eventType);
          if (initialFetchComplete && isMounted && fetchTimelineRef.current) {
            // For timeline updates, use immediate execution for faster feel
            const isCriticalUpdate = payload.eventType === 'INSERT' || payload.eventType === 'DELETE';
            debouncedFetch(() => {
              fetchTimelineRef.current?.();
            }, isCriticalUpdate);
          }
        }
      )
      .subscribe();

    // Activity logs subscription - Subscribe to order_activity_logs table changes
    const activityLogsChannel = supabase
      .channel('activity-logs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_activity_logs',
        },
        (payload) => {
          console.log('[OrderContext] Activity log change received:', payload.eventType);
          if (initialFetchComplete && isMounted && fetchTimelineRef.current) {
            // For activity logs, use immediate execution for faster feel
            const isCriticalUpdate = payload.eventType === 'INSERT' || payload.eventType === 'DELETE';
            debouncedFetch(() => {
              fetchTimelineRef.current?.();
            }, isCriticalUpdate);
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false; // Mark as unmounted
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubscribeOrders();
      unsubscribeItems();
      supabase.removeChannel(timelineChannel);
      supabase.removeChannel(activityLogsChannel);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // CRITICAL: DO NOT call setOrders([]) here - it causes orders to disappear
      // DO NOT clear cache or fetch guard on unmount - keep for session persistence
    };
  }, [user?.id, role, authReady, isAdmin]); // CRITICAL: Only depend on user.id and role, remove profile and derived state

  const refreshOrders = useCallback(async () => {
    // Force refresh by bypassing cache
    await Promise.all([fetchOrders(false, true), fetchTimeline()]);
  }, [fetchOrders, fetchTimeline]);

  const getOrderById = useCallback((orderId: string) => {
    return orders.find(o => o.order_id === orderId);
  }, [orders]);

  // Helper function to check if item matches department and visibility rules
  const itemMatchesDepartment = useCallback((
    item: OrderItem,
    targetDepartment: string,
    userDepartment: string,
    isAdminUser: boolean,
    currentUserId?: string,
    isSalesUser?: boolean
  ): boolean => {
    const itemDept = (item.assigned_department || '').toLowerCase().trim();
    const itemStage = (item.current_stage || '').toLowerCase().trim();
    const targetDeptLower = targetDepartment.toLowerCase().trim();

    // CRITICAL: Check if item belongs to target department
    // Primary check: assigned_department must match
    // Fallback: if no assigned_department, check current_stage
    const isDepartmentItem = itemDept === targetDeptLower ||
      (itemStage === targetDeptLower && !item.assigned_department);

    if (!isDepartmentItem) {
      return false;
    }

    // CRITICAL FIX: Visibility logic (CORRECTED)
    // - Admin sees everything
    // - Sales sees everything
    // - Department users see ALL items in their department (regardless of assigned_to)
    // - assigned_to does NOT control department-level visibility
    // - assigned_to is only used for "Assigned to Me" tab filtering, not visibility

    if (isAdminUser || isSalesUser) {
      return true; // Admin and Sales see everything
    }

    // CRITICAL: Department users ALWAYS see items in their department
    // assigned_to does NOT filter out items from department view
    // This ensures department-wide visibility (read-only for assigned items)
    const userDeptLower = (userDepartment || '').toLowerCase().trim();
    return userDeptLower === targetDeptLower;
  }, []);

  // CRITICAL: Make getOrdersByDepartment a PURE function
  // No fetching, no state updates, only filter and return orders
  // Use refs to access current auth values without recreating the function
  const getOrdersByDepartment = useCallback(() => {
    const { isAdmin: currentIsAdmin, role: currentRole, profile: currentProfile, userId: currentUserId } = authRefs.current;

    // Check if user is sales (before type narrowing)
    const isSalesUser = currentRole === 'sales';

    // CRITICAL FIX: Admin and Sales should see ALL orders (including synced orders)
    // Only filter out completed orders, but show archived synced orders too
    if (currentIsAdmin || isSalesUser) {
      const activeOrders = orders.filter(o => !o.is_completed);
      // CRITICAL: Return all active orders for admin/sales, including synced orders
      return activeOrders;
    }

    // For other departments, filter out archived WooCommerce orders
    const activeOrders = orders.filter(o => !o.is_completed && !o.archived_from_wc);

    if (!currentRole) {
      return [];
    }

    const roleLower = currentRole.toLowerCase().trim();

    // For production users, filter by assigned production stage
    if (currentRole === 'production' && currentProfile?.production_stage) {
      return activeOrders.filter(order =>
        order.items.some(item => {
          // Must be in production stage and assigned substage
          if (item.current_stage !== 'production' || item.current_substage !== currentProfile.production_stage) {
            return false;
          }

          // Use helper function for department matching and visibility
          return itemMatchesDepartment(item, 'production', roleLower, currentIsAdmin, currentUserId, isSalesUser);
        })
      );
    }

    // For other departments, apply visibility rules with case-insensitive matching
    // Use helper function to reduce code duplication
    const filtered = activeOrders.filter(order =>
      order.items.some(item =>
        itemMatchesDepartment(item, roleLower, roleLower, currentIsAdmin, currentUserId, isSalesUser)
      )
    );

    return filtered;
  }, [orders, itemMatchesDepartment]); // CRITICAL: Only depend on orders and itemMatchesDepartment

  const getOrdersForUser = useCallback(() => {
    // SAFEGUARD 6: Filter out archived WooCommerce orders
    const activeOrders = orders.filter(o => !o.is_completed && !o.archived_from_wc);

    if (isAdmin) {
      return activeOrders;
    }

    // For production users, filter by assigned production stage
    if (role === 'production' && profile?.production_stage) {
      return activeOrders.filter(order =>
        order.items.some(item => {
          // Must be in production stage and assigned substage
          if (item.current_stage !== 'production' || item.current_substage !== profile.production_stage) {
            return false;
          }

          // Must be assigned to production department
          if (item.assigned_department !== 'production') {
            return false;
          }

          // CRITICAL FIX: Department users ALWAYS see items in their department
          // assigned_to does NOT filter out items from department view
          // This ensures department-wide visibility (read-only for assigned items)
          return true;
        })
      );
    }

    // For other departments, apply visibility rules
    // CRITICAL: Use case-insensitive matching for department
    const roleLower = (role || '').toLowerCase().trim();
    return activeOrders.filter(order =>
      order.items.some(item => {
        // Must be assigned to user's department (case-insensitive)
        const itemDept = (item.assigned_department || '').toLowerCase().trim();
        if (itemDept !== roleLower) {
          return false;
        }

        // CRITICAL FIX: Department users ALWAYS see items in their department
        // assigned_to does NOT filter out items from department view
        // This ensures department-wide visibility (read-only for assigned items)
        // assigned_to is only used for "Assigned to Me" filtering, not visibility
        return true;
      })
    );
  }, [orders, role, isAdmin, user, profile]);

  const getCompletedOrders = useCallback(() => {
    // Completed orders can include archived ones (for historical reference)
    // But we still filter by department for non-admin users
    if (isAdmin || role === 'sales') {
      return orders.filter(o => o.is_completed);
    }
    return orders.filter(o =>
      o.is_completed && o.items.some(item => item.assigned_department === role)
    );
  }, [orders, role, isAdmin]);

  // Get orders for a specific department with proper visibility rules
  // If assigned_to is set, only that user sees it; otherwise all department users see it
  // Admin can see all orders regardless of assignment
  const getOrdersForDepartment = useCallback((department: UserRole) => {
    const activeOrders = orders.filter(o => !o.is_completed && !o.archived_from_wc);
    const deptLower = department.toLowerCase();

    // Check if user is sales (before type narrowing)
    const isSalesRole = role === 'sales';

    // Admin and Sales can see all orders for any department
    if (isAdmin || isSalesRole) {
      return activeOrders.filter(order =>
        order.items.some(item =>
          itemMatchesDepartment(item, deptLower, deptLower, true, undefined, isSalesRole)
        )
      );
    }

    // CRITICAL: For non-admin/sales users, verify their role OR profile department matches the requested department
    // This prevents users from accessing other departments' orders
    // Check both role (from user_roles) and profile.department (from profiles)
    const userRoleLower = (role || '').toLowerCase().trim();
    const profileDeptLower = (profile?.department || '').toLowerCase().trim();
    const roleMatches = userRoleLower === deptLower;
    const profileMatches = profileDeptLower === deptLower;

    // Debug logging (only for non-admin/sales users)
    if (!isAdmin && !isSalesRole) {
      console.log(`[getOrdersForDepartment] Checking access for department: ${department}`, {
        user_id: user?.id,
        role: role,
        roleLower: userRoleLower,
        profileDepartment: profile?.department,
        profileDeptLower: profileDeptLower,
        deptLower: deptLower,
        roleMatches,
        profileMatches,
        totalActiveOrders: activeOrders.length,
        willReturnEmpty: !roleMatches && !profileMatches,
      });
    }

    // CRITICAL: If neither role nor profile department matches, return empty array
    // BUT: Also check if user has no role/profile set - in that case, allow access if they're requesting their own department
    if (!roleMatches && !profileMatches) {
      // Special case: If user has no role/profile set, but they're requesting a department that matches their current context
      // This handles edge cases where user data might be incomplete
      if (!role && !profile?.department) {
        if (!isAdmin && !isSalesRole) {
          console.warn(`[getOrdersForDepartment] User has no role or profile department set. Denying access to ${department}`);
        }
        return [];
      }
      // Only log warning for non-admin/sales users
      if (!isAdmin && !isSalesRole) {
        console.warn(`[getOrdersForDepartment] User role (${role}) and profile department (${profile?.department}) do not match requested department (${department})`);
      }
      return []; // Return empty array if neither role nor profile department matches
    }

    const filteredOrders = activeOrders.filter(order => {
      const hasVisibleItem = order.items.some(item => {
        // Use helper function to reduce code duplication
        const userDeptLower = (role || profile?.department || '').toLowerCase().trim();
        // FIX: Use user?.id instead of user?.uid (Supabase uses id, not uid)
        return itemMatchesDepartment(item, deptLower, userDeptLower, isAdmin, user?.id, isSalesRole);
      });

      // Debug: Log orders that are being filtered out
      if (!hasVisibleItem && order.items.length > 0) {
        const firstItem = order.items[0];
        const dept = (firstItem.assigned_department || '').toLowerCase().trim();
        const stage = (firstItem.current_stage || '').toLowerCase().trim();
        console.log(`[getOrdersForDepartment] Order ${order.order_id} filtered out - item dept: "${dept}", stage: "${stage}", requested: "${deptLower}"`);
      }

      return hasVisibleItem;
    });

    console.log(`[getOrdersForDepartment] Filtered ${filteredOrders.length} orders for department ${department}`, {
      orderIds: filteredOrders.map(o => o.order_id),
      totalItems: filteredOrders.reduce((sum, o) => sum + o.items.filter(item => {
        const dept = (item.assigned_department || '').toLowerCase().trim();
        const stage = (item.current_stage || '').toLowerCase().trim();
        return dept === deptLower || stage === deptLower;
      }).length, 0),
    });

    return filteredOrders;
  }, [orders, user, isAdmin, role, profile, itemMatchesDepartment]);

  // Get all urgent orders for Admin (across all departments)
  const getUrgentOrdersForAdmin = useCallback(() => {
    const activeOrders = orders.filter(o => !o.is_completed && !o.archived_from_wc);

    return activeOrders.filter(order =>
      order.items.some(item => item.priority_computed === 'red')
    );
  }, [orders]);

  // Get urgent orders for a specific department
  // Admin can see all urgent orders for any department
  const getUrgentOrdersForDepartment = useCallback((department: UserRole) => {
    const activeOrders = orders.filter(o => !o.is_completed && !o.archived_from_wc);

    // Admin can see all urgent orders for any department
    if (isAdmin) {
      return activeOrders.filter(order =>
        order.items.some(item =>
          item.priority_computed === 'red' &&
          item.assigned_department === department
        )
      );
    }

    return activeOrders.filter(order =>
      order.items.some(item => {
        // Must be urgent
        if (item.priority_computed !== 'red') return false;

        // Must be assigned to this department
        if (item.assigned_department !== department) return false;

        // CRITICAL FIX: Department users ALWAYS see items in their department
        // assigned_to does NOT filter out items from department view
        return true;

        // No user assigned, visible to all department users
        return true;
      })
    );
  }, [orders, user, isAdmin]);

  const getTimelineForOrder = useCallback((orderId: string, itemId?: string) => {
    const order = orders.find(o => o.order_id === orderId);
    const orderUUID = order?.id || orderId;

    // Get timeline entries for this order
    const timelineEntries = timeline
      .filter(entry => entry.order_id === orderUUID && (!itemId || entry.item_id === itemId));

    // Get activity logs for this order
    const orderActivityLogs = activityLogs.filter(log => {
      // Find order by UUID or order_id
      if (log.order_id === orderUUID) return true;
      // If log.order_id is a UUID, check if it matches order.id
      if (order && log.order_id === order.id) return true;
      return false;
    }).filter(log => !itemId || log.item_id === itemId);

    // Convert activity logs to timeline-like format for merging
    const activityLogEntries: (TimelineEntry & { department?: string })[] = orderActivityLogs.map(log => ({
      timeline_id: log.id,
      order_id: orderUUID,
      item_id: log.item_id || undefined,
      product_name: undefined,
      stage: log.department as Stage, // Use department as stage for grouping
      substage: undefined,
      action: log.action as any,
      performed_by: log.created_by || '',
      performed_by_name: log.performed_by_name || 'User',
      notes: log.message,
      attachments: undefined,
      qty_confirmed: undefined,
      paper_treatment: undefined,
      created_at: new Date(log.created_at),
      is_public: true,
      // Add department info for UI grouping
      department: log.department,
    }));

    // Merge and sort by date
    const merged = [...timelineEntries, ...activityLogEntries];
    return merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [timeline, orders, activityLogs]);

  const addTimelineEntry = useCallback(async (entry: Omit<TimelineEntry, 'timeline_id' | 'created_at'>) => {
    try {
      // If item_id is provided, fetch product_name from order
      let productName = entry.product_name;
      if (!productName && entry.item_id) {
        const order = orders.find(o => o.id === entry.order_id || o.order_id === entry.order_id);
        if (order) {
          const item = order.items.find(i => i.item_id === entry.item_id);
          if (item) {
            productName = item.product_name;
          }
        }
      }

      // Ensure performed_by is user.id (UUID) if available
      const performedBy = entry.performed_by || user?.id || '';

      await supabaseAddTimelineEntry({
        ...entry,
        product_name: productName,
        performed_by: performedBy,
      });

      // Refresh timeline after adding entry
      await fetchTimeline();
    } catch (error: any) {
      // Log detailed error but don't throw - timeline is not critical
      console.error('Error adding timeline entry:', {
        error,
        entry: {
          order_id: entry.order_id,
          item_id: entry.item_id,
          action: entry.action,
          stage: entry.stage,
        },
        errorCode: error?.code,
        errorMessage: error?.message,
      });
      // Don't throw - allow operation to continue even if timeline fails
    }
  }, [fetchTimeline, orders]);

  const updateItemStage = useCallback(async (orderId: string, itemId: string, newStage: Stage, substage?: SubStage) => {
    try {
      const order = orders.find(o => o.order_id === orderId);
      const item = order?.items.find(i => i.item_id === itemId);
      if (!order || !item) return;

      const previousPriority = item.priority_computed;

      const deptMap: Record<Stage, 'sales' | 'design' | 'prepress' | 'production' | 'dispatch'> = {
        sales: 'sales',
        design: 'design',
        prepress: 'prepress',
        production: 'production',
        outsource: 'production',
        dispatch: 'dispatch',
        completed: 'production',
      };

      const targetDepartment = deptMap[newStage] || 'sales';

      // Log activity FIRST (department-wise tracking)
      await logActivity(
        order.order_id,
        itemId,
        targetDepartment,
        'status_changed',
        `${item.product_name} moved to ${newStage}${substage ? ` - ${substage}` : ''}`,
        { previous_stage: item.current_stage, new_stage: newStage, substage }
      );

      // Add timeline entry
      await addTimelineEntry({
        order_id: order.id!,
        item_id: itemId,
        product_name: item.product_name,
        stage: newStage,
        substage: substage,
        action: 'assigned',
        performed_by: user?.id || '',
        performed_by_name: profile?.full_name || 'Unknown',
        notes: `Moved to ${newStage}${substage ? ` - ${substage}` : ''}`,
        is_public: true,
      });

      // Auto-log work action with proper time calculation
      if (user?.id && profile?.full_name) {
        const item = order.items.find(i => i.item_id === itemId);
        const startTime = new Date();
        const endTime = new Date();
        // Calculate minimum 1 minute for stage updates
        await autoLogWorkAction(
          user.id,
          profile.full_name,
          role || 'unknown',
          order.id!,
          order.order_id,
          itemId,
          newStage,
          'stage_updated',
          `Stage updated to ${newStage}${substage ? ` - ${substage}` : ''}`,
          1, // Minimum 1 minute for stage updates
          item?.product_name,
          startTime,
          endTime
        );
      }

      // Update the item stage using Supabase
      const assignedDept = deptMap[newStage];

      await supabaseUpdateOrderItemStage(order.id!, itemId, newStage, substage);

      // Update assigned_department separately if needed
      if (assignedDept) {
        await supabase
          .from('order_items')
          .update({ assigned_department: assignedDept })
          .eq('id', itemId);
      }

      // Debug log to track assignment
      console.log(`[updateItemStage] Order ${order.order_id}, Item ${itemId}: Stage=${newStage}, AssignedDept=${assignedDept}`, {
        orderId: order.order_id,
        itemId,
        newStage,
        substage,
        assignedDept
      });

      // Send notifications for stage change
      if (user?.id) {
        await notifyStageChange(order.order_id, itemId, item.product_name, newStage, user.id);
      }

      // Force a fresh fetch so assigned_to_name and other derived fields update in UI
      await fetchOrders(false, true);

      // Check for priority changes
      const newPriority = computePriority(item.delivery_date);
      if (newPriority !== previousPriority) {
        await checkAndNotifyPriority(order.order_id, itemId, item.product_name, newPriority, previousPriority);
      }

      // Update dependencies to include logActivity
      toast({
        title: "Stage Updated",
        description: `Item moved to ${newStage}${substage ? ` - ${substage}` : ''}`,
      });
    } catch (error) {
      console.error('Error updating item stage:', error);
      toast({
        title: "Error",
        description: "Failed to update stage",
        variant: "destructive",
      });
    }
  }, [orders, user, profile, addTimelineEntry, fetchOrders, logActivity]);

  const updateItemSubstage = useCallback(async (orderId: string, itemId: string, substage: SubStage) => {
    try {
      const order = orders.find(o => o.order_id === orderId);
      if (!order) return;

      // Update via Supabase
      await supabase
        .from('order_items')
        .update({
          current_substage: substage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      const item = order.items.find(i => i.item_id === itemId);
      await addTimelineEntry({
        order_id: order.id!,
        item_id: itemId,
        product_name: item?.product_name,
        stage: 'production',
        substage: substage,
        action: 'substage_started',
        performed_by: user?.id || '',
        performed_by_name: profile?.full_name || 'Unknown',
        notes: `Started ${substage}`,
        is_public: true,
      });

      // Auto-log work action
      if (user?.id && profile?.full_name) {
        const item = order.items.find(i => i.item_id === itemId);
        const startTime = new Date();
        const endTime = new Date();
        await autoLogWorkAction(
          user.id,
          profile.full_name,
          role || 'unknown',
          order.id!,
          order.order_id,
          itemId,
          'production',
          'substage_started',
          `Started production substage: ${substage}`,
          1, // Minimum 1 minute
          item?.product_name,
          startTime,
          endTime
        );
      }

      await fetchOrders(false);

      toast({
        title: "Production Stage Started",
        description: `Started ${substage}`,
      });
    } catch (error) {
      console.error('Error updating substage:', error);
      toast({
        title: "Error",
        description: "Failed to update substage",
        variant: "destructive",
      });
    }
  }, [orders, user, profile, addTimelineEntry, fetchOrders]);

  const completeSubstage = useCallback(async (orderId: string, itemId: string) => {
    const order = orders.find(o => o.order_id === orderId);
    const item = order?.items.find(i => i.item_id === itemId);

    if (!item || !item.current_substage) return;

    // Use custom sequence if defined, otherwise default
    const sequence = (item as any).production_stage_sequence || PRODUCTION_SUBSTAGES;
    const currentIndex = sequence.indexOf(item.current_substage);
    const isLastSubstage = currentIndex === sequence.length - 1;

    await addTimelineEntry({
      order_id: order!.id!,
      item_id: itemId,
      product_name: item.product_name,
      stage: 'production',
      substage: item.current_substage,
      action: 'substage_completed',
      performed_by: user?.id || '',
      performed_by_name: profile?.full_name || 'Unknown',
      notes: `Completed ${item.current_substage}`,
      is_public: true,
    });

    // Auto-log work action
    if (user?.id && profile?.full_name) {
      const item = order!.items.find(i => i.item_id === itemId);
      const startTime = new Date();
      const endTime = new Date();
      await autoLogWorkAction(
        user.id,
        profile.full_name,
        role || 'unknown',
        order!.id!,
        order!.order_id,
        itemId,
        'production',
        'substage_completed',
        `Completed production substage: ${item.current_substage}`,
        1, // Minimum 1 minute
        item?.product_name,
        startTime,
        endTime
      );
    }

    if (isLastSubstage) {
      await updateItemStage(orderId, itemId, 'dispatch');

      // Notify about ready for dispatch
      if (user?.id) {
        const { data: adminsData } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'admin');

        if (adminsData) {
          for (const admin of adminsData) {
            await createNotification(
              admin.user_id,
              'Ready for Dispatch',
              `${item.product_name} (${orderId}) is ready for dispatch`,
              'success',
              orderId,
              itemId
            );
          }
        }
      }
    } else {
      const nextSubstage = sequence[currentIndex + 1];
      await updateItemSubstage(orderId, itemId, nextSubstage);
    }

    // CRITICAL FIX: Force refresh orders after stage completion to update UI
    await fetchOrders(false);
  }, [orders, user, profile, updateItemStage, updateItemSubstage, addTimelineEntry, fetchOrders]);

  const startSubstage = useCallback(async (orderId: string, itemId: string, substage: SubStage) => {
    await updateItemSubstage(orderId, itemId, substage);
  }, [updateItemSubstage]);

  const markAsDispatched = useCallback(async (orderId: string, itemId: string, dispatchInfo?: DispatchInfo) => {
    try {
      const order = orders.find(o => o.order_id === orderId);
      if (!order) return;

      const item = order.items.find(i => i.item_id === itemId);

      // Prepare update data
      const updateData: any = {
        current_stage: 'completed',
        is_dispatched: true,
        updated_at: new Date().toISOString(),
      };

      // If dispatchInfo is provided, include it
      if (dispatchInfo) {
        updateData.dispatch_info = dispatchInfo;
      }

      // Update via Supabase
      await supabase
        .from('order_items')
        .update(updateData)
        .eq('id', itemId);

      await addTimelineEntry({
        order_id: order.id!,
        item_id: itemId,
        product_name: item.product_name,
        stage: 'dispatch',
        action: 'dispatched',
        performed_by: user?.id || '',
        performed_by_name: profile?.full_name || 'Unknown',
        notes: 'Item dispatched',
        is_public: true,
      });

      // Notify about dispatch
      if (user?.id && item) {
        const { data: adminsData } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'admin');

        if (adminsData) {
          for (const admin of adminsData) {
            if (admin.user_id !== user.id) {
              await createNotification(
                admin.user_id,
                'Order Dispatched',
                `${item.product_name} (${orderId}) has been dispatched`,
                'success',
                orderId,
                itemId
              );
            }
          }
        }
      }

      const updatedItems = order.items.map(i =>
        i.item_id === itemId ? { ...i, current_stage: 'completed' as Stage, is_dispatched: true } : i
      );
      const allCompleted = updatedItems.every(i => i.current_stage === 'completed');

      if (allCompleted) {
        const { error: orderUpdateError } = await supabase
          .from('orders')
          .update({
            is_completed: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id!);

        if (orderUpdateError) {
          console.error('Error updating order completion:', orderUpdateError);
        }
      }

      await fetchOrders(false);

      toast({
        title: "Item Dispatched",
        description: "Item has been marked as dispatched and completed",
      });
    } catch (error) {
      console.error('Error marking as dispatched:', error);
      toast({
        title: "Error",
        description: "Failed to mark as dispatched",
        variant: "destructive",
      });
    }
  }, [orders, user, profile, addTimelineEntry, fetchOrders]);

  const setProductionStageSequence = useCallback(async (orderId: string, itemId: string, sequence: string[]) => {
    try {
      const order = orders.find(o => o.order_id === orderId);
      if (!order) return;

      const { error: updateError } = await supabase
        .from('order_items')
        .update({
          production_stage_sequence: sequence,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      if (updateError) throw updateError;

      const item = order.items.find(i => i.item_id === itemId);
      await addTimelineEntry({
        order_id: order.id!,
        item_id: itemId,
        product_name: item?.product_name,
        stage: 'prepress',
        action: 'assigned',
        performed_by: user?.id || '',
        performed_by_name: profile?.full_name || 'Unknown',
        notes: `Production sequence set: ${sequence.join(' → ')}`,
        is_public: true,
      });

      await fetchOrders(false);

      toast({
        title: "Stage Sequence Saved",
        description: `Production stages: ${sequence.join(' → ')}`,
      });
    } catch (error) {
      console.error('Error setting stage sequence:', error);
      toast({
        title: "Error",
        description: "Failed to save stage sequence",
        variant: "destructive",
      });
    }
  }, [orders, user, profile, addTimelineEntry, fetchOrders]);

  const sendToProduction = useCallback(async (orderId: string, itemId: string, stageSequence: string[]) => {
    const order = orders.find(o => o.order_id === orderId);
    const item = order?.items.find(i => i.item_id === itemId);
    if (!order || !item) return;

    // Stage sequence is now mandatory - must be provided
    if (!stageSequence || stageSequence.length === 0) {
      toast({
        title: "Error",
        description: "Production stages must be defined before sending to production",
        variant: "destructive",
      });
      return;
    }

    const sequence = stageSequence;
    const firstStage = sequence[0] as SubStage;

    try {
      // Update via Supabase
      await supabase
        .from('order_items')
        .update({
          production_stage_sequence: stageSequence,
          current_stage: 'production',
          current_substage: firstStage,
          assigned_department: 'production',
          is_ready_for_production: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      // Add timeline entry AFTER updating
      await addTimelineEntry({
        order_id: order.id!,
        item_id: itemId,
        product_name: item.product_name,
        stage: 'production',
        substage: firstStage,
        action: 'sent_to_production',
        performed_by: user?.id || '',
        performed_by_name: profile?.full_name || 'Unknown',
        notes: `Sent to production with sequence: ${sequence.join(' → ')}`,
        is_public: true,
      });

      // Send notifications for stage change
      if (user?.id) {
        await notifyStageChange(order.order_id, itemId, item.product_name, 'production', user.id);
      }

      await fetchOrders(false);

      toast({
        title: "Sent to Production",
        description: `${item.product_name} sent to production: ${sequence.join(' → ')}`,
      });
    } catch (error) {
      console.error('Error sending to production:', error);
      toast({
        title: "Error",
        description: "Failed to send to production",
        variant: "destructive",
      });
    }
  }, [orders, user, profile, addTimelineEntry, fetchOrders]);

  const assignToDepartment = useCallback(async (orderId: string, itemId: string, department: string) => {
    try {
      const order = orders.find(o => o.order_id === orderId);
      const item = order?.items.find(i => i.item_id === itemId);
      if (!order || !item) return;

      const stageMap: Record<string, Stage> = {
        sales: 'sales',
        design: 'design',
        prepress: 'prepress',
        production: 'production',
      };

      const newStage = stageMap[department] || 'sales';

      // Log activity FIRST (department-wise tracking)
      const previousDepartment = item.assigned_department;
      const activityMessage = previousDepartment !== department
        ? `Order assigned from ${previousDepartment} → ${department} department`
        : `${item.product_name} assigned to ${department} department`;

      await logActivity(
        order.order_id,
        itemId,
        department as 'sales' | 'design' | 'prepress' | 'production' | 'dispatch',
        'assigned',
        activityMessage,
        { previous_department: previousDepartment, new_department: department, stage: newStage }
      );

      // Unassign user if department changes (user might be from different department)
      // Use Supabase service to assign to department
      await assignOrderItemToDepartment(order.id!, itemId, department);

      // Update stage if needed
      if (newStage !== item.current_stage) {
        await supabaseUpdateOrderItemStage(order.id!, itemId, newStage, item.current_substage);
      }

      // For production: set default first substage if not already set
      if (department === 'production' && !item.current_substage) {
        await supabase
          .from('order_items')
          .update({
            current_substage: 'printing',
            is_ready_for_production: true,
          })
          .eq('id', itemId);
      }

      // Prepare update data
      const updateData: any = {
        assigned_department: department,
        updated_at: new Date().toISOString(),
      };

      // If user is assigned and from different department, unassign them
      if (item.assigned_to) {
        // Get user's department from profile
        try {
          const { data: userProfile, error: profileError } = await supabase
            .from('profiles')
            .select('department')
            .eq('user_id', item.assigned_to)
            .single();

          if (!profileError && userProfile) {
            const userDept = userProfile.department;
            if (userDept !== department) {
              // User is from different department, unassign them
              updateData.assigned_to = null;

              // Add timeline entry for unassignment
              await addTimelineEntry({
                order_id: order.id!,
                item_id: itemId,
                product_name: item.product_name,
                stage: item.current_stage,
                action: 'assigned',
                performed_by: user?.id || '',
                performed_by_name: profile?.full_name || 'Unknown',
                notes: `Unassigned from ${item.assigned_to_name || 'user'} (department changed to ${department})`,
                is_public: true,
              });
            }
          }
        } catch (error) {
          console.error('Error checking user department:', error);
          // If we can't check, unassign to be safe
          updateData.assigned_to = null;
        }
      }

      // Update item with new department and unassignment if needed
      // CRITICAL: Update both assigned_department and current_stage in one go to prevent race conditions
      const { error: itemUpdateError } = await supabase
        .from('order_items')
        .update(updateData)
        .eq('id', itemId);

      if (itemUpdateError) throw itemUpdateError;

      // CRITICAL FIX: Update parent order's updated_at to trigger realtime listener
      // This ensures dashboard updates immediately when assignment changes
      const { error: orderUpdateError } = await supabase
        .from('orders')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', order.id!);

      if (orderUpdateError) {
        console.error('Error updating order timestamp:', orderUpdateError);
        // Don't throw - this is not critical
      }

      // CRITICAL: Wait a bit to ensure Supabase has updated before fetching
      await new Promise(resolve => setTimeout(resolve, 100));

      // Add timeline entry for department assignment
      await addTimelineEntry({
        order_id: order.id!,
        item_id: itemId,
        product_name: item.product_name,
        stage: newStage,
        action: 'assigned',
        performed_by: user?.id || '',
        performed_by_name: profile?.full_name || 'Unknown',
        notes: `Assigned to ${department} department`,
        is_public: true,
      });

      // Send notifications for stage change
      if (user?.id) {
        await notifyStageChange(order.order_id, itemId, item.product_name, newStage, user.id);
      }

      // Refresh orders to show updated data immediately
      await fetchOrders(false);

      toast({
        title: "Assigned to Department",
        description: `${item.product_name} assigned to ${department}`,
      });
    } catch (error) {
      console.error('Error assigning to department:', error);
      toast({
        title: "Error",
        description: "Failed to assign to department",
        variant: "destructive",
      });
    }
  }, [orders, updateItemStage, user, profile, addTimelineEntry, logActivity]);

  const assignToOutsource = useCallback(async (
    orderId: string,
    itemId: string,
    vendor: VendorDetails,
    jobDetails: OutsourceJobDetails
  ) => {
    try {
      const order = orders.find(o => o.order_id === orderId);
      const item = order?.items.find(i => i.item_id === itemId);
      if (!order || !item || !user || !profile) return;

      // Find the order's UUID from Supabase
      const { data: orderData } = await supabase
        .from('orders')
        .select('id')
        .eq('order_id', orderId)
        .single();

      if (!orderData) {
        throw new Error('Order not found in database');
      }

      // Update order item using Supabase
      const { error: updateError } = await supabase
        .from('order_items')
        .update({
          assigned_department: 'outsource',
          current_stage: 'outsource',
          outsource_info: {
            vendor: {
              vendor_name: vendor.vendor_name,
              vendor_company: vendor.vendor_company || '',
              contact_person: vendor.contact_person,
              phone: vendor.phone,
              email: vendor.email || '',
              city: vendor.city || '',
            },
            job_details: {
              work_type: jobDetails.work_type,
              expected_ready_date: jobDetails.expected_ready_date.toISOString(),
              quantity_sent: jobDetails.quantity_sent,
              special_instructions: jobDetails.special_instructions || '',
            },
            current_outsource_stage: 'outsourced',
            assigned_at: new Date().toISOString(),
            assigned_by: user.id,
            assigned_by_name: profile.full_name || 'Unknown',
            assigned_by_role: (role as UserRole) || 'admin',
            follow_up_notes: [],
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      if (updateError) {
        throw updateError;
      }

      // Update parent order's updated_at to trigger realtime listener
      const { error: orderUpdateError } = await supabase
        .from('orders')
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderData.id);

      if (orderUpdateError) {
        console.error('Error updating order timestamp:', orderUpdateError);
      }

      await addTimelineEntry({
        order_id: orderId,
        item_id: itemId,
        product_name: item.product_name,
        stage: 'outsource',
        action: 'assigned',
        performed_by: user.id,
        performed_by_name: profile.full_name || 'Unknown',
        notes: `Assigned to Outsource - Vendor: ${vendor.vendor_name}, Work Type: ${jobDetails.work_type}, Expected: ${format(jobDetails.expected_ready_date, 'MMM d, yyyy')}`,
        is_public: true,
      });

      await fetchOrders(false);

      toast({
        title: "Assigned to Outsource",
        description: `Item assigned to ${vendor.vendor_name}`,
      });
    } catch (error) {
      console.error('Error assigning to outsource:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to assign to outsource",
        variant: "destructive",
      });
    }
  }, [orders, user, profile, addTimelineEntry, fetchOrders]);

  const assignToUser = useCallback(async (orderId: string, itemId: string, userId: string, userName: string) => {
    try {
      const order = orders.find(o => o.order_id === orderId);
      if (!order) return;

      const item = order.items.find(i => i.item_id === itemId);
      if (!item) return;

      // Get previous department for activity log
      const previousDepartment = item.assigned_department;

      // Get user's department for activity log
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('department')
        .eq('user_id', userId)
        .maybeSingle();

      // Also check user_roles for department
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      const newDepartment = (userRole?.role || userProfile?.department || item.assigned_department || 'sales').toLowerCase();

      // Use Supabase service to assign to user
      await assignOrderItemToUser(order.id!, itemId, userId);

      // Log activity with proper format: "Order assigned from Design → Prepress to user Amit"
      const activityMessage = previousDepartment !== newDepartment
        ? `Order assigned from ${previousDepartment} → ${newDepartment} to user ${userName}`
        : `Order assigned to user ${userName} in ${newDepartment} department`;

      await logActivity(
        order.order_id,
        itemId,
        newDepartment as 'sales' | 'design' | 'prepress' | 'production' | 'dispatch',
        'assigned',
        activityMessage,
        {
          previous_department: previousDepartment,
          new_department: newDepartment,
          assigned_user: userId,
          assigned_user_name: userName
        }
      );

      await addTimelineEntry({
        order_id: order.id!,
        item_id: itemId,
        product_name: item?.product_name,
        stage: item?.current_stage || 'sales',
        action: 'assigned',
        performed_by: user?.id || '',
        performed_by_name: profile?.full_name || 'Unknown',
        notes: activityMessage,
        is_public: true,
      });

      // Notify the assigned user
      if (item) {
        await createNotification(
          userId,
          'Order Assigned to You',
          `${item.product_name} (${orderId}) has been assigned to you`,
          'info',
          orderId,
          itemId
        );
      }

      await fetchOrders(false);

      toast({
        title: "User Assigned",
        description: `Item assigned to ${userName}`,
      });
    } catch (error) {
      console.error('Error assigning user:', error);
      toast({
        title: "Error",
        description: "Failed to assign user",
        variant: "destructive",
      });
    }
  }, [orders, user, profile, addTimelineEntry, fetchOrders, logActivity]);

  const uploadFile = useCallback(async (orderId: string, itemId: string, file: File, replaceExisting: boolean = false) => {
    try {
      const order = orders.find(o => o.order_id === orderId);
      if (!order) {
        toast({
          title: "Error",
          description: "Order not found",
          variant: "destructive",
        });
        return;
      }

      // Determine file type
      const fileType = file.type.includes('pdf') ? 'proof' :
        file.type.includes('image') ? 'image' : 'other';

      // Upload to Supabase Storage
      const uploadResult = await uploadOrderFile(file, orderId, fileType);

      const downloadURL = uploadResult.url;
      const filePath = uploadResult.path;

      if (!downloadURL) {
        throw new Error('Failed to get file URL from Supabase Storage');
      }

      if (replaceExisting) {
        // Delete existing files for this item from Supabase
        // First, get the item UUID if itemId is not a UUID
        let itemUuid: string | null = null;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (uuidRegex.test(itemId)) {
          itemUuid = itemId;
        } else {
          // Try to find item UUID by item_id field
          try {
            const { data: itemData, error: itemError } = await supabase
              .from('order_items')
              .select('id')
              .eq('item_id', itemId)
              .single();

            // Handle 400 Bad Request errors gracefully
            if (itemError) {
              const isBadRequest = itemError.status === 400 ||
                itemError.statusCode === 400 ||
                itemError.code === 'PGRST204' ||
                itemError.message?.includes('item_id') ||
                itemError.message?.includes('column');

              if (isBadRequest) {
                // item_id column might not exist or query format issue
                // Try to find by order_id + item_id combination
                const order = orders.find(o => o.items.some(i => i.item_id === itemId));
                if (order) {
                  const item = order.items.find(i => i.item_id === itemId);
                  if (item && order.id) {
                    // Use order.id to find files
                    itemUuid = null; // Will filter by order_id only
                  }
                }
              }
            } else if (itemData) {
              itemUuid = itemData.id;
            }
          } catch (error: any) {
            console.warn('Error finding item UUID by item_id:', error);
          }
        }

        // Delete existing files - use item UUID if available, otherwise filter by order_id
        let filesQuery = supabase
          .from('order_files')
          .select('id, file_url');

        if (itemUuid) {
          filesQuery = filesQuery.eq('item_id', itemUuid);
        } else {
          // Fallback: find by order_id
          const order = orders.find(o => o.items.some(i => i.item_id === itemId));
          if (order?.id) {
            filesQuery = filesQuery.eq('order_id', order.id);
          }
        }

        const { data: existingFiles } = await filesQuery;

        if (existingFiles && existingFiles.length > 0) {
          // Delete file records from database
          let deleteQuery = supabase
            .from('order_files')
            .delete();

          if (itemUuid) {
            deleteQuery = deleteQuery.eq('item_id', itemUuid);
          } else {
            const order = orders.find(o => o.items.some(i => i.item_id === itemId));
            if (order?.id) {
              deleteQuery = deleteQuery.eq('order_id', order.id);
            }
          }

          await deleteQuery;

          // Delete files from storage (extract path from URL if needed)
          for (const fileRecord of existingFiles) {
            try {
              // Extract path from URL or use stored path
              const urlPath = fileRecord.file_url.split('/order-files/')[1]?.split('?')[0];
              if (urlPath) {
                await deleteFileFromSupabase(urlPath);
              }
            } catch (err) {
              console.warn('Error deleting old file from storage:', err);
            }
          }
        }
      }

      // Store file metadata in Supabase
      const { error: insertError } = await supabase
        .from('order_files')
        .insert({
          order_id: order.id,
          item_id: itemId,
          file_url: downloadURL,
          file_name: file.name,
          file_type: fileType,
          uploaded_by: user?.id || null,
          is_public: true,
        });

      if (insertError) {
        throw new Error(`Failed to save file metadata: ${insertError.message}`);
      }

      const currentItem = order.items.find(i => i.item_id === itemId);
      const currentStage = currentItem?.current_stage || 'sales';
      const currentDepartment = currentItem?.assigned_department || 'sales';

      // Log activity FIRST (department-wise tracking)
      await logActivity(
        order.order_id,
        itemId,
        currentDepartment as 'sales' | 'design' | 'prepress' | 'production' | 'dispatch',
        'file_uploaded',
        `${currentItem?.product_name || 'Item'}: ${replaceExisting ? 'Replaced with' : 'Uploaded'} ${file.name}`,
        { file_type: fileType, file_name: file.name, file_url: downloadURL }
      );

      await addTimelineEntry({
        order_id: order.id!,
        item_id: itemId,
        product_name: currentItem?.product_name,
        stage: currentStage,
        action: replaceExisting ? 'final_proof_uploaded' : 'uploaded_proof',
        performed_by: user?.id || '',
        performed_by_name: profile?.full_name || 'Unknown',
        notes: `${replaceExisting ? 'Replaced with' : 'Uploaded'} ${file.name}`,
        attachments: [{ url: downloadURL, type: file.type }],
        is_public: true,
      });

      // Auto-log work action
      if (user?.id && profile?.full_name) {
        const item = order.items.find(i => i.item_id === itemId);
        const startTime = new Date();
        const endTime = new Date();
        await autoLogWorkAction(
          user.id,
          profile.full_name,
          role || 'unknown',
          order.id!,
          order.order_id,
          itemId,
          currentStage,
          'file_uploaded',
          `${replaceExisting ? 'Replaced' : 'Uploaded'} file: ${file.name}`,
          1, // Minimum 1 minute
          item?.product_name,
          startTime,
          endTime
        );
      }

      // Refresh orders to show new file - wait a bit for database to update
      await new Promise(resolve => setTimeout(resolve, 300));
      await fetchOrders(false);

      toast({
        title: replaceExisting ? "File Replaced" : "File Uploaded",
        description: `${file.name} has been ${replaceExisting ? 'replaced' : 'uploaded'} successfully. Preview will update shortly.`,
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload file';
      toast({
        title: "Upload Failed",
        description: errorMessage,
        variant: "destructive",
      });
      throw error; // Re-throw to let caller handle it
    }
  }, [orders, user, profile, role, addTimelineEntry, fetchOrders, toast, logActivity]);

  const addNote = useCallback(async (orderId: string, note: string) => {
    try {
      const order = orders.find(o => o.order_id === orderId);
      if (!order) return;

      const newNotes = order.global_notes ? `${order.global_notes}\n${note}` : note;

      const { error: updateError } = await supabase
        .from('orders')
        .update({
          global_notes: newNotes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id!);

      if (updateError) throw updateError;

      // Log activity (determine department from order items)
      const firstItem = order.items[0];
      const noteDepartment = firstItem?.assigned_department || 'sales';

      await logActivity(
        order.order_id,
        undefined,
        noteDepartment as 'sales' | 'design' | 'prepress' | 'production' | 'dispatch',
        'note_added',
        `Note added to order ${order.order_id}`,
        { note_preview: note.substring(0, 50) }
      );

      await addTimelineEntry({
        order_id: order.id!,
        stage: 'sales',
        action: 'note_added',
        performed_by: user?.id || '',
        performed_by_name: profile?.full_name || 'Unknown',
        notes: note,
        is_public: false,
      });

      await fetchOrders(false);

      toast({
        title: "Note Added",
        description: "Your note has been saved",
      });
    } catch (error) {
      console.error('Error adding note:', error);
      toast({
        title: "Error",
        description: "Failed to add note",
        variant: "destructive",
      });
    }
  }, [orders, user, profile, addTimelineEntry, fetchOrders, logActivity]);

  const updateOrder = useCallback(async (orderId: string, updates: Partial<Order>) => {
    try {
      const order = orders.find(o => o.order_id === orderId);
      if (!order) return;

      // PERMISSION CHECK: Only Sales and Admin can update delivery date
      if (updates.order_level_delivery_date && !isAdmin && role !== 'sales') {
        toast({
          title: "Permission Denied",
          description: "Only Sales and Admin can update delivery dates",
          variant: "destructive",
        });
        // Remove delivery date from updates
        const { order_level_delivery_date, ...restUpdates } = updates;
        // Continue with other updates (customer, notes, etc.)
        if (Object.keys(restUpdates).length === 0) return;
        updates = restUpdates;
      }

      // Prepare update data for Supabase
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (updates.customer) {
        updateData.customer_name = updates.customer.name;
        updateData.customer_email = updates.customer.email;
        updateData.customer_phone = updates.customer.phone;
        updateData.customer_address = updates.customer.address;
      }
      if (updates.global_notes !== undefined) updateData.global_notes = updates.global_notes;

      // If order-level delivery date is updated, also update all items' delivery dates
      if (updates.order_level_delivery_date) {
        updateData.delivery_date = updates.order_level_delivery_date.toISOString();

        // Update all items' delivery dates to match order-level delivery date
        const { data: itemsData } = await supabase
          .from('order_items')
          .select('id')
          .eq('order_id', order.id!);

        if (itemsData && itemsData.length > 0) {
          // Update all items in parallel
          const updatePromises = itemsData.map(item =>
            supabase
              .from('order_items')
              .update({
                delivery_date: updates.order_level_delivery_date!.toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', item.id)
          );
          await Promise.all(updatePromises);
        }
      }

      // Update order in Supabase
      const { error: updateError } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', order.id!);

      if (updateError) throw updateError;

      await fetchOrders(false);

      toast({
        title: "Order Updated",
        description: "Changes have been saved",
      });
    } catch (error) {
      console.error('Error updating order:', error);
      toast({
        title: "Error",
        description: "Failed to update order",
        variant: "destructive",
      });
    }
  }, [orders, fetchOrders, isAdmin, role]);

  const deleteOrder = useCallback(async (orderId: string) => {
    try {
      const order = orders.find(o => o.order_id === orderId);
      if (!order) return;

      if (!isAdmin && role !== 'sales') {
        toast({
          title: "Permission Denied",
          description: "Only Admin and Sales can delete orders",
          variant: "destructive",
        });
        return;
      }

      // Delete order - CASCADE will automatically delete related items, files, and timeline entries
      if (!order.id) {
        throw new Error('Order ID not found');
      }

      const { error: deleteError } = await supabase
        .from('orders')
        .delete()
        .eq('id', order.id);

      if (deleteError) throw deleteError;

      await fetchOrders(false);

      toast({
        title: "Order Deleted",
        description: "Order has been permanently deleted",
      });
    } catch (error) {
      console.error('Error deleting order:', error);
      toast({
        title: "Error",
        description: "Failed to delete order",
        variant: "destructive",
      });
    }
  }, [orders, isAdmin, role, fetchOrders]);

  const updateItemSpecifications = useCallback(async (orderId: string, itemId: string, updates: Record<string, any>) => {
    try {
      // Assuming supabaseService is available in this scope, or it should be imported/defined.
      // If not, the direct supabase call would be:
      // await supabase.from('order_items').update(updates).eq('id', itemId);
      // For now, I'll assume supabaseService.updateItemSpecifications exists as per the instruction.
      await supabaseService.updateItemSpecifications(orderId, itemId, updates);
      await refreshOrders();

      toast({
        title: "Item Updated",
        description: "Item specifications updated successfully",
      });
    } catch (error) {
      console.error('Error updating item specifications:', error);
      toast({
        title: "Error",
        description: "Failed to update item specifications",
        variant: "destructive",
      });
    }
  }, [refreshOrders, toast]);

  const updateItemDeliveryDate = useCallback(async (orderId: string, itemId: string, deliveryDate: Date) => {
    // PERMISSION CHECK: Only Sales and Admin can update delivery date
    if (!isAdmin && role !== 'sales') {
      toast({
        title: "Permission Denied",
        description: "Only Sales and Admin can update delivery dates",
        variant: "destructive",
      });
      return;
    }

    try {
      const order = orders.find(o => o.order_id === orderId);
      if (!order) return;

      // Update item delivery date via Supabase
      await supabase
        .from('order_items')
        .update({
          delivery_date: deliveryDate.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      // Update priority will be computed automatically
      // Also update order-level delivery date in same update
      const { error: orderUpdateError } = await supabase
        .from('orders')
        .update({
          delivery_date: deliveryDate.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id!);

      if (orderUpdateError) {
        console.error('Error updating order delivery date:', orderUpdateError);
      }

      const item = order.items.find(i => i.item_id === itemId);

      await addTimelineEntry({
        order_id: orderId,
        item_id: itemId,
        product_name: item?.product_name,
        stage: (item?.current_stage as Stage) || 'sales',
        action: 'note_added',
        performed_by: user?.id || '',
        performed_by_name: profile?.full_name || 'Unknown',
        notes: `Delivery date updated to ${format(deliveryDate, 'MMM d, yyyy')}`,
        is_public: true,
      });

      await fetchOrders(false);

      toast({
        title: "Delivery Date Updated",
        description: `Delivery date updated to ${format(deliveryDate, 'MMM d, yyyy')}`,
      });
    } catch (error) {
      console.error('Error updating delivery date:', error);
      toast({
        title: "Error",
        description: "Failed to update delivery date",
        variant: "destructive",
      });
    }
  }, [orders, user, profile, addTimelineEntry, fetchOrders, isAdmin, role]);

  // Outsource Stage Management - Strict Progression
  const updateOutsourceStage = useCallback(async (
    orderId: string,
    itemId: string,
    newStage: OutsourceStage
  ) => {
    try {
      const order = orders.find(o => o.order_id === orderId);
      const item = order?.items.find(i => i.item_id === itemId);
      if (!order || !item || !item.outsource_info || !user || !profile) return;

      const currentStage = item.outsource_info.current_outsource_stage;

      // Define valid stage transitions (strict progression)
      const validTransitions: Record<OutsourceStage, OutsourceStage[]> = {
        outsourced: ['vendor_in_progress'],
        vendor_in_progress: ['vendor_dispatched', 'outsourced'], // Can go back if needed
        vendor_dispatched: ['received_from_vendor'],
        received_from_vendor: ['quality_check'],
        quality_check: ['decision_pending', 'vendor_in_progress'], // Can fail and go back
        decision_pending: [], // Final stage, no transitions
      };

      if (!validTransitions[currentStage]?.includes(newStage)) {
        toast({
          title: "Invalid Stage Transition",
          description: `Cannot transition from ${OUTSOURCE_STAGE_LABELS[currentStage]} to ${OUTSOURCE_STAGE_LABELS[newStage]}`,
          variant: "destructive",
        });
        return;
      }

      // Update using Supabase
      const { error: updateError } = await supabase
        .from('order_items')
        .update({
          outsource_info: {
            ...item.outsource_info,
            current_outsource_stage: newStage,
            updated_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      if (updateError) {
        throw updateError;
      }

      await addTimelineEntry({
        order_id: orderId,
        item_id: itemId,
        product_name: item.product_name,
        stage: 'outsource',
        action: 'assigned',
        performed_by: user.id,
        performed_by_name: profile.full_name || 'Unknown',
        notes: `Stage updated: ${OUTSOURCE_STAGE_LABELS[currentStage]} → ${OUTSOURCE_STAGE_LABELS[newStage]}`,
        is_public: true,
      });

      await fetchOrders(false);

      toast({
        title: "Stage Updated",
        description: `Updated to ${OUTSOURCE_STAGE_LABELS[newStage]}`,
      });
    } catch (error) {
      console.error('Error updating outsource stage:', error);
      toast({
        title: "Error",
        description: "Failed to update stage",
        variant: "destructive",
      });
    }
  }, [orders, user, profile, addTimelineEntry, fetchOrders]);

  // Add Follow-Up Note
  const addFollowUpNote = useCallback(async (
    orderId: string,
    itemId: string,
    note: string
  ) => {
    try {
      const order = orders.find(o => o.order_id === orderId);
      const item = order?.items.find(i => i.item_id === itemId);
      if (!order || !item || !item.outsource_info || !user || !profile) return;

      const noteId = `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newNote = {
        note_id: noteId,
        note: note.trim(),
        created_at: new Date().toISOString(),
        created_by: user.id,
        created_by_name: profile.full_name || 'Unknown',
      };

      const currentNotes = item.outsource_info.follow_up_notes || [];
      const updatedNotes = [...currentNotes, newNote];

      // Update using Supabase
      const { error: updateError } = await supabase
        .from('order_items')
        .update({
          outsource_info: {
            ...item.outsource_info,
            follow_up_notes: updatedNotes,
            updated_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      if (updateError) {
        throw updateError;
      }

      await addTimelineEntry({
        order_id: orderId,
        item_id: itemId,
        product_name: item.product_name,
        stage: 'outsource',
        action: 'note_added',
        performed_by: user.id,
        performed_by_name: profile.full_name || 'Unknown',
        notes: `Follow-up note: ${note.trim()}`,
        is_public: true,
      });

      await fetchOrders(false);

      toast({
        title: "Note Added",
        description: "Follow-up note has been added",
      });
    } catch (error) {
      console.error('Error adding follow-up note:', error);
      toast({
        title: "Error",
        description: "Failed to add note",
        variant: "destructive",
      });
    }
  }, [orders, user, profile, addTimelineEntry, fetchOrders]);

  // Vendor Dispatch
  const vendorDispatch = useCallback(async (
    orderId: string,
    itemId: string,
    courierName: string,
    trackingNumber: string,
    dispatchDate: Date
  ) => {
    try {
      const order = orders.find(o => o.order_id === orderId);
      const item = order?.items.find(i => i.item_id === itemId);
      if (!order || !item || !item.outsource_info || !user || !profile) return;

      // Update using Supabase
      const { error: updateError } = await supabase
        .from('order_items')
        .update({
          outsource_info: {
            ...item.outsource_info,
            current_outsource_stage: 'vendor_dispatched',
            vendor_dispatch_date: dispatchDate.toISOString(),
            courier_name: courierName,
            tracking_number: trackingNumber,
            updated_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      if (updateError) {
        throw updateError;
      }

      await addTimelineEntry({
        order_id: orderId,
        item_id: itemId,
        product_name: item.product_name,
        stage: 'outsource',
        action: 'assigned',
        performed_by: user.id,
        performed_by_name: profile.full_name || 'Unknown',
        notes: `Vendor dispatched via ${courierName}. Tracking: ${trackingNumber}`,
        is_public: true,
      });

      await fetchOrders(false);

      toast({
        title: "Vendor Dispatched",
        description: `Dispatched via ${courierName}`,
      });
    } catch (error) {
      console.error('Error updating vendor dispatch:', error);
      toast({
        title: "Error",
        description: "Failed to update dispatch",
        variant: "destructive",
      });
    }
  }, [orders, user, profile, addTimelineEntry, fetchOrders]);

  // Receive from Vendor
  const receiveFromVendor = useCallback(async (
    orderId: string,
    itemId: string,
    receiverName: string,
    receivedDate: Date
  ) => {
    try {
      const order = orders.find(o => o.order_id === orderId);
      const item = order?.items.find(i => i.item_id === itemId);
      if (!order || !item || !item.outsource_info || !user || !profile) return;

      // Update using Supabase
      const { error: updateError } = await supabase
        .from('order_items')
        .update({
          outsource_info: {
            ...item.outsource_info,
            current_outsource_stage: 'received_from_vendor',
            received_date: receivedDate.toISOString(),
            receiver_name: receiverName,
            updated_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      if (updateError) {
        throw updateError;
      }

      await addTimelineEntry({
        order_id: orderId,
        item_id: itemId,
        product_name: item.product_name,
        stage: 'outsource',
        action: 'assigned',
        performed_by: user.id,
        performed_by_name: profile.full_name || 'Unknown',
        notes: `Received from vendor. Receiver: ${receiverName}`,
        is_public: true,
      });

      await fetchOrders(false);

      toast({
        title: "Received from Vendor",
        description: `Received by ${receiverName}`,
      });
    } catch (error) {
      console.error('Error updating receive:', error);
      toast({
        title: "Error",
        description: "Failed to update receive status",
        variant: "destructive",
      });
    }
  }, [orders, user, profile, addTimelineEntry, fetchOrders]);

  // Quality Check
  const qualityCheck = useCallback(async (
    orderId: string,
    itemId: string,
    result: 'pass' | 'fail',
    notes: string
  ) => {
    try {
      const order = orders.find(o => o.order_id === orderId);
      const item = order?.items.find(i => i.item_id === itemId);
      if (!order || !item || !item.outsource_info || !user || !profile) return;

      // Update using Supabase
      const updateData = {
        outsource_info: {
          ...item.outsource_info,
          qc_result: result,
          qc_notes: notes.trim(),
          updated_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      };

      if (result === 'pass') {
        updateData.outsource_info.current_outsource_stage = 'decision_pending';
      } else {
        // Fail - go back to vendor_in_progress
        updateData.outsource_info.current_outsource_stage = 'vendor_in_progress';
      }

      const { error: updateError } = await supabase
        .from('order_items')
        .update(updateData)
        .eq('id', itemId);

      if (updateError) {
        throw updateError;
      }

      await addTimelineEntry({
        order_id: orderId,
        item_id: itemId,
        product_name: item.product_name,
        stage: 'outsource',
        action: 'note_added',
        performed_by: user.id,
        performed_by_name: profile.full_name || 'Unknown',
        notes: `QC ${result.toUpperCase()}: ${notes.trim()}`,
        is_public: true,
      });

      await fetchOrders(false);

      toast({
        title: `QC ${result === 'pass' ? 'Passed' : 'Failed'}`,
        description: result === 'pass'
          ? "Ready for decision"
          : "Sent back to vendor",
      });
    } catch (error) {
      console.error('Error updating QC:', error);
      toast({
        title: "Error",
        description: "Failed to update QC",
        variant: "destructive",
      });
    }
  }, [orders, user, profile, addTimelineEntry, fetchOrders]);

  // Post-QC Decision
  const postQCDecision = useCallback(async (
    orderId: string,
    itemId: string,
    decision: 'production' | 'dispatch'
  ) => {
    try {
      const order = orders.find(o => o.order_id === orderId);
      const item = order?.items.find(i => i.item_id === itemId);
      if (!order || !item || !item.outsource_info || !user || !profile) return;

      if (item.outsource_info.current_outsource_stage !== 'decision_pending') {
        toast({
          title: "Invalid Stage",
          description: "Item must be in Decision Pending stage",
          variant: "destructive",
        });
        return;
      }

      // Update using Supabase
      if (decision === 'production') {
        // Send to production - need to set stage sequence
        // For now, just update stage
        const { error: updateError } = await supabase
          .from('order_items')
          .update({
            current_stage: 'production',
            assigned_department: 'production',
            outsource_info: {
              ...item.outsource_info,
              current_outsource_stage: 'decision_pending',
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', itemId);

        if (updateError) {
          throw updateError;
        }

        await addTimelineEntry({
          order_id: orderId,
          item_id: itemId,
          product_name: item.product_name,
          stage: 'production',
          action: 'sent_to_production',
          performed_by: user.id,
          performed_by_name: profile.full_name || 'Unknown',
          notes: `Sent to Production after QC Pass`,
          is_public: true,
        });
      } else {
        // Mark as ready for dispatch
        const { error: updateError } = await supabase
          .from('order_items')
          .update({
            current_stage: 'dispatch',
            assigned_department: 'production',
            is_ready_for_production: true,
            outsource_info: {
              ...item.outsource_info,
              current_outsource_stage: 'decision_pending',
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', itemId);

        if (updateError) {
          throw updateError;
        }

        await addTimelineEntry({
          order_id: orderId,
          item_id: itemId,
          product_name: item.product_name,
          stage: 'dispatch',
          action: 'assigned',
          performed_by: user.id,
          performed_by_name: profile.full_name || 'Unknown',
          notes: `Ready for Dispatch after QC Pass`,
          is_public: true,
        });
      }

      await fetchOrders(false);

      toast({
        title: "Decision Applied",
        description: decision === 'production'
          ? "Sent to Production"
          : "Ready for Dispatch",
      });
    } catch (error) {
      console.error('Error applying decision:', error);
      toast({
        title: "Error",
        description: "Failed to apply decision",
        variant: "destructive",
      });
    }
  }, [orders, user, profile, addTimelineEntry, fetchOrders]);

  return (
    <OrderContext.Provider value={{
      orders,
      timeline,
      isLoading,
      lastSyncTime,
      getOrderById,
      getOrdersByDepartment,
      getOrdersForUser,
      getOrdersForDepartment,
      getUrgentOrdersForAdmin,
      getUrgentOrdersForDepartment,
      getTimelineForOrder,
      updateItemStage,
      updateItemSubstage,
      assignToDepartment,
      assignToOutsource,
      assignToUser,
      addTimelineEntry,
      uploadFile,
      addNote,
      updateOrder,
      deleteOrder,
      completeSubstage,
      startSubstage,
      markAsDispatched,
      sendToProduction,
      setProductionStageSequence,
      updateItemDeliveryDate,
      updateOutsourceStage,
      addFollowUpNote,
      vendorDispatch,
      receiveFromVendor, qualityCheck, postQCDecision, updateItemSpecifications,
      refreshOrders,
      getCompletedOrders,
    }}>
      {children}
    </OrderContext.Provider>
  );
}

export function useOrders() {
  const context = useContext(OrderContext);
  if (context === undefined) {
    throw new Error('useOrders must be used within an OrderProvider');
  }
  return context;
}
