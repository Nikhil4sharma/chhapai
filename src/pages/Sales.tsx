import { useState } from 'react';
import { Plus, Download, ArrowRight, Send, CheckCircle, Trash2, UserCircle, Loader2, Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
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
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function Sales() {
  const { orders, updateItemStage, sendToProduction, deleteOrder, isLoading, refreshOrders } = useOrders();
  const { isAdmin, role } = useAuth();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);

  const canDelete = isAdmin || role === 'sales';

  // Get items in sales stage
  const salesOrders = orders.filter(order => 
    !order.is_completed && order.items.some(item => item.current_stage === 'sales')
  );
  
  const salesItems = orders.flatMap(order => 
    order.items
      .filter(item => item.current_stage === 'sales')
      .map(item => ({
        order,
        item,
      }))
  );

  // Filter items
  const filteredSalesItems = salesItems.filter(({ order, item }) => {
    const matchesSearch = searchTerm === '' || 
      order.order_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.product_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPriority = priorityFilter === 'all' || item.priority_computed === priorityFilter;
    
    return matchesSearch && matchesPriority;
  });

  const wpPendingOrders = orders.filter(o => 
    o.source === 'wordpress' && o.items.some(i => i.current_stage === 'sales')
  );
  
  const urgentItems = filteredSalesItems.filter(({ item }) => item.priority_computed === 'red');

  const handleSendToDesign = async (orderId: string, itemId: string) => {
    await updateItemStage(orderId, itemId, 'design');
  };

  const handleSendToPrepress = async (orderId: string, itemId: string) => {
    await updateItemStage(orderId, itemId, 'prepress');
  };

  const handleSendToProduction = async (orderId: string, itemId: string) => {
    await sendToProduction(orderId, itemId);
  };

  const handleDeleteOrder = async () => {
    if (orderToDelete) {
      await deleteOrder(orderToDelete);
      setOrderToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const confirmDelete = (orderId: string) => {
    setOrderToDelete(orderId);
    setDeleteDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading orders...</span>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Sales Dashboard</h1>
            <p className="text-muted-foreground">
              {filteredSalesItems.length} item{filteredSalesItems.length !== 1 ? 's' : ''} in sales stage
            </p>
          </div>
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => refreshOrders()}>
                  <Download className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh orders</TooltipContent>
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

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by order ID, customer, or product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="red">Urgent (Red)</SelectItem>
              <SelectItem value="yellow">Medium (Yellow)</SelectItem>
              <SelectItem value="blue">Normal (Blue)</SelectItem>
            </SelectContent>
          </Select>
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
              <Badge variant="secondary" className="ml-2">{filteredSalesItems.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="urgent">
              Urgent
              <Badge variant="priority-red" className="ml-2">{urgentItems.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="all">All Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <div className="space-y-4">
              {filteredSalesItems.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                    <h3 className="font-semibold text-lg mb-2">No items in Sales</h3>
                    <p className="text-muted-foreground">All items have been assigned to departments.</p>
                  </CardContent>
                </Card>
              ) : (
                filteredSalesItems.map(({ order, item }) => (
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
                            {item.assigned_to_name && (
                              <div className="flex items-center gap-1 text-xs text-primary mb-2">
                                <UserCircle className="h-3 w-3" />
                                Assigned to: {item.assigned_to_name}
                              </div>
                            )}
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
                                {canDelete && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      className="text-destructive"
                                      onClick={() => confirmDelete(order.order_id)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete Order
                                    </DropdownMenuItem>
                                  </>
                                )}
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
              {orders.filter(o => !o.is_completed).map((order) => (
                <OrderCard key={order.order_id} order={order} />
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Order</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this order? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteOrder}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
