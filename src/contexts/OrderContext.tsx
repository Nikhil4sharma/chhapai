import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Order, OrderItem, TimelineEntry, Stage, SubStage, Priority } from '@/types/order';
import { useAuth } from './AuthContext';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface OrderContextType {
  orders: Order[];
  timeline: TimelineEntry[];
  isLoading: boolean;
  getOrderById: (orderId: string) => Order | undefined;
  getOrdersByDepartment: () => Order[];
  getOrdersForUser: () => Order[];
  getTimelineForOrder: (orderId: string, itemId?: string) => TimelineEntry[];
  updateItemStage: (orderId: string, itemId: string, newStage: Stage, substage?: SubStage) => Promise<void>;
  updateItemSubstage: (orderId: string, itemId: string, substage: SubStage) => Promise<void>;
  assignToDepartment: (orderId: string, itemId: string, department: string) => Promise<void>;
  assignToUser: (orderId: string, itemId: string, userId: string, userName: string) => Promise<void>;
  addTimelineEntry: (entry: Omit<TimelineEntry, 'timeline_id' | 'created_at'>) => Promise<void>;
  uploadFile: (orderId: string, itemId: string, file: File, replaceExisting?: boolean) => Promise<void>;
  addNote: (orderId: string, note: string) => Promise<void>;
  updateOrder: (orderId: string, updates: Partial<Order>) => Promise<void>;
  deleteOrder: (orderId: string) => Promise<void>;
  completeSubstage: (orderId: string, itemId: string) => Promise<void>;
  startSubstage: (orderId: string, itemId: string, substage: SubStage) => Promise<void>;
  markAsDispatched: (orderId: string, itemId: string) => Promise<void>;
  sendToProduction: (orderId: string, itemId: string, stageSequence?: string[]) => Promise<void>;
  setProductionStageSequence: (orderId: string, itemId: string, sequence: string[]) => Promise<void>;
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
    await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title,
        message,
        type,
        order_id: orderId,
        item_id: itemId,
      });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

