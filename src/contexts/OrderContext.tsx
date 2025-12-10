import React, { createContext, useContext, useState, useCallback } from 'react';
import { Order, OrderItem, TimelineEntry, Stage, SubStage, Priority } from '@/types/order';
import { mockOrders, mockTimeline, computePriority } from '@/data/mockData';
import { useAuth } from './AuthContext';
import { toast } from '@/hooks/use-toast';

interface OrderContextType {
  orders: Order[];
  timeline: TimelineEntry[];
  getOrderById: (orderId: string) => Order | undefined;
  getOrdersByDepartment: () => Order[];
  getTimelineForOrder: (orderId: string, itemId?: string) => TimelineEntry[];
  updateItemStage: (orderId: string, itemId: string, newStage: Stage, substage?: SubStage) => void;
  updateItemSubstage: (orderId: string, itemId: string, substage: SubStage) => void;
  assignToDepartment: (orderId: string, itemId: string, department: string) => void;
  addTimelineEntry: (entry: Omit<TimelineEntry, 'timeline_id' | 'created_at'>) => void;
  uploadFile: (orderId: string, itemId: string, file: File) => Promise<void>;
  addNote: (orderId: string, note: string) => void;
  updateOrder: (orderId: string, updates: Partial<Order>) => void;
  completeSubstage: (orderId: string, itemId: string) => void;
  startSubstage: (orderId: string, itemId: string, substage: SubStage) => void;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

const PRODUCTION_SUBSTAGES: SubStage[] = ['foiling', 'printing', 'pasting', 'cutting', 'letterpress', 'embossing', 'packing'];

export function OrderProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [timeline, setTimeline] = useState<TimelineEntry[]>(mockTimeline);
  const { user, profile, role, isAdmin } = useAuth();

  const getOrderById = useCallback((orderId: string) => {
    return orders.find(o => o.order_id === orderId);
  }, [orders]);

  const getOrdersByDepartment = useCallback(() => {
    if (isAdmin || role === 'sales') {
      return orders;
    }
    
    return orders.filter(order =>
      order.items.some(item => item.assigned_department === role)
    );
  }, [orders, role, isAdmin]);

  const getTimelineForOrder = useCallback((orderId: string, itemId?: string) => {
    return timeline
      .filter(entry => entry.order_id === orderId && (!itemId || entry.item_id === itemId))
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  }, [timeline]);

  const addTimelineEntry = useCallback((entry: Omit<TimelineEntry, 'timeline_id' | 'created_at'>) => {
    const newEntry: TimelineEntry = {
      ...entry,
      timeline_id: `t-${Date.now()}`,
      created_at: new Date(),
    };
    setTimeline(prev => [newEntry, ...prev]);
  }, []);

  const updateItemStage = useCallback((orderId: string, itemId: string, newStage: Stage, substage?: SubStage) => {
    setOrders(prev => prev.map(order => {
      if (order.order_id !== orderId) return order;
      
      const deptMap: Record<Stage, 'sales' | 'design' | 'prepress' | 'production'> = {
        sales: 'sales',
        design: 'design', 
        prepress: 'prepress',
        production: 'production',
        dispatch: 'production',
        completed: 'production',
      };
      
      return {
        ...order,
        updated_at: new Date(),
        items: order.items.map(item => {
          if (item.item_id !== itemId) return item;
          
          return {
            ...item,
            current_stage: newStage,
            current_substage: substage || null,
            assigned_department: deptMap[newStage],
            updated_at: new Date(),
          };
        }),
      };
    }));

    addTimelineEntry({
      order_id: orderId,
      item_id: itemId,
      stage: newStage,
      substage: substage,
      action: 'assigned',
      performed_by: user?.id || '',
      performed_by_name: profile?.full_name || 'Unknown',
      notes: `Moved to ${newStage}${substage ? ` - ${substage}` : ''}`,
      is_public: true,
    });

    toast({
      title: "Stage Updated",
      description: `Item moved to ${newStage}${substage ? ` - ${substage}` : ''}`,
    });
  }, [user, profile, addTimelineEntry]);

  const updateItemSubstage = useCallback((orderId: string, itemId: string, substage: SubStage) => {
    setOrders(prev => prev.map(order => {
      if (order.order_id !== orderId) return order;
      
      return {
        ...order,
        updated_at: new Date(),
        items: order.items.map(item => {
          if (item.item_id !== itemId) return item;
          
          return {
            ...item,
            current_substage: substage,
            updated_at: new Date(),
          };
        }),
      };
    }));

    addTimelineEntry({
      order_id: orderId,
      item_id: itemId,
      stage: 'production',
      substage: substage,
      action: 'substage_started',
      performed_by: user?.id || '',
      performed_by_name: profile?.full_name || 'Unknown',
      notes: `Started ${substage}`,
      is_public: true,
    });

    toast({
      title: "Production Stage Started",
      description: `Started ${substage}`,
    });
  }, [user, profile, addTimelineEntry]);

