import { useState, useMemo, useEffect } from 'react';
import { Plus, Download, ArrowRight, Send, CheckCircle, Trash2, UserCircle, Loader2, Search, ChevronDown, ChevronUp, ChevronRight, Package, Calendar, Building2, Settings, AlertTriangle, Clock, IndianRupee, CheckCircle2, Flame } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { ProductCard } from '@/features/orders/components/ProductCard';
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
  const { orders, updateItemStage, sendToProduction, assignToOutsource, deleteOrder, isLoading, refreshOrders, updateItemDeliveryDate, getOrdersForDepartment, assignToDepartment, assignOrderToUser } = useOrders();
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
            return dept === 'sales' || isPendingApproval;
          })
          .map(item => ({ order, item }))
      );
  }, [orders]);

  // Filter by selected user tab (for admin)
  const userFilteredSalesProducts = useMemo(() => {
    if (!isAdmin || selectedUserTab === 'all') {
      return salesProducts;
    }
    return salesProducts.filter(({ item }) => item.assigned_to === selectedUserTab);
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

  // Helper to render product list
  const renderProductList = (productList: { order: Order; item: OrderItem }[], emptyMessage: string) => {
    if (productList.length === 0) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <h3 className="font-semibold text-lg mb-2">No products found</h3>
            <p className="text-muted-foreground">{emptyMessage}</p>
          </CardContent>
        </Card>
      );
    }

    // Group items by order
    const itemsByOrder = new Map<string, Array<{ order: Order; item: OrderItem }>>();
    productList.forEach(({ order, item }) => {
      const orderKey = order.order_id;
      if (!itemsByOrder.has(orderKey)) itemsByOrder.set(orderKey, []);
      itemsByOrder.get(orderKey)!.push({ order, item });
    });

    const orderGroups = Array.from(itemsByOrder.entries());

    return (
      <div className="space-y-6 pb-6">
        {orderGroups.map(([orderId, items]) => {
          // Prepare items with suffixes
          const itemsWithSuffixes = items.map(({ order, item }, index) => ({
            order,
            item,
            suffix: items.length > 1 ? String.fromCharCode(65 + index) : ''
          }));

          const order = items[0].order;
          // Determine Customer UUID safely
          const customerId = order.customer?.id || order.customer_id;

          const paymentStat = paymentStatuses[orderId];
          const isPaid = paymentStat && paymentStat.pending_amount <= 0;
          const pendingAmount = paymentStat ? paymentStat.pending_amount : (order.financials?.total || 0);

          // Determine priority color
          const isUrgent = items.some(({ item }) => item.priority_computed === 'red');
          const isMedium = !isUrgent && items.some(({ item }) => item.priority_computed === 'yellow');

          let spineColor = 'bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700'; // Default
          let textColor = 'text-slate-500 dark:text-slate-400';

          if (isUrgent) {
            spineColor = 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-900/50';
            textColor = 'text-red-600 dark:text-red-400';
          } else if (isMedium) {
            spineColor = 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-900/50';
            textColor = 'text-yellow-600 dark:text-yellow-400';
          }

          return (
            <div key={orderId} className="flex h-auto min-h-[250px] border rounded-lg shadow-sm bg-card overflow-hidden transition-all hover:shadow-md">

              {/* Left Spine: Vertical Order ID */}
              <div
                className={`w-10 sm:w-12 flex flex-col items-center justify-center py-4 border-r ${spineColor} flex-shrink-0 cursor-pointer transition-colors hover:bg-opacity-80`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (orderId && navigator?.clipboard) {
                    navigator.clipboard.writeText(orderId).then(() => {
                      toast({ title: "Copied", description: `Order #${orderId} copied to clipboard` });
                    }).catch(console.error);
                  }
                }}
              >
                <div className="flex-1" />
                <span
                  className={`text-sm font-bold tracking-widest whitespace-nowrap ${textColor}`}
                  style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                >
                  #{orderId}
                </span>
                <div className="flex-1" />
              </div>

              {/* Right Content */}
              <div className="flex-1 overflow-hidden flex flex-col min-w-0">
                {/* Financial Header */}
                <div className="px-4 py-2 border-b bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-sm">{order.customer.name}</span>
                    <Badge variant={isPaid ? "default" : "destructive"} className={isPaid ? "bg-emerald-500 hover:bg-emerald-600" : ""}>
                      {isPaid ? "Paid" : `Pending: ₹${pendingAmount ? pendingAmount.toLocaleString() : '0'}`}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 px-2 sm:px-3"
                      onClick={() => {
                        if (customerId) {
                          setSelectedOrderForPayment({
                            orderId: order.id!, // UUID
                            customerId: customerId,
                            customerName: order.customer.name
                          });
                          setPaymentDialogOpen(true);
                        } else {
                          toast({ title: "Error", description: "Missing customer association", variant: "destructive" });
                        }
                      }}
                    >
                      <IndianRupee className="h-3 w-3" />
                      <span className="hidden sm:inline">Add Payment</span>
                    </Button>

                    {/* Order Assignment Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2 border border-dashed border-slate-300 dark:border-slate-700">
                          <UserCircle className="h-3 w-3" />
                          <span className="hidden sm:inline font-medium">
                            {order.assigned_user_name || "Unassigned"}
                          </span>
                          <ChevronDown className="h-3 w-3 opacity-50 hidden sm:block" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem disabled className="text-xs font-semibold opacity-70">
                          Assign Order To
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {salesUsers.map(user => (
                          <DropdownMenuItem
                            key={user.user_id}
                            onClick={() => {
                              if (order.id) {
                                assignOrderToUser(order.id, user.user_id);
                              }
                            }}
                            className={order.assigned_user === user.user_id ? "bg-slate-100 dark:bg-slate-800" : ""}
                          >
                            {user.full_name}
                            {order.assigned_user === user.user_id && <CheckCircle className="ml-2 h-3 w-3 text-green-500" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Delete Order Button */}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (order.order_id) {
                            confirmDelete(order.order_id);
                          }
                        }}
                        title="Delete Order"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className={`p-4 h-full overflow-x-auto overflow-y-hidden custom-scrollbar bg-slate-50/30 dark:bg-slate-900/10`}>
                  <div className={`flex gap-4 h-full items-start ${itemsWithSuffixes.length === 1 ? 'w-full' : ''}`}>
                    {itemsWithSuffixes.map(({ order, item, suffix }) => (
                      <div
                        key={`${order.order_id}-${item.item_id}`}
                        className={`
                               flex-shrink-0 transition-all duration-300
                               ${itemsWithSuffixes.length === 1 ? 'w-full max-w-2xl' : 'w-[320px]'}
                             `}
                      >
                        <ProductCard
                          order={order}
                          item={item}
                          productSuffix={suffix}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          );
        })}
      </div>
    );
  };

  const handleSendToDesign = async (orderId: string, itemId: string) => { await updateItemStage(orderId, itemId, 'design'); };
  const handleSendToPrepress = async (orderId: string, itemId: string) => { await updateItemStage(orderId, itemId, 'prepress'); };
  const handleSendToProduction = (orderId: string, itemId: string) => {
    const order = orders.find(o => o.order_id === orderId);
    const item = order?.items.find(i => i.item_id === itemId);
    if (!order || !item) return;
    if ((item as any).production_stage_sequence && (item as any).production_stage_sequence.length > 0) {
      sendToProduction(orderId, itemId, (item as any).production_stage_sequence);
    } else {
      setSelectedItemForProduction({ orderId, itemId, productName: item.product_name, currentSequence: (item as any).production_stage_sequence });
      setProductionStageDialogOpen(true);
    }
  };
  const handleDirectAssignToProduction = async (orderId: string, itemId: string) => { await assignToDepartment(orderId, itemId, 'production'); toast({ title: "Assigned to Production", description: "Item assigned to production department" }); };
  const handleOutsourceClick = (orderId: string, itemId: string, productName: string, quantity: number) => { setSelectedItemForOutsource({ orderId, itemId, productName, quantity }); setOutsourceDialogOpen(true); };
  const handleOutsourceAssign = async (vendor: any, jobDetails: any) => { if (selectedItemForOutsource) { await assignToOutsource(selectedItemForOutsource.orderId, selectedItemForOutsource.itemId, vendor, jobDetails); setOutsourceDialogOpen(false); setSelectedItemForOutsource(null); } };
  const handleUpdateDeliveryDate = (orderId: string, itemId: string, productName: string, currentDate: Date) => { setSelectedItemForDeliveryDate({ orderId, itemId, productName, currentDate }); setDeliveryDateDialogOpen(true); };
  const handleSaveDeliveryDate = async (date: Date) => { if (selectedItemForDeliveryDate) { await updateItemDeliveryDate(selectedItemForDeliveryDate.orderId, selectedItemForDeliveryDate.itemId, date); setDeliveryDateDialogOpen(false); setSelectedItemForDeliveryDate(null); } };
  const handleSetPriority = (orderId: string, itemId: string, productName: string, currentPriority: 'blue' | 'yellow' | 'red') => { setSelectedItemForPriority({ orderId, itemId, productName, currentPriority }); setPriorityDialogOpen(true); };
  const handleDeleteOrder = async () => { if (orderToDelete) { await deleteOrder(orderToDelete); setOrderToDelete(null); setDeleteDialogOpen(false); } };
  const confirmDelete = (orderId: string) => { setOrderToDelete(orderId); setDeleteDialogOpen(true); };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading orders...</span>
      </div>
    );
  }

  // Calculate unique customers count (from all orders)
  const uniqueCustomersCount = new Set(orders.map(o => o.customer.email || o.customer.phone)).size;

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
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm font-medium text-muted-foreground">Filter by User:</span>
            <Tabs value={selectedUserTab} onValueChange={setSelectedUserTab} className="w-full">
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="all" className="text-sm">All Users</TabsTrigger>
                {salesUsers.map((salesUser) => (
                  <TabsTrigger key={salesUser.user_id} value={salesUser.user_id} className="text-sm">
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
              <TabsTrigger value="completed" className="flex gap-2">
                Completed Orders
                <Badge variant="secondary">{completedSalesItems.length}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="flex-1 mt-4 overflow-hidden">
              <div className="h-full overflow-y-auto custom-scrollbar pr-2">
                {renderProductList(filteredSalesProducts, "No products found in Sales")}
              </div>
            </TabsContent>

            <TabsContent value="my_orders" className="flex-1 mt-4 overflow-hidden">
              <div className="h-full overflow-y-auto custom-scrollbar pr-2">
                {renderProductList(mySalesItems, "You have no active orders")}
              </div>
            </TabsContent>

            <TabsContent value="pending_approval" className="flex-1 mt-4 overflow-hidden">
              <div className="h-full overflow-y-auto custom-scrollbar pr-2 space-y-8">
                {/* 1. Design Requests */}
                {(() => {
                  const designReqs = pendingApprovalItems.filter(({ item }) => item.previous_department === 'design');
                  const prepressReqs = pendingApprovalItems.filter(({ item }) => item.previous_department === 'prepress');
                  const otherReqs = pendingApprovalItems.filter(({ item }) => item.previous_department !== 'design' && item.previous_department !== 'prepress');

                  if (pendingApprovalItems.length === 0) return renderProductList([], "No orders awaiting approval");

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
                          {renderProductList(designReqs, "")}
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
                          {renderProductList(prepressReqs, "")}
                        </div>
                      )}

                      {otherReqs.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 px-1">
                            <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                              Other Pending Items
                            </Badge>
                          </div>
                          {renderProductList(otherReqs, "")}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </TabsContent>

            <TabsContent value="completed" className="flex-1 mt-4 overflow-hidden">
              <div className="h-full overflow-y-auto custom-scrollbar pr-2">
                {renderProductList(completedSalesItems, "No completed orders found")}
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
    </TooltipProvider>
  );
}
