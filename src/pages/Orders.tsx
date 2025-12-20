import { useState, useMemo } from 'react';
import { Search, Filter, ChevronDown, ChevronUp, Calendar, User, AlertTriangle, Clock, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PriorityBadge } from '@/components/orders/PriorityBadge';
import { StageBadge } from '@/components/orders/StageBadge';
import { useOrders } from '@/contexts/OrderContext';
import { useAuth } from '@/contexts/AuthContext';
import { format, differenceInDays } from 'date-fns';
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
import { OrderItem, Stage } from '@/types/order';

// Department color mapping
const departmentColors: Record<string, string> = {
  sales: 'bg-blue-500',
  design: 'bg-purple-500',
  prepress: 'bg-green-500',
  production: 'bg-orange-500',
  outsource: 'bg-yellow-500',
  dispatch: 'bg-teal-500',
  completed: 'bg-gray-500',
};

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
  const { isAdmin, role, profileReady, isLoading: authLoading } = useAuth();
  
  // CRITICAL: Wait for auth to be ready before rendering
  if (!profileReady || authLoading) {
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
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Flatten orders to one row per product
  // CRITICAL: Show ALL orders including WooCommerce synced (not filtered by department)
  // Admin and Sales see all orders, others see filtered
  const productRows = useMemo(() => {
    // For Orders page, show all orders (including WooCommerce synced)
    // Only filter out completed orders
    const allOrders = isAdmin || role === 'sales' 
      ? orders.filter(o => !o.is_completed) // Admin/Sales see all active orders
      : getOrdersByDepartment(); // Others see filtered by department
    
    const rows: Array<{
      order_id: string;
      order_uuid: string;
      customer_name: string;
      item: OrderItem;
      order_created_at: Date;
    }> = [];

    allOrders.forEach(order => {
      order.items.forEach(item => {
        rows.push({
          order_id: order.order_id,
          order_uuid: order.id || order.order_id,
          customer_name: order.customer.name,
          item,
          order_created_at: order.created_at,
        });
      });
    });

    return rows;
  }, [orders, getOrdersByDepartment, isAdmin, role]);

  // Get unique assigned users for filter
  const assignedUsers = useMemo(() => {
    const userSet = new Set<string>();
    productRows.forEach(row => {
      if (row.item.assigned_to_name) {
        userSet.add(row.item.assigned_to_name);
      }
    });
    return Array.from(userSet).sort();
  }, [productRows]);

  // Filter products
  const filteredProducts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return productRows.filter(row => {
      const { item, order_id, customer_name } = row;

      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        if (
          !order_id.toLowerCase().includes(searchLower) &&
          !customer_name.toLowerCase().includes(searchLower) &&
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
  }, [productRows, searchTerm, departmentFilter, assignedUserFilter, urgentOnly, stuckOnly]);

  const toggleExpand = (itemId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const getDepartmentColor = (stage: Stage) => {
    return departmentColors[stage] || 'bg-gray-500';
  };

  const isStuck = (item: OrderItem) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastUpdate = new Date(item.updated_at);
    const hoursSinceUpdate = (today.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
    return hoursSinceUpdate > 24;
  };

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col gap-4">
        {/* Header */}
        <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Orders</h1>
            <p className="text-muted-foreground">
              {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} across {new Set(filteredProducts.map(p => p.order_id)).size} order{new Set(filteredProducts.map(p => p.order_id)).size !== 1 ? 's' : ''}
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
          <div className="space-y-2">
            {filteredProducts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No products found matching your filters.</p>
                </CardContent>
              </Card>
            ) : (
              filteredProducts.map((row) => {
                const { order_id, order_uuid, customer_name, item } = row;
                const isExpanded = expandedItems.has(item.item_id);
                const stuck = isStuck(item);
                const deptColor = getDepartmentColor(item.current_stage);

                return (
                  <Card key={item.item_id} className="overflow-hidden">
                    <CardContent className="p-0">
                      {/* Department Color Strip */}
                      <div className={`h-1 ${deptColor}`} />
                      
                      <div className="p-4">
                        <div className="flex items-start gap-4">
                          {/* Main Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <Link
                                to={`/orders/${order_id}`}
                                className="font-bold text-primary hover:underline"
                              >
                                Order #{order_id}
                              </Link>
                              <StageBadge stage={item.current_stage} />
                              <PriorityBadge priority={item.priority_computed} />
                              {stuck && (
                                <Badge variant="destructive" className="text-xs">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Stuck
                                </Badge>
                              )}
                            </div>
                            
                            <h3 className="font-semibold text-foreground mb-1">{item.product_name}</h3>
                            <p className="text-sm text-muted-foreground mb-2">{customer_name}</p>
                            
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <span>Qty: {item.quantity}</span>
                              <span>•</span>
                              <span>Due: {format(item.delivery_date, 'MMM d, yyyy')}</span>
                              {item.assigned_to_name && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {item.assigned_to_name}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Expand/Collapse Button */}
                          <Collapsible open={isExpanded} onOpenChange={() => toggleExpand(item.item_id)}>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm">
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-2">
                              <div className="p-3 bg-secondary/50 rounded-lg space-y-2">
                                <div>
                                  <span className="text-xs font-medium text-muted-foreground">Department:</span>
                                  <span className="ml-2 text-sm">{departmentLabels[item.assigned_department] || item.assigned_department}</span>
                                </div>
                                {item.specifications && Object.keys(item.specifications).length > 0 && (
                                  <div>
                                    <span className="text-xs font-medium text-muted-foreground">Specifications:</span>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {Object.entries(item.specifications)
                                        .filter(([key]) => !['sku', 'SKU', 'notes', '_sku', 'product_sku', 'id'].includes(key.toLowerCase()))
                                        .map(([key, value]) => (
                                          <Badge key={key} variant="outline" className="text-xs">
                                            {key}: {value}
                                          </Badge>
                                        ))}
                                    </div>
                                  </div>
                                )}
                                <div>
                                  <span className="text-xs font-medium text-muted-foreground">Last Updated:</span>
                                  <span className="ml-2 text-sm">{format(item.updated_at, 'MMM d, yyyy HH:mm')}</span>
                                </div>
                                <div className="pt-2">
                                  <Button variant="outline" size="sm" asChild>
                                    <Link to={`/orders/${order_id}`}>
                                      View Full Details
                                    </Link>
                                  </Button>
                                </div>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

