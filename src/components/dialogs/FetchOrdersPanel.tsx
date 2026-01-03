import { useState, useEffect, useCallback } from 'react';
import { Search, ShoppingCart, CheckCircle, X, Loader2, AlertCircle, Download, User, Mail, Phone, Calendar, DollarSign, Package } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useOrders } from '@/features/orders/context/OrderContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface WooCommerceOrder {
  id: number;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  order_date: string;
  total: number;
  status: string;
  currency: string;
  line_items: Array<{
    id: number;
    name: string;
    quantity: number;
    total: number;
  }>;
}

interface FetchOrdersPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FetchOrdersPanel({
  open,
  onOpenChange,
}: FetchOrdersPanelProps) {
  const { user, profile } = useAuth();
  const { refreshOrders } = useOrders();
  
  const [searchParams, setSearchParams] = useState({
    order_number: '',
    customer_email: '',
    customer_name: '',
    customer_phone: '',
  });
  
  const [searchResults, setSearchResults] = useState<WooCommerceOrder[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<Set<number>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [existingOrderIds, setExistingOrderIds] = useState<Set<number>>(new Set());

  // Check which orders are already imported
  useEffect(() => {
    if (open && searchResults.length > 0) {
      checkExistingOrders();
    }
  }, [open, searchResults]);

  const checkExistingOrders = async () => {
    try {
      const wooOrderIds = searchResults.map(o => o.id);
      const { data: existingOrders } = await supabase
        .from('orders')
        .select('woo_order_id')
        .in('woo_order_id', wooOrderIds.map(id => id.toString()))
        .not('woo_order_id', 'is', null);

      if (existingOrders) {
        const existingIds = new Set<number>(
          existingOrders
            .map(o => o.woo_order_id)
            .filter((id): id is string => id !== null && id !== undefined)
            .map(id => parseInt(id, 10))
            .filter(id => !isNaN(id))
        );
        setExistingOrderIds(existingIds);
      }
    } catch (error) {
      console.error('Error checking existing orders:', error);
    }
  };

  const handleSearch = useCallback(async () => {
    // Validate: at least one search parameter required
    if (!searchParams.order_number && !searchParams.customer_email && 
        !searchParams.customer_name && !searchParams.customer_phone) {
      toast({
        title: "Search Required",
        description: "Please enter at least one search parameter",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    setSearchResults([]);
    setSelectedOrders(new Set());

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/woocommerce`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({
          action: 'search-orders',
          ...searchParams,
        }),
      });

      // Handle network errors
      if (!response.ok) {
        let errorMessage = `Search failed: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      if (data.success && data.orders) {
        setSearchResults(data.orders);
        if (data.orders.length === 0) {
          toast({
            title: "No Orders Found",
            description: "No orders match your search criteria",
          });
        } else {
          toast({
            title: "Search Complete",
            description: `Found ${data.orders.length} order(s)`,
          });
        }
      } else {
        throw new Error(data.error || 'Search failed');
      }
    } catch (error: any) {
      console.error('Search error:', error);
      
      // Better error messages
      let errorMessage = "Could not search WooCommerce orders";
      if (error.message?.includes('Failed to fetch') || error.message?.includes('CORS')) {
        errorMessage = "Network error: Could not connect to server. Please check your connection.";
      } else if (error.message?.includes('Not authenticated')) {
        errorMessage = "Please log in to search orders";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Search Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  }, [searchParams]);

  const handleImport = async () => {
    if (selectedOrders.size === 0) {
      toast({
        title: "No Orders Selected",
        description: "Please select at least one order to import",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    setImportedCount(0);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const orderIds = Array.from(selectedOrders);
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/woocommerce`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({
          action: 'import-orders',
          order_ids: orderIds,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Import failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setImportedCount(data.imported || 0);
        
        if (data.errors && data.errors.length > 0) {
          toast({
            title: "Import Completed with Errors",
            description: `Imported ${data.imported} order(s). ${data.errors.length} error(s) occurred.`,
            variant: "default",
          });
          console.error('Import errors:', data.errors);
        } else {
          toast({
            title: "Import Successful",
            description: `Successfully imported ${data.imported} order(s)`,
          });
        }

        // Refresh orders list - wait a bit for database to update
        await new Promise(resolve => setTimeout(resolve, 1000));
        await refreshOrders();
        
        // Show success message with order count
        toast({
          title: "Orders Imported Successfully",
          description: `${data.imported} order(s) have been added. Page will refresh to show new orders.`,
        });
        
        // Reset selection and close dialog after delay
        setSelectedOrders(new Set());
        setTimeout(() => {
          onOpenChange(false);
          // Force page refresh to show new orders
          window.location.reload();
        }, 2000);
      } else {
        throw new Error(data.error || 'Import failed');
      }
    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        title: "Import Failed",
        description: error.message || "Could not import orders",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const toggleOrderSelection = (orderId: number) => {
    const newSelection = new Set(selectedOrders);
    if (newSelection.has(orderId)) {
      newSelection.delete(orderId);
    } else {
      newSelection.add(orderId);
    }
    setSelectedOrders(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedOrders.size === searchResults.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(searchResults.map(o => o.id)));
    }
  };

  const handleInputChange = (field: keyof typeof searchParams, value: string) => {
    setSearchParams(prev => ({ ...prev, [field]: value }));
  };

  // Auto-search on input change (debounced) - only if dialog is open and has search params
  useEffect(() => {
    if (!open) return;
    
    const hasSearchParams = searchParams.order_number || searchParams.customer_email || 
                            searchParams.customer_name || searchParams.customer_phone;
    
    if (!hasSearchParams) {
      setSearchResults([]);
      return;
    }
    
    const timer = setTimeout(() => {
      handleSearch();
    }, 500);

    return () => clearTimeout(timer);
  }, [searchParams, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Fetch WooCommerce Orders
          </DialogTitle>
          <DialogDescription>
            Search and selectively import orders from WooCommerce. Orders will be assigned to you and your department.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 min-h-0">
          {/* Search Form */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="order_number">Order Number</Label>
                  <Input
                    id="order_number"
                    placeholder="e.g., 12345"
                    value={searchParams.order_number}
                    onChange={(e) => handleInputChange('order_number', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer_email">Customer Email</Label>
                  <Input
                    id="customer_email"
                    type="email"
                    placeholder="customer@example.com"
                    value={searchParams.customer_email}
                    onChange={(e) => handleInputChange('customer_email', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer_name">Customer Name</Label>
                  <Input
                    id="customer_name"
                    placeholder="John Doe"
                    value={searchParams.customer_name}
                    onChange={(e) => handleInputChange('customer_name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer_phone">Customer Phone</Label>
                  <Input
                    id="customer_phone"
                    placeholder="+1234567890"
                    value={searchParams.customer_phone}
                    onChange={(e) => handleInputChange('customer_phone', e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-4 text-xs text-muted-foreground">
                <AlertCircle className="h-3 w-3 inline mr-1" />
                Enter at least one search parameter. Results will update automatically as you type.
              </div>
            </CardContent>
          </Card>

          {/* Search Results */}
          {isSearching && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Searching WooCommerce...</span>
            </div>
          )}

          {!isSearching && searchResults.length > 0 && (
            <Card className="flex-1 flex flex-col min-h-0">
              <CardContent className="pt-6 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedOrders.size === searchResults.length && searchResults.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                    <Label className="text-sm font-medium">
                      Select All ({selectedOrders.size} selected)
                    </Label>
                  </div>
                  <Badge variant="secondary">
                    {searchResults.length} order(s) found
                  </Badge>
                </div>

                <ScrollArea className="flex-1">
                  <div className="space-y-3">
                    {searchResults.map((order) => {
                      const isSelected = selectedOrders.has(order.id);
                      const isAlreadyImported = existingOrderIds.has(order.id);
                      const orderDate = order.order_date ? new Date(order.order_date) : null;

                      return (
                        <Card
                          key={order.id}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'border-primary bg-primary/5' : ''
                          } ${isAlreadyImported ? 'opacity-60' : ''}`}
                          onClick={() => !isAlreadyImported && toggleOrderSelection(order.id)}
                        >
                          <CardContent className="pt-4">
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={isSelected}
                                disabled={isAlreadyImported}
                                onCheckedChange={() => !isAlreadyImported && toggleOrderSelection(order.id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div className="flex-1 space-y-2">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold">Order #{order.order_number}</span>
                                      <Badge variant={order.status === 'processing' ? 'default' : 'secondary'}>
                                        {order.status}
                                      </Badge>
                                      {isAlreadyImported && (
                                        <Badge variant="outline" className="text-xs">
                                          Already Imported
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="mt-1 text-sm text-muted-foreground">
                                      {order.customer_name}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-semibold text-lg">
                                      {order.currency} {order.total.toFixed(2)}
                                    </div>
                                    {orderDate && (
                                      <div className="text-xs text-muted-foreground">
                                        {format(orderDate, 'MMM dd, yyyy')}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <Separator />

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                  {order.customer_email && (
                                    <div className="flex items-center gap-1.5 text-muted-foreground">
                                      <Mail className="h-3 w-3" />
                                      <span className="truncate">{order.customer_email}</span>
                                    </div>
                                  )}
                                  {order.customer_phone && (
                                    <div className="flex items-center gap-1.5 text-muted-foreground">
                                      <Phone className="h-3 w-3" />
                                      <span>{order.customer_phone}</span>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <Package className="h-3 w-3" />
                                    <span>{order.line_items.length} item(s)</span>
                                  </div>
                                  {orderDate && (
                                    <div className="flex items-center gap-1.5 text-muted-foreground">
                                      <Calendar className="h-3 w-3" />
                                      <span>{format(orderDate, 'MMM dd')}</span>
                                    </div>
                                  )}
                                </div>

                                {order.line_items.length > 0 && (
                                  <div className="mt-2 pt-2 border-t">
                                    <div className="text-xs text-muted-foreground">
                                      Items: {order.line_items.map(item => `${item.name} (x${item.quantity})`).join(', ')}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {!isSearching && searchResults.length === 0 && (
            <Card>
              <CardContent className="pt-6 pb-6 text-center text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Enter search criteria to find WooCommerce orders</p>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={selectedOrders.size === 0 || isImporting || isSearching}
          >
            {isImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Add to Order Flow ({selectedOrders.size})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

