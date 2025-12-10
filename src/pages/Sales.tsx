import { useState } from 'react';
import { Filter, Plus, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OrderCard } from '@/components/orders/OrderCard';
import { mockOrders, getItemsByStage } from '@/data/mockData';

export default function Sales() {
  const salesItems = getItemsByStage('sales');
  const wpPendingOrders = mockOrders.filter(o => o.source === 'wordpress' && o.items.some(i => i.current_stage === 'sales'));
  const manualOrders = mockOrders.filter(o => o.source === 'manual');

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync WP
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Order
          </Button>
        </div>
      </div>

      {/* Pending WP Orders Alert */}
      {wpPendingOrders.length > 0 && (
        <Card className="border-priority-yellow/50 bg-priority-yellow/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Badge variant="priority-yellow">{wpPendingOrders.length}</Badge>
              Pending WooCommerce Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              These orders were imported from WordPress and need to be assigned to departments.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {wpPendingOrders.slice(0, 2).map((order) => (
                <OrderCard key={order.order_id} order={order} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Orders Tabs */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Orders</TabsTrigger>
          <TabsTrigger value="pending">
            Pending
            <Badge variant="secondary" className="ml-2">{salesItems.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="urgent">
            Urgent
            <Badge variant="priority-red" className="ml-2">
              {mockOrders.filter(o => o.priority_computed === 'red').length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockOrders.map((order) => (
              <OrderCard key={order.order_id} order={order} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="pending">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {salesItems.map(({ order_id, item }) => {
              const order = mockOrders.find(o => o.order_id === order_id);
              if (!order) return null;
              return <OrderCard key={`${order_id}-${item.item_id}`} order={order} />;
            })}
          </div>
        </TabsContent>

        <TabsContent value="urgent">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockOrders
              .filter(o => o.priority_computed === 'red')
              .map((order) => (
                <OrderCard key={order.order_id} order={order} />
              ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
