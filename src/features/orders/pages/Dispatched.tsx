import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { 
  Truck, 
  Search, 
  Package, 
  User, 
  Calendar,
  ExternalLink,
  Filter,
  Loader2,
  PackageCheck,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOrders } from '@/features/orders/context/OrderContext';
import { useAuth } from '@/features/auth/context/AuthContext';

export default function Dispatched() {
  const { orders, isLoading } = useOrders();
  const { isAdmin, role } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'customer'>('date');

  // CRITICAL: Get orders stage-wise - dispatched but not completed
  const dispatchedItems = useMemo(() => {
    return orders.flatMap(order =>
      order.items
        .filter(item => 
          item.is_dispatched && 
          item.dispatch_info &&
          item.current_stage !== 'completed'
        )
        .map(item => ({
          order_id: order.order_id,
          order_uuid: order.id,
          customer: order.customer,
          item,
          order,
        }))
    );
  }, [orders]);

  // CRITICAL: Get delivered/completed orders with dispatch info
  const deliveredItems = useMemo(() => {
    return orders.flatMap(order =>
      order.items
        .filter(item => 
          item.is_dispatched && 
          item.dispatch_info &&
          item.current_stage === 'completed'
        )
        .map(item => ({
          order_id: order.order_id,
          order_uuid: order.id,
          customer: order.customer,
          item,
          order,
        }))
    );
  }, [orders]);

  // Get all dispatched orders (for stats)
  const dispatchedOrders = useMemo(() => {
    return orders.filter(order => 
      order.is_completed || order.items.some(item => item.is_dispatched || item.current_stage === 'completed')
    );
  }, [orders]);

  // Filter items by search term
  const filterItems = (items: typeof dispatchedItems) => 
    items.filter(({ order_id, customer, item }) =>
      item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const filteredDispatchedItems = useMemo(() => {
    let filtered = filterItems(dispatchedItems);
    
    // Sort
    if (sortBy === 'date') {
      filtered = [...filtered].sort((a, b) => {
        const dateA = a.item.dispatch_info?.dispatch_date 
          ? new Date(a.item.dispatch_info.dispatch_date).getTime()
          : new Date(a.order.updated_at).getTime();
        const dateB = b.item.dispatch_info?.dispatch_date 
          ? new Date(b.item.dispatch_info.dispatch_date).getTime()
          : new Date(b.order.updated_at).getTime();
        return dateB - dateA;
      });
    } else if (sortBy === 'customer') {
      filtered = [...filtered].sort((a, b) => 
        a.customer.name.localeCompare(b.customer.name)
      );
    }
    
    return filtered;
  }, [dispatchedItems, searchTerm, sortBy]);

  const filteredDeliveredItems = useMemo(() => {
    let filtered = filterItems(deliveredItems);
    
    // Sort
    if (sortBy === 'date') {
      filtered = [...filtered].sort((a, b) => {
        const dateA = a.item.dispatch_info?.dispatch_date 
          ? new Date(a.item.dispatch_info.dispatch_date).getTime()
          : new Date(a.order.updated_at).getTime();
        const dateB = b.item.dispatch_info?.dispatch_date 
          ? new Date(b.item.dispatch_info.dispatch_date).getTime()
          : new Date(b.order.updated_at).getTime();
        return dateB - dateA;
      });
    } else if (sortBy === 'customer') {
      filtered = [...filtered].sort((a, b) => 
        a.customer.name.localeCompare(b.customer.name)
      );
    }
    
    return filtered;
  }, [deliveredItems, searchTerm, sortBy]);

  if (!isAdmin && role !== 'sales') {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">You don't have access to this page.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Fixed Header */}
      <div className="flex-shrink-0 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
            <Truck className="h-5 w-5 text-green-500" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Dispatched Orders</h1>
            <p className="text-muted-foreground text-sm">
              View all completed and dispatched orders
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Truck className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{filteredDispatchedItems.length}</p>
                  <p className="text-xs text-muted-foreground">Dispatched</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <PackageCheck className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{filteredDeliveredItems.length}</p>
                  <p className="text-xs text-muted-foreground">Delivered</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Package className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{dispatchedOrders.length}</p>
                  <p className="text-xs text-muted-foreground">Total Orders</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {filteredDispatchedItems.filter(({ item }) => {
                      if (!item.dispatch_info?.dispatch_date) return false;
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const dispatchDate = new Date(item.dispatch_info.dispatch_date);
                      dispatchDate.setHours(0, 0, 0, 0);
                      return dispatchDate.getTime() === today.getTime();
                    }).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Dispatched Today</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by order, customer, or product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="w-full sm:w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">By Date</SelectItem>
              <SelectItem value="customer">By Customer</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stage-wise Tabs */}
      <div className="flex-1 min-h-0 flex flex-col">
        <Tabs defaultValue="dispatched" className="h-full flex flex-col">
          <TabsList className="flex-shrink-0">
            <TabsTrigger value="dispatched">
              <Truck className="h-4 w-4 mr-2" />
              Dispatched
              <Badge variant="secondary" className="ml-2">{filteredDispatchedItems.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="delivered">
              <PackageCheck className="h-4 w-4 mr-2" />
              Delivered
              <Badge variant="secondary" className="ml-2">{filteredDeliveredItems.length}</Badge>
            </TabsTrigger>
          </TabsList>

          {/* Dispatched Tab */}
          <TabsContent value="dispatched" className="flex-1 mt-4 overflow-hidden">
            <div className="h-full overflow-y-auto custom-scrollbar pr-2 space-y-3">
              {filteredDispatchedItems.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Truck className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="font-medium text-lg mb-1">No Dispatched Items</h3>
                    <p className="text-muted-foreground text-sm text-center">
                      {searchTerm 
                        ? "No items match your search criteria"
                        : "Items that have been dispatched will appear here"}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredDispatchedItems.map(({ customer, order_id, order_uuid, item, order }) => (
                  <Card key={`${order_id}-${item.item_id}`} className="hover:shadow-md transition-shadow border-green-200 dark:border-green-800">
                    <CardContent className="p-4">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3 flex-wrap">
                            <Link 
                              to={`/orders/${order_id}`}
                              className="font-bold text-primary hover:underline"
                            >
                              {order_id}
                            </Link>
                            <Badge variant="default" className="bg-green-500">
                              Dispatched
                            </Badge>
                            {order.source === 'wordpress' && (
                              <Badge variant="outline">WooCommerce</Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold">{item.product_name}</h3>
                            <span className="text-sm text-muted-foreground">× {item.quantity}</span>
                          </div>

                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <User className="h-4 w-4" />
                              <span>{customer.name}</span>
                            </div>
                            {customer.phone && (
                              <span>{customer.phone}</span>
                            )}
                          </div>

                          {item.dispatch_info && (
                            <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/10 rounded border border-green-200 dark:border-green-800">
                              <div className="text-sm space-y-1">
                                <p><span className="font-medium">Courier:</span> {item.dispatch_info.courier_company}</p>
                                <p><span className="font-medium">Tracking:</span> {item.dispatch_info.tracking_number}</p>
                                <p><span className="font-medium">Date:</span> {format(new Date(item.dispatch_info.dispatch_date), 'MMM d, yyyy')}</p>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 lg:gap-6">
                          <div className="text-sm">
                            <p className="text-muted-foreground">Dispatched</p>
                            <p className="font-medium">
                              {item.dispatch_info?.dispatch_date 
                                ? format(new Date(item.dispatch_info.dispatch_date), 'MMM d, yyyy')
                                : format(order.updated_at, 'MMM d, yyyy')}
                            </p>
                          </div>

                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/orders/${order_id}`}>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View Details
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Delivered Tab */}
          <TabsContent value="delivered" className="flex-1 mt-4 overflow-hidden">
            <div className="h-full overflow-y-auto custom-scrollbar pr-2 space-y-3">
              {filteredDeliveredItems.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <PackageCheck className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="font-medium text-lg mb-1">No Delivered Items</h3>
                    <p className="text-muted-foreground text-sm text-center">
                      {searchTerm 
                        ? "No items match your search criteria"
                        : "Items that have been delivered will appear here"}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredDeliveredItems.map(({ customer, order_id, order_uuid, item, order }) => (
                  <Card key={`${order_id}-${item.item_id}`} className="hover:shadow-md transition-shadow border-blue-200 dark:border-blue-800">
                    <CardContent className="p-4">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3 flex-wrap">
                            <Link 
                              to={`/orders/${order_id}`}
                              className="font-bold text-primary hover:underline"
                            >
                              {order_id}
                            </Link>
                            <Badge variant="default" className="bg-blue-500">
                              Delivered
                            </Badge>
                            {order.source === 'wordpress' && (
                              <Badge variant="outline">WooCommerce</Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold">{item.product_name}</h3>
                            <span className="text-sm text-muted-foreground">× {item.quantity}</span>
                          </div>

                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <User className="h-4 w-4" />
                              <span>{customer.name}</span>
                            </div>
                            {customer.phone && (
                              <span>{customer.phone}</span>
                            )}
                          </div>

                          {item.dispatch_info && (
                            <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/10 rounded border border-blue-200 dark:border-blue-800">
                              <div className="text-sm space-y-1">
                                <p><span className="font-medium">Courier:</span> {item.dispatch_info.courier_company}</p>
                                <p><span className="font-medium">Tracking:</span> {item.dispatch_info.tracking_number}</p>
                                <p><span className="font-medium">Dispatched:</span> {format(new Date(item.dispatch_info.dispatch_date), 'MMM d, yyyy')}</p>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 lg:gap-6">
                          <div className="text-sm">
                            <p className="text-muted-foreground">Delivered</p>
                            <p className="font-medium">
                              {item.dispatch_info?.dispatch_date 
                                ? format(new Date(item.dispatch_info.dispatch_date), 'MMM d, yyyy')
                                : format(order.updated_at, 'MMM d, yyyy')}
                            </p>
                          </div>

                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/orders/${order_id}`}>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View Details
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