// Helper to notify admins and relevant users
const notifyStageChange = async (
  orderId: string,
  itemId: string,
  productName: string,
  newStage: Stage,
  performerId: string
) => {
  try {
    // Get admins
    const { data: admins } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    // Get users in the target department
    const deptRole = newStage === 'dispatch' || newStage === 'completed' ? 'production' : newStage;
    const { data: deptUsers } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', deptRole);

    const notifyUsers = new Set<string>();
    admins?.forEach(a => notifyUsers.add(a.user_id));
    deptUsers?.forEach(u => notifyUsers.add(u.user_id));
    notifyUsers.delete(performerId); // Don't notify performer

    const title = `Order moved to ${newStage.charAt(0).toUpperCase() + newStage.slice(1)}`;
    const message = `${productName} (${orderId}) is now in ${newStage}`;

    for (const userId of notifyUsers) {
      await createNotification(userId, title, message, 'info', orderId, itemId);
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
  previousPriority?: Priority
) => {
  if (priority === previousPriority) return;

  try {
    // Get admins
    const { data: admins } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (priority === 'red') {
      const title = 'Urgent Order Alert';
      const message = `${productName} (${orderId}) is now URGENT - delivery approaching!`;
      
      for (const admin of admins || []) {
        await createNotification(admin.user_id, title, message, 'urgent', orderId, itemId);
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
  const { user, profile, role, isAdmin } = useAuth();

  // Fetch orders from Supabase
  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders_secure')
        .select('*')
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('*');

      if (itemsError) throw itemsError;

      const { data: filesData, error: filesError } = await supabase
        .from('order_files')
        .select('*');

      if (filesError) throw filesError;

      const { data: profilesData } = await supabase
        .from('profiles_secure')
        .select('user_id, full_name');

      const profilesMap = new Map(profilesData?.map(p => [p.user_id, p.full_name]) || []);

      const mappedOrders: Order[] = (ordersData || []).map(order => {
        const orderItems = (itemsData || [])
          .filter(item => item.order_id === order.id)
          .map(item => {
            const itemFiles = (filesData || [])
              .filter(file => file.item_id === item.id || (file.order_id === order.id && !file.item_id))
              .map(file => ({
                file_id: file.id,
                url: file.file_url,
                type: file.file_type as 'proof' | 'final' | 'image' | 'other',
                uploaded_by: file.uploaded_by || '',
                uploaded_at: new Date(file.created_at),
                is_public: file.is_public,
                file_name: file.file_name,
              }));

            const assignedUserName = item.assigned_to ? profilesMap.get(item.assigned_to) : null;

            return {
              item_id: item.id,
              order_id: item.order_id,
              product_name: item.product_name,
              sku: item.sku,
              quantity: item.quantity,
              specifications: item.specifications || {},
              need_design: item.need_design,
              current_stage: item.current_stage as Stage,
              current_substage: item.current_substage as SubStage,
              assigned_to: item.assigned_to,
              assigned_to_name: assignedUserName,
              assigned_department: item.assigned_department as any,
              delivery_date: item.delivery_date ? new Date(item.delivery_date) : new Date(),
              priority_computed: computePriority(item.delivery_date ? new Date(item.delivery_date) : null),
              files: itemFiles,
              is_ready_for_production: item.is_ready_for_production,
              is_dispatched: item.is_dispatched,
              created_at: new Date(item.created_at),
              updated_at: new Date(item.updated_at),
              production_stage_sequence: item.production_stage_sequence || null,
            } as OrderItem;
          });

        return {
          id: order.id,
          order_id: order.order_id,
          source: order.source as 'wordpress' | 'manual',
          customer: {
            name: order.customer_name,
            phone: order.customer_phone || '',
            email: order.customer_email || '',
            address: order.customer_address || '',
          },
          created_by: order.created_by || '',
          created_at: new Date(order.created_at),
          updated_at: new Date(order.updated_at),
          global_notes: order.global_notes,
          is_completed: order.is_completed,
          order_level_delivery_date: order.delivery_date ? new Date(order.delivery_date) : undefined,
          priority_computed: computePriority(order.delivery_date ? new Date(order.delivery_date) : null),
          items: orderItems,
        } as Order;
      });

      setOrders(mappedOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        title: "Error",
        description: "Failed to load orders",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchTimeline = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('timeline')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mappedTimeline: TimelineEntry[] = (data || []).map(entry => ({
        timeline_id: entry.id,
        order_id: entry.order_id,
        item_id: entry.item_id,
        stage: entry.stage as Stage,
        substage: entry.substage as SubStage,
        action: entry.action as any,
        performed_by: entry.performed_by || '',
        performed_by_name: entry.performed_by_name || 'Unknown',
        notes: entry.notes,
        attachments: entry.attachments as any,
        qty_confirmed: entry.qty_confirmed,
        paper_treatment: entry.paper_treatment,
        created_at: new Date(entry.created_at),
        is_public: entry.is_public,
      }));

      setTimeline(mappedTimeline);
    } catch (error) {
      console.error('Error fetching timeline:', error);
    }
  }, []);

  // Real-time subscription for orders
  useEffect(() => {
    if (!user) return;

    fetchOrders();
    fetchTimeline();

    // Subscribe to real-time changes
    const ordersChannel = supabase
      .channel('orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
        fetchOrders();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timeline' }, () => {
        fetchTimeline();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
    };
  }, [user, fetchOrders, fetchTimeline]);

  const refreshOrders = useCallback(async () => {
    await Promise.all([fetchOrders(), fetchTimeline()]);
  }, [fetchOrders, fetchTimeline]);

  const getOrderById = useCallback((orderId: string) => {
    return orders.find(o => o.order_id === orderId);
  }, [orders]);

  const getOrdersByDepartment = useCallback(() => {
    if (isAdmin || role === 'sales') {
      return orders.filter(o => !o.is_completed);
    }
    
    return orders.filter(order =>
      !order.is_completed && order.items.some(item => item.assigned_department === role)
    );
  }, [orders, role, isAdmin]);

  const getOrdersForUser = useCallback(() => {
    if (isAdmin) {
      return orders.filter(o => !o.is_completed);
    }

    return orders.filter(order =>
      !order.is_completed && order.items.some(item => 
        item.assigned_department === role || item.assigned_to === user?.id
      )
    );
  }, [orders, role, isAdmin, user]);

  const getCompletedOrders = useCallback(() => {
    if (isAdmin || role === 'sales') {
      return orders.filter(o => o.is_completed);
    }
    return orders.filter(o => 
      o.is_completed && o.items.some(item => item.assigned_department === role)
    );
  }, [orders, role, isAdmin]);

  const getTimelineForOrder = useCallback((orderId: string, itemId?: string) => {
    const order = orders.find(o => o.order_id === orderId);
    const orderUUID = order?.id || orderId;
    
    return timeline
      .filter(entry => entry.order_id === orderUUID && (!itemId || entry.item_id === itemId))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [timeline, orders]);

  const addTimelineEntry = useCallback(async (entry: Omit<TimelineEntry, 'timeline_id' | 'created_at'>) => {
    try {
      const { error } = await supabase
        .from('timeline')
        .insert({
          order_id: entry.order_id,
          item_id: entry.item_id,
          stage: entry.stage,
          substage: entry.substage,
          action: entry.action,
          performed_by: entry.performed_by,
          performed_by_name: entry.performed_by_name,
          notes: entry.notes,
          attachments: entry.attachments,
          qty_confirmed: entry.qty_confirmed,
          paper_treatment: entry.paper_treatment,
          is_public: entry.is_public ?? true,
        });

      if (error) throw error;
      await fetchTimeline();
    } catch (error) {
      console.error('Error adding timeline entry:', error);
    }
  }, [fetchTimeline]);

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

      const { error } = await supabase
        .from('order_items')
        .update({
          current_stage: newStage,
          current_substage: substage || null,
          assigned_department: deptMap[newStage],
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      if (error) throw error;

      // Add timeline entry
      await addTimelineEntry({
        order_id: order.id!,
        item_id: itemId,
        stage: newStage,
        substage: substage,
        action: 'assigned',
        performed_by: user?.id || '',
        performed_by_name: profile?.full_name || 'Unknown',
        notes: `Moved to ${newStage}${substage ? ` - ${substage}` : ''}`,
        is_public: true,
      });

      // Send notifications for stage change
      if (user?.id) {
        await notifyStageChange(order.order_id, itemId, item.product_name, newStage, user.id);
      }

      await fetchOrders();

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

      const { error } = await supabase
        .from('order_items')
        .update({
          current_substage: substage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      if (error) throw error;

      await addTimelineEntry({
        order_id: order.id!,
        item_id: itemId,
        stage: 'production',
        substage: substage,
        action: 'substage_started',
        performed_by: user?.id || '',
        performed_by_name: profile?.full_name || 'Unknown',
        notes: `Started ${substage}`,
        is_public: true,
      });

      await fetchOrders();

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
      stage: 'production',
      substage: item.current_substage,
      action: 'substage_completed',
      performed_by: user?.id || '',
      performed_by_name: profile?.full_name || 'Unknown',
      notes: `Completed ${item.current_substage}`,
      is_public: true,
    });

    if (isLastSubstage) {
      await updateItemStage(orderId, itemId, 'dispatch');
      
      // Notify about ready for dispatch
      if (user?.id) {
        const { data: admins } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'admin');
        
        for (const admin of admins || []) {
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

      const { error } = await supabase
        .from('order_items')
        .update({
          current_stage: 'completed',
          is_dispatched: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      if (error) throw error;

      await addTimelineEntry({
        order_id: order.id!,
        item_id: itemId,
        stage: 'dispatch',
        action: 'dispatched',
        performed_by: user?.id || '',
        performed_by_name: profile?.full_name || 'Unknown',
        notes: 'Item dispatched',
        is_public: true,
      });

      // Notify about dispatch
      if (user?.id && item) {
        const { data: admins } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'admin');
        
        for (const admin of admins || []) {
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

      const updatedItems = order.items.map(i => 
        i.item_id === itemId ? { ...i, current_stage: 'completed' as Stage, is_dispatched: true } : i
      );
      const allCompleted = updatedItems.every(i => i.current_stage === 'completed');

      if (allCompleted) {
        await supabase
          .from('orders')
          .update({ is_completed: true, updated_at: new Date().toISOString() })
          .eq('id', order.id);
      }

      await fetchOrders();

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

      const { error } = await supabase
        .from('order_items')
        .update({
          production_stage_sequence: sequence,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      if (error) throw error;

      await addTimelineEntry({
        order_id: order.id!,
        item_id: itemId,
        stage: 'prepress',
        action: 'assigned',
        performed_by: user?.id || '',
        performed_by_name: profile?.full_name || 'Unknown',
        notes: `Production sequence set: ${sequence.join(' → ')}`,
        is_public: true,
      });

      await fetchOrders();

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

  const sendToProduction = useCallback(async (orderId: string, itemId: string, stageSequence?: string[]) => {
    const order = orders.find(o => o.order_id === orderId);
    const item = order?.items.find(i => i.item_id === itemId);
    
    // Use custom sequence if provided or saved, otherwise default
    const sequence = stageSequence || (item as any)?.production_stage_sequence || PRODUCTION_SUBSTAGES;
    const firstStage = sequence[0] as SubStage;

    // Save sequence if provided
    if (stageSequence && stageSequence.length > 0) {
      await setProductionStageSequence(orderId, itemId, stageSequence);
    }

    await updateItemStage(orderId, itemId, 'production', firstStage);
    
    if (order && item) {
      await addTimelineEntry({
        order_id: order.id!,
        item_id: itemId,
        stage: 'production',
        substage: firstStage,
        action: 'sent_to_production',
        performed_by: user?.id || '',
        performed_by_name: profile?.full_name || 'Unknown',
        notes: `Sent to production with sequence: ${sequence.join(' → ')}`,
        is_public: true,
      });
    }
  }, [orders, user, profile, updateItemStage, addTimelineEntry, setProductionStageSequence]);

  const assignToDepartment = useCallback(async (orderId: string, itemId: string, department: string) => {
    const stageMap: Record<string, Stage> = {
      sales: 'sales',
      design: 'design',
      prepress: 'prepress',
      production: 'production',
    };

    const newStage = stageMap[department] || 'sales';
    await updateItemStage(orderId, itemId, newStage, department === 'production' ? 'foiling' : undefined);
  }, [updateItemStage]);

  const assignToUser = useCallback(async (orderId: string, itemId: string, userId: string, userName: string) => {
    try {
      const order = orders.find(o => o.order_id === orderId);
      if (!order) return;

      const item = order.items.find(i => i.item_id === itemId);

      const { error } = await supabase
        .from('order_items')
        .update({
          assigned_to: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      if (error) throw error;

      await addTimelineEntry({
        order_id: order.id!,
        item_id: itemId,
        stage: item?.current_stage || 'sales',
        action: 'assigned',
        performed_by: user?.id || '',
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

      await fetchOrders();

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
      if (!order) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `${orderId}/${itemId}/${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('order-files')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('order-files')
        .getPublicUrl(fileName);

      const fileType = file.type.includes('pdf') ? 'proof' : 
                       file.type.includes('image') ? 'image' : 'other';

      if (replaceExisting) {
        await supabase
          .from('order_files')
          .delete()
          .eq('item_id', itemId);
      }

      const { error: insertError } = await supabase
        .from('order_files')
        .insert({
          order_id: order.id,
          item_id: itemId,
          file_url: urlData.publicUrl,
          file_name: file.name,
          file_type: fileType,
          uploaded_by: user?.id,
          is_public: true,
        });

      if (insertError) throw insertError;

      await addTimelineEntry({
        order_id: order.id!,
        item_id: itemId,
        stage: order.items.find(i => i.item_id === itemId)?.current_stage || 'sales',
        action: replaceExisting ? 'final_proof_uploaded' : 'uploaded_proof',
        performed_by: user?.id || '',
        performed_by_name: profile?.full_name || 'Unknown',
        notes: `${replaceExisting ? 'Replaced with' : 'Uploaded'} ${file.name}`,
        attachments: [{ url: urlData.publicUrl, type: file.type }],
        is_public: true,
      });

      await fetchOrders();

      toast({
        title: replaceExisting ? "File Replaced" : "File Uploaded",
        description: `${file.name} has been ${replaceExisting ? 'replaced' : 'uploaded'} successfully`,
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Error",
        description: "Failed to upload file",
        variant: "destructive",
      });
    }
  }, [orders, user, profile, addTimelineEntry, fetchOrders]);

  const addNote = useCallback(async (orderId: string, note: string) => {
    try {
      const order = orders.find(o => o.order_id === orderId);
      if (!order) return;

      const newNotes = order.global_notes ? `${order.global_notes}\n${note}` : note;

      const { error } = await supabase
        .from('orders')
        .update({
          global_notes: newNotes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (error) throw error;

      await addTimelineEntry({
        order_id: order.id!,
        stage: 'sales',
        action: 'note_added',
        performed_by: user?.id || '',
        performed_by_name: profile?.full_name || 'Unknown',
        notes: note,
        is_public: false,
      });

      await fetchOrders();

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

      const dbUpdates: any = {
        updated_at: new Date().toISOString(),
      };

      if (updates.customer) {
        dbUpdates.customer_name = updates.customer.name;
        dbUpdates.customer_email = updates.customer.email;
        dbUpdates.customer_phone = updates.customer.phone;
        dbUpdates.customer_address = updates.customer.address;
      }
      if (updates.global_notes !== undefined) dbUpdates.global_notes = updates.global_notes;
      if (updates.order_level_delivery_date) dbUpdates.delivery_date = updates.order_level_delivery_date.toISOString();

      const { error } = await supabase
        .from('orders')
        .update(dbUpdates)
        .eq('id', order.id);

      if (error) throw error;

      await fetchOrders();

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
  }, [orders, fetchOrders]);

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

      await supabase.from('timeline').delete().eq('order_id', order.id);
      await supabase.from('order_files').delete().eq('order_id', order.id);
      await supabase.from('order_items').delete().eq('order_id', order.id);
      
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', order.id);

      if (error) throw error;

      await fetchOrders();

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

  return (
    <OrderContext.Provider value={{
      orders,
      timeline,
      isLoading,
      getOrderById,
      getOrdersByDepartment,
      getOrdersForUser,
      getTimelineForOrder,
      updateItemStage,
      updateItemSubstage,
      assignToDepartment,
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
