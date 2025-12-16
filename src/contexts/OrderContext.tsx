import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Order, OrderItem, TimelineEntry, Stage, SubStage, Priority } from '@/types/order';
import { useAuth } from './AuthContext';
import { toast } from '@/hooks/use-toast';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy,
  onSnapshot,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '@/integrations/firebase/config';

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
  const { user, profile, role, isAdmin } = useAuth();
  
  // Check if user can view financial data
  const canViewFinancials = isAdmin || role === 'sales';

  // Fetch orders from Firestore
  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Fetch orders
      const ordersQuery = query(collection(db, 'orders'), orderBy('created_at', 'desc'));
      const ordersSnapshot = await getDocs(ordersQuery);
      const ordersData = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Fetch items
      const itemsSnapshot = await getDocs(collection(db, 'order_items'));
      const itemsData = itemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Fetch files
      const filesSnapshot = await getDocs(collection(db, 'order_files'));
      const filesData = filesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Fetch profiles for user names
      const profilesSnapshot = await getDocs(collection(db, 'profiles'));
      const profilesMap = new Map(profilesSnapshot.docs.map(d => [d.data().user_id, d.data().full_name]));

      // Process files to get download URLs
      const filesWithUrls = await Promise.all(
        filesData.map(async (file: any) => {
          try {
            const fileRef = ref(storage, file.file_url);
            const url = await getDownloadURL(fileRef);
            return { ...file, file_url: url };
          } catch (error) {
            console.error('Error getting file URL:', error);
            return file;
          }
        })
      );

      const mappedOrders: Order[] = ordersData.map((order: any) => {
        const orderItems = itemsData
          .filter((item: any) => item.order_id === order.id)
          .map((item: any) => {
            const itemFiles = filesWithUrls
              .filter((file: any) => file.item_id === item.id || (file.order_id === order.id && !file.item_id))
              .map((file: any) => ({
                file_id: file.id,
                url: file.file_url,
                type: file.file_type as 'proof' | 'final' | 'image' | 'other',
                uploaded_by: file.uploaded_by || '',
                uploaded_at: file.created_at?.toDate() || new Date(),
                is_public: file.is_public,
                file_name: file.file_name,
              }));

            const assignedUserName = item.assigned_to ? profilesMap.get(item.assigned_to) : null;

            return {
              item_id: item.id,
              order_id: item.order_id,
              product_name: item.product_name,
              quantity: item.quantity,
              line_total: canViewFinancials ? (item.line_total || undefined) : undefined,
              specifications: item.specifications || {},
              woo_meta: item.woo_meta || undefined,
              need_design: item.need_design,
              current_stage: item.current_stage as Stage,
              current_substage: item.current_substage as SubStage,
              assigned_to: item.assigned_to,
              assigned_to_name: assignedUserName,
              assigned_department: item.assigned_department as any,
              delivery_date: item.delivery_date?.toDate() || new Date(),
              priority_computed: computePriority(item.delivery_date?.toDate() || null),
              files: itemFiles,
              is_ready_for_production: item.is_ready_for_production,
              is_dispatched: item.is_dispatched,
              created_at: item.created_at?.toDate() || new Date(),
              updated_at: item.updated_at?.toDate() || new Date(),
              production_stage_sequence: item.production_stage_sequence || undefined,
            } as OrderItem;
          });

        return {
          id: order.id,
          order_id: order.order_id,
          source: order.source as 'wordpress' | 'manual' | 'woocommerce',
          customer: {
            name: order.customer_name,
            phone: order.customer_phone || '',
            email: order.customer_email || '',
            address: order.customer_address || '',
            city: order.billing_city || undefined,
            state: order.billing_state || undefined,
            pincode: order.billing_pincode || undefined,
          },
          shipping: order.shipping_name ? {
            name: order.shipping_name || '',
            email: order.shipping_email || undefined,
            phone: order.shipping_phone || undefined,
            address: order.shipping_address || '',
            city: order.shipping_city || undefined,
            state: order.shipping_state || undefined,
            pincode: order.shipping_pincode || undefined,
          } : undefined,
          financials: canViewFinancials ? {
            total: order.order_total || undefined,
            tax_cgst: order.tax_cgst || undefined,
            tax_sgst: order.tax_sgst || undefined,
            payment_status: order.payment_status || undefined,
          } : undefined,
          woo_order_id: order.woo_order_id || undefined,
          order_status: order.order_status || undefined,
          created_by: order.created_by || '',
          created_at: order.created_at?.toDate() || new Date(),
          updated_at: order.updated_at?.toDate() || new Date(),
          global_notes: order.global_notes,
          is_completed: order.is_completed,
          order_level_delivery_date: order.delivery_date?.toDate() || undefined,
          priority_computed: computePriority(order.delivery_date?.toDate() || null),
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
  }, [canViewFinancials]);

  const fetchTimeline = useCallback(async () => {
    try {
      const timelineQuery = query(collection(db, 'timeline'), orderBy('created_at', 'desc'));
      const timelineSnapshot = await getDocs(timelineQuery);

      const mappedTimeline: TimelineEntry[] = timelineSnapshot.docs.map(doc => {
        const entry = doc.data();
        return {
          timeline_id: doc.id,
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
          created_at: entry.created_at?.toDate() || new Date(),
          is_public: entry.is_public,
        };
      });

      setTimeline(mappedTimeline);
    } catch (error) {
      console.error('Error fetching timeline:', error);
    }
  }, []);

  // Real-time subscription for orders, items, timeline, and files
  useEffect(() => {
    if (!user) return;

    fetchOrders();
    fetchTimeline();

    // Subscribe to real-time changes
    const unsubscribeOrders = onSnapshot(collection(db, 'orders'), () => {
      console.log('Orders changed - refreshing');
      fetchOrders();
    });

    const unsubscribeItems = onSnapshot(collection(db, 'order_items'), () => {
      console.log('Order items changed - refreshing');
      fetchOrders();
    });

    const unsubscribeFiles = onSnapshot(collection(db, 'order_files'), () => {
      console.log('Order files changed - refreshing');
      fetchOrders();
    });

    const unsubscribeTimeline = onSnapshot(collection(db, 'timeline'), () => {
      console.log('Timeline changed - refreshing');
      fetchTimeline();
    });

    return () => {
      unsubscribeOrders();
      unsubscribeItems();
      unsubscribeFiles();
      unsubscribeTimeline();
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
        item.assigned_department === role || item.assigned_to === user?.uid
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
      await setDoc(doc(collection(db, 'timeline')), {
        order_id: entry.order_id,
        item_id: entry.item_id || null,
        stage: entry.stage,
        substage: entry.substage || null,
        action: entry.action,
        performed_by: entry.performed_by,
        performed_by_name: entry.performed_by_name,
        notes: entry.notes || null,
        attachments: entry.attachments || null,
        qty_confirmed: entry.qty_confirmed || null,
        paper_treatment: entry.paper_treatment || null,
        is_public: entry.is_public ?? true,
        created_at: Timestamp.now(),
      });

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

      // Add timeline entry FIRST
      await addTimelineEntry({
        order_id: order.id!,
        item_id: itemId,
        stage: newStage,
        substage: substage,
        action: 'assigned',
        performed_by: user?.uid || '',
        performed_by_name: profile?.full_name || 'Unknown',
        notes: `Moved to ${newStage}${substage ? ` - ${substage}` : ''}`,
        is_public: true,
      });

      // Update the item stage
      const itemRef = doc(db, 'order_items', itemId);
      await updateDoc(itemRef, {
        current_stage: newStage,
        current_substage: substage || null,
        assigned_department: deptMap[newStage],
        updated_at: Timestamp.now(),
      });

      // Send notifications for stage change
      if (user?.uid) {
        await notifyStageChange(order.order_id, itemId, item.product_name, newStage, user.uid);
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

      const itemRef = doc(db, 'order_items', itemId);
      await updateDoc(itemRef, {
        current_substage: substage,
        updated_at: Timestamp.now(),
      });

      await addTimelineEntry({
        order_id: order.id!,
        item_id: itemId,
        stage: 'production',
        substage: substage,
        action: 'substage_started',
        performed_by: user?.uid || '',
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
      performed_by: user?.uid || '',
      performed_by_name: profile?.full_name || 'Unknown',
      notes: `Completed ${item.current_substage}`,
      is_public: true,
    });

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

      const itemRef = doc(db, 'order_items', itemId);
      await updateDoc(itemRef, {
        current_stage: 'completed',
        is_dispatched: true,
        updated_at: Timestamp.now(),
      });

      await addTimelineEntry({
        order_id: order.id!,
        item_id: itemId,
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

      const itemRef = doc(db, 'order_items', itemId);
      await updateDoc(itemRef, {
        production_stage_sequence: sequence,
        updated_at: Timestamp.now(),
      });

      await addTimelineEntry({
        order_id: order.id!,
        item_id: itemId,
        stage: 'prepress',
        action: 'assigned',
        performed_by: user?.uid || '',
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
    if (!order || !item) return;
    
    // Use custom sequence if provided or saved, otherwise default
    const sequence = stageSequence || (item as any)?.production_stage_sequence || PRODUCTION_SUBSTAGES;
    const firstStage = sequence[0] as SubStage;

    try {
      // Save production sequence FIRST
      if (stageSequence && stageSequence.length > 0) {
        const itemRef = doc(db, 'order_items', itemId);
        await updateDoc(itemRef, {
          production_stage_sequence: stageSequence,
          updated_at: Timestamp.now(),
        });
      }

      // Add timeline entry BEFORE changing department
      await addTimelineEntry({
        order_id: order.id!,
        item_id: itemId,
        stage: 'production',
        substage: firstStage,
        action: 'sent_to_production',
        performed_by: user?.uid || '',
        performed_by_name: profile?.full_name || 'Unknown',
        notes: `Sent to production with sequence: ${sequence.join(' → ')}`,
        is_public: true,
      });

      // Now update department to production
      const itemRef = doc(db, 'order_items', itemId);
      await updateDoc(itemRef, {
        current_stage: 'production',
        current_substage: firstStage,
        assigned_department: 'production',
        is_ready_for_production: true,
        updated_at: Timestamp.now(),
      });

      // Send notifications for stage change
      if (user?.uid) {
        await notifyStageChange(order.order_id, itemId, item.product_name, 'production', user.uid);
      }

      await fetchOrders();

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

      const itemRef = doc(db, 'order_items', itemId);
      await updateDoc(itemRef, {
        assigned_to: userId,
        updated_at: Timestamp.now(),
      });

      await addTimelineEntry({
        order_id: order.id!,
        item_id: itemId,
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
      const filePath = `order-files/${fileName}`;
      
      // Upload to Firebase Storage
      const fileRef = ref(storage, filePath);
      await uploadBytes(fileRef, file);

      // Get download URL
      const downloadURL = await getDownloadURL(fileRef);

      const fileType = file.type.includes('pdf') ? 'proof' : 
                       file.type.includes('image') ? 'image' : 'other';

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
        file_url: filePath,
        file_name: file.name,
        file_type: fileType,
        uploaded_by: user?.uid,
        is_public: true,
        created_at: Timestamp.now(),
      });

      await addTimelineEntry({
        order_id: order.id!,
        item_id: itemId,
        stage: order.items.find(i => i.item_id === itemId)?.current_stage || 'sales',
        action: replaceExisting ? 'final_proof_uploaded' : 'uploaded_proof',
        performed_by: user?.uid || '',
        performed_by_name: profile?.full_name || 'Unknown',
        notes: `${replaceExisting ? 'Replaced with' : 'Uploaded'} ${file.name}`,
        attachments: [{ url: downloadURL, type: file.type }],
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
      if (updates.order_level_delivery_date) updateData.delivery_date = Timestamp.fromDate(updates.order_level_delivery_date);

      await updateDoc(orderRef, updateData);

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
