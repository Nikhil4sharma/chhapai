/**
 * Supabase Orders Service - Complete CRUD Operations
 * 
 * This service provides all order-related operations using Supabase
 * Replaces Firebase Firestore operations in OrderContext
 */

import { supabase } from '@/integrations/supabase/client';
import { Order, OrderItem, TimelineEntry, Stage, SubStage, Priority, UserRole } from '@/types/order';
import { MIGRATION_START_DATE } from '@/constants/migration';

/**
 * Fetch all orders (RLS automatically filters based on user role/department)
 */
export async function fetchAllOrders(): Promise<Order[]> {
  try {
    // Fetch orders (RLS automatically applies department/assignment filtering)
    // Note: migration_date column might not exist initially, so we check created_at
    let query = supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    
    // If migration_date column exists, filter by it
    // Otherwise fetch all (for backward compatibility during migration)
    const { data: ordersData, error: ordersError } = await query;

    if (ordersError) throw ordersError;
    if (!ordersData || ordersData.length === 0) return [];

    // Fetch order items
    const orderIds = ordersData.map(o => o.id);
    const { data: itemsData, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .in('order_id', orderIds);

    if (itemsError) throw itemsError;

    // Fetch files
    const { data: filesData, error: filesError } = await supabase
      .from('order_files')
      .select('*')
      .in('order_id', orderIds);

    // Files error is non-critical
    if (filesError) console.warn('Error fetching files:', filesError);

    // Fetch profiles for assigned users
    const userIds = new Set<string>();
    (itemsData || []).forEach(item => {
      if (item.assigned_to) userIds.add(item.assigned_to);
    });
    (filesData || []).forEach(file => {
      if (file.uploaded_by) userIds.add(file.uploaded_by);
    });

    const profilesMap = new Map<string, string>();
    if (userIds.size > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', Array.from(userIds));

      (profilesData || []).forEach(profile => {
        if (profile.full_name) profilesMap.set(profile.user_id, profile.full_name);
      });
    }

    // Transform to Order[] format
    return transformOrdersToAppFormat(ordersData, itemsData || [], filesData || [], profilesMap);
  } catch (error) {
    console.error('Error in fetchAllOrders:', error);
    throw error;
  }
}

/**
 * Transform Supabase data to Order[] format
 */
function transformOrdersToAppFormat(
  ordersData: any[],
  itemsData: any[],
  filesData: any[],
  profilesMap: Map<string, string>
): Order[] {
  return ordersData.map(orderRow => {
    const orderItems = itemsData
      .filter(item => item.order_id === orderRow.id)
      .map(item => transformOrderItem(item, filesData, profilesMap));

    return {
      id: orderRow.id,
      order_id: orderRow.order_id,
      source: orderRow.source as 'wordpress' | 'manual' | 'woocommerce',
      customer: {
        name: orderRow.customer_name,
        phone: orderRow.customer_phone || '',
        email: orderRow.customer_email || '',
        address: orderRow.customer_address || '',
        city: orderRow.billing_city || undefined,
        state: orderRow.billing_state || undefined,
        pincode: orderRow.billing_pincode || undefined,
      },
      shipping: orderRow.shipping_name ? {
        name: orderRow.shipping_name,
        email: orderRow.shipping_email || undefined,
        phone: orderRow.shipping_phone || undefined,
        address: orderRow.shipping_address || '',
        city: orderRow.shipping_city || undefined,
        state: orderRow.shipping_state || undefined,
        pincode: orderRow.shipping_pincode || undefined,
      } : undefined,
      financials: {
        total: orderRow.order_total || undefined,
        tax_cgst: orderRow.tax_cgst || undefined,
        tax_sgst: orderRow.tax_sgst || undefined,
        payment_status: orderRow.payment_status || undefined,
        amount_received: orderRow.amount_received || undefined,
      },
      woo_order_id: orderRow.woo_order_id || undefined,
      order_status: orderRow.order_status || undefined,
      created_by: orderRow.created_by || '',
      created_at: new Date(orderRow.created_at),
      updated_at: new Date(orderRow.updated_at),
      global_notes: orderRow.global_notes || undefined,
      is_completed: orderRow.is_completed,
      order_level_delivery_date: orderRow.delivery_date ? new Date(orderRow.delivery_date) : undefined,
      priority_computed: computePriority(orderRow.delivery_date ? new Date(orderRow.delivery_date) : null),
      items: orderItems,
      archived_from_wc: orderRow.archived_from_wc || false,
      last_seen_in_wc_sync: orderRow.last_seen_in_wc_sync ? new Date(orderRow.last_seen_in_wc_sync) : undefined,
      meta: {
        imported: !!orderRow.imported_by,
        imported_by: orderRow.imported_by || undefined,
      },
    };
  });
}

/**
 * Transform order item
 */
function transformOrderItem(itemRow: any, filesData: any[], profilesMap: Map<string, string>): OrderItem {
  const itemFiles = filesData
    .filter(f => f.item_id === itemRow.id)
    .map(f => ({
      file_id: f.id,
      url: f.file_url,
      file_name: f.file_name,
      type: f.file_type as 'proof' | 'final' | 'image' | 'other',
      uploaded_by: f.uploaded_by || '',
      uploaded_at: new Date(f.created_at),
      is_public: f.is_public || false,
    }));

  // Handle missing delivery_date - use order's delivery_date or default to 7 days from now
  let deliveryDate: Date;
  if (itemRow.delivery_date) {
    deliveryDate = new Date(itemRow.delivery_date);
  } else {
    deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 7);
  }

  return {
    item_id: itemRow.item_id || itemRow.id, // Use item_id if available, fallback to id
    order_id: itemRow.order_id,
    product_name: itemRow.product_name,
    sku: itemRow.sku || undefined,
    quantity: itemRow.quantity,
    line_total: itemRow.line_total || undefined,
    specifications: itemRow.specifications || {},
    woo_meta: itemRow.woo_meta || undefined,
    need_design: itemRow.need_design || false,
    current_stage: itemRow.current_stage as Stage,
    current_substage: (itemRow.current_substage as SubStage) || null,
    assigned_to: itemRow.assigned_to || undefined,
    assigned_to_name: itemRow.assigned_to ? profilesMap.get(itemRow.assigned_to) || null : null,
    assigned_department: itemRow.assigned_department as UserRole,
    delivery_date: deliveryDate,
    priority_computed: computePriority(deliveryDate),
    files: itemFiles,
    is_ready_for_production: itemRow.is_ready_for_production || false,
    is_dispatched: itemRow.is_dispatched || false,
    dispatch_info: itemRow.dispatch_info || undefined,
    created_at: new Date(itemRow.created_at),
    updated_at: new Date(itemRow.updated_at),
    production_stage_sequence: itemRow.production_stage_sequence || undefined,
    outsource_info: itemRow.outsource_info || undefined,
  };
}

