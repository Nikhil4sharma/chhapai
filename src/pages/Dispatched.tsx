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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOrders } from '@/contexts/OrderContext';
import { useAuth } from '@/contexts/AuthContext';

export default function Dispatched() {
  const { orders, isLoading } = useOrders();
  const { isAdmin, role } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'customer'>('date');

  // Get dispatched orders (completed orders with dispatched items)
  const dispatchedOrders = useMemo(() => {
    return orders.filter(order => 
      order.is_completed || order.items.some(item => item.is_dispatched || item.current_stage === 'completed')
    );
  }, [orders]);

  // Filter and sort orders
  const filteredOrders = useMemo(() => {
    let filtered = dispatchedOrders;

    // Apply search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(order =>
        order.order_id.toLowerCase().includes(term) ||
        order.customer.name.toLowerCase().includes(term) ||
        order.customer.phone?.toLowerCase().includes(term) ||
        order.items.some(item => item.product_name.toLowerCase().includes(term))
      );
    }

    // Sort
    if (sortBy === 'date') {
      filtered = [...filtered].sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    } else if (sortBy === 'customer') {
      filtered = [...filtered].sort((a, b) => 
        a.customer.name.localeCompare(b.customer.name)
      );
    }

    return filtered;
  }, [dispatchedOrders, searchTerm, sortBy]);

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
                  <Package className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{filteredOrders.length}</p>
                  <p className="text-xs text-muted-foreground">Total Dispatched</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {filteredOrders.filter(o => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const updated = new Date(o.updated_at);
                      updated.setHours(0, 0, 0, 0);
                      return updated.getTime() === today.getTime();
                    }).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Today</p>
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

      {/* Scrollable Orders List */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-3">
        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Truck className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-lg mb-1">No Dispatched Orders</h3>
              <p className="text-muted-foreground text-sm text-center">
                {searchTerm 
                  ? "No orders match your search criteria"
                  : "Dispatched orders will appear here"}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredOrders.map(order => (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Order Info */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Link 
                        to={`/orders/${order.order_id}`}
                        className="font-bold text-primary hover:underline"
                      >
                        {order.order_id}
                      </Link>
                      <Badge variant="default" className="bg-green-500">
                        Dispatched
                      </Badge>
                      {order.source === 'wordpress' && (
                        <Badge variant="outline">WooCommerce</Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        <span>{order.customer.name}</span>
                      </div>
                      {order.customer.phone && (
                        <span>{order.customer.phone}</span>
                      )}
                    </div>

                    {/* Products */}
                    <div className="flex flex-wrap gap-2">
                      {order.items.map(item => (
                        <Badge key={item.item_id} variant="secondary" className="text-xs">
                          {item.product_name} × {item.quantity}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Dispatch Info */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 lg:gap-6">
                    <div className="text-sm">
                      <p className="text-muted-foreground">Dispatched</p>
                      <p className="font-medium">
                        {format(order.updated_at, 'MMM d, yyyy')}
                      </p>
                    </div>

                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/orders/${order.order_id}`}>
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
    </div>
  );
}
