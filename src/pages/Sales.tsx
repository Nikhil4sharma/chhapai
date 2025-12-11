import { useState } from 'react';
import { Filter, Plus, Download, RefreshCw, ArrowRight, Send, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OrderCard } from '@/components/orders/OrderCard';
import { PriorityBadge } from '@/components/orders/PriorityBadge';
import { useOrders } from '@/contexts/OrderContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function Sales() {
  const { orders, updateItemStage, sendToProduction } = useOrders();
  const { isAdmin } = useAuth();

  // Get items in sales stage
  const salesOrders = orders.filter(order => 
    order.items.some(item => item.current_stage === 'sales')
  );
  
  const salesItems = orders.flatMap(order => 
    order.items
      .filter(item => item.current_stage === 'sales')
      .map(item => ({
        order,
        item,
      }))
  );

  const wpPendingOrders = orders.filter(o => 
    o.source === 'wordpress' && o.items.some(i => i.current_stage === 'sales')
  );
  
  const urgentItems = salesItems.filter(({ item }) => item.priority_computed === 'red');

  const handleSendToDesign = (orderId: string, itemId: string) => {
    updateItemStage(orderId, itemId, 'design');
    toast({
      title: "Sent to Design",
      description: "Item has been sent to Design department",
    });
  };

  const handleSendToPrepress = (orderId: string, itemId: string) => {
    updateItemStage(orderId, itemId, 'prepress');
    toast({
      title: "Sent to Prepress",
      description: "Item has been sent to Prepress department",
    });
  };

  const handleSendToProduction = (orderId: string, itemId: string) => {
    sendToProduction(orderId, itemId);
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Sales Dashboard</h1>
            <p className="text-muted-foreground">
              {salesItems.length} item{salesItems.length !== 1 ? 's' : ''} in sales stage
            </p>
          </div>
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export orders to CSV</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  New Order
                </Button>
              </TooltipTrigger>
              <TooltipContent>Create a new order</TooltipContent>
            </Tooltip>
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
            </CardContent>
          </Card>
        )}

        {/* Orders Tabs */}
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending">
              In Sales
              <Badge variant="secondary" className="ml-2">{salesItems.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="urgent">
              Urgent
              <Badge variant="priority-red" className="ml-2">{urgentItems.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="all">All Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <div className="space-y-4">
              {salesItems.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                    <h3 className="font-semibold text-lg mb-2">No items in Sales</h3>
                    <p className="text-muted-foreground">All items have been assigned to departments.</p>
                  </CardContent>
                </Card>
              ) : (
                salesItems.map(({ order, item }) => (
                  <Card key={`${order.order_id}-${item.item_id}`} className="card-hover overflow-hidden">
                    <CardContent className="p-0">
                      <div 
                        className={`h-1 ${
                          item.priority_computed === 'blue' ? 'bg-priority-blue' :
                          item.priority_computed === 'yellow' ? 'bg-priority-yellow' :
                          'bg-priority-red'
                        }`}
                      />
                      <div className="p-4">
                        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <Link 
                              to={`/orders/${order.order_id}`}
                              className="flex items-center gap-2 mb-1 hover:underline"
                            >
                              <h3 className="font-semibold truncate text-foreground">{item.product_name}</h3>
                              <PriorityBadge priority={item.priority_computed} showLabel />
                            </Link>
                            <p className="text-sm text-muted-foreground mb-2">
                              {order.order_id} • {order.customer.name} • Qty: {item.quantity}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {item.specifications.paper && (
                                <Badge variant="outline" className="text-xs">{item.specifications.paper}</Badge>
                              )}
                              {item.specifications.size && (
                                <Badge variant="outline" className="text-xs">{item.specifications.size}</Badge>
                              )}
                            </div>
                          </div>

                          <div className="text-sm text-muted-foreground">
                            Due: {format(item.delivery_date, 'MMM d, yyyy')}
                          </div>

                          {/* Stage Actions */}
                          <div className="flex gap-2">
                            <DropdownMenu>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="sm">
                                      <Send className="h-4 w-4 mr-2" />
                                      Assign
                                    </Button>
                                  </DropdownMenuTrigger>
                                </TooltipTrigger>
                                <TooltipContent>Assign to department</TooltipContent>
                              </Tooltip>
                              <DropdownMenuContent align="end" className="bg-popover">
                                <DropdownMenuItem onClick={() => handleSendToDesign(order.order_id, item.item_id)}>
                                  <ArrowRight className="h-4 w-4 mr-2" />
                                  Send to Design
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleSendToPrepress(order.order_id, item.item_id)}>
                                  <ArrowRight className="h-4 w-4 mr-2" />
                                  Send to Prepress
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleSendToProduction(order.order_id, item.item_id)}>
                                  <ArrowRight className="h-4 w-4 mr-2" />
                                  Send to Production
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="urgent">
            <div className="space-y-4">
              {urgentItems.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                    <h3 className="font-semibold text-lg mb-2">No urgent items</h3>
                    <p className="text-muted-foreground">All items are on schedule.</p>
                  </CardContent>
                </Card>
              ) : (
                urgentItems.map(({ order, item }) => (
                  <Card key={`${order.order_id}-${item.item_id}`} className="card-hover border-priority-red/50">
                    <CardContent className="p-4">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                        <div className="flex-1">
                          <Link to={`/orders/${order.order_id}`} className="hover:underline">
                            <h3 className="font-semibold text-foreground">{item.product_name}</h3>
                          </Link>
                          <p className="text-sm text-muted-foreground">
                            {order.order_id} • Due: {format(item.delivery_date, 'MMM d')}
                          </p>
                        </div>
                        <PriorityBadge priority="red" showLabel />
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="all">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {orders.map((order) => (
                <OrderCard key={order.order_id} order={order} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
