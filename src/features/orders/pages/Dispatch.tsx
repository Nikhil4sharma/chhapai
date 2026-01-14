import { useState, useMemo } from 'react';
import { Package, Truck, CheckCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductCard } from '@/features/orders/components/ProductCard';
import { useOrders } from '@/features/orders/context/OrderContext';
import { useAuth } from '@/features/auth/context/AuthContext';
import { Order, OrderItem } from '@/types/order';

export default function Dispatch() {
  const { orders } = useOrders();
  const { role, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'ready' | 'dispatched'>('ready');

  // Filter dispatch items
  const dispatchItems = useMemo(() => {
    return orders
      .filter(order => !order.archived_from_wc)
      .flatMap(order =>
        order.items
          .filter(item => {
            // Visibility Check
            if (!isAdmin && role !== 'dispatch' && role !== 'production' && role !== 'sales') {
              // Dispatch usually visible to Dispatch, Production, Sales, Admin
              return false;
            }

            // Logic for "Dispatch" Department View
            // 1. Ready for Dispatch (Production marked it ready OR assigned to dispatch)
            const isReady = item.status === 'ready_for_dispatch'
              || item.status === 'dispatch_pending'
              || item.assigned_department === 'dispatch';

            // 2. Already Dispatched
            const isDispatched = item.is_dispatched || item.status === 'dispatched' || item.current_stage === 'dispatch';

            // 3. Completed but was dispatched
            const isCompletedDispatched = item.status === 'completed' && item.is_dispatched;

            if (activeTab === 'ready') return isReady && !item.is_dispatched;
            if (activeTab === 'dispatched') return isDispatched || isCompletedDispatched;

            return false;
          })
          .map(item => ({ order, item }))
      );
  }, [orders, activeTab, isAdmin, role]);

  const sortedItems = useMemo(() => {
    // Sort by date (newest first)
    return [...dispatchItems].sort((a, b) => {
      return new Date(b.order.created_at).getTime() - new Date(a.order.created_at).getTime();
    });
  }, [dispatchItems]);

  return (
    <div className="h-full flex flex-col gap-4 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Truck className="w-8 h-8 text-primary" />
            Dispatch
          </h1>
          <p className="text-muted-foreground">
            Manage shipments and tracking
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ready for Dispatch</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold text-blue-500">
                {orders.flatMap(o => o.items).filter(i => (i.status === 'ready_for_dispatch' || i.status === 'dispatch_pending') && !i.is_dispatched).length}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Courier</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              <span className="text-2xl font-bold text-orange-500">
                {orders.flatMap(o => o.items).filter(i => i.status === 'dispatch_pending').length}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Dispatched Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold text-green-500">
                {/* Simple approximation, ideally filter by date */}
                {orders.flatMap(o => o.items).filter(i => i.is_dispatched && new Date(i.updated_at).toDateString() === new Date().toDateString()).length}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full flex-1 flex flex-col min-h-0">
        <div className="flex-shrink-0">
          <TabsList>
            <TabsTrigger value="ready">Ready to Dispatch</TabsTrigger>
            <TabsTrigger value="dispatched">Dispatched History</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="ready" className="flex-1 mt-4 overflow-hidden">
          <div className="h-full overflow-y-auto custom-scrollbar pr-2 space-y-3">
            {sortedItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No items ready for dispatch.</p>
              </div>
            ) : (
              sortedItems.map(({ order, item }) => (
                <ProductCard key={`${order.order_id}-${item.item_id}`} order={order} item={item} />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="dispatched" className="flex-1 mt-4 overflow-hidden">
          <div className="h-full overflow-y-auto custom-scrollbar pr-2 space-y-3">
            {sortedItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Truck className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No dispatched history found.</p>
              </div>
            ) : (
              sortedItems.map(({ order, item }) => (
                <ProductCard key={`${order.order_id}-${item.item_id}`} order={order} item={item} />
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
