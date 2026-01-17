import { useState, useMemo, useEffect } from 'react';
import { Plus, Download, ArrowRight, Send, CheckCircle, Trash2, UserCircle, Loader2, Search, ChevronDown, ChevronUp, ChevronRight, Package, Calendar, Building2, Settings, AlertTriangle, Clock, IndianRupee, CheckCircle2, Flame, RefreshCw } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { ProductCard } from '@/features/orders/components/ProductCard';
import { OrderGroupList } from '@/features/orders/components/OrderGroupList';
import { PriorityBadge } from '@/features/orders/components/PriorityBadge';
import { FilePreview } from '@/features/orders/components/FilePreview';
import { CreateOrderDialog } from '@/components/dialogs/CreateOrderDialog';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AddPaymentDialog } from '@/components/dialogs/AddPaymentDialog';
import { ProformaInvoiceDialog } from '@/components/dialogs/ProformaInvoiceDialog';
import { financeService } from '@/services/financeService';
import { OrderPaymentStatus } from '@/types/finance';

interface SalesUser {
  user_id: string;
  full_name: string;
  department: string;
}

export default function Sales() {
  const { orders, isLoading, refreshOrders, assignOrderToUser } = useOrders();
  const { isAdmin, role, user } = useAuth();
  const { canViewFinancials } = useFinancialAccess();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [openOrders, setOpenOrders] = useState<Set<string>>(new Set());
  const [searchParams] = useSearchParams();
  const [selectedUserTab, setSelectedUserTab] = useState<string>(searchParams.get('assigned_user') || 'all'); // 'all' or user_id
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Payment States
  const [paymentStatuses, setPaymentStatuses] = useState<Record<string, OrderPaymentStatus>>({});
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<{
    orderId: string;
    customerId: string;
    customerName: string;
  } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [piDialogOpen, setPiDialogOpen] = useState(false);
  const [isSyncingOrders, setIsSyncingOrders] = useState(false);

  const handleSyncOrders = async () => {
    setIsSyncingOrders(true);
    try {
      toast({ title: "Syncing Orders...", description: "Fetching modified orders from last 24 hours." });
      const { data, error } = await supabase.functions.invoke('woocommerce', {
        body: { action: 'sync-orders', lookback_minutes: 1440 }
      });

      if (error) throw error;

      const result = data;
      if (result.success) {
        toast({ title: "Sync Complete", description: result.message, variant: "default" });
        refreshOrders(); // Refresh local list
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err: any) {
      console.error('Sync failed', err);
      toast({ title: "Sync Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSyncingOrders(false);
    }
  };

  // PRODUCT-CENTRIC: Get products (items) in sales stage
  const salesProducts = useMemo(() => {
    return orders
      .filter(order => !order.is_completed && !order.archived_from_wc)
      .flatMap(order =>
        order.items
          .filter(item => {
            const dept = (item.assigned_department || item.current_stage)?.toLowerCase();
            const isPendingApproval =
              item.status === 'pending_for_customer_approval' ||
              item.status === 'pending_client_approval';
            const isReadyForDispatch = item.status === 'ready_for_dispatch';
            return dept === 'sales' || isPendingApproval || isReadyForDispatch;
          })
          .map(item => ({ order, item }))
      );
  }, [orders]);

  // Filter by selected user tab (for admin)
  // Check order.assigned_user (Manager) instead of item.assigned_to
  const userFilteredSalesProducts = useMemo(() => {
    if (!isAdmin || selectedUserTab === 'all') {
      return salesProducts;
    }
    return salesProducts.filter(({ order, item }) => {
      // Check both order-level assignment (Manager) and item-level assignment
      return order.assigned_user === selectedUserTab || item.assigned_to === selectedUserTab;
    });
  }, [salesProducts, isAdmin, selectedUserTab]);


  // Filter products based on search and priority
  const filteredSalesProducts = useMemo(() => {
    return userFilteredSalesProducts.filter(({ order, item }) => {
      const matchesSearch = searchTerm === '' ||
        order.order_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.product_name.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesPriority = priorityFilter === 'all' ||
        item.priority_computed === priorityFilter;

      return matchesSearch && matchesPriority;
    });
  }, [userFilteredSalesProducts, searchTerm, priorityFilter]);

  // Fetch Payment Statuses
  useEffect(() => {
    const fetchPaymentStatuses = async () => {
      const uniqueOrders = new Map<string, { order_id: string; total: number; customer_id?: string }>();

      filteredSalesProducts.forEach(({ order }) => {
        if (!uniqueOrders.has(order.order_id)) {
          const total = order.financials?.total || order.items.reduce((sum, item) => sum + (Number(item.line_total) || 0), 0);
          // Safely get customer ID
          const customerId = order.customer?.id || order.customer_id;
          uniqueOrders.set(order.order_id, {
            order_id: order.id || order.order_id,
            total,
            customer_id: customerId
          });
        }
      });

      if (uniqueOrders.size > 0) {
        try {
          const payload = Array.from(uniqueOrders.values()).map(o => ({
            order_id: o.order_id, // This is UUID (ideally)
            total: o.total,
            customer_id: o.customer_id
          }));

          const stats = await financeService.getBatchOrderPaymentStatus(payload);

          const remappedStats: Record<string, OrderPaymentStatus> = {};
          uniqueOrders.forEach((val, key) => {
            if (stats[val.order_id]) {
              remappedStats[key] = stats[val.order_id];
            }
          });

          setPaymentStatuses(remappedStats);
        } catch (err) {
          console.error("Failed to fetch payment stats", err);
        }
      }
    };

    if (filteredSalesProducts.length > 0) {
      fetchPaymentStatuses();
    }
  }, [filteredSalesProducts, refreshKey]); // Added refreshKey dependency

  // Handle Payment Click
  const handleAddPayment = (order: Order) => {
    // Check if order has ID
    if (!order.id) {
      // Try fallback if order.id missing but logic permits
      console.warn("Order missing internal ID", order);
    }

    // Safely get customer ID
    // @ts-ignore - 'customer' in Order type might lack 'id' definition but it exists in runtime
    const customerId = order.customer?.id || order.customer_id;

    if (customerId) {
      setSelectedOrderForPayment({
        orderId: order.id!, // Assuming UUID exists if we got here
        customerId: customerId,
        customerName: order.customer.name || 'Customer'
      });
      setPaymentDialogOpen(true);
    } else {
      toast({ title: "Error", description: "Missing customer association for this order", variant: "destructive" });
    }
  };

  const canDelete = isAdmin || role === 'sales';

  // Fetch sales users for admin tabs
  useEffect(() => {
    if (isAdmin || role === 'sales') {
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

  // Calculate total products count for All tab
  const totalSalesItems = useMemo(() => {
    return filteredSalesProducts.length;
  }, [filteredSalesProducts]);

  // My Orders: Created by me OR assigned to me
  const mySalesItems = useMemo(() => {
    if (!user) return [];
    return filteredSalesProducts.filter(({ order, item }) =>
      order.created_by === user.id || item.assigned_to === user.id
    );
  }, [filteredSalesProducts, user]);

  // Pending Approval: Items in Sales stage but waiting for approval
  const pendingApprovalItems = useMemo(() => {
    return filteredSalesProducts.filter(({ item }) =>
      item.status === 'pending_for_customer_approval' ||
      item.status === 'pending_client_approval'
    );
  }, [filteredSalesProducts]);

  // Ready to Dispatch items (Waiting for Sales decision)
  const readyToDispatchItems = useMemo(() => {
    return filteredSalesProducts.filter(({ item }) => item.status === 'ready_for_dispatch');
  }, [filteredSalesProducts]);

  // Completed Orders: Order is completed or item is completed/dispatched
  const completedSalesItems = useMemo(() => {
    const completedOrders = orders.filter(o => o.is_completed);
    const completedProductList = completedOrders.flatMap(o => o.items.map(i => ({ order: o, item: i })));

    const activeOrderCompletedItems = orders
      .filter(o => !o.is_completed)
      .flatMap(o => o.items.filter(i => i.current_stage === 'completed' || i.is_dispatched)
        .map(i => ({ order: o, item: i })));

    return [...completedProductList, ...activeOrderCompletedItems];
  }, [orders]);

  // Urgent products
  const urgentProducts = useMemo(() => {
    return filteredSalesProducts.filter(({ item }) => item.priority_computed === 'red');
  }, [filteredSalesProducts]);

  // Delivery Risk products
  const deliveryRiskProducts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return filteredSalesProducts.filter(({ item }) => {
      const deliveryDate = new Date(item.delivery_date);
      deliveryDate.setHours(0, 0, 0, 0);
      const daysUntil = differenceInDays(deliveryDate, today);
      return daysUntil < 3 && daysUntil >= 0 && item.current_stage !== 'sales';
    });
  }, [filteredSalesProducts]);

  // Pending WP Orders
  const wpPendingOrders = orders.filter(o =>
    o.source === 'wordpress' && o.items.some(i => i.current_stage === 'sales')
  );

  const [activeTab, setActiveTab] = useState('all');





  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading orders...</span>
      </div>
    );
  }

  // Calculate unique customers count
  const [uniqueCustomersCount, setTotalCustomersCount] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      const { count } = await supabase
        .from('wc_customers')
        .select('*', { count: 'exact', head: true });
      if (count !== null) setTotalCustomersCount(count);
    };
    fetchCount();
  }, [refreshKey]);

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col gap-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Sales Dashboard</h1>
            <p className="text-muted-foreground">
              Overview of sales orders and customer status
            </p>
          </div>
          <div className="flex gap-2">
            <div className="flex gap-2">

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Settings className="h-4 w-4" />
                    Quick Actions
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setPiDialogOpen(true)}>
                    <IndianRupee className="h-4 w-4 mr-2 text-muted-foreground" />
                    Generate Proforma Invoice
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSyncOrders} disabled={isSyncingOrders}>
                    <RefreshCw className={`h-4 w-4 mr-2 text-muted-foreground ${isSyncingOrders ? 'animate-spin' : ''}`} />
                    Sync Recent Orders (24h)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast({ title: "Coming Soon", description: "More actions coming soon." })}>
                    <Package className="h-4 w-4 mr-2 text-muted-foreground" />
                    Bulk Export Orders
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* My Customers Card */}
          <Card
            className="cursor-pointer hover:shadow-md transition-all border-l-4 border-l-blue-500"
            onClick={() => navigate('/customers?filter=my')}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Customers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <UserCircle className="h-8 w-8 text-blue-500" />
                <span className="text-2xl font-bold">{uniqueCustomersCount}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Click to view all customers</p>
            </CardContent>
          </Card>

          {/* Total Sales Items */}
          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Package className="h-8 w-8 text-purple-500" />
                <span className="text-2xl font-bold">{totalSalesItems}</span>
              </div>
            </CardContent>
          </Card>

          {/* Urgent Items */}
          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Urgent Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-8 w-8 text-red-500" />
                <span className="text-2xl font-bold">{urgentProducts.length}</span>
              </div>
            </CardContent>
          </Card>

          {/* Pending Approval */}
          <Card className="border-l-4 border-l-yellow-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Approval</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-8 w-8 text-yellow-500" />
                <span className="text-2xl font-bold">{pendingApprovalItems.length}</span>
              </div>
            </CardContent>
          </Card>
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
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filter by Team Member</span>
            <Tabs value={selectedUserTab} onValueChange={setSelectedUserTab} className="w-full">
              <TabsList className="h-auto p-1 bg-slate-100 dark:bg-slate-800 rounded-lg flex flex-wrap gap-1 justify-start overflow-visible">
                <TabsTrigger
                  value="all"
                  className="rounded-md px-3 py-1.5 text-xs font-medium data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:shadow-sm transition-all"
                >
                  All Users
                </TabsTrigger>
                {salesUsers.map((salesUser) => (
                  <TabsTrigger
                    key={salesUser.user_id}
                    value={salesUser.user_id}
                    className="rounded-md px-3 py-1.5 text-xs font-medium data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:shadow-sm transition-all"
                  >
                    {salesUser.full_name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        )}

        {/* Main Tabs */}
        <div className="flex-1 min-h-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="flex-shrink-0 w-full justify-start overflow-x-auto">
              <TabsTrigger value="all" className="flex gap-2">
                Show All Orders
                <Badge variant="secondary">{totalSalesItems}</Badge>
              </TabsTrigger>
              <TabsTrigger value="my_orders" className="flex gap-2">
                My Orders
                <Badge variant="secondary">{mySalesItems.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="pending_approval" className="flex gap-2">
                Pending Approval
                <Badge variant={pendingApprovalItems.length > 0 ? "destructive" : "secondary"}>
                  {pendingApprovalItems.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="ready_dispatch" className="flex gap-2">
                Ready to Dispatch
                <Badge variant={readyToDispatchItems.length > 0 ? "default" : "secondary"} className={readyToDispatchItems.length > 0 ? "bg-blue-600 hover:bg-blue-700" : ""}>
                  {readyToDispatchItems.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="completed" className="flex gap-2">
                Completed Orders
                <Badge variant="secondary">{completedSalesItems.length}</Badge>
              </TabsTrigger>
            </TabsList>

            {/* Main Tabs */}
            <TabsContent value="all" className="flex-1 mt-4 overflow-hidden">
              <div className="h-full overflow-y-auto custom-scrollbar pr-2 pb-20">
                <OrderGroupList
                  products={filteredSalesProducts}
                  emptyMessage="No products found in Sales"
                  onAddPayment={handleAddPayment}
                  showFinancials={true}
                  assignableUsers={salesUsers}
                />
              </div>
            </TabsContent>

            <TabsContent value="my_orders" className="flex-1 mt-4 overflow-hidden">
              <div className="h-full overflow-y-auto custom-scrollbar pr-2 pb-20">
                <OrderGroupList
                  products={mySalesItems}
                  emptyMessage="You have no active orders"
                  onAddPayment={handleAddPayment}
                  showFinancials={true}
                  assignableUsers={salesUsers}
                />
              </div>
            </TabsContent>

            <TabsContent value="pending_approval" className="flex-1 mt-4 overflow-hidden">
              <div className="h-full overflow-y-auto custom-scrollbar pr-2 space-y-8 pb-20">
                {/* 1. Design Requests */}
                {(() => {
                  const designReqs = pendingApprovalItems.filter(({ item }) => item.previous_department === 'design');
                  const prepressReqs = pendingApprovalItems.filter(({ item }) => item.previous_department === 'prepress');
                  const otherReqs = pendingApprovalItems.filter(({ item }) => item.previous_department !== 'design' && item.previous_department !== 'prepress');

                  if (pendingApprovalItems.length === 0) return (
                    <OrderGroupList
                      products={[]}
                      emptyMessage="No orders awaiting approval"
                      onAddPayment={handleAddPayment}
                      showFinancials={true}
                      assignableUsers={salesUsers}
                    />
                  );

                  return (
                    <>
                      {designReqs.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 px-1">
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                              Request from Design
                            </Badge>
                            <span className="text-xs text-muted-foreground font-medium">{designReqs.length} items</span>
                          </div>
                          <OrderGroupList
                            products={designReqs}
                            showFinancials={true}
                            assignableUsers={salesUsers}
                          />
                        </div>
                      )}

                      {prepressReqs.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 px-1">
                            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                              Request from Prepress
                            </Badge>
                            <span className="text-xs text-muted-foreground font-medium">{prepressReqs.length} items</span>
                          </div>
                          <OrderGroupList
                            products={prepressReqs}
                            showFinancials={true}
                            assignableUsers={salesUsers}
                          />
                        </div>
                      )}

                      {otherReqs.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 px-1">
                            <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                              Other Pending Items
                            </Badge>
                          </div>
                          <OrderGroupList
                            products={otherReqs}
                            showFinancials={true}
                            assignableUsers={salesUsers}
                          />
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </TabsContent>

            <TabsContent value="ready_dispatch" className="flex-1 mt-4 overflow-hidden">
              <div className="h-full overflow-y-auto custom-scrollbar pr-2 pb-20">
                <OrderGroupList
                  products={readyToDispatchItems}
                  emptyMessage="No items ready for dispatch"
                  onAddPayment={handleAddPayment}
                  showFinancials={true}
                  assignableUsers={salesUsers}
                />
              </div>
            </TabsContent>

            <TabsContent value="completed" className="flex-1 mt-4 overflow-hidden">
              <div className="h-full overflow-y-auto custom-scrollbar pr-2 pb-20">
                <OrderGroupList
                  products={completedSalesItems}
                  emptyMessage="No completed orders found"
                  onAddPayment={handleAddPayment}
                  showFinancials={true}
                  assignableUsers={salesUsers}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>




        {/* Add Payment Dialog */}
        {selectedOrderForPayment && (
          <AddPaymentDialog
            open={paymentDialogOpen}
            onOpenChange={setPaymentDialogOpen}
            customerId={selectedOrderForPayment.customerId}
            customerName={selectedOrderForPayment.customerName}
            linkedOrderId={selectedOrderForPayment.orderId}
            onSuccess={() => {
              setRefreshKey(prev => prev + 1);
            }}
          />
        )}

        {/* Proforma Invoice Dialog */}
        <ProformaInvoiceDialog
          open={piDialogOpen}
          onOpenChange={setPiDialogOpen}
        />
      </div>
    </TooltipProvider >
  );
}