/**
 * Compute priority from delivery date
 */
function computePriority(deliveryDate: Date | null): Priority {
  if (!deliveryDate) return 'blue';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const delivery = new Date(deliveryDate);
  delivery.setHours(0, 0, 0, 0);
  const daysUntil = Math.ceil((delivery.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntil > 5) return 'blue';
  if (daysUntil >= 3) return 'yellow';
  return 'red';
}

/**
 * Update order item stage
 */
export async function updateOrderItemStage(
  orderId: string,
  itemId: string,
  newStage: Stage,
  substage?: SubStage
): Promise<void> {
  try {
    // Map stage to department
    const deptMap: Record<Stage, 'sales' | 'design' | 'prepress' | 'production'> = {
      sales: 'sales',
      design: 'design',
      prepress: 'prepress',
      production: 'production',
      dispatch: 'production',
      completed: 'production',
      outsource: 'production',
    };

    const assignedDept = deptMap[newStage];

    // itemId can be either UUID (id) or string (item_id field)
    // Try UUID first, then fallback to item_id field lookup
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let itemUuid: string | null = null;
    
    if (uuidRegex.test(itemId)) {
      // Already a UUID, use directly
      itemUuid = itemId;
    } else {
      // It's a string item_id, need to find the UUID id
      const { data: itemData, error: itemError } = await supabase
        .from('order_items')
        .select('id')
        .eq('item_id', itemId)
        .eq('order_id', orderId)
        .maybeSingle();
      
      if (itemError || !itemData) {
        // If item_id column doesn't exist or item not found, try using itemId as UUID anyway
        itemUuid = itemId;
      } else {
        itemUuid = itemData.id;
      }
    }
    
    if (!itemUuid) {
      throw new Error(`Could not find order item with id: ${itemId}`);
    }

    // Update item
    const { error: itemError } = await supabase
      .from('order_items')
      .update({
        current_stage: newStage,
        current_substage: substage || null,
        assigned_department: assignedDept,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemUuid)
      .eq('order_id', orderId);

    if (itemError) {
      // Provide more detailed error message for RLS issues
      if (itemError.code === '42501') {
        throw new Error(`Permission denied: Cannot update item stage to ${newStage}. ${itemError.message}`);
      }
      throw itemError;
    }

    // Update order's current_department will be handled by trigger
  } catch (error) {
    console.error('Error in updateOrderItemStage:', error);
    throw error;
  }
}

/**
 * Assign order item to department
 */
export async function assignOrderItemToDepartment(
  orderId: string,
  itemId: string,
  department: string
): Promise<void> {
  try {
    // itemId can be either UUID (id) or string (item_id field)
    // Try UUID first, then fallback to item_id field lookup
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let itemUuid: string | null = null;
    
    if (uuidRegex.test(itemId)) {
      // Already a UUID, use directly
      itemUuid = itemId;
    } else {
      // It's a string item_id, need to find the UUID id
      const { data: itemData, error: itemError } = await supabase
        .from('order_items')
        .select('id')
        .eq('item_id', itemId)
        .eq('order_id', orderId)
        .maybeSingle();
      
      if (itemError || !itemData) {
        // If item_id column doesn't exist or item not found, try using itemId as UUID anyway
        // (for backward compatibility)
        itemUuid = itemId;
      } else {
        itemUuid = itemData.id;
      }
    }
    
    if (!itemUuid) {
      throw new Error(`Could not find order item with id: ${itemId}`);
    }
    
    const { error } = await supabase
      .from('order_items')
      .update({
        assigned_department: department,
        assigned_to: null, // Clear user assignment
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemUuid)
      .eq('order_id', orderId);

    if (error) {
      // Provide more detailed error message for RLS issues
      if (error.code === '42501') {
        throw new Error(`Permission denied: Cannot assign item to ${department} department. ${error.message}`);
      }
      throw error;
    }

    // Update orders.current_department to reflect the department assignment
    // This helps with RLS policies and department-based filtering
    try {
      const { error: orderUpdateError } = await supabase
        .from('orders')
        .update({
          current_department: department,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (orderUpdateError && orderUpdateError.code !== '42501') {
        // Log but don't throw - this is not critical, trigger may handle it
        console.warn('Warning: Could not update orders.current_department:', orderUpdateError);
      }
    } catch (e) {
      // Ignore errors - not critical
      console.warn('Warning: Could not update orders.current_department:', e);
    }
  } catch (error) {
    console.error('Error in assignOrderItemToDepartment:', error);
    throw error;
  }
}

/**
 * Assign order item to user
 */
export async function assignOrderItemToUser(
  orderId: string,
  itemId: string,
  userId: string
): Promise<void> {
  try {
    // First get user's department from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('department')
      .eq('user_id', userId)
      .single();

    const department = profile?.department || 'sales';

    // Also get user's role for department mapping
    let userDepartment = department;
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    
    if (roleData?.role) {
      userDepartment = roleData.role;
    }

    // itemId can be either UUID (id) or string (item_id field)
    // Try UUID first, then fallback to item_id field lookup
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let itemUuid: string | null = null;

    if (uuidRegex.test(itemId)) {
      // Already a UUID, use directly
      itemUuid = itemId;
    } else {
      // It's a string item_id, need to find the UUID id
      const { data: itemData, error: itemError } = await supabase
        .from('order_items')
        .select('id')
        .eq('item_id', itemId)
        .eq('order_id', orderId)
        .maybeSingle();

      if (itemError || !itemData) {
        // If item_id column doesn't exist or item not found, try using itemId as UUID anyway
        // (for backward compatibility)
        itemUuid = itemId;
      } else {
        itemUuid = itemData.id;
      }
    }

    if (!itemUuid) {
      throw new Error(`Could not find order item with id: ${itemId}`);
    }

    const { error } = await supabase
      .from('order_items')
      .update({
        assigned_to: userId,
        assigned_department: userDepartment,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemUuid)
      .eq('order_id', orderId);

    if (error) throw error;

    // Update orders.current_department and assigned_user to reflect the assignment
    try {
      const { error: orderUpdateError } = await supabase
        .from('orders')
        .update({
          current_department: userDepartment,
          assigned_user: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (orderUpdateError && orderUpdateError.code !== '42501') {
        // Log but don't throw - this is not critical, trigger may handle it
        console.warn('Warning: Could not update orders.current_department/assigned_user:', orderUpdateError);
      }
    } catch (e) {
      // Ignore errors - not critical
      console.warn('Warning: Could not update orders.current_department/assigned_user:', e);
    }
  } catch (error) {
    console.error('Error in assignOrderItemToUser:', error);
    throw error;
  }
}

/**
 * Assign order to department (order-level assignment)
 */
export async function assignOrderToDepartment(
  orderId: string,
  department: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('orders')
      .update({
        current_department: department,
        assigned_user: null, // Clear user assignment
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (error) throw error;
  } catch (error) {
    console.error('Error in assignOrderToDepartment:', error);
    throw error;
  }
}

/**
 * Assign order to user (order-level assignment)
 */
export async function assignOrderToUser(
  orderId: string,
  userId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('orders')
      .update({
        assigned_user: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (error) throw error;
  } catch (error) {
    console.error('Error in assignOrderToUser:', error);
    throw error;
  }
}

/**
 * Fetch timeline entries for an order
 */
export async function fetchTimelineEntries(orderId: string, itemId?: string): Promise<TimelineEntry[]> {
  try {
    // Convert order_id string (e.g., "53509") to UUID if needed
    let orderUuid: string | null = null;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (uuidRegex.test(orderId)) {
      orderUuid = orderId;
    } else {
      // orderId is a string order number, need to fetch UUID from orders table
      const { data: orderData } = await supabase
        .from('orders')
        .select('id')
        .eq('order_id', orderId)
        .maybeSingle();
      
      if (orderData) {
        orderUuid = orderData.id;
      } else {
        console.warn(`[fetchTimelineEntries] Order not found for order_id: ${orderId}`);
        return [];
      }
    }

    if (!orderUuid) {
      console.warn(`[fetchTimelineEntries] Could not resolve UUID for order_id: ${orderId}`);
      return [];
    }

    let query = supabase
      .from('timeline')
      .select('*')
      .eq('order_id', orderUuid)
      .order('created_at', { ascending: false });

    if (itemId) {
      query = query.eq('item_id', itemId);
    }

    const { data, error } = await query;

    // Handle table not found error gracefully
    if (error) {
      if (error.code === 'PGRST205' || 
          error.code === '42P01' ||
          error.message?.includes('Could not find the table') ||
          error.message?.includes('does not exist') ||
          error.status === 404 ||
          error.statusCode === 404) {
        console.warn('Timeline table not found in Supabase, returning empty array');
        return [];
      }
      throw error;
    }

    return (data || []).map(entry => ({
      timeline_id: entry.id,
      order_id: entry.order_id,
      item_id: entry.item_id || undefined,
      stage: entry.stage as Stage,
      substage: (entry.substage as SubStage) || undefined,
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
  } catch (error) {
    console.error('Error in fetchTimelineEntries:', error);
    throw error;
  }
}

/**
 * Add activity log entry (department-wise activity tracking)
 */
export async function addActivityLog(params: {
  orderId: string;
  itemId?: string;
  department: 'sales' | 'design' | 'prepress' | 'production' | 'dispatch';
  action: 'created' | 'assigned' | 'started' | 'completed' | 'rejected' | 'dispatched' | 'note_added' | 'file_uploaded' | 'status_changed';
  message: string;
  createdBy: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  try {
    // Convert order_id string (WC-53522) to UUID (orders.id) if needed
    let orderUuid: string | null = null;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (uuidRegex.test(params.orderId)) {
      orderUuid = params.orderId;
    } else {
      const { data: orderData } = await supabase
        .from('orders')
        .select('id')
        .eq('order_id', params.orderId)
        .maybeSingle();
      
      if (orderData) {
        orderUuid = orderData.id;
      }
    }
    
    if (!orderUuid) {
      console.warn('[addActivityLog] Could not find order UUID for:', params.orderId);
      return;
    }
    
    // Convert item_id to UUID if needed
    let itemUuid: string | undefined = undefined;
    if (params.itemId) {
      if (uuidRegex.test(params.itemId)) {
        itemUuid = params.itemId;
      } else {
        const { data: itemData } = await supabase
          .from('order_items')
          .select('id')
          .eq('item_id', params.itemId)
          .maybeSingle();
        
        if (itemData) {
          itemUuid = itemData.id;
        }
      }
    }
    
    const { error } = await supabase
      .from('order_activity_logs')
      .insert({
        order_id: orderUuid,
        item_id: itemUuid || null,
        department: params.department,
        action: params.action,
        message: params.message,
        created_by: params.createdBy,
        metadata: params.metadata || {},
      });
    
    if (error) {
      console.error('[addActivityLog] Error inserting activity log:', error);
      // Don't throw - activity logs are not critical
    }
  } catch (error) {
    console.error('[addActivityLog] Error:', error);
    // Don't throw - activity logs are not critical
  }
}

/**
 * Fetch activity logs for an order
 */
export async function fetchActivityLogs(orderId: string): Promise<any[]> {
  try {
    // Convert order_id string (WC-53522) to UUID if needed
    let orderUuid: string | null = null;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (uuidRegex.test(orderId)) {
      orderUuid = orderId;
    } else {
      const { data: orderData } = await supabase
        .from('orders')
        .select('id')
        .eq('order_id', orderId)
        .maybeSingle();
      
      if (orderData) {
        orderUuid = orderData.id;
      }
    }
    
    if (!orderUuid) {
      // Don't log warning for every order - table might not exist yet
      return [];
    }
    
    const { data, error } = await supabase
      .from('order_activity_logs')
      .select('*')
      .eq('order_id', orderUuid)
      .order('created_at', { ascending: false })
      .limit(200); // Limit to recent 200 logs per order
    
    if (error) {
      // Handle table not found gracefully (table may not exist if migration hasn't run)
      if (error.code === 'PGRST205' || 
          error.code === '42P01' || 
          error.code === 'PGRST116' ||
          error.status === 404 ||
          error.statusCode === 404 ||
          error.message?.includes('relation') ||
          error.message?.includes('does not exist') ||
          error.message?.includes('Could not find the table')) {
        // Table doesn't exist yet - this is OK during migration
        // Silently return empty array (don't log - expected during migration)
        return [];
      }
      // Don't log RLS/permission errors - expected for some users
      if (error.code !== 'PGRST301' && error.code !== '42501') {
        // Only log unexpected errors
        console.warn('[fetchActivityLogs] Unexpected error (non-critical):', error.code, error.message);
      }
      return [];
    }
    
    // Fetch profile names for created_by users
    const userIds = [...new Set((data || []).map((log: any) => log.created_by).filter(Boolean))];
    const profilesMap = new Map<string, string>();
    
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);
      
      (profilesData || []).forEach((profile: any) => {
        if (profile.full_name) {
          profilesMap.set(profile.user_id, profile.full_name);
        }
      });
    }
    
    // Map to include profile name if available
    return (data || []).map((log: any) => {
      const userName = log.created_by ? (profilesMap.get(log.created_by) || 'Unknown') : null;
      return {
        ...log,
        created_by_name: userName,
        performed_by_name: userName || 'Unknown',
      };
    });
  } catch (error) {
    // Don't throw - return empty array on error
    return [];
  }
}

/**
 * Add timeline entry
 */
export async function addTimelineEntry(entry: Omit<TimelineEntry, 'timeline_id' | 'created_at'>): Promise<void> {
  try {
    // CRITICAL: Convert order_id string (WC-53522) to UUID (orders.id)
    // Timeline table expects UUID, not the order_id text field
    let orderUuid: string | null = null;
    
    // Check if order_id is already a UUID (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (uuidRegex.test(entry.order_id)) {
      // Already a UUID, use it directly
      orderUuid = entry.order_id;
    } else {
      // It's a string order_id (like WC-53522), need to find the UUID
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('id')
        .eq('order_id', entry.order_id)
        .single();
      
      if (orderError || !orderData) {
        console.error('Error finding order UUID for timeline entry:', orderError);
        console.error('Order ID:', entry.order_id);
        // Don't throw - just skip timeline entry if order not found
        return;
      }
      
      orderUuid = orderData.id;
    }

    // Also convert item_id if it's not a UUID (should be UUID already, but check)
    let itemUuid: string | null = null;
    if (entry.item_id) {
      if (uuidRegex.test(entry.item_id)) {
        itemUuid = entry.item_id;
      } else {
        // Try to find item UUID by item_id field
        try {
          const { data: itemData, error: itemError } = await supabase
            .from('order_items')
            .select('id')
            .eq('item_id', entry.item_id)
            .single();
          
          // Handle 400 Bad Request errors gracefully
          if (itemError) {
            const isBadRequest = itemError.status === 400 || 
              itemError.statusCode === 400 ||
              itemError.code === 'PGRST204' ||
              itemError.message?.includes('item_id') ||
              itemError.message?.includes('column') ||
              itemError.message?.includes('does not exist');
            
            if (isBadRequest) {
              // item_id column might not exist or query format issue
              // Skip item_id lookup, use null
              console.warn('item_id column issue, skipping item_id lookup:', entry.item_id);
              itemUuid = null;
            } else {
              // Other errors - log but don't throw
              console.warn('Error finding item by item_id:', itemError);
              itemUuid = null;
            }
          } else if (itemData) {
            itemUuid = itemData.id;
          }
        } catch (error: any) {
          // Handle any errors gracefully
          console.warn('Error finding item UUID by item_id:', error);
          itemUuid = null;
        }
      }
    }

    // Ensure performed_by is a valid UUID (convert if needed)
    let performedByUuid: string | null = null;
    if (entry.performed_by) {
      if (uuidRegex.test(entry.performed_by)) {
        performedByUuid = entry.performed_by;
      } else {
        // If it's not a UUID, try to find user by email or other identifier
        // For now, set to null if not a valid UUID (RLS will use auth.uid())
        console.warn('performed_by is not a valid UUID:', entry.performed_by);
        performedByUuid = null; // Let RLS use auth.uid() instead
      }
    }

    const insertData: any = {
      order_id: orderUuid,
      item_id: itemUuid,
      product_name: entry.product_name || null,
      stage: entry.stage,
      substage: entry.substage || null,
      action: entry.action,
      performed_by_name: entry.performed_by_name,
      notes: entry.notes || null,
      attachments: entry.attachments || null,
      qty_confirmed: entry.qty_confirmed || null,
      paper_treatment: entry.paper_treatment || null,
      is_public: entry.is_public !== false,
    };

    // Only include performed_by if it's a valid UUID
    if (performedByUuid) {
      insertData.performed_by = performedByUuid;
    }

    const { error, data } = await supabase
      .from('timeline')
      .insert(insertData)
      .select();

    // Handle table not found error gracefully
    if (error) {
      // Log detailed error for debugging
      console.error('Timeline insert error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        order_id: entry.order_id,
        orderUuid,
        item_id: entry.item_id,
        itemUuid,
        performed_by: entry.performed_by,
        performedByUuid,
      });

      if (error.code === 'PGRST205' || 
          error.code === '42P01' ||
          error.message?.includes('Could not find the table') ||
          error.message?.includes('does not exist') ||
          error.status === 404 ||
          error.statusCode === 404) {
        console.warn('Timeline table not found in Supabase, skipping timeline entry');
        return; // Silently skip if table doesn't exist
      }

      // Check for RLS policy violation
      if (error.code === '42501' || error.message?.includes('permission denied') || error.message?.includes('policy')) {
        console.error('RLS policy violation when inserting timeline entry. User may not have access to this order.');
        // Don't throw - just log and skip
        return;
      }

      throw error;
    }

    if (data && data.length > 0) {
      console.log('Timeline entry added successfully:', data[0].id);
    }
  } catch (error) {
    console.error('Error in addTimelineEntry:', error);
    throw error;
  }
}

/**
 * Create Realtime subscription for orders
 */
export function subscribeToOrdersChanges(
  callback: (payload: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new?: any; old?: any }) => void
) {
  const channel = supabase
    .channel('orders-realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders',
      },
      (payload) => {
        callback({
          eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
          new: payload.new,
          old: payload.old,
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Create Realtime subscription for order items
 */
export function subscribeToOrderItemsChanges(
  callback: (payload: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new?: any; old?: any }) => void
) {
  const channel = supabase
    .channel('order-items-realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'order_items',
      },
      (payload) => {
        callback({
          eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
          new: payload.new,
          old: payload.old,
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

