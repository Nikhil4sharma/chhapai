import { useState, useMemo } from 'react';
import { ShoppingCart, AlertTriangle, Package, TrendingUp, CheckCircle, Loader2, ChevronLeft, ChevronRight, Filter, ArrowUpDown } from 'lucide-react';
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

const ITEMS_PER_PAGE = 9;

type SortOption = 'newest' | 'oldest' | 'priority' | 'delivery';
type FilterOption = 'all' | 'red' | 'yellow' | 'blue';

export default function Dashboard() {
  const { getOrdersByDepartment, getCompletedOrders, isLoading } = useOrders();
  const { isAdmin, role, profile } = useAuth();
  const navigate = useNavigate();
  
  // Pagination state
  const [activePage, setActivePage] = useState(1);
  const [urgentPage, setUrgentPage] = useState(1);
  const [completedPage, setCompletedPage] = useState(1);
  
  // Sort and filter state
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  
  const orders = getOrdersByDepartment();
  const completedOrders = getCompletedOrders();
  const urgentOrders = orders.filter(o => o.priority_computed === 'red');
  
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

  const processedOrders = useMemo(() => 
    filterOrders(sortOrders(orders)), 
    [orders, sortBy, filterBy]
  );
  
  const processedCompletedOrders = useMemo(() => 
    sortOrders(completedOrders), 
    [completedOrders, sortBy]
  );
  
  // Pagination helpers
  const paginateArray = <T,>(array: T[], page: number) => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return array.slice(start, end);
  };

  const getTotalPages = (total: number) => Math.ceil(total / ITEMS_PER_PAGE);
  
  // Calculate stats
  const stats = {
    totalOrders: orders.length,
    urgentItems: 0,
    byStage: {
      sales: 0,
      design: 0,
      prepress: 0,
      production: 0,
      dispatch: 0,
      completed: 0,
    },
  };

  orders.forEach(order => {
    order.items.forEach(item => {
      stats.byStage[item.current_stage]++;
      if (item.priority_computed === 'red') {
        stats.urgentItems++;
      }
    });
  });

  completedOrders.forEach(order => {
    order.items.forEach(item => {
      if (item.current_stage === 'completed') {
        stats.byStage.completed++;
      }
    });
  });

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
      <div className="h-full flex flex-col gap-4 overflow-hidden">
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
                className="cursor-pointer transition-transform hover:scale-[1.02]"
                onClick={() => handleCardClick('/sales')}
              >
                <StatsCard
                  title="Total Orders"
                  value={stats.totalOrders}
                  icon={ShoppingCart}
                  variant="primary"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>View all orders in Sales</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <div 
                className="cursor-pointer transition-transform hover:scale-[1.02]"
                onClick={() => handleCardClick('/production')}
              >
                <StatsCard
                  title="Urgent Items"
                  value={stats.urgentItems}
                  icon={AlertTriangle}
                  variant="danger"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>View urgent items</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <div 
                className="cursor-pointer transition-transform hover:scale-[1.02]"
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
                className="cursor-pointer transition-transform hover:scale-[1.02]"
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

        {/* Stage Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display">Items by Stage</CardTitle>
          </CardHeader>
          <CardContent>
            <StageProgress data={stats.byStage} />
          </CardContent>
        </Card>

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
                {processedOrders.length > 0 ? (
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
                      <p className="text-muted-foreground">No active orders found</p>
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