import { useState, useMemo, useEffect } from 'react';
import { Plus, Download, ArrowRight, Send, CheckCircle, Trash2, UserCircle, Loader2, Search, ChevronDown, ChevronUp, ChevronRight, Package, Calendar, Building2, Settings, AlertTriangle, Clock, DollarSign, CheckCircle2, Flame } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { ProductCard } from '@/components/products/ProductCard';
import { PriorityBadge } from '@/features/orders/components/PriorityBadge';
import { FilePreview } from '@/features/orders/components/FilePreview';
import { CreateOrderDialog } from '@/components/dialogs/CreateOrderDialog';
import { ProductionStageSequenceDialog } from '@/components/dialogs/ProductionStageSequenceDialog';
import { OutsourceAssignmentDialog } from '@/components/dialogs/OutsourceAssignmentDialog';
import { UpdateDeliveryDateDialog } from '@/components/dialogs/UpdateDeliveryDateDialog';
import { useOrders } from '@/features/orders/context/OrderContext';
import { useAuth } from '@/features/auth/context/AuthContext';
import { Order, OrderItem } from '@/types/order';
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

  // PRODUCT-CENTRIC: Get products (items) in sales stage, not grouped by orders
  const salesProducts = useMemo(() => {
    const deptOrders = getOrdersForDepartment('sales');
    return deptOrders
      .filter(order => !order.is_completed && !order.archived_from_wc)
      .flatMap(order => 
        order.items
          .filter(item => {
            const dept = (item.assigned_department || item.current_stage)?.toLowerCase();
            return dept === 'sales';
          })
          .map(item => ({ order, item }))
      );
  }, [orders, getOrdersForDepartment]);

  // Filter by selected user tab (for admin)
  const userFilteredSalesProducts = useMemo(() => {
    if (!isAdmin || selectedUserTab === 'all') {
      return salesProducts;
    }
    // Filter products assigned to selected user
    return salesProducts.filter(({ item }) => item.assigned_to === selectedUserTab);
  }, [salesProducts, isAdmin, selectedUserTab]);

  // Filter products based on search and priority
  const filteredSalesProducts = useMemo(() => {
    return userFilteredSalesProducts.filter(({ order, item }) => {
      // Check if product matches search
      const matchesSearch = searchTerm === '' || 
        order.order_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.product_name.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Check if product matches priority filter
      const matchesPriority = priorityFilter === 'all' || 
        item.priority_computed === priorityFilter;
      
      return matchesSearch && matchesPriority;
    });
  }, [userFilteredSalesProducts, searchTerm, priorityFilter]);

  // Calculate total products count
  const totalSalesItems = useMemo(() => {
    return filteredSalesProducts.length;
  }, [filteredSalesProducts]);

  // Urgent products
  const urgentProducts = useMemo(() => {
    return filteredSalesProducts.filter(({ item }) => item.priority_computed === 'red');
  }, [filteredSalesProducts]);

  // Delivery Risk products - delivery date < 3 days and stuck in next department
  const deliveryRiskProducts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return filteredSalesProducts.filter(({ item }) => {
      const deliveryDate = new Date(item.delivery_date);
      deliveryDate.setHours(0, 0, 0, 0);
      const daysUntil = differenceInDays(deliveryDate, today);
      
      // Delivery date < 3 days and item is not in sales stage (stuck in next department)
      return daysUntil < 3 && daysUntil >= 0 && item.current_stage !== 'sales';
    });
  }, [filteredSalesProducts]);

  // Products awaiting customer approval (items in design/prepress that need customer approval)
  const awaitingCustomerApproval = useMemo(() => {
    return filteredSalesProducts.filter(({ item }) => 
      (item.current_stage === 'design' || item.current_stage === 'prepress') &&
      item.files && item.files.length > 0 &&
      item.files.some(f => f.type === 'proof')
    );
  }, [filteredSalesProducts]);

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
              {totalSalesItems} product{totalSalesItems !== 1 ? 's' : ''} in sales stage
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
                    {salesProducts.length}
                  </Badge>
                </TabsTrigger>
                {salesUsers.map((salesUser) => {
                  const userProductCount = salesProducts.filter(({ item }) => item.assigned_to === salesUser.user_id).length;
                  return (
                    <TabsTrigger key={salesUser.user_id} value={salesUser.user_id} className="text-sm">
                      {salesUser.full_name}
                      <Badge variant="secondary" className="ml-2">{userProductCount}</Badge>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
          </div>
        )}

        {/* Delivery Risk Card */}
        {deliveryRiskProducts.length > 0 && (
          <Card className="border-priority-red/50 bg-priority-red/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <Flame className="h-5 w-5 text-priority-red" />
                <Badge variant="priority-red">{deliveryRiskProducts.length}</Badge>
                🔥 Delivery Risk
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-2">
                Products with delivery date &lt; 3 days and stuck in next department
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  const urgentTab = document.querySelector('[value="urgent"]') as HTMLElement;
                  if (urgentTab) urgentTab.click();
                }}
              >
                View Urgent Products
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
                <Badge variant="secondary" className="ml-2">{filteredSalesProducts.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="urgent">
                Urgent
                <Badge variant="priority-red" className="ml-2">{urgentProducts.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="all">All Products</TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="flex-1 mt-4 overflow-hidden">
              <div className="h-full overflow-y-auto custom-scrollbar pr-2">
              {filteredSalesProducts.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                    <h3 className="font-semibold text-lg mb-2">No products in Sales</h3>
                    <p className="text-muted-foreground">All products have been assigned to departments.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {(() => {
                    // Group items by order_id to assign suffixes (A, B, C, etc.)
                    const itemsByOrder = new Map<string, Array<{ order: Order; item: OrderItem }>>();
                    filteredSalesProducts.forEach(({ order, item }) => {
                      const orderKey = order.order_id;
                      if (!itemsByOrder.has(orderKey)) {
                        itemsByOrder.set(orderKey, []);
                      }
                      itemsByOrder.get(orderKey)!.push({ order, item });
                    });

                    // Flatten with suffixes
                    const itemsWithSuffixes: Array<{ order: Order; item: OrderItem; suffix: string }> = [];
                    itemsByOrder.forEach((items, orderKey) => {
                      items.forEach(({ order, item }, index) => {
                        const suffix = items.length > 1 ? String.fromCharCode(65 + index) : ''; // A, B, C, etc.
                        itemsWithSuffixes.push({ order, item, suffix });
                      });
                    });

                    return itemsWithSuffixes.map(({ order, item, suffix }) => (
                      <ProductCard 
                        key={`${order.order_id}-${item.item_id}`}
                        order={order} 
                        item={item}
                        productSuffix={suffix}
                      />
                    ));
                  })()}
                </div>
              )}
              </div>
            </TabsContent>

            <TabsContent value="urgent" className="flex-1 mt-4 overflow-hidden">
              <div className="h-full overflow-y-auto custom-scrollbar pr-2">
                {urgentProducts.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                      <h3 className="font-semibold text-lg mb-2">No urgent products</h3>
                      <p className="text-muted-foreground">All products are on schedule.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="flex gap-4 overflow-x-auto pb-4 scroll-smooth snap-x snap-mandatory scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent hover:scrollbar-thumb-primary/40">
                    {(() => {
                      // Group items by order_id to assign suffixes (A, B, C, etc.)
                      const itemsByOrder = new Map<string, Array<{ order: Order; item: OrderItem }>>();
                      urgentProducts.forEach(({ order, item }) => {
                        const orderKey = order.order_id;
                        if (!itemsByOrder.has(orderKey)) {
                          itemsByOrder.set(orderKey, []);
                        }
                        itemsByOrder.get(orderKey)!.push({ order, item });
                      });

                      // Flatten with suffixes
                      const itemsWithSuffixes: Array<{ order: Order; item: OrderItem; suffix: string }> = [];
                      itemsByOrder.forEach((items, orderKey) => {
                        items.forEach(({ order, item }, index) => {
                          const suffix = items.length > 1 ? String.fromCharCode(65 + index) : ''; // A, B, C, etc.
                          itemsWithSuffixes.push({ order, item, suffix });
                        });
                      });

                      return itemsWithSuffixes.map(({ order, item, suffix }) => (
                        <div key={`${order.order_id}-${item.item_id}`} className="flex-shrink-0 w-80 snap-start">
                          <ProductCard 
                            order={order} 
                            item={item}
                            productSuffix={suffix}
                          />
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="all" className="flex-1 mt-4 overflow-hidden">
              <div className="h-full overflow-y-auto custom-scrollbar pr-2">
                <div className="flex gap-4 overflow-x-auto pb-4 scroll-smooth snap-x snap-mandatory scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent hover:scrollbar-thumb-primary/40">
                  {(() => {
                    // Group items by order_id to assign suffixes (A, B, C, etc.)
                    const itemsByOrder = new Map<string, Array<{ order: Order; item: OrderItem }>>();
                    filteredSalesProducts.forEach(({ order, item }) => {
                      const orderKey = order.order_id;
                      if (!itemsByOrder.has(orderKey)) {
                        itemsByOrder.set(orderKey, []);
                      }
                      itemsByOrder.get(orderKey)!.push({ order, item });
                    });

                    // Flatten with suffixes
                    const itemsWithSuffixes: Array<{ order: Order; item: OrderItem; suffix: string }> = [];
                    itemsByOrder.forEach((items, orderKey) => {
                      items.forEach(({ order, item }, index) => {
                        const suffix = items.length > 1 ? String.fromCharCode(65 + index) : ''; // A, B, C, etc.
                        itemsWithSuffixes.push({ order, item, suffix });
                      });
                    });

                    return itemsWithSuffixes.map(({ order, item, suffix }) => (
                      <div key={`${order.order_id}-${item.item_id}`} className="flex-shrink-0 w-80 snap-start">
                        <ProductCard 
                          order={order} 
                          item={item}
                          productSuffix={suffix}
                        />
                      </div>
                    ));
                  })()}
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
