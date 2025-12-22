import { useState, useMemo } from 'react';
import { Search, AlertTriangle, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OrderAccordion } from '@/components/orders/OrderAccordion';
import { useOrders } from '@/contexts/OrderContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  TooltipProvider,
} from '@/components/ui/tooltip';

// Department labels for filter dropdown
const departmentLabels: Record<string, string> = {
  sales: 'Sales',
  design: 'Design',
  prepress: 'Prepress',
  production: 'Production',
  outsource: 'Outsource',
  dispatch: 'Dispatch',
  completed: 'Completed',
};

export default function Orders() {
  const { orders, getOrdersByDepartment } = useOrders();
  const { isAdmin, role, isLoading: authLoading } = useAuth();
  
  // CRITICAL: Wait for auth to be ready before rendering
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [assignedUserFilter, setAssignedUserFilter] = useState<string>('all');
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [stuckOnly, setStuckOnly] = useState(false);

  // Group orders - show orders grouped (not flattened by products)
  // CRITICAL: Show ALL orders including WooCommerce synced (not filtered by department)
  // Admin and Sales see all orders, others see filtered
  const filteredOrders = useMemo(() => {
    // For Orders page, show all orders (including WooCommerce synced)
    // Only filter out completed orders
    const allOrders = isAdmin || role === 'sales' 
      ? orders.filter(o => !o.is_completed) // Admin/Sales see all active orders
      : getOrdersByDepartment(); // Others see filtered by department
    
    return allOrders;
  }, [orders, getOrdersByDepartment, isAdmin, role]);

  // Get unique assigned users for filter (from all items in all orders)
  const assignedUsers = useMemo(() => {
    const userSet = new Set<string>();
    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        if (item.assigned_to_name) {
          userSet.add(item.assigned_to_name);
        }
      });
    });
    return Array.from(userSet).sort();
  }, [filteredOrders]);

  // Filter orders based on search and filters
  const displayedOrders = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return filteredOrders.filter(order => {
      // Check if any item in the order matches the filters
      const hasMatchingItem = order.items.some(item => {
        // Search filter
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          if (
            !order.order_id.toLowerCase().includes(searchLower) &&
            !order.customer.name.toLowerCase().includes(searchLower) &&
            !item.product_name.toLowerCase().includes(searchLower)
          ) {
            return false;
          }
        }

        // Department filter
        if (departmentFilter !== 'all' && item.assigned_department !== departmentFilter) {
          return false;
        }

        // Assigned user filter
        if (assignedUserFilter !== 'all') {
          if (!item.assigned_to_name || item.assigned_to_name !== assignedUserFilter) {
            return false;
          }
        }

        // Urgent only
        if (urgentOnly && item.priority_computed !== 'red') {
          return false;
        }

        // Stuck > 24 hrs
        if (stuckOnly) {
          const lastUpdate = new Date(item.updated_at);
          const hoursSinceUpdate = (today.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
          if (hoursSinceUpdate <= 24) {
            return false;
          }
        }

        return true;
      });

      return hasMatchingItem;
    });
  }, [filteredOrders, searchTerm, departmentFilter, assignedUserFilter, urgentOnly, stuckOnly]);

  // Calculate total products across displayed orders
  const totalProducts = useMemo(() => {
    return displayedOrders.reduce((sum, order) => sum + order.items.length, 0);
  }, [displayedOrders]);


  return (
    <TooltipProvider>
      <div className="h-full flex flex-col gap-4">
        {/* Header */}
        <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Orders</h1>
            <p className="text-muted-foreground">
              {totalProducts} product{totalProducts !== 1 ? 's' : ''} across {displayedOrders.length} order{displayedOrders.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex-shrink-0 flex flex-col gap-4 p-4 bg-secondary/50 rounded-lg">
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
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {Object.entries(departmentLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={assignedUserFilter} onValueChange={setAssignedUserFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Assigned User" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {assignedUsers.map(user => (
                  <SelectItem key={user} value={user}>{user}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={urgentOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setUrgentOnly(!urgentOnly)}
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Urgent Only
            </Button>
            <Button
              variant={stuckOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setStuckOnly(!stuckOnly)}
            >
              <Clock className="h-4 w-4 mr-2" />
              Stuck &gt; 24 hrs
            </Button>
          </div>
        </div>

        {/* Orders List - Scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2">
          <div className="space-y-3">
            {displayedOrders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No orders found matching your filters.</p>
                </CardContent>
              </Card>
            ) : (
              displayedOrders.map((order) => (
                <OrderAccordion 
                  key={order.order_id} 
                  order={order}
                  defaultOpen={false}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

