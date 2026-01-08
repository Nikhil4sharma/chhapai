import { useState, useMemo, useEffect, useRef } from 'react';
import { ShoppingCart, AlertTriangle, Package, TrendingUp, CheckCircle, Loader2, ChevronLeft, ChevronRight, Filter, ArrowUpDown, Bell, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DepartmentLoadChart } from '@/components/dashboard/DepartmentLoadChart';
import { UserWorkloadCard } from '@/components/dashboard/UserWorkloadCard';
import { OrderCard } from '@/features/orders/components/OrderCard';
import { ProductCard } from '@/features/orders/components/ProductCard';
import { useOrders } from '@/features/orders/context/OrderContext';
import { useAuth } from '@/features/auth/context/AuthContext';
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

  // CRITICAL: Show loading if auth is not ready
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Pagination state
  const [activePage, setActivePage] = useState(1);
  const [urgentPage, setUrgentPage] = useState(1);
  const [completedPage, setCompletedPage] = useState(1);

  // Sort and filter state
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');

  // Notification permission state
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);

  const orders = useMemo(() => {
    let result: typeof allOrders;

    // For admin/sales, return all active orders
    if (isAdmin || role === 'sales') {
      result = allOrders.filter(o => !o.is_completed);
    } else if (!role) {
      result = [];
    } else {
      const activeOrders = allOrders.filter(o => !o.is_completed && !o.archived_from_wc);
      const roleLower = role.toLowerCase().trim();

      // For production users with production_stage, filter by stage
      if (role === 'production' && profile?.production_stage) {
        result = activeOrders.filter(order =>
          order.items.some(item =>
            item.current_stage === 'production' &&
            item.current_substage === profile.production_stage &&
            (item.assigned_department?.toLowerCase() === 'production' || item.current_stage === 'production')
          )
        );
      } else {
        // For other departments, filter by assigned_department or current_stage
        result = activeOrders.filter(order =>
          order.items.some(item => {
            const itemDept = (item.assigned_department || item.current_stage || '').toLowerCase().trim();
            return itemDept === roleLower;
          })
        );
      }
    }

    return result;
  }, [allOrders, isAdmin, role, profile?.production_stage, profile?.department]);

  // CRITICAL: Calculate completed orders directly to avoid function reference issues
  const completedOrders = useMemo(() => {
    if (isAdmin || role === 'sales') {
      return allOrders.filter(o => o.is_completed);
    }
    if (!role) return [];

    return allOrders.filter(o =>
      o.is_completed &&
      o.items.some(item => {
        const itemDept = (item.assigned_department || item.current_stage || '').toLowerCase().trim();
        return itemDept === role.toLowerCase().trim();
      })
    );
  }, [allOrders, isAdmin, role]);

  // CRITICAL FIX: For admin, use allOrders directly if getOrdersByDepartment returns empty
  // This ensures admin always sees orders even if filtering fails
  const adminOrders = useMemo(() => {
    // CRITICAL: Admin should always see all active orders
    if (isAdmin) {
      const activeAllOrders = allOrders.filter(o => !o.is_completed && !o.archived_from_wc);
      if (orders.length === 0 && activeAllOrders.length > 0) {
        console.warn('[Dashboard] Admin: getOrdersByDepartment returned empty, using allOrders directly');
        return activeAllOrders;
      }
      // If orders from getOrdersByDepartment exist, use them (they should match allOrders for admin)
      return orders.length > 0 ? orders : activeAllOrders;
    }
    return orders;
  }, [isAdmin, orders, allOrders]);

  // CRITICAL: Remove debug logging that causes re-renders - only log on mount or when counts actually change
  const prevOrdersCountRef = useRef({ allOrders: 0, orders: 0, adminOrders: 0, completedOrders: 0 });
  useEffect(() => {
    if (isAdmin) {
      const currentCounts = {
        allOrders: allOrders.length,
        orders: orders.length,
        adminOrders: adminOrders.length,
        completedOrders: completedOrders.length,
      };

      // Only log if counts actually changed
      const countsChanged =
        prevOrdersCountRef.current.allOrders !== currentCounts.allOrders ||
        prevOrdersCountRef.current.orders !== currentCounts.orders ||
        prevOrdersCountRef.current.adminOrders !== currentCounts.adminOrders ||
        prevOrdersCountRef.current.completedOrders !== currentCounts.completedOrders;

      if (countsChanged) {
        console.log('[Dashboard] Admin Debug:', {
          ...currentCounts,
          isLoading,
          role,
          isAdmin,
          usingFallback: adminOrders.length > orders.length,
        });
        prevOrdersCountRef.current = currentCounts;
      }
    }
  }, [isAdmin, allOrders.length, orders.length, adminOrders.length, completedOrders.length, isLoading, role]);

  // For Admin/Sales: show all urgent orders across all departments
  // For other departments: show urgent orders for their department only
  // CRITICAL: Memoize with stable dependencies
  const urgentOrdersKey = useMemo(() => {
    const urgentCount = allOrders.filter(o => !o.is_completed && o.priority_computed === 'red').length;
    return `${allOrders.length}-${urgentCount}-${isAdmin}-${role}`;
  }, [allOrders.length, isAdmin, role]);

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
  }, [urgentOrdersKey, isAdmin, role, allOrders]);

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
  // CRITICAL: Memoize ordersToProcess to prevent reference changes
  const ordersToProcess = useMemo(() => {
    return isAdmin ? adminOrders : orders;
  }, [isAdmin, adminOrders, orders]);

  // CRITICAL: Use stable comparison for processedOrders
  // Create a stable key from order IDs to detect actual changes
  const processedOrdersKey = useMemo(() => {
    return ordersToProcess.map(o => o.order_id).join(',');
  }, [ordersToProcess.length, ordersToProcess.map(o => o.order_id).slice(0, 5).join(',')]);

  const processedOrders = useMemo(() => {
    if (ordersToProcess.length === 0) return [];
    return filterOrders(sortOrders(ordersToProcess));
  }, [processedOrdersKey, sortBy, filterBy]);

  // PRODUCT-CENTRIC: Convert orders to products (each item = one product card)
  const processedProducts = useMemo(() => {
    return processedOrders.flatMap(order =>
      order.items
        .filter(item => !item.is_dispatched) // Only show non-dispatched items
        .map(item => ({ order, item }))
    );
  }, [processedOrders]);

  // Urgent products (from urgent orders)
  const urgentProducts = useMemo(() => {
    return urgentOrders.flatMap(order =>
      order.items
        .filter(item => !item.is_dispatched && item.priority_computed === 'red')
        .map(item => ({ order, item }))
    );
  }, [urgentOrders]);

  // CRITICAL: Use stable comparison for processedCompletedOrders
  const completedOrdersKey = useMemo(() => {
    return completedOrders.map(o => o.order_id).join(',');
  }, [completedOrders.length, completedOrders.map(o => o.order_id).slice(0, 5).join(',')]);

  const processedCompletedOrders = useMemo(() => {
    if (completedOrders.length === 0) return [];
    return sortOrders(completedOrders);
  }, [completedOrdersKey, sortBy]);

  // Completed products
  const completedProducts = useMemo(() => {
    return processedCompletedOrders.flatMap(order =>
      order.items.map(item => ({ order, item }))
    );
  }, [processedCompletedOrders]);

  // Calculate stats with useMemo for realtime updates
  // CRITICAL: For non-admin/sales users, stats should only show their department
  // Use stable key to prevent unnecessary recalculations
  const statsKey = useMemo(() => {
    const orderIds = (isAdmin || role === 'sales' ? allOrders : orders)
      .slice(0, 10)
      .map(o => o.order_id)
      .join(',');
    return `${orderIds}-${totalOrdersCount}-${isAdmin}-${role}-${user?.id || ''}`;
  }, [
    isAdmin || role === 'sales' ? allOrders.length : orders.length,
    totalOrdersCount,
    isAdmin,
    role,
    user?.id
  ]);

  const statsCacheRef = useRef<{ stats: any; key: string } | null>(null);

  const stats = useMemo(() => {
    // Return cached if key matches
    if (statsCacheRef.current && statsCacheRef.current.key === statsKey) {
      return statsCacheRef.current.stats;
    }

    const calculated = {
      totalOrders: totalOrdersCount,
      urgentItems: 0,
      assignedToMe: 0, // Department-wise: items assigned to current user
      byStage: {
        sales: 0,
        design: 0,
        prepress: 0,
        production: 0,
        outsource: 0,
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
        if (item.assigned_to === user?.id) {
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

    // Cache result
    statsCacheRef.current = { stats: calculated, key: statsKey };
    return calculated;
  }, [statsKey, orders, allOrders, totalOrdersCount, isAdmin, role, user?.id]);

  // CRITICAL: Department-based routing for cards
  const handleCardClick = (path: string) => {
    // If path starts with /, use it directly
    // Otherwise, prepend / for department-based routing
    const finalPath = path.startsWith('/') ? path : `/${path}`;
    navigate(finalPath);
  };

  // Get department-based route for cards
  const getDepartmentRoute = (defaultPath: string) => {
    if (isAdmin) {
      // Admin can access all routes
      return defaultPath;
    }
    // For non-admin users, route to their department page
    if (role) {
      return `/${role}`;
    }
    // Fallback to default
    return defaultPath;
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
      <div className="h-full flex flex-col gap-6 overflow-hidden p-2 sm:p-4 max-w-[1600px] mx-auto w-full">
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

        {/* 1. Header Section */}
        <DashboardHeader />

        {/* 2. KPI Pulse Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            className="cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
            onClick={() => handleCardClick(getDepartmentRoute('/sales'))}
          >
            <StatsCard
              title={isAdmin || role === 'sales' ? "Total Active Orders" : `${role?.charAt(0).toUpperCase()}${role?.slice(1)} Orders`}
              value={stats.totalOrders}
              icon={ShoppingCart}
              variant="primary"
            />
          </div>

          <div
            className="cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
            onClick={() => {
              const urgentTab = document.querySelector('[value="urgent"]') as HTMLElement;
              if (urgentTab) urgentTab.click();
            }}
          >
            <StatsCard
              title="Urgent Attention"
              value={stats.urgentItems}
              icon={AlertTriangle}
              variant="danger"
            />
          </div>

          <div className="md:col-span-1 lg:col-span-1">
            {/* Dynamic Card based on Role */}
            {isAdmin ? (
              <StatsCard
                title="In Production"
                value={stats.byStage.production}
                icon={Package}
                variant="warning"
              />
            ) : (
              <StatsCard
                title="Tasks Assigned"
                value={stats.assignedToMe}
                icon={User}
                variant="default" // Use blue/neutral
              />
            )}
          </div>

          <div
            className="cursor-pointer transition-transform hover:scale-[1.02]"
            onClick={() => handleCardClick('/dispatch')}
          >
            <StatsCard
              title="Ready for Dispatch"
              value={stats.byStage.dispatch}
              icon={TrendingUp}
              variant="success" // Assuming StatsCard supports this or maps to default
            />
          </div>
        </div>

        {/* 3. Deep Dive Analytics (Charts) - Only for Admin/Sales/Production */}
        {(isAdmin || role === 'sales' || role === 'production') && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <DepartmentLoadChart />
            </div>
            <div className="lg:col-span-1">
              <UserWorkloadCard />
            </div>
          </div>
        )}

        {/* 4. Filter & Tabs Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-2">
          <Tabs defaultValue="active" className="w-full">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
              <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-full">
                <TabsTrigger value="active" className="rounded-full px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 shadow-sm">Active</TabsTrigger>
                <TabsTrigger value="urgent" className="rounded-full px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 shadow-sm text-red-500 data-[state=active]:text-red-600">Urgent</TabsTrigger>
                <TabsTrigger value="completed" className="rounded-full px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 shadow-sm">Completed</TabsTrigger>
              </TabsList>

              {/* Sort/Filter Controls - Compact */}
              <div className="flex items-center gap-2">
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                  <SelectTrigger className="w-[140px] h-9 rounded-full text-xs font-medium border-slate-200 dark:border-slate-800">
                    <ArrowUpDown className="h-3 w-3 mr-2 opacity-50" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="priority">Priority High</SelectItem>
                    <SelectItem value="delivery">Delivery Date</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="h-[calc(100vh-450px)] sm:h-[calc(100vh-500px)] min-h-[400px]">
              <TabsContent value="active" className="h-full">
                <div className="h-full overflow-y-auto custom-scrollbar pr-2 pb-20">
                  {processedProducts.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {paginateArray(processedProducts, activePage).map(({ order, item }) => (
                        <ProductCard
                          key={`${order.order_id}-${item.item_id}`}
                          order={order}
                          item={item}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                      <Package className="h-12 w-12 mb-2 opacity-20" />
                      <p>No active items found</p>
                    </div>
                  )}
                  <Pagination
                    currentPage={activePage}
                    totalPages={getTotalPages(processedProducts.length)}
                    onPageChange={setActivePage}
                  />
                </div>
              </TabsContent>

              <TabsContent value="urgent" className="h-full">
                <div className="h-full overflow-y-auto custom-scrollbar pr-2 pb-20">
                  {urgentProducts.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {paginateArray(urgentProducts, urgentPage).map(({ order, item }) => (
                        <ProductCard
                          key={`${order.order_id}-${item.item_id}`}
                          order={order}
                          item={item}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-emerald-500/50">
                      <CheckCircle className="h-16 w-16 mb-2 opacity-50" />
                      <p className="font-medium">All caught up! No urgent items.</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="completed" className="h-full">
                <div className="h-full overflow-y-auto custom-scrollbar pr-2 pb-20">
                  {completedProducts.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {paginateArray(completedProducts, completedPage).map(({ order, item }) => (
                        <ProductCard
                          key={`${order.order_id}-${item.item_id}`}
                          order={order}
                          item={item}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                      <p>No history yet</p>
                    </div>
                  )}
                  <Pagination
                    currentPage={completedPage}
                    totalPages={getTotalPages(completedProducts.length)}
                    onPageChange={setCompletedPage}
                  />
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </TooltipProvider>
  );
}
