import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Order, OrderItem, TimelineEntry, Stage, SubStage, Priority, VendorDetails, OutsourceJobDetails, OutsourceInfo, OutsourceStage, UserRole, OUTSOURCE_STAGE_LABELS } from '@/types/order';
import { useAuth } from './AuthContext';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { 
  fetchAllOrders,
  fetchTimelineEntries,
  updateOrderItemStage as supabaseUpdateOrderItemStage,
  assignOrderItemToDepartment,
  assignOrderItemToUser,
  assignOrderToDepartment as supabaseAssignOrderToDepartment,
  assignOrderToUser as supabaseAssignOrderToUser,
  addTimelineEntry as supabaseAddTimelineEntry,
  subscribeToOrdersChanges,
  subscribeToOrderItemsChanges,
} from '@/services/supabaseOrdersService';
import { autoLogWorkAction } from '@/utils/workLogHelper';
import { uploadFileToCloudinary } from '@/services/cloudinaryUpload';
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
  markAsDispatched: (orderId: string, itemId: string) => Promise<void>;
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
    await setDoc(doc(collection(db, 'notifications')), {
      user_id: userId,
      title,
      message,
      type,
      order_id: orderId || null,
      item_id: itemId || null,
      read: false,
      created_at: Timestamp.now(),
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
    const adminsQuery = query(collection(db, 'user_roles'), where('role', '==', 'admin'));
    const adminsSnapshot = await getDocs(adminsQuery);
    const admins = adminsSnapshot.docs.map(d => ({ user_id: d.data().user_id }));

    // Get sales users - they get notifications for all orders
    const salesQuery = query(collection(db, 'user_roles'), where('role', '==', 'sales'));
    const salesSnapshot = await getDocs(salesQuery);
    const salesUsers = salesSnapshot.docs.map(d => ({ user_id: d.data().user_id }));

    // Get users in the TARGET department only
    const targetDept = newStage === 'dispatch' || newStage === 'completed' ? 'production' : newStage;
    const deptQuery = query(collection(db, 'user_roles'), where('role', '==', targetDept));
    const deptSnapshot = await getDocs(deptQuery);
    const deptUsers = deptSnapshot.docs.map(d => ({ user_id: d.data().user_id }));

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
    const adminsQuery = query(collection(db, 'user_roles'), where('role', '==', 'admin'));
    const adminsSnapshot = await getDocs(adminsQuery);
    const admins = adminsSnapshot.docs.map(d => ({ user_id: d.data().user_id }));

    // Get assigned department users if urgent
    let deptUsers: { user_id: string }[] = [];
    if (assignedDepartment && priority === 'red') {
      const validRoles = ['admin', 'sales', 'design', 'prepress', 'production'] as const;
      const roleToQuery = validRoles.includes(assignedDepartment as any) ? assignedDepartment as typeof validRoles[number] : null;
      if (roleToQuery) {
        const deptQuery = query(collection(db, 'user_roles'), where('role', '==', roleToQuery));
        const deptSnapshot = await getDocs(deptQuery);
        deptUsers = deptSnapshot.docs.map(d => ({ user_id: d.data().user_id }));
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
  const [isLoading, setIsLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const { user, profile, role, isAdmin } = useAuth();
  
  // CRITICAL: Use refs to store stable function references
  // This prevents useEffect from re-running when these functions change
  const fetchOrdersRef = useRef<((showLoading?: boolean) => Promise<void>) | null>(null);
  const fetchTimelineRef = useRef<(() => Promise<void>) | null>(null);
  
  // Check if user can view financial data
  const canViewFinancials = isAdmin || role === 'sales';

  // Fetch orders from Supabase - RLS automatically filters based on user role/department
  const fetchOrders = useCallback(async (showLoading = false) => {
    if (!user) {
      console.warn('[fetchOrders] No user, skipping fetch');
      return; // Don't fetch if no user
    }
    
    console.log('[fetchOrders] Starting fetch from Supabase, showLoading:', showLoading, 'user:', user.id);
    
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
    }
  }, [canViewFinancials]);

  const fetchTimeline = useCallback(async () => {
    try {
      // Fetch all timeline entries (RLS automatically filters based on user access)
      const { data: timelineData, error } = await supabase
        .from('timeline')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) {
        console.error('Error fetching timeline:', error);
        setTimeline([]);
        return;
      }

      const mappedTimeline: TimelineEntry[] = (timelineData || []).map(entry => ({
        timeline_id: entry.id,
        order_id: entry.order_id,
        item_id: entry.item_id || undefined,
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
    } catch (error) {
      console.error('Error fetching timeline:', error);
      setTimeline([]);
    }
  }, []);

  // CRITICAL: Update refs whenever fetchOrders or fetchTimeline changes
  // This allows useEffect to use stable refs instead of dependencies
  useEffect(() => {
    fetchOrdersRef.current = fetchOrders;
  }, [fetchOrders]);

  useEffect(() => {
    fetchTimelineRef.current = fetchTimeline;
  }, [fetchTimeline]);

  // Real-time subscription for orders, items, timeline, and files - optimized
  // CRITICAL FIX: Use refs to prevent re-subscription loops
  // Dependency array should ONLY have [user] - NOT fetchOrders/fetchTimeline
  useEffect(() => {
    if (!user) {
      // Clear data when user logs out
      setOrders([]);
      setTimeline([]);
      setIsLoading(false);
      return;
    }

    // CRITICAL: Ensure we fetch orders on mount/reload
    // This prevents orders from disappearing on page reload
    // Mark initial fetch as complete so real-time listeners can start updating
    let initialFetchComplete = false;
    let isMounted = true; // Track if component is still mounted
    
    // Initial fetch with loading indicator - delay to allow auth to complete
    // CRITICAL: Use refs to call functions, not direct references
    const initTimer = setTimeout(async () => {
      if (!isMounted) return;
      console.log('[OrderContext] Starting initial fetch');
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
    }, 200); // Increased delay to ensure user state is ready

    // Use debounce to prevent too many rapid updates
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedFetch = (callback: () => void) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (isMounted) {
          callback();
        }
      }, 500); // Increased to 500ms debounce for better performance
    };

    // Supabase Realtime subscriptions - RLS automatically filters based on user access
    // CRITICAL: Only set up subscriptions after initial fetch to prevent clearing orders
    const unsubscribeOrders = subscribeToOrdersChanges((payload) => {
      console.log('[OrderContext] Orders change received:', payload.eventType);
      // Only trigger real-time updates after initial fetch is complete
      if (initialFetchComplete && isMounted && fetchOrdersRef.current) {
        debouncedFetch(() => {
          fetchOrdersRef.current?.(false); // Don't show loading on real-time updates
        });
      }
    });

    const unsubscribeItems = subscribeToOrderItemsChanges((payload) => {
      console.log('[OrderContext] Order items change received:', payload.eventType);
      // Only trigger real-time updates after initial fetch is complete
      if (initialFetchComplete && isMounted && fetchOrdersRef.current) {
        debouncedFetch(() => {
          fetchOrdersRef.current?.(false); // Don't show loading on real-time updates
        });
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
          if (isMounted && fetchTimelineRef.current) {
            debouncedFetch(() => {
              fetchTimelineRef.current?.();
            });
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false; // Mark as unmounted
      clearTimeout(initTimer);
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubscribeOrders();
      unsubscribeItems();
      supabase.removeChannel(timelineChannel);
      // CRITICAL: DO NOT call setOrders([]) here - it causes orders to disappear
    };
  }, [user]); // CRITICAL: Only depend on user, NOT on fetchOrders/fetchTimeline

  const refreshOrders = useCallback(async () => {
    await Promise.all([fetchOrders(false), fetchTimeline()]);
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
    currentUserId?: string
  ): boolean => {
    const itemDept = (item.assigned_department || '').toLowerCase().trim();
    const itemStage = (item.current_stage || '').toLowerCase().trim();
    const targetDeptLower = targetDepartment.toLowerCase().trim();
    
    // Check if item belongs to target department
    const isDepartmentItem = itemDept === targetDeptLower || 
                            (itemStage === targetDeptLower && !item.assigned_department);
    
    if (!isDepartmentItem) return false;
    
    // Visibility logic:
    // - Admin sees everything
    // - If item.assigned_to IS NULL → visible to ALL users in department
    // - If item.assigned_to IS SET → only that assigned user sees it
    if (isAdminUser) return true;
    
    if (item.assigned_to) {
      // Item is assigned - only the assigned user can see it
      return item.assigned_to === currentUserId;
    }
    
    // No user assigned - visible to all users in department
    return true;
  }, []);

  const getOrdersByDepartment = useCallback(() => {
    // SAFEGUARD 6: Filter out archived WooCommerce orders from Sales view
    // Archived orders are preserved but hidden from normal workflow views
    const activeOrders = orders.filter(o => !o.is_completed && !o.archived_from_wc);
    
    // CRITICAL FIX: Admin should see ALL active orders, even if they have no items
    // This ensures admin can see orders immediately after sync, before items are assigned
    if (isAdmin || role === 'sales') {
      console.log('[getOrdersByDepartment] Admin/Sales - Returning all active orders:', {
        totalOrders: orders.length,
        activeOrders: activeOrders.length,
        completedOrders: orders.filter(o => o.is_completed).length,
        archivedOrders: orders.filter(o => o.archived_from_wc).length,
      });
      return activeOrders;
    }
    
    if (!role) {
      console.warn('[getOrdersByDepartment] No role found for user');
      return [];
    }
    
    const roleLower = role.toLowerCase().trim();
    
    // For production users, filter by assigned production stage
    if (role === 'production' && profile?.production_stage) {
      return activeOrders.filter(order =>
        order.items.some(item => {
          // Must be in production stage and assigned substage
          if (item.current_stage !== 'production' || item.current_substage !== profile.production_stage) {
            return false;
          }
          
          // Use helper function for department matching and visibility
          return itemMatchesDepartment(item, 'production', roleLower, isAdmin, user?.uid);
        })
      );
    }
    
    // For other departments, apply visibility rules with case-insensitive matching
    // Use helper function to reduce code duplication
    const filtered = activeOrders.filter(order =>
      order.items.some(item => 
        itemMatchesDepartment(item, roleLower, roleLower, isAdmin, user?.uid)
      )
    );
    
    console.log(`[getOrdersByDepartment] Filtered ${filtered.length} orders for role ${role}`, {
      totalActiveOrders: activeOrders.length,
      role: role,
      roleLower: roleLower,
      user_id: user?.uid,
    });
    
    return filtered;
  }, [orders, role, isAdmin, profile, user]);

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
          
          // If assigned to a user, only that user sees it
          if (item.assigned_to) {
            return item.assigned_to === user?.uid;
          }
          
          // No user assigned, visible to all production users in this substage
          return true;
        })
      );
    }

    // For other departments, apply visibility rules
    return activeOrders.filter(order =>
      order.items.some(item => {
        // Must be assigned to user's department
        if (item.assigned_department !== role) {
          return false;
        }
        
        // If assigned to a specific user, only that user sees it
        if (item.assigned_to) {
          return item.assigned_to === user?.uid;
        }
        
        // No user assigned, visible to all department users
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
    
    // Admin can see all orders for any department
    if (isAdmin) {
      return activeOrders.filter(order =>
        order.items.some(item => 
          itemMatchesDepartment(item, deptLower, deptLower, true, undefined)
        )
      );
    }
    
    // CRITICAL: For non-admin users, verify their role OR profile department matches the requested department
    // This prevents users from accessing other departments' orders
    // Check both role (from user_roles) and profile.department (from profiles)
    const userRoleLower = (role || '').toLowerCase().trim();
    const profileDeptLower = (profile?.department || '').toLowerCase().trim();
    const roleMatches = userRoleLower === deptLower;
    const profileMatches = profileDeptLower === deptLower;
    
    // Debug logging
    console.log(`[getOrdersForDepartment] Checking access for department: ${department}`, {
      user_id: user?.uid,
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
    
    // CRITICAL: If neither role nor profile department matches, return empty array
    // BUT: Also check if user has no role/profile set - in that case, allow access if they're requesting their own department
    if (!roleMatches && !profileMatches) {
      // Special case: If user has no role/profile set, but they're requesting a department that matches their current context
      // This handles edge cases where user data might be incomplete
      if (!role && !profile?.department) {
        console.warn(`[getOrdersForDepartment] User has no role or profile department set. Denying access to ${department}`);
        return [];
      }
      console.warn(`[getOrdersForDepartment] User role (${role}) and profile department (${profile?.department}) do not match requested department (${department})`);
      return []; // Return empty array if neither role nor profile department matches
    }
    
    const filteredOrders = activeOrders.filter(order => {
      const hasVisibleItem = order.items.some(item => {
        // Use helper function to reduce code duplication
        const userDeptLower = (role || profile?.department || '').toLowerCase().trim();
        return itemMatchesDepartment(item, deptLower, userDeptLower, isAdmin, user?.uid);
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
        
        // If assigned to a specific user, only that user sees it
        if (item.assigned_to) {
          return item.assigned_to === user?.uid;
        }
        
        // No user assigned, visible to all department users
        return true;
      })
    );
  }, [orders, user, isAdmin]);

  const getTimelineForOrder = useCallback((orderId: string, itemId?: string) => {
    const order = orders.find(o => o.order_id === orderId);
    const orderUUID = order?.id || orderId;
    
    return timeline
      .filter(entry => entry.order_id === orderUUID && (!itemId || entry.item_id === itemId))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [timeline, orders]);

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

      await supabaseAddTimelineEntry({
        ...entry,
        product_name: productName,
      });

      await fetchTimeline();
    } catch (error) {
      console.error('Error adding timeline entry:', error);
    }
  }, [fetchTimeline, orders]);

  const updateItemStage = useCallback(async (orderId: string, itemId: string, newStage: Stage, substage?: SubStage) => {
    try {
      const order = orders.find(o => o.order_id === orderId);
      const item = order?.items.find(i => i.item_id === itemId);
      if (!order || !item) return;

      const previousPriority = item.priority_computed;

      const deptMap: Record<Stage, 'sales' | 'design' | 'prepress' | 'production'> = {
        sales: 'sales',
        design: 'design', 
        prepress: 'prepress',
        production: 'production',
        dispatch: 'production',
        completed: 'production',
      };

      // Add timeline entry FIRST
      await addTimelineEntry({
        order_id: order.id!,
        item_id: itemId,
        product_name: item.product_name,
        stage: newStage,
        substage: substage,
        action: 'assigned',
        performed_by: user?.uid || '',
        performed_by_name: profile?.full_name || 'Unknown',
        notes: `Moved to ${newStage}${substage ? ` - ${substage}` : ''}`,
        is_public: true,
      });

      // Auto-log work action with proper time calculation
      if (user?.uid && profile?.full_name) {
        const item = order.items.find(i => i.item_id === itemId);
        const startTime = new Date();
        const endTime = new Date();
        // Calculate minimum 1 minute for stage updates
        await autoLogWorkAction(
          user.uid,
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
      console.log(`[updateItemStage] Order ${order.order_id}, Item ${itemId}: Stage=${newStage}, AssignedDept=${assignedDept}`, updateData);

      // Send notifications for stage change
      if (user?.uid) {
        await notifyStageChange(order.order_id, itemId, item.product_name, newStage, user.uid);
      }

      await fetchOrders(false);

      // Check for priority changes
      const newPriority = computePriority(item.delivery_date);
      if (newPriority !== previousPriority) {
        await checkAndNotifyPriority(order.order_id, itemId, item.product_name, newPriority, previousPriority);
      }

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
  }, [orders, user, profile, addTimelineEntry, fetchOrders]);

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
        performed_by: user?.uid || '',
        performed_by_name: profile?.full_name || 'Unknown',
        notes: `Started ${substage}`,
        is_public: true,
      });

      // Auto-log work action
      if (user?.uid && profile?.full_name) {
        const item = order.items.find(i => i.item_id === itemId);
        const startTime = new Date();
        const endTime = new Date();
        await autoLogWorkAction(
          user.uid,
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
      performed_by: user?.uid || '',
      performed_by_name: profile?.full_name || 'Unknown',
      notes: `Completed ${item.current_substage}`,
      is_public: true,
    });

    // Auto-log work action
    if (user?.uid && profile?.full_name) {
      const item = order!.items.find(i => i.item_id === itemId);
      const startTime = new Date();
      const endTime = new Date();
      await autoLogWorkAction(
        user.uid,
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
      if (user?.uid) {
        const adminsQuery = query(collection(db, 'user_roles'), where('role', '==', 'admin'));
        const adminsSnapshot = await getDocs(adminsQuery);
        
        for (const adminDoc of adminsSnapshot.docs) {
          await createNotification(
            adminDoc.data().user_id,
            'Ready for Dispatch',
            `${item.product_name} (${orderId}) is ready for dispatch`,
            'success',
            orderId,
            itemId
          );
        }
      }
    } else {
      const nextSubstage = sequence[currentIndex + 1];
      await updateItemSubstage(orderId, itemId, nextSubstage);
    }
  }, [orders, user, profile, updateItemStage, updateItemSubstage, addTimelineEntry]);

  const startSubstage = useCallback(async (orderId: string, itemId: string, substage: SubStage) => {
    await updateItemSubstage(orderId, itemId, substage);
  }, [updateItemSubstage]);

  const markAsDispatched = useCallback(async (orderId: string, itemId: string) => {
    try {
      const order = orders.find(o => o.order_id === orderId);
      if (!order) return;

      const item = order.items.find(i => i.item_id === itemId);

      // Update via Supabase
      await supabase
        .from('order_items')
        .update({
          current_stage: 'completed',
          is_dispatched: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      await addTimelineEntry({
        order_id: order.id!,
        item_id: itemId,
        product_name: item.product_name,
        stage: 'dispatch',
        action: 'dispatched',
        performed_by: user?.uid || '',
        performed_by_name: profile?.full_name || 'Unknown',
        notes: 'Item dispatched',
        is_public: true,
      });

      // Notify about dispatch
      if (user?.uid && item) {
        const adminsQuery = query(collection(db, 'user_roles'), where('role', '==', 'admin'));
        const adminsSnapshot = await getDocs(adminsQuery);
        
        for (const adminDoc of adminsSnapshot.docs) {
          if (adminDoc.data().user_id !== user.uid) {
            await createNotification(
              adminDoc.data().user_id,
              'Order Dispatched',
              `${item.product_name} (${orderId}) has been dispatched`,
              'success',
              orderId,
              itemId
            );
          }
        }
      }

      const updatedItems = order.items.map(i => 
        i.item_id === itemId ? { ...i, current_stage: 'completed' as Stage, is_dispatched: true } : i
      );
      const allCompleted = updatedItems.every(i => i.current_stage === 'completed');

      if (allCompleted) {
        const orderRef = doc(db, 'orders', order.id!);
        await updateDoc(orderRef, { 
          is_completed: true, 
          updated_at: Timestamp.now() 
        });
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

      const itemRef = doc(db, 'order_items', itemId);
      await updateDoc(itemRef, {
        production_stage_sequence: sequence,
        updated_at: Timestamp.now(),
      });

      const item = order.items.find(i => i.item_id === itemId);
      await addTimelineEntry({
        order_id: order.id!,
        item_id: itemId,
        product_name: item?.product_name,
        stage: 'prepress',
        action: 'assigned',
        performed_by: user?.uid || '',
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
        performed_by: user?.uid || '',
        performed_by_name: profile?.full_name || 'Unknown',
        notes: `Sent to production with sequence: ${sequence.join(' → ')}`,
        is_public: true,
      });

      // Send notifications for stage change
      if (user?.uid) {
        await notifyStageChange(order.order_id, itemId, item.product_name, 'production', user.uid);
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

      // If user is assigned and from different department, unassign them
      if (item.assigned_to) {
        // Get user's department from profile
        try {
          const userProfileRef = doc(db, 'profiles', item.assigned_to);
          const userProfileSnap = await getDoc(userProfileRef);
          if (userProfileSnap.exists()) {
            const userDept = userProfileSnap.data().department;
            if (userDept !== department) {
              // User is from different department, unassign them
              updateData.assigned_to = null;
              updateData.assigned_to_name = null;
              
              // Add timeline entry for unassignment
              await addTimelineEntry({
                order_id: order.id!,
                item_id: itemId,
                product_name: item.product_name,
                stage: item.current_stage,
                action: 'assigned',
                performed_by: user?.uid || '',
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
          updateData.assigned_to_name = null;
        }
      }

      // Update item with new department and unassignment if needed
      // CRITICAL: Update both assigned_department and current_stage in one go to prevent race conditions
      await updateDoc(itemRef, updateData);
      
      // CRITICAL FIX: Update parent order's updated_at to trigger realtime listener
      // This ensures dashboard updates immediately when assignment changes
      const orderRef = doc(db, 'orders', order.id!);
      await updateDoc(orderRef, {
        updated_at: Timestamp.now(),
      });
      
      // CRITICAL: Wait a bit to ensure Firestore has updated before fetching
      await new Promise(resolve => setTimeout(resolve, 100));

      // Add timeline entry for department assignment
      await addTimelineEntry({
        order_id: order.id!,
        item_id: itemId,
        product_name: item.product_name,
        stage: newStage,
        action: 'assigned',
        performed_by: user?.uid || '',
        performed_by_name: profile?.full_name || 'Unknown',
        notes: `Assigned to ${department} department`,
        is_public: true,
      });

      // Send notifications for stage change
      if (user?.uid) {
        await notifyStageChange(order.order_id, itemId, item.product_name, newStage, user.uid);
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
  }, [orders, updateItemStage, user, profile, addTimelineEntry]);

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

      const outsourceInfo: OutsourceInfo = {
        vendor,
        job_details: jobDetails,
        current_outsource_stage: 'outsourced',
        assigned_at: new Date(),
        assigned_by: user.uid,
        assigned_by_name: profile.full_name || 'Unknown',
        assigned_by_role: (profile.role as UserRole) || 'admin',
        follow_up_notes: [],
      };

      const itemRef = doc(db, 'order_items', itemId);
      await updateDoc(itemRef, {
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
            expected_ready_date: Timestamp.fromDate(jobDetails.expected_ready_date),
            quantity_sent: jobDetails.quantity_sent,
            special_instructions: jobDetails.special_instructions || '',
          },
          current_outsource_stage: 'outsourced',
          assigned_at: Timestamp.now(),
          assigned_by: user.uid,
          assigned_by_name: profile.full_name || 'Unknown',
          assigned_by_role: (profile.role as UserRole) || 'admin',
          follow_up_notes: [],
        },
        updated_at: Timestamp.now(),
      });

      // CRITICAL FIX: Update parent order's updated_at to trigger realtime listener
      const orderRef = doc(db, 'orders', order.id!);
      await updateDoc(orderRef, {
        updated_at: Timestamp.now(),
      });

      await addTimelineEntry({
        order_id: orderId,
        item_id: itemId,
        product_name: item.product_name,
        stage: 'outsource',
        action: 'assigned',
        performed_by: user.uid,
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
        description: "Failed to assign to outsource",
        variant: "destructive",
      });
    }
  }, [orders, user, profile, addTimelineEntry, fetchOrders]);

  const assignToUser = useCallback(async (orderId: string, itemId: string, userId: string, userName: string) => {
    try {
      const order = orders.find(o => o.order_id === orderId);
      if (!order) return;

      const item = order.items.find(i => i.item_id === itemId);

      // Use Supabase service to assign to user
      await assignOrderItemToUser(order.id!, itemId, userId);

      await addTimelineEntry({
        order_id: order.id!,
        item_id: itemId,
        product_name: item?.product_name,
        stage: item?.current_stage || 'sales',
        action: 'assigned',
        performed_by: user?.uid || '',
        performed_by_name: profile?.full_name || 'Unknown',
        notes: `Assigned to ${userName}`,
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
  }, [orders, user, profile, addTimelineEntry, fetchOrders]);

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

      // Upload to Cloudinary
      const uploadResult = await uploadFileToCloudinary(file, orderId, fileType);
      
      const downloadURL = uploadResult.secure_url;
      const filePath = uploadResult.public_id;

      if (!downloadURL) {
        throw new Error('Failed to get file URL from Cloudinary');
      }

      if (replaceExisting) {
        // Delete existing files for this item
        const existingFilesQuery = query(collection(db, 'order_files'), where('item_id', '==', itemId));
        const existingFilesSnapshot = await getDocs(existingFilesQuery);
        const batch = writeBatch(db);
        existingFilesSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      }

      // Store file metadata in Firestore
      await setDoc(doc(collection(db, 'order_files')), {
        order_id: order.id,
        item_id: itemId,
        file_url: downloadURL, // Store Cloudinary URL
        file_name: file.name,
        file_type: fileType,
        uploaded_by: user?.uid,
        is_public: true,
        created_at: Timestamp.now(),
        cloudinary_public_id: filePath, // Store public_id for future reference
      });

      const currentItem = order.items.find(i => i.item_id === itemId);
      const currentStage = currentItem?.current_stage || 'sales';
      
      await addTimelineEntry({
        order_id: order.id!,
        item_id: itemId,
        product_name: currentItem?.product_name,
        stage: currentStage,
        action: replaceExisting ? 'final_proof_uploaded' : 'uploaded_proof',
        performed_by: user?.uid || '',
        performed_by_name: profile?.full_name || 'Unknown',
        notes: `${replaceExisting ? 'Replaced with' : 'Uploaded'} ${file.name}`,
        attachments: [{ url: downloadURL, type: file.type }],
        is_public: true,
      });

      // Auto-log work action
      if (user?.uid && profile?.full_name) {
        const item = order.items.find(i => i.item_id === itemId);
        const startTime = new Date();
        const endTime = new Date();
        await autoLogWorkAction(
          user.uid,
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

      await fetchOrders(false);

      toast({
        title: replaceExisting ? "File Replaced" : "File Uploaded",
        description: `${file.name} has been ${replaceExisting ? 'replaced' : 'uploaded'} successfully`,
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
  }, [orders, user, profile, role, addTimelineEntry, fetchOrders, toast]);

  const addNote = useCallback(async (orderId: string, note: string) => {
    try {
      const order = orders.find(o => o.order_id === orderId);
      if (!order) return;

      const newNotes = order.global_notes ? `${order.global_notes}\n${note}` : note;

      const orderRef = doc(db, 'orders', order.id!);
      await updateDoc(orderRef, {
        global_notes: newNotes,
        updated_at: Timestamp.now(),
      });

      await addTimelineEntry({
        order_id: order.id!,
        stage: 'sales',
        action: 'note_added',
        performed_by: user?.uid || '',
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
  }, [orders, user, profile, addTimelineEntry, fetchOrders]);

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

      const orderRef = doc(db, 'orders', order.id!);
      const updateData: any = {
        updated_at: Timestamp.now(),
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
        updateData.delivery_date = Timestamp.fromDate(updates.order_level_delivery_date);
        
        // Update all items' delivery dates to match order-level delivery date
        const itemsQuery = query(collection(db, 'order_items'), where('order_id', '==', order.id));
        const itemsSnapshot = await getDocs(itemsQuery);
        
        const batch = writeBatch(db);
        itemsSnapshot.docs.forEach((itemDoc) => {
          const itemRef = doc(db, 'order_items', itemDoc.id);
          batch.update(itemRef, {
            delivery_date: Timestamp.fromDate(updates.order_level_delivery_date!),
            updated_at: Timestamp.now(),
          });
        });
        await batch.commit();
      }

      await updateDoc(orderRef, updateData);

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

      // Delete related documents
      const batch = writeBatch(db);
      
      // Delete timeline entries
      const timelineQuery = query(collection(db, 'timeline'), where('order_id', '==', order.id));
      const timelineSnapshot = await getDocs(timelineQuery);
      timelineSnapshot.docs.forEach(doc => batch.delete(doc.ref));

      // Delete files
      const filesQuery = query(collection(db, 'order_files'), where('order_id', '==', order.id));
      const filesSnapshot = await getDocs(filesQuery);
      filesSnapshot.docs.forEach(doc => batch.delete(doc.ref));

      // Delete items
      const itemsQuery = query(collection(db, 'order_items'), where('order_id', '==', order.id));
      const itemsSnapshot = await getDocs(itemsQuery);
      itemsSnapshot.docs.forEach(doc => batch.delete(doc.ref));

      // Delete order
      batch.delete(doc(db, 'orders', order.id!));
      
      await batch.commit();

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
      const orderRef = doc(db, 'orders', order.id!);
      await updateDoc(orderRef, {
        delivery_date: Timestamp.fromDate(deliveryDate),
        updated_at: Timestamp.now(),
      });

      const item = order.items.find(i => i.item_id === itemId);
      
      await addTimelineEntry({
        order_id: orderId,
        item_id: itemId,
        product_name: item?.product_name,
        stage: (itemData?.current_stage as Stage) || 'sales',
        action: 'note_added',
        performed_by: user?.uid || '',
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

      const itemRef = doc(db, 'order_items', itemId);
      await updateDoc(itemRef, {
        'outsource_info.current_outsource_stage': newStage,
        'outsource_info.updated_at': Timestamp.now(),
        updated_at: Timestamp.now(),
      });
      
      await addTimelineEntry({
        order_id: orderId,
        item_id: itemId,
        product_name: item.product_name,
        stage: 'outsource',
        action: 'assigned',
        performed_by: user.uid,
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
        created_at: Timestamp.now(),
        created_by: user.uid,
        created_by_name: profile.full_name || 'Unknown',
      };

      const currentNotes = item.outsource_info.follow_up_notes || [];
      const updatedNotes = [...currentNotes, {
        ...newNote,
        created_at: new Date(),
      }];

      const itemRef = doc(db, 'order_items', itemId);
      await updateDoc(itemRef, {
        'outsource_info.follow_up_notes': updatedNotes.map(n => ({
          ...n,
          created_at: Timestamp.fromDate(n.created_at),
        })),
        'outsource_info.updated_at': Timestamp.now(),
        updated_at: Timestamp.now(),
      });

      await addTimelineEntry({
        order_id: orderId,
        item_id: itemId,
        product_name: item.product_name,
        stage: 'outsource',
        action: 'note_added',
        performed_by: user.uid,
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

      const itemRef = doc(db, 'order_items', itemId);
      await updateDoc(itemRef, {
        'outsource_info.current_outsource_stage': 'vendor_dispatched',
        'outsource_info.vendor_dispatch_date': Timestamp.fromDate(dispatchDate),
        'outsource_info.courier_name': courierName,
        'outsource_info.tracking_number': trackingNumber,
        'outsource_info.updated_at': Timestamp.now(),
        updated_at: Timestamp.now(),
      });

      await addTimelineEntry({
        order_id: orderId,
        item_id: itemId,
        product_name: item.product_name,
        stage: 'outsource',
        action: 'assigned',
        performed_by: user.uid,
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

      const itemRef = doc(db, 'order_items', itemId);
      await updateDoc(itemRef, {
        'outsource_info.current_outsource_stage': 'received_from_vendor',
        'outsource_info.received_date': Timestamp.fromDate(receivedDate),
        'outsource_info.receiver_name': receiverName,
        'outsource_info.updated_at': Timestamp.now(),
        updated_at: Timestamp.now(),
      });

      await addTimelineEntry({
        order_id: orderId,
        item_id: itemId,
        product_name: item.product_name,
        stage: 'outsource',
        action: 'assigned',
        performed_by: user.uid,
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

      const itemRef = doc(db, 'order_items', itemId);
      
      if (result === 'pass') {
        await updateDoc(itemRef, {
          'outsource_info.current_outsource_stage': 'decision_pending',
          'outsource_info.qc_result': 'pass',
          'outsource_info.qc_notes': notes.trim(),
          'outsource_info.updated_at': Timestamp.now(),
          updated_at: Timestamp.now(),
        });
      } else {
        // Fail - go back to vendor_in_progress
        await updateDoc(itemRef, {
          'outsource_info.current_outsource_stage': 'vendor_in_progress',
          'outsource_info.qc_result': 'fail',
          'outsource_info.qc_notes': notes.trim(),
          'outsource_info.updated_at': Timestamp.now(),
          updated_at: Timestamp.now(),
        });
      }

      await addTimelineEntry({
        order_id: orderId,
        item_id: itemId,
        product_name: item.product_name,
        stage: 'outsource',
        action: 'note_added',
        performed_by: user.uid,
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

      const itemRef = doc(db, 'order_items', itemId);

      if (decision === 'production') {
        // Send to production - need to set stage sequence
        // For now, just update stage
        await updateDoc(itemRef, {
          current_stage: 'production',
          assigned_department: 'production',
          'outsource_info.current_outsource_stage': 'decision_pending',
          updated_at: Timestamp.now(),
        });

        await addTimelineEntry({
          order_id: orderId,
          item_id: itemId,
          product_name: item.product_name,
          stage: 'production',
          action: 'sent_to_production',
          performed_by: user.uid,
          performed_by_name: profile.full_name || 'Unknown',
          notes: `Sent to Production after QC Pass`,
          is_public: true,
        });
      } else {
        // Mark as ready for dispatch
        await updateDoc(itemRef, {
          current_stage: 'dispatch',
          assigned_department: 'production',
          is_ready_for_production: true,
          'outsource_info.current_outsource_stage': 'decision_pending',
          updated_at: Timestamp.now(),
        });

        await addTimelineEntry({
          order_id: orderId,
          item_id: itemId,
          product_name: item.product_name,
          stage: 'dispatch',
          action: 'assigned',
          performed_by: user.uid,
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
      receiveFromVendor,
      qualityCheck,
      postQCDecision,
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
