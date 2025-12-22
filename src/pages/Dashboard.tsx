import { useState, useMemo, useEffect, useRef } from 'react';
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
  
  // CRITICAL: Memoize orders to prevent flickering from reference changes
  // Use ref to cache and only recalculate when order IDs actually change
  const ordersCacheRef = useRef<{ orders: typeof allOrders; orderIds: string } | null>(null);
  const prevOrderIdsRef = useRef<string>('');
  
  // Create stable key from order IDs - use ref to track previous IDs
  const ordersKey = useMemo(() => {
    if (allOrders.length === 0) {
      if (prevOrderIdsRef.current !== 'empty') {
        prevOrderIdsRef.current = 'empty';
      }
      return 'empty';
    }
    
    // Use first 10 order IDs for key (sorted for consistency)
    const currentIds = allOrders.slice(0, 10).map(o => o.order_id).sort().join(',');
    const key = `${allOrders.length}-${currentIds}-${role || ''}-${profile?.production_stage || ''}-${profile?.department || ''}-${isAdmin}`;
    
    // Only update if IDs actually changed
    if (prevOrderIdsRef.current !== currentIds) {
      prevOrderIdsRef.current = currentIds;
    }
    
    return key;
  }, [
    allOrders.length,
    // Use ref value in dependency - but this won't trigger recalculation
    // Instead, we'll check inside the useMemo
    role,
    profile?.production_stage,
    profile?.department,
    isAdmin,
    // Add a dependency that changes when order IDs change
    allOrders.length > 0 ? allOrders[0]?.order_id : '',
    allOrders.length > 1 ? allOrders[1]?.order_id : '',
    allOrders.length > 2 ? allOrders[2]?.order_id : '',
  ]);
  
  const orders = useMemo(() => {
    // Return cached if key matches
    if (ordersCacheRef.current && ordersCacheRef.current.orderIds === ordersKey) {
      return ordersCacheRef.current.orders;
    }
    
    // Calculate orders directly from allOrders
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
    
    // Cache result
    ordersCacheRef.current = { orders: result, orderIds: ordersKey };
    return result;
  }, [ordersKey]);
  
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
  
  // CRITICAL: Use stable comparison for processedCompletedOrders
  const completedOrdersKey = useMemo(() => {
    return completedOrders.map(o => o.order_id).join(',');
  }, [completedOrders.length, completedOrders.map(o => o.order_id).slice(0, 5).join(',')]);
  
  const processedCompletedOrders = useMemo(() => {
    if (completedOrders.length === 0) return [];
    return sortOrders(completedOrders);
  }, [completedOrdersKey, sortBy]);
  
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
                onClick={() => handleCardClick(getDepartmentRoute('/sales'))}
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
                onClick={() => {
                  // Production card - route based on department
                  if (isAdmin || role === 'production') {
                    handleCardClick('/production');
                  } else if (role) {
                    handleCardClick(`/${role}`);
                  }
                }}
              >
                <StatsCard
                  title="In Production"
                  value={stats.byStage.production}
                  icon={Package}
                  variant="warning"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {isAdmin || role === 'production' ? "View production queue" : `View ${role} department`}
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <div 
                className="cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
                onClick={() => {
                  // Completed/Dispatch card - route based on department
                  if (isAdmin || role === 'production' || role === 'sales') {
                    handleCardClick('/dispatch');
                  } else if (role) {
                    handleCardClick(`/${role}`);
                  }
                }}
              >
                <StatsCard
                  title="Completed"
                  value={stats.byStage.completed}
                  icon={TrendingUp}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {isAdmin || role === 'production' || role === 'sales' 
                ? "View dispatch/completed orders" 
                : `View ${role} department`}
            </TooltipContent>
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