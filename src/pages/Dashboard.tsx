import { useState, useMemo, useEffect } from 'react';
import { ShoppingCart, AlertTriangle, Package, TrendingUp, CheckCircle, Loader2, ChevronLeft, ChevronRight, Filter, ArrowUpDown, Bell, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { StageProgress } from '@/components/dashboard/StageProgress';
import { OrderCard } from '@/components/orders/OrderCard';
import { useOrders } from '@/contexts/OrderContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
import { useNotifications } from '@/hooks/useNotifications';
import { toast } from '@/hooks/use-toast';

const ITEMS_PER_PAGE = 9;

type SortOption = 'newest' | 'oldest' | 'priority' | 'delivery';
type FilterOption = 'all' | 'red' | 'yellow' | 'blue';

export default function Dashboard() {
  // ALL HOOKS MUST BE CALLED FIRST - before any conditional returns
  const { orders: allOrders, getOrdersByDepartment, getUrgentOrdersForAdmin, getUrgentOrdersForDepartment, getCompletedOrders, isLoading } = useOrders();
  const { isAdmin, role, profile, user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { requestPushPermission } = useNotifications();
  
  // Pagination state
  const [activePage, setActivePage] = useState(1);
  const [urgentPage, setUrgentPage] = useState(1);
  const [completedPage, setCompletedPage] = useState(1);
  
  // Sort and filter state
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  
  // Notification permission state
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  
  const orders = getOrdersByDepartment();
  const completedOrders = getCompletedOrders();
  
  // CRITICAL FIX: For admin, use allOrders directly if getOrdersByDepartment returns empty
  // This ensures admin always sees orders even if filtering fails
  const adminOrders = useMemo(() => {
    if (isAdmin && orders.length === 0 && allOrders.length > 0) {
      console.warn('[Dashboard] Admin: getOrdersByDepartment returned empty, using allOrders directly');
      return allOrders.filter(o => !o.is_completed && !o.archived_from_wc);
    }
    return orders;
  }, [isAdmin, orders, allOrders]);
  
  // Debug logging for admin
  useEffect(() => {
    if (isAdmin) {
      console.log('[Dashboard] Admin Debug:', {
        allOrdersCount: allOrders.length,
        filteredOrdersCount: orders.length,
        adminOrdersCount: adminOrders.length,
        completedOrdersCount: completedOrders.length,
        isLoading,
        role,
        isAdmin,
        usingFallback: adminOrders.length > orders.length,
      });
    }
  }, [isAdmin, allOrders.length, orders.length, adminOrders.length, completedOrders.length, isLoading, role]);
  
  // For Admin/Sales: show all urgent orders across all departments
  // For other departments: show urgent orders for their department only
  const urgentOrders = useMemo(() => {
    if (isAdmin) {
      return getUrgentOrdersForAdmin();
    }
    if (role === 'sales') {
      return allOrders.filter(o => !o.is_completed && o.priority_computed === 'red');
    }
    if (role) {
      return getUrgentOrdersForDepartment(role);
    }
    return [];
  }, [isAdmin, role, getUrgentOrdersForAdmin, getUrgentOrdersForDepartment, allOrders]);
  
  // Total orders count: For Admin/Sales show all, for others show only their department
  const totalOrdersCount = useMemo(() => {
    if (isAdmin || role === 'sales') {
      return allOrders.length;
    }
    // For other departments, count only their department orders
    return orders.length;
  }, [isAdmin, role, allOrders.length, orders.length]);
  
  // Apply sorting and filtering
  const sortOrders = (orderList: typeof orders) => {
    const sorted = [...orderList];
    switch (sortBy) {
      case 'newest':
        return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case 'oldest':
        return sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      case 'priority':
        const priorityOrder = { red: 0, yellow: 1, blue: 2 };
        return sorted.sort((a, b) => priorityOrder[a.priority_computed] - priorityOrder[b.priority_computed]);
      case 'delivery':
        return sorted.sort((a, b) => {
          const dateA = a.order_level_delivery_date || a.items[0]?.delivery_date;
          const dateB = b.order_level_delivery_date || b.items[0]?.delivery_date;
          if (!dateA) return 1;
          if (!dateB) return -1;
          return new Date(dateA).getTime() - new Date(dateB).getTime();
        });
      default:
        return sorted;
    }
  };

  const filterOrders = (orderList: typeof orders) => {
    if (filterBy === 'all') return orderList;
    return orderList.filter(o => o.priority_computed === filterBy);
  };

  // Use adminOrders for admin, regular orders for others
  const ordersToProcess = isAdmin ? adminOrders : orders;
  
  const processedOrders = useMemo(() => 
    filterOrders(sortOrders(ordersToProcess)), 
    [ordersToProcess, sortBy, filterBy, isAdmin]
  );
  
  const processedCompletedOrders = useMemo(() => 
    sortOrders(completedOrders), 
    [completedOrders, sortBy]
  );
  
  // Calculate stats with useMemo for realtime updates
  // CRITICAL: For non-admin/sales users, stats should only show their department
  const stats = useMemo(() => {
    const calculated = {
      totalOrders: totalOrdersCount,
      urgentItems: 0,
      assignedToMe: 0, // Department-wise: items assigned to current user
      byStage: {
        sales: 0,
        design: 0,
        prepress: 0,
        production: 0,
        dispatch: 0,
        completed: 0,
      },
      byDepartment: {
        sales: 0,
        design: 0,
        prepress: 0,
        production: 0,
      },
    };

    // For non-admin/sales: only count items from their department
    // For admin/sales: count all items
    const ordersToCount = isAdmin || role === 'sales' ? allOrders : orders;

    ordersToCount.forEach(order => {
      order.items.forEach(item => {
        // For non-admin/sales: only count items assigned to their department
        if (!isAdmin && role !== 'sales' && role) {
          const dept = (item.assigned_department || item.current_stage)?.toLowerCase();
          const userDept = role.toLowerCase();
          if (dept !== userDept) {
            return; // Skip items not assigned to user's department
          }
        }
        
        // Count items assigned to current user (user-wise)
        if (item.assigned_to === user?.uid) {
          calculated.assignedToMe++;
        }
        
        calculated.byStage[item.current_stage]++;
        if (item.priority_computed === 'red') {
          calculated.urgentItems++;
        }
        // Count by assigned department
        if (item.assigned_department && calculated.byDepartment[item.assigned_department as keyof typeof calculated.byDepartment] !== undefined) {
          calculated.byDepartment[item.assigned_department as keyof typeof calculated.byDepartment]++;
        }
      });
    });

    return calculated;
  }, [orders, allOrders, completedOrders, totalOrdersCount, isAdmin, role, user]);

  const handleCardClick = (path: string) => {
    navigate(path);
  };

  // Pagination component
  const Pagination = ({ 
    currentPage, 
    totalPages, 
    onPageChange 
  }: { 
    currentPage: number; 
    totalPages: number; 
    onPageChange: (page: number) => void;
  }) => {
    if (totalPages <= 1) return null;
    
    return (
      <div className="flex items-center justify-center gap-2 mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
  };
  
  // Pagination helpers
  const paginateArray = <T,>(array: T[], page: number) => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return array.slice(start, end);
  };

  const getTotalPages = (total: number) => Math.ceil(total / ITEMS_PER_PAGE);

  // Check and prompt for notification permission on first visit
  useEffect(() => {
    if (!authLoading && profile) {
      const hasPrompted = localStorage.getItem('notificationPermissionPrompted');
      if (!hasPrompted && 'Notification' in window && Notification.permission === 'default') {
        // Show prompt after 3 seconds
        const timer = setTimeout(() => {
          setShowNotificationPrompt(true);
        }, 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [authLoading, profile]);

  const handleNotificationPermission = async () => {
    const granted = await requestPushPermission();
    if (granted) {
      localStorage.setItem('notificationPermissionPrompted', 'true');
      toast({
        title: "Notifications Enabled",
        description: "You'll receive real-time updates about your orders",
      });
    }
    setShowNotificationPrompt(false);
  };
  
  // NOW check loading after all hooks are called
  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col gap-4 overflow-hidden">
        {/* Notification Permission Prompt */}
        <AlertDialog open={showNotificationPrompt} onOpenChange={setShowNotificationPrompt}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Enable Push Notifications?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Get instant notifications about order updates, urgent items, and important alerts. 
                Stay informed without constantly checking the dashboard.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Not Now</AlertDialogCancel>
              <AlertDialogAction onClick={handleNotificationPermission}>
                Enable Notifications
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Welcome message */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">
              Welcome, {profile?.full_name || 'User'}
            </h1>
            <p className="text-muted-foreground">
              {isAdmin ? 'Admin Dashboard - All departments' : `${role?.charAt(0).toUpperCase()}${role?.slice(1)} Department`}
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <div 
                className="cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
                onClick={() => handleCardClick('/sales')}
              >
                <StatsCard
                  title={isAdmin || role === 'sales' ? "Total Orders" : `${role?.charAt(0).toUpperCase()}${role?.slice(1)} Orders`}
                  value={stats.totalOrders}
                  icon={ShoppingCart}
                  variant="primary"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>{isAdmin || role === 'sales' ? "View all orders" : `View ${role} orders`}</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <div 
                className="cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
                onClick={() => {
                  // Switch to urgent tab instead of navigating away
                  const urgentTab = document.querySelector('[value="urgent"]') as HTMLElement;
                  if (urgentTab) {
                    urgentTab.click();
                  } else {
                    // Fallback: navigate to appropriate department
                    if (isAdmin) {
                      handleCardClick('/dashboard');
                    } else if (role) {
                      handleCardClick(`/${role}`);
                    }
                  }
                }}
              >
                <StatsCard
                  title={isAdmin || role === 'sales' ? "Urgent Items" : `${role?.charAt(0).toUpperCase()}${role?.slice(1)} Urgent`}
                  value={stats.urgentItems}
                  icon={AlertTriangle}
                  variant="danger"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>View urgent items - Click to see urgent tab</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <div 
                className="cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
                onClick={() => handleCardClick('/production')}
              >
                <StatsCard
                  title="In Production"
                  value={stats.byStage.production}
                  icon={Package}
                  variant="warning"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>View production queue</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <div 
                className="cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
                onClick={() => handleCardClick('/dispatch')}
              >
                <StatsCard
                  title="Completed"
                  value={stats.byStage.completed}
                  icon={TrendingUp}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>View completed orders</TooltipContent>
          </Tooltip>
        </div>

        {/* Stage Progress - Only show for Admin/Sales */}
        {(isAdmin || role === 'sales') && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display">Items by Stage</CardTitle>
            </CardHeader>
            <CardContent>
              <StageProgress data={stats.byStage} />
            </CardContent>
          </Card>
        )}

        {/* Sort and Filter Controls */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="delivery">Delivery Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterBy} onValueChange={(v) => setFilterBy(v as FilterOption)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="red">Urgent (Red)</SelectItem>
                <SelectItem value="yellow">Warning (Yellow)</SelectItem>
                <SelectItem value="blue">Normal (Blue)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Orders Tabs - Scrollable Content */}
        <div className="flex-1 min-h-0 flex flex-col">
          <Tabs defaultValue="active" className="flex-1 flex flex-col min-h-0">
            <TabsList className="flex-shrink-0">
              <TabsTrigger value="active">Active Orders ({processedOrders.length})</TabsTrigger>
              <TabsTrigger value="urgent">Urgent ({urgentOrders.length})</TabsTrigger>
              <TabsTrigger value="completed">Completed ({processedCompletedOrders.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="flex-1 mt-4 overflow-hidden">
              <div className="h-full overflow-y-auto custom-scrollbar pr-2">
                {isLoading ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary mb-4" />
                      <p className="text-muted-foreground">Loading orders...</p>
                    </CardContent>
                  </Card>
                ) : processedOrders.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-4">
                      {paginateArray(processedOrders, activePage).map((order) => (
                        <OrderCard key={order.order_id} order={order} />
                      ))}
                    </div>
                    <Pagination 
                      currentPage={activePage}
                      totalPages={getTotalPages(processedOrders.length)}
                      onPageChange={setActivePage}
                    />
                  </>
                ) : (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Package className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="font-semibold text-lg mb-2">No active orders found</h3>
                      {isAdmin && (
                        <>
                          <p className="text-muted-foreground mb-4 text-center max-w-md">
                            {allOrders.length === 0 
                              ? "Database is empty. Please sync orders from WooCommerce in Settings."
                              : `Found ${allOrders.length} total orders, but none are active. Check completed or archived orders.`
                            }
                          </p>
                          {allOrders.length === 0 && (
                            <Button onClick={() => navigate('/settings')} variant="default">
                              Go to Settings & Sync Orders
                            </Button>
                          )}
                        </>
                      )}
                      {!isAdmin && (
                        <p className="text-muted-foreground text-center max-w-md">
                          No orders assigned to your department yet. Contact admin to assign orders.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="urgent" className="flex-1 mt-4 overflow-hidden">
              <div className="h-full overflow-y-auto custom-scrollbar pr-2">
                {urgentOrders.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-4">
                      {paginateArray(urgentOrders, urgentPage).map((order) => (
                        <OrderCard key={order.order_id} order={order} />
                      ))}
                    </div>
                    <Pagination 
                      currentPage={urgentPage}
                      totalPages={getTotalPages(urgentOrders.length)}
                      onPageChange={setUrgentPage}
                    />
                  </>
                ) : (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                      <p className="text-muted-foreground">No urgent orders!</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="completed" className="flex-1 mt-4 overflow-hidden">
              <div className="h-full overflow-y-auto custom-scrollbar pr-2">
                {processedCompletedOrders.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-4">
                      {paginateArray(processedCompletedOrders, completedPage).map((order) => (
                        <OrderCard key={order.order_id} order={order} />
                      ))}
                    </div>
                    <Pagination 
                      currentPage={completedPage}
                      totalPages={getTotalPages(processedCompletedOrders.length)}
                      onPageChange={setCompletedPage}
                    />
                  </>
                ) : (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Package className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No completed orders yet</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </TooltipProvider>
  );
}