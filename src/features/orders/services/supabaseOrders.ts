/**
 * Supabase Orders Service
 * 
 * This service provides helper functions for querying orders from Supabase
 * Replaces Firebase Firestore queries in OrderContext
 */

import { supabase } from '@/integrations/supabase/client';
import { Order, OrderItem, TimelineEntry, Stage, Priority } from '@/types/order';
import { MIGRATION_START_DATE, shouldHandleInSupabase } from '@/constants/migration';

/**
 * Fetch orders from Supabase
 * RLS policies automatically filter based on user's role and department
 */
export async function fetchOrdersFromSupabase(): Promise<Order[]> {
  try {
    // Fetch orders (RLS automatically applies filtering)
    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .gte('migration_date', MIGRATION_START_DATE.toISOString()) // Only orders created after migration
      .order('created_at', { ascending: false });

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      throw ordersError;
    }

    if (!ordersData || ordersData.length === 0) {
      return [];
    }

    // Fetch order items for these orders
    const orderIds = ordersData.map(o => o.id);
    const { data: itemsData, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .in('order_id', orderIds);

    if (itemsError) {
      console.error('Error fetching order items:', itemsError);
      throw itemsError;
    }

    // Fetch files for these orders
    const { data: filesData, error: filesError } = await supabase
      .from('order_files')
      .select('*')
      .in('order_id', orderIds);

    if (filesError) {
      console.error('Error fetching order files:', filesError);
      // Don't throw, files are optional
    }

    // Transform data to Order[] format
    const orders: Order[] = ordersData.map(orderRow => {
      const orderItems = (itemsData || [])
        .filter(item => item.order_id === orderRow.id)
        .map(item => transformOrderItem(item, filesData || []));

      return transformOrder(orderRow, orderItems);
    });

    return orders;
  } catch (error) {
    console.error('Error in fetchOrdersFromSupabase:', error);
    throw error;
  }
}

/**
 * Fetch timeline entries for an order
 */
export async function fetchTimelineFromSupabase(orderId: string): Promise<TimelineEntry[]> {
  try {
    const { data, error } = await supabase
      .from('timeline')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching timeline:', error);
      throw error;
    }

    return (data || []).map(transformTimelineEntry);
  } catch (error) {
    console.error('Error in fetchTimelineFromSupabase:', error);
    throw error;
  }
}

/**
 * Subscribe to orders changes via Realtime
 */
export function subscribeToOrders(
  callback: (payload: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new?: any; old?: any }) => void
) {
  const channel = supabase
    .channel('orders-changes')
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
 * Subscribe to order items changes via Realtime
 */
export function subscribeToOrderItems(
  callback: (payload: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new?: any; old?: any }) => void
) {
  const channel = supabase
    .channel('order-items-changes')
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

/**
 * Transform Supabase order row to Order type
 */
function transformOrder(orderRow: any, items: OrderItem[]): Order {
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
    priority_computed: (orderRow.priority as Priority) || 'blue',
    items: items.filter(item => item.order_id === orderRow.id),
    archived_from_wc: orderRow.archived_from_wc || false,
  };
}

/**
 * Transform Supabase order item row to OrderItem type
 */
function transformOrderItem(itemRow: any, filesData: any[]): OrderItem {
  const itemFiles = (filesData || [])
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

  return {
    item_id: itemRow.id,
    order_id: itemRow.order_id,
    product_name: itemRow.product_name,
    sku: itemRow.sku || undefined,
    quantity: itemRow.quantity,
    line_total: itemRow.line_total || undefined,
    specifications: (itemRow.specifications as any) || {},
    woo_meta: (itemRow.woo_meta as any) || undefined,
    need_design: itemRow.need_design || false,
    current_stage: itemRow.current_stage as Stage,
    current_substage: (itemRow.current_substage as any) || null,
    assigned_to: itemRow.assigned_to || undefined,
    assigned_to_name: null, // Will need to fetch from profiles
    assigned_department: itemRow.assigned_department as any,
    delivery_date: new Date(itemRow.delivery_date),
    priority_computed: (itemRow.priority as Priority) || 'blue',
    files: itemFiles,
    is_ready_for_production: itemRow.is_ready_for_production || false,
    is_dispatched: itemRow.is_dispatched || false,
    dispatch_info: itemRow.dispatch_info ? JSON.parse(JSON.stringify(itemRow.dispatch_info)) : undefined,
    created_at: new Date(itemRow.created_at),
    updated_at: new Date(itemRow.updated_at),
    production_stage_sequence: itemRow.production_stage_sequence || undefined,
    outsource_info: itemRow.outsource_info ? JSON.parse(JSON.stringify(itemRow.outsource_info)) : undefined,
  };
}

/**
 * Transform Supabase timeline entry to TimelineEntry type
 */
function transformTimelineEntry(entryRow: any): TimelineEntry {
  return {
    timeline_id: entryRow.id,
    order_id: entryRow.order_id,
    item_id: entryRow.item_id || undefined,
    stage: entryRow.stage as Stage,
    substage: (entryRow.substage as any) || undefined,
    action: entryRow.action as any,
    performed_by: entryRow.performed_by || '',
    performed_by_name: entryRow.performed_by_name || 'Unknown',
    notes: entryRow.notes || undefined,
    attachments: entryRow.attachments || undefined,
    qty_confirmed: entryRow.qty_confirmed || undefined,
    paper_treatment: entryRow.paper_treatment || undefined,
    created_at: new Date(entryRow.created_at),
    is_public: entryRow.is_public !== false,
  };
}

/**
 * Update order item stage
 */
export async function updateOrderItemStage(
  orderId: string,
  itemId: string,
  newStage: Stage,
  substage?: string | null
): Promise<void> {
  try {
    const { error } = await supabase
      .from('order_items')
      .update({
        current_stage: newStage,
        current_substage: substage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .eq('order_id', orderId);

    if (error) {
      console.error('Error updating order item stage:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in updateOrderItemStage:', error);
    throw error;
  }
}

/**
 * Assign order to department
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
        assigned_user: null, // Clear user assignment when assigning to department
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (error) {
      console.error('Error assigning order to department:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in assignOrderToDepartment:', error);
    throw error;
  }
}

/**
 * Assign order to specific user
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

    if (error) {
      console.error('Error assigning order to user:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in assignOrderToUser:', error);
    throw error;
  }
}

