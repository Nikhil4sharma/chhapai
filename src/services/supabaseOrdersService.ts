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

    // Update item
    const { error: itemError } = await supabase
      .from('order_items')
      .update({
        current_stage: newStage,
        current_substage: substage || null,
        assigned_department: assignedDept,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .eq('order_id', orderId);

    if (itemError) throw itemError;

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
    const { error } = await supabase
      .from('order_items')
      .update({
        assigned_department: department,
        assigned_to: null, // Clear user assignment
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .eq('order_id', orderId);

    if (error) throw error;
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

    const { error } = await supabase
      .from('order_items')
      .update({
        assigned_to: userId,
        assigned_department: department,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .eq('order_id', orderId);

    if (error) throw error;
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
    let query = supabase
      .from('timeline')
      .select('*')
      .eq('order_id', orderId)
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
        const { data: itemData } = await supabase
          .from('order_items')
          .select('id')
          .eq('item_id', entry.item_id)
          .single();
        
        if (itemData) {
          itemUuid = itemData.id;
        }
      }
    }

    const { error } = await supabase
      .from('timeline')
      .insert({
        order_id: orderUuid,
        item_id: itemUuid,
        stage: entry.stage,
        substage: entry.substage || null,
        action: entry.action,
        performed_by: entry.performed_by,
        performed_by_name: entry.performed_by_name,
        notes: entry.notes || null,
        attachments: entry.attachments || null,
        qty_confirmed: entry.qty_confirmed || null,
        paper_treatment: entry.paper_treatment || null,
        is_public: entry.is_public !== false,
      });

    // Handle table not found error gracefully
    if (error) {
      if (error.code === 'PGRST205' || 
          error.code === '42P01' ||
          error.message?.includes('Could not find the table') ||
          error.message?.includes('does not exist') ||
          error.status === 404 ||
          error.statusCode === 404) {
        console.warn('Timeline table not found in Supabase, skipping timeline entry');
        return; // Silently skip if table doesn't exist
      }
      throw error;
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

