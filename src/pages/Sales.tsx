import { useState, useMemo, useEffect } from 'react';
import { Plus, Download, ArrowRight, Send, CheckCircle, Trash2, UserCircle, Loader2, Search, ChevronDown, ChevronUp, ChevronRight, Package, Calendar, Building2, Settings, AlertTriangle, Clock, DollarSign, CheckCircle2, Flame } from 'lucide-react';
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
import { ProductionStageSequenceDialog } from '@/components/dialogs/ProductionStageSequenceDialog';
import { OutsourceAssignmentDialog } from '@/components/dialogs/OutsourceAssignmentDialog';
import { UpdateDeliveryDateDialog } from '@/components/dialogs/UpdateDeliveryDateDialog';
import { useOrders } from '@/contexts/OrderContext';
import { useAuth } from '@/contexts/AuthContext';
import { useFinancialAccess } from '@/hooks/useFinancialAccess';
import { toast } from '@/hooks/use-toast';
import { format, differenceInDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SalesUser {
  user_id: string;
  full_name: string;
  department: string;
}

export default function Sales() {
  const { orders, updateItemStage, sendToProduction, assignToOutsource, deleteOrder, isLoading, refreshOrders, updateItemDeliveryDate, getOrdersForDepartment, assignToDepartment } = useOrders();
  const { isAdmin, role, user } = useAuth();
  const { canViewFinancials } = useFinancialAccess();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [openOrders, setOpenOrders] = useState<Set<string>>(new Set());
  const [productionStageDialogOpen, setProductionStageDialogOpen] = useState(false);
  const [selectedItemForProduction, setSelectedItemForProduction] = useState<{ orderId: string; itemId: string; productName: string; currentSequence?: string[] | null } | null>(null);
  const [outsourceDialogOpen, setOutsourceDialogOpen] = useState(false);
  const [selectedItemForOutsource, setSelectedItemForOutsource] = useState<{ orderId: string; itemId: string; productName: string; quantity: number } | null>(null);
  const [deliveryDateDialogOpen, setDeliveryDateDialogOpen] = useState(false);
  const [selectedItemForDeliveryDate, setSelectedItemForDeliveryDate] = useState<{ orderId: string; itemId: string; productName: string; currentDate: Date } | null>(null);
  const [priorityDialogOpen, setPriorityDialogOpen] = useState(false);
  const [selectedItemForPriority, setSelectedItemForPriority] = useState<{ orderId: string; itemId: string; productName: string; currentPriority: 'blue' | 'yellow' | 'red' } | null>(null);
  const [selectedUserTab, setSelectedUserTab] = useState<string>('all'); // 'all' or user_id
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const canDelete = isAdmin || role === 'sales';

  // Fetch sales users for admin tabs
  useEffect(() => {
    if (isAdmin) {
      const fetchSalesUsers = async () => {
        setLoadingUsers(true);
        try {
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('user_id, full_name, department')
            .eq('department', 'sales');

          if (profilesError) throw profilesError;

          const users = (profilesData || []).map(profile => ({
            user_id: profile.user_id,
            full_name: profile.full_name || 'Unknown',
            department: profile.department || 'sales',
          }));
          setSalesUsers(users);
        } catch (error) {
          console.error('Error fetching sales users:', error);
        } finally {
          setLoadingUsers(false);
        }
      };
      fetchSalesUsers();
    }
  }, [isAdmin]);

  // Get orders with items in sales stage, grouped by order
  // Use getOrdersForDepartment to get sales department orders (respects assigned_department)
  const salesOrders = useMemo(() => {
    const deptOrders = getOrdersForDepartment('sales');
    return deptOrders
      .filter(order => !order.is_completed && !order.archived_from_wc)
      .map(order => ({
        ...order,
        salesItems: order.items.filter(item => {
          const dept = (item.assigned_department || item.current_stage)?.toLowerCase();
          return dept === 'sales';
        }),
      }))
      .filter(order => order.salesItems.length > 0);
  }, [orders, getOrdersForDepartment]);

  // Filter by selected user tab (for admin)
  const userFilteredSalesOrders = useMemo(() => {
    if (!isAdmin || selectedUserTab === 'all') {
      return salesOrders;
    }
    // Filter orders where items are assigned to selected user
    return salesOrders
      .map(order => ({
        ...order,
        salesItems: order.salesItems.filter(item => item.assigned_to === selectedUserTab),
      }))
      .filter(order => order.salesItems.length > 0);
  }, [salesOrders, isAdmin, selectedUserTab]);

  // Filter orders based on search and priority
  const filteredSalesOrders = useMemo(() => {
    return userFilteredSalesOrders.filter(order => {
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
  }, [userFilteredSalesOrders, searchTerm, priorityFilter]);

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

  // Delivery Risk orders - delivery date < 3 days and stuck in next department
  const deliveryRiskOrders = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return filteredSalesOrders.filter(order => 
      order.salesItems.some(item => {
        const deliveryDate = new Date(item.delivery_date);
        deliveryDate.setHours(0, 0, 0, 0);
        const daysUntil = differenceInDays(deliveryDate, today);
        
        // Delivery date < 3 days and item is not in sales stage (stuck in next department)
        return daysUntil < 3 && daysUntil >= 0 && item.current_stage !== 'sales';
      })
    );
  }, [filteredSalesOrders]);

  // Orders awaiting customer approval (items in design/prepress that need customer approval)
  const awaitingCustomerApproval = useMemo(() => {
    return filteredSalesOrders.filter(order =>
      order.salesItems.some(item => 
        (item.current_stage === 'design' || item.current_stage === 'prepress') &&
        item.files && item.files.length > 0 &&
        item.files.some(f => f.type === 'proof')
      )
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

  const handleSendToProduction = (orderId: string, itemId: string) => {
    const order = orders.find(o => o.order_id === orderId);
    const item = order?.items.find(i => i.item_id === itemId);
    if (!order || !item) return;
    
    // If item already has production stage sequence, assign directly
    // Otherwise, show dialog to set sequence
    if ((item as any).production_stage_sequence && (item as any).production_stage_sequence.length > 0) {
      // Direct assignment to production
      sendToProduction(orderId, itemId, (item as any).production_stage_sequence);
    } else {
      // Show dialog to set production stages
      setSelectedItemForProduction({
        orderId,
        itemId,
        productName: item.product_name,
        currentSequence: (item as any).production_stage_sequence
      });
      setProductionStageDialogOpen(true);
    }
  };

  const handleDirectAssignToProduction = async (orderId: string, itemId: string) => {
    // Direct assignment to production department (will use default stages)
    await assignToDepartment(orderId, itemId, 'production');
    toast({
      title: "Assigned to Production",
      description: "Item assigned to production department",
    });
  };

  const handleOutsourceClick = (orderId: string, itemId: string, productName: string, quantity: number) => {
    setSelectedItemForOutsource({ orderId, itemId, productName, quantity });
    setOutsourceDialogOpen(true);
  };

  const handleOutsourceAssign = async (vendor: any, jobDetails: any) => {
    if (selectedItemForOutsource) {
      await assignToOutsource(selectedItemForOutsource.orderId, selectedItemForOutsource.itemId, vendor, jobDetails);
      setOutsourceDialogOpen(false);
      setSelectedItemForOutsource(null);
    }
  };

  const handleUpdateDeliveryDate = (orderId: string, itemId: string, productName: string, currentDate: Date) => {
    setSelectedItemForDeliveryDate({ orderId, itemId, productName, currentDate });
    setDeliveryDateDialogOpen(true);
  };

  const handleSaveDeliveryDate = async (date: Date) => {
    if (selectedItemForDeliveryDate) {
      await updateItemDeliveryDate(selectedItemForDeliveryDate.orderId, selectedItemForDeliveryDate.itemId, date);
      setDeliveryDateDialogOpen(false);
      setSelectedItemForDeliveryDate(null);
    }
  };

  const handleSetPriority = (orderId: string, itemId: string, productName: string, currentPriority: 'blue' | 'yellow' | 'red') => {
    setSelectedItemForPriority({ orderId, itemId, productName, currentPriority });
    setPriorityDialogOpen(true);
  };

  const handleMarkCXApproved = async (orderId: string, itemId: string) => {
    // Move to next stage after customer approval
    const order = orders.find(o => o.order_id === orderId);
    const item = order?.items.find(i => i.item_id === itemId);
    if (!order || !item) return;

    if (item.current_stage === 'design') {
      await updateItemStage(orderId, itemId, 'prepress');
      toast({
        title: "Customer Approved",
        description: "Item moved to Prepress",
      });
    } else if (item.current_stage === 'prepress') {
      // If prepress, can go to production
      handleSendToProduction(orderId, itemId);
    }
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

        {/* User Tabs for Admin */}
        {isAdmin && salesUsers.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm font-medium text-muted-foreground">Filter by User:</span>
            <Tabs value={selectedUserTab} onValueChange={setSelectedUserTab} className="w-full">
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="all" className="text-sm">
                  All Users
                  <Badge variant="secondary" className="ml-2">
                    {salesOrders.reduce((sum, order) => sum + order.salesItems.length, 0)}
                  </Badge>
                </TabsTrigger>
                {salesUsers.map((salesUser) => {
                  const userOrderCount = salesOrders.reduce((sum, order) => 
                    sum + order.salesItems.filter(item => item.assigned_to === salesUser.user_id).length, 0
                  );
                  return (
                    <TabsTrigger key={salesUser.user_id} value={salesUser.user_id} className="text-sm">
                      {salesUser.full_name}
                      <Badge variant="secondary" className="ml-2">{userOrderCount}</Badge>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
          </div>
        )}

        {/* Delivery Risk Card */}
        {deliveryRiskOrders.length > 0 && (
          <Card className="border-priority-red/50 bg-priority-red/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <Flame className="h-5 w-5 text-priority-red" />
                <Badge variant="priority-red">{deliveryRiskOrders.length}</Badge>
                🔥 Delivery Risk
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-2">
                Orders with delivery date &lt; 3 days and stuck in next department
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  const urgentTab = document.querySelector('[value="urgent"]') as HTMLElement;
                  if (urgentTab) urgentTab.click();
                }}
              >
                View Urgent Orders
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

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
                    <Card key={order.order_id} className="card-hover overflow-visible transition-all duration-200 hover:shadow-lg relative">
                      <CardContent className="p-0 overflow-visible">
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
                                        {/* Waiting on Customer tag */}
                                        {awaitingCustomerApproval.some(o => 
                                          o.salesItems.some(i => i.item_id === item.item_id)
                                        ) && (
                                          <Badge variant="priority-yellow" className="text-xs">
                                            <Clock className="h-3 w-3 mr-1" />
                                            Waiting on Customer
                                          </Badge>
                                        )}
                                        {/* Show amount only to Sales/Admin */}
                                        {canViewFinancials && item.line_total && (
                                          <Badge variant="outline" className="text-xs">
                                            <DollarSign className="h-3 w-3 mr-1" />
                                            ₹{item.line_total.toLocaleString('en-IN')}
                                          </Badge>
                                        )}
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
                                      
                                      <div className="flex flex-wrap gap-2">
                                        {/* Mark CX Approved - only show if item has proof files */}
                                        {item.files && item.files.some(f => f.type === 'proof') && (
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button 
                                                size="sm" 
                                                variant="outline"
                                                className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:hover:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                                                onClick={() => handleMarkCXApproved(order.order_id, item.item_id)}
                                              >
                                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                                CX Approved
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Mark customer approved</TooltipContent>
                                          </Tooltip>
                                        )}
                                        
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
                                            {(isAdmin || role === 'sales') && (
                                              <DropdownMenuItem onClick={() => handleDirectAssignToProduction(order.order_id, item.item_id)}>
                                                <ArrowRight className="h-4 w-4 mr-2" />
                                                Assign to Production (Direct)
                                              </DropdownMenuItem>
                                            )}
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={() => handleUpdateDeliveryDate(order.order_id, item.item_id, item.product_name, item.delivery_date)}>
                                              <Calendar className="h-4 w-4 mr-2" />
                                              Add/Update Delivery Date
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleSetPriority(order.order_id, item.item_id, item.product_name, item.priority_computed)}>
                                              <AlertTriangle className="h-4 w-4 mr-2" />
                                              Set Priority
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
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
                      <Card key={order.order_id} className="card-hover border-priority-red/50 overflow-visible relative">
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
                                          {(isAdmin || role === 'sales') && (
                                            <DropdownMenuItem onClick={() => handleDirectAssignToProduction(order.order_id, item.item_id)}>
                                              <ArrowRight className="h-4 w-4 mr-2" />
                                              Assign to Production (Direct)
                                            </DropdownMenuItem>
                                          )}
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

        {/* Production Stage Sequence Dialog */}
        {selectedItemForProduction && (
          <ProductionStageSequenceDialog
            open={productionStageDialogOpen}
            onOpenChange={setProductionStageDialogOpen}
            productName={selectedItemForProduction.productName}
            orderId={selectedItemForProduction.orderId}
            currentSequence={selectedItemForProduction.currentSequence}
            onConfirm={(sequence) => {
              sendToProduction(selectedItemForProduction.orderId, selectedItemForProduction.itemId, sequence);
              setProductionStageDialogOpen(false);
              setSelectedItemForProduction(null);
            }}
          />
        )}

        {/* Outsource Assignment Dialog */}
        {selectedItemForOutsource && (
          <OutsourceAssignmentDialog
            open={outsourceDialogOpen}
            onOpenChange={setOutsourceDialogOpen}
            onAssign={handleOutsourceAssign}
            productName={selectedItemForOutsource.productName}
            quantity={selectedItemForOutsource.quantity}
          />
        )}

        {/* Delivery Date Dialog */}
        {selectedItemForDeliveryDate && (
          <UpdateDeliveryDateDialog
            open={deliveryDateDialogOpen}
            onOpenChange={setDeliveryDateDialogOpen}
            currentDate={selectedItemForDeliveryDate.currentDate}
            productName={selectedItemForDeliveryDate.productName}
            onSave={handleSaveDeliveryDate}
          />
        )}

        {/* Priority Dialog */}
        {selectedItemForPriority && (
          <Dialog open={priorityDialogOpen} onOpenChange={setPriorityDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Set Priority
                </DialogTitle>
                <DialogDescription>
                  Set priority for <span className="font-semibold">{selectedItemForPriority.productName}</span>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Select 
                  defaultValue={selectedItemForPriority.currentPriority}
                  onValueChange={async (value: 'blue' | 'yellow' | 'red') => {
                    // Priority is computed from delivery date, so we need to update delivery date
                    // For now, just show a message that priority is auto-computed
                    toast({
                      title: "Priority Auto-Computed",
                      description: "Priority is automatically calculated based on delivery date. Update delivery date to change priority.",
                    });
                    setPriorityDialogOpen(false);
                    setSelectedItemForPriority(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blue">Normal (Blue) - &gt; 5 days</SelectItem>
                    <SelectItem value="yellow">Medium (Yellow) - 3-5 days</SelectItem>
                    <SelectItem value="red">Urgent (Red) - &lt; 3 days</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Note: Priority is automatically computed from delivery date. To change priority, update the delivery date.
                </p>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </TooltipProvider>
  );
}