  const completeSubstage = useCallback((orderId: string, itemId: string) => {
    const order = orders.find(o => o.order_id === orderId);
    const item = order?.items.find(i => i.item_id === itemId);
    
    if (!item || !item.current_substage) return;

    const currentIndex = PRODUCTION_SUBSTAGES.indexOf(item.current_substage);
    const isLastSubstage = currentIndex === PRODUCTION_SUBSTAGES.length - 1;

    if (isLastSubstage) {
      // Move to dispatch
      updateItemStage(orderId, itemId, 'dispatch');
    } else {
      // Move to next substage
      const nextSubstage = PRODUCTION_SUBSTAGES[currentIndex + 1];
      updateItemSubstage(orderId, itemId, nextSubstage);
    }

    addTimelineEntry({
      order_id: orderId,
      item_id: itemId,
      stage: 'production',
      substage: item.current_substage,
      action: 'substage_completed',
      performed_by: user?.id || '',
      performed_by_name: profile?.full_name || 'Unknown',
      notes: `Completed ${item.current_substage}`,
      is_public: true,
    });
  }, [orders, user, profile, updateItemStage, updateItemSubstage, addTimelineEntry]);

  const startSubstage = useCallback((orderId: string, itemId: string, substage: SubStage) => {
    updateItemSubstage(orderId, itemId, substage);
  }, [updateItemSubstage]);

  const assignToDepartment = useCallback((orderId: string, itemId: string, department: string) => {
    const stageMap: Record<string, Stage> = {
      sales: 'sales',
      design: 'design',
      prepress: 'prepress',
      production: 'production',
    };

    const newStage = stageMap[department] || 'sales';
    updateItemStage(orderId, itemId, newStage, department === 'production' ? 'foiling' : undefined);
  }, [updateItemStage]);

  const uploadFile = useCallback(async (orderId: string, itemId: string, file: File) => {
    // In a real app, this would upload to storage
    const fileUrl = URL.createObjectURL(file);
    const fileType = file.type.includes('pdf') ? 'proof' : 'image';

    setOrders(prev => prev.map(order => {
      if (order.order_id !== orderId) return order;
      
      return {
        ...order,
        items: order.items.map(item => {
          if (item.item_id !== itemId) return item;
          
          return {
            ...item,
            files: [...item.files, {
              file_id: `f-${Date.now()}`,
              url: fileUrl,
              type: fileType,
              uploaded_by: user?.id || '',
              uploaded_at: new Date(),
              is_public: true,
            }],
          };
        }),
      };
    }));

    addTimelineEntry({
      order_id: orderId,
      item_id: itemId,
      stage: orders.find(o => o.order_id === orderId)?.items.find(i => i.item_id === itemId)?.current_stage || 'sales',
      action: 'uploaded_proof',
      performed_by: user?.id || '',
      performed_by_name: profile?.full_name || 'Unknown',
      notes: `Uploaded ${file.name}`,
      attachments: [{ url: fileUrl, type: file.type }],
      is_public: true,
    });

    toast({
      title: "File Uploaded",
      description: `${file.name} has been uploaded successfully`,
    });
  }, [orders, user, profile, addTimelineEntry]);

  const addNote = useCallback((orderId: string, note: string) => {
    setOrders(prev => prev.map(order => {
      if (order.order_id !== orderId) return order;
      
      return {
        ...order,
        global_notes: order.global_notes ? `${order.global_notes}\n${note}` : note,
        updated_at: new Date(),
      };
    }));

    addTimelineEntry({
      order_id: orderId,
      stage: 'sales',
      action: 'note_added',
      performed_by: user?.id || '',
      performed_by_name: profile?.full_name || 'Unknown',
      notes: note,
      is_public: false,
    });

    toast({
      title: "Note Added",
      description: "Your note has been saved",
    });
  }, [user, profile, addTimelineEntry]);

  const updateOrder = useCallback((orderId: string, updates: Partial<Order>) => {
    setOrders(prev => prev.map(order => {
      if (order.order_id !== orderId) return order;
      
      return {
        ...order,
        ...updates,
        updated_at: new Date(),
      };
    }));

    toast({
      title: "Order Updated",
      description: "Changes have been saved",
    });
  }, []);

  return (
    <OrderContext.Provider value={{
      orders,
      timeline,
      getOrderById,
      getOrdersByDepartment,
      getTimelineForOrder,
      updateItemStage,
      updateItemSubstage,
      assignToDepartment,
      addTimelineEntry,
      uploadFile,
      addNote,
      updateOrder,
      completeSubstage,
      startSubstage,
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
