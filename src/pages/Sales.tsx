import { useState, useMemo } from 'react';
import { Plus, Download, ArrowRight, Send, CheckCircle, Trash2, UserCircle, Loader2, Search, ChevronDown, ChevronUp, ChevronRight, Package, Calendar } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { OrderCard } from '@/components/orders/OrderCard';
import { PriorityBadge } from '@/components/orders/PriorityBadge';
import { FilePreview } from '@/components/orders/FilePreview';
import { CreateOrderDialog } from '@/components/dialogs/CreateOrderDialog';
import { useOrders } from '@/contexts/OrderContext';
import { useAuth } from '@/contexts/AuthContext';
import { useFinancialAccess } from '@/hooks/useFinancialAccess';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
  const { canViewFinancials } = useFinancialAccess();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [openOrders, setOpenOrders] = useState<Set<string>>(new Set());

  const canDelete = isAdmin || role === 'sales';

  // Get orders with items in sales stage, grouped by order
  const salesOrders = useMemo(() => {
    return orders
      .filter(order => !order.is_completed && order.items.some(item => item.current_stage === 'sales'))
      .map(order => ({
        ...order,
        salesItems: order.items.filter(item => item.current_stage === 'sales'),
      }))
      .filter(order => order.salesItems.length > 0);
  }, [orders]);

  // Filter orders based on search and priority
  const filteredSalesOrders = useMemo(() => {
    return salesOrders.filter(order => {
      // Check if any item matches search
      const matchesSearch = searchTerm === '' || 
        order.order_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.salesItems.some(item => item.product_name.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Check if any item matches priority filter
      const matchesPriority = priorityFilter === 'all' || 
        order.salesItems.some(item => item.priority_computed === priorityFilter);
      
      return matchesSearch && matchesPriority;
    });
  }, [salesOrders, searchTerm, priorityFilter]);

  // Calculate total items count
  const totalSalesItems = useMemo(() => {
    return filteredSalesOrders.reduce((sum, order) => sum + order.salesItems.length, 0);
  }, [filteredSalesOrders]);

  // Urgent orders (orders with at least one urgent item)
  const urgentOrders = useMemo(() => {
    return filteredSalesOrders.filter(order => 
      order.salesItems.some(item => item.priority_computed === 'red')
    );
  }, [filteredSalesOrders]);

  const wpPendingOrders = orders.filter(o => 
    o.source === 'wordpress' && o.items.some(i => i.current_stage === 'sales')
  );

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
      <div className="h-full flex flex-col gap-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Sales Dashboard</h1>
            <p className="text-muted-foreground">
              {filteredSalesOrders.length} order{filteredSalesOrders.length !== 1 ? 's' : ''} • {totalSalesItems} item{totalSalesItems !== 1 ? 's' : ''} in sales stage
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
                <Button size="sm" onClick={() => setCreateOrderOpen(true)}>
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

        {/* Orders Tabs - Scrollable content area */}
        <div className="flex-1 min-h-0">
          <Tabs defaultValue="pending" className="h-full flex flex-col">
            <TabsList className="flex-shrink-0">
              <TabsTrigger value="pending">
                In Sales
                <Badge variant="secondary" className="ml-2">{filteredSalesOrders.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="urgent">
                Urgent
                <Badge variant="priority-red" className="ml-2">{urgentOrders.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="all">All Orders</TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="flex-1 mt-4 overflow-hidden">
              <div className="h-full overflow-y-auto custom-scrollbar pr-2 space-y-4">
              {filteredSalesOrders.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                    <h3 className="font-semibold text-lg mb-2">No orders in Sales</h3>
                    <p className="text-muted-foreground">All items have been assigned to departments.</p>
                  </CardContent>
                </Card>
              ) : (
                filteredSalesOrders.map((order) => {
                  const highestPriority = order.salesItems.reduce((highest, item) => {
                    const priorityOrder = { red: 3, yellow: 2, blue: 1 };
                    return priorityOrder[item.priority_computed] > priorityOrder[highest] ? item.priority_computed : highest;
                  }, 'blue' as 'red' | 'yellow' | 'blue');
                  
                  const isOpen = openOrders.has(order.order_id);
                  const toggleOpen = () => {
                    setOpenOrders(prev => {
                      const newSet = new Set(prev);
                      if (newSet.has(order.order_id)) {
                        newSet.delete(order.order_id);
                      } else {
                        newSet.add(order.order_id);
                      }
                      return newSet;
                    });
                  };
                  
                  return (
                    <Card key={order.order_id} className="card-hover overflow-hidden transition-all duration-200 hover:shadow-lg">
                      <CardContent className="p-0">
                        <div 
                          className={`h-1 ${
                            highestPriority === 'blue' ? 'bg-priority-blue' :
                            highestPriority === 'yellow' ? 'bg-priority-yellow' :
                            'bg-priority-red'
                          }`}
                        />
                        <div className="p-4 sm:p-5">
                          {/* Order Header */}
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <Link 
                                  to={`/orders/${order.order_id}`}
                                  className="font-bold text-lg text-primary hover:underline"
                                >
                                  {order.order_id}
                                </Link>
                                <PriorityBadge priority={highestPriority} showLabel />
                                <Badge variant="secondary" className="text-xs">
                                  {order.salesItems.length} product{order.salesItems.length !== 1 ? 's' : ''}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-1">
                                {order.customer.name}
                              </p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  <span>
                                    {order.order_level_delivery_date 
                                      ? format(order.order_level_delivery_date, 'MMM d, yyyy')
                                      : order.salesItems[0]?.delivery_date 
                                        ? format(order.salesItems[0].delivery_date, 'MMM d, yyyy')
                                        : 'No date set'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Package className="h-3 w-3" />
                                  <span>Total Qty: {order.salesItems.reduce((sum, item) => sum + item.quantity, 0)}</span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm" asChild>
                                <Link to={`/orders/${order.order_id}`}>
                                  View Order
                                  <ChevronRight className="h-4 w-4 ml-2" />
                                </Link>
                              </Button>
                              {canDelete && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={() => confirmDelete(order.order_id)}
                                      className="text-destructive hover:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Delete Order</TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </div>

                          {/* Products Collapsible */}
                          <Collapsible open={isOpen} onOpenChange={toggleOpen}>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" className="w-full justify-between p-2 h-auto hover:bg-secondary/50">
                                <span className="text-sm font-medium">
                                  Products ({order.salesItems.length})
                                </span>
                                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="space-y-3 mt-2">
                              {order.salesItems.map((item) => (
                                <div 
                                  key={item.item_id} 
                                  className="bg-secondary/30 rounded-lg p-4 border border-border/50"
                                >
                                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                                        <h4 className="font-semibold text-foreground">{item.product_name}</h4>
                                        <PriorityBadge priority={item.priority_computed} />
                                        <Badge variant="outline" className="text-xs">
                                          Qty: {item.quantity}
                                        </Badge>
                                      </div>
                                      
                                      {item.assigned_to_name && (
                                        <div className="flex items-center gap-1 text-xs text-primary mb-2">
                                          <UserCircle className="h-3 w-3" />
                                          Assigned to: {item.assigned_to_name}
                                        </div>
                                      )}
                                      
                                      <div className="flex flex-wrap gap-2 mb-2">
                                        {item.specifications.paper && (
                                          <Badge variant="outline" className="text-xs">{item.specifications.paper}</Badge>
                                        )}
                                        {item.specifications.size && (
                                          <Badge variant="outline" className="text-xs">{item.specifications.size}</Badge>
                                        )}
                                      </div>
                                      
                                      {item.files && item.files.length > 0 && (
                                        <FilePreview files={item.files} compact />
                                      )}
                                    </div>

                                    <div className="flex flex-col sm:flex-row gap-2">
                                      <div className="text-xs text-muted-foreground mb-2 sm:mb-0">
                                        Due: {format(item.delivery_date, 'MMM d, yyyy')}
                                      </div>
                                      
                                      <DropdownMenu>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <DropdownMenuTrigger asChild>
                                              <Button size="sm" variant="outline">
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
                              ))}
                            </CollapsibleContent>
                          </Collapsible>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
              </div>
            </TabsContent>

            <TabsContent value="urgent" className="flex-1 mt-4 overflow-hidden">
              <div className="h-full overflow-y-auto custom-scrollbar pr-2 space-y-4">
                {urgentOrders.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                      <h3 className="font-semibold text-lg mb-2">No urgent orders</h3>
                      <p className="text-muted-foreground">All items are on schedule.</p>
                    </CardContent>
                  </Card>
                ) : (
                  urgentOrders.map((order) => {
                    const urgentItems = order.salesItems.filter(item => item.priority_computed === 'red');
                    const isOpen = openOrders.has(`urgent-${order.order_id}`);
                    const toggleOpen = () => {
                      setOpenOrders(prev => {
                        const newSet = new Set(prev);
                        const key = `urgent-${order.order_id}`;
                        if (newSet.has(key)) {
                          newSet.delete(key);
                        } else {
                          newSet.add(key);
                        }
                        return newSet;
                      });
                    };
                    
                    return (
                      <Card key={order.order_id} className="card-hover border-priority-red/50 overflow-hidden">
                        <CardContent className="p-0">
                          <div className="h-1 bg-priority-red" />
                          <div className="p-4 sm:p-5">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <Link 
                                    to={`/orders/${order.order_id}`}
                                    className="font-bold text-lg text-primary hover:underline"
                                  >
                                    {order.order_id}
                                  </Link>
                                  <PriorityBadge priority="red" showLabel />
                                  <Badge variant="destructive" className="text-xs">
                                    {urgentItems.length} urgent
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {order.customer.name}
                                </p>
                              </div>
                              <Button variant="outline" size="sm" asChild>
                                <Link to={`/orders/${order.order_id}`}>
                                  View Order
                                  <ChevronRight className="h-4 w-4 ml-2" />
                                </Link>
                              </Button>
                            </div>
                            
                            <Collapsible open={isOpen} onOpenChange={toggleOpen}>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" className="w-full justify-between p-2 h-auto hover:bg-secondary/50">
                                  <span className="text-sm font-medium">
                                    Urgent Products ({urgentItems.length})
                                  </span>
                                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </Button>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="space-y-3 mt-2">
                                {urgentItems.map((item) => (
                                  <div 
                                    key={item.item_id} 
                                    className="bg-priority-red/10 rounded-lg p-4 border border-priority-red/30"
                                  >
                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                      <div className="flex-1">
                                        <h4 className="font-semibold text-foreground mb-1">{item.product_name}</h4>
                                        <p className="text-xs text-muted-foreground">
                                          Qty: {item.quantity} • Due: {format(item.delivery_date, 'MMM d, yyyy')}
                                        </p>
                                      </div>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button size="sm" variant="outline">
                                            <Send className="h-4 w-4 mr-2" />
                                            Assign
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
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
                                ))}
                              </CollapsibleContent>
                            </Collapsible>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </TabsContent>

            <TabsContent value="all" className="flex-1 mt-4 overflow-hidden">
              <div className="h-full overflow-y-auto custom-scrollbar pr-2">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-4">
                  {orders.filter(o => !o.is_completed).map((order) => (
                    <OrderCard key={order.order_id} order={order} />
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

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

        {/* Create Order Dialog */}
        <CreateOrderDialog 
          open={createOrderOpen} 
          onOpenChange={setCreateOrderOpen}
          onOrderCreated={() => refreshOrders()}
        />
      </div>
    </TooltipProvider>
  );
}
