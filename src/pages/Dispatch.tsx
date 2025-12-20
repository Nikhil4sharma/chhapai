import { useState, useMemo } from 'react';
import { Truck, Package, CheckCircle, Search, PackageCheck, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PriorityBadge } from '@/components/orders/PriorityBadge';
import { FilePreview } from '@/components/orders/FilePreview';
import { DispatchValidationDialog } from '@/components/dialogs/DispatchValidationDialog';
import { format } from 'date-fns';
import { useOrders } from '@/contexts/OrderContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Link } from 'react-router-dom';

interface DispatchInfo {
  courier_company: string;
  tracking_number: string;
  dispatch_date: string;
}

export default function Dispatch() {
  const { orders, updateItemStage, addTimelineEntry, refreshOrders, markAsDispatched } = useOrders();
  const { user, profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{
    orderId: string;
    orderUUID: string;
    itemId: string;
    productName: string;
  } | null>(null);

  // Get items ready for dispatch (dispatch stage) and items in packing substage
  const readyItems = useMemo(() => 
    orders.flatMap(order => 
      order.items
        .filter(item => 
          (item.current_stage === 'dispatch' || 
          (item.current_stage === 'production' && item.current_substage === 'packing')) &&
          !item.is_dispatched
        )
        .map(item => ({
          order_id: order.order_id,
          order_uuid: order.id,
          customer: order.customer,
          item,
        }))
    ), [orders]
  );

  // Get dispatched items (has dispatch_info but not completed)
  const dispatchedItems = useMemo(() =>
    orders.flatMap(order =>
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
        }))
    ), [orders]
  );

  // Get delivered items (completed with dispatch_info)
  const deliveredItems = useMemo(() =>
    orders.flatMap(order =>
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
        }))
    ), [orders]
  );

  const filterItems = (items: typeof readyItems) => 
    items.filter(({ order_id, customer, item }) =>
      item.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const filteredReadyItems = filterItems(readyItems);
  const filteredDispatchedItems = filterItems(dispatchedItems);
  const filteredDeliveredItems = filterItems(deliveredItems);

  const handleMarkDispatched = (orderId: string, orderUUID: string, itemId: string, productName: string) => {
    setSelectedItem({ orderId, orderUUID: orderUUID || '', itemId, productName });
    setValidationDialogOpen(true);
  };

  const confirmDispatch = async (dispatchInfo: DispatchInfo) => {
    if (!selectedItem) return;

    try {
      // First, update dispatch_info using Supabase
      const { error: updateError } = await supabase
        .from('order_items')
        .update({
          dispatch_info: dispatchInfo,
          is_dispatched: true,
          current_stage: 'dispatch',
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedItem.itemId);

      if (updateError) throw updateError;

      // Then use markAsDispatched from OrderContext which handles timeline and notifications
      await markAsDispatched(selectedItem.orderId, selectedItem.itemId);

      toast({
        title: "Item Dispatched",
        description: `${selectedItem.productName} dispatched via ${dispatchInfo.courier_company}`,
      });

      setValidationDialogOpen(false);
      setSelectedItem(null);
      await refreshOrders();
    } catch (error) {
      console.error('Error dispatching:', error);
      toast({
        title: "Error",
        description: "Failed to mark as dispatched",
        variant: "destructive",
      });
    }
  };

  const handlePrintSlip = (orderId: string, item: any) => {
    toast({
      title: "Printing Dispatch Slip",
      description: `Generating slip for ${item.product_name}`,
    });
    window.print();
  };

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col gap-4">
        {/* Header - Fixed */}
        <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
              <Truck className="h-6 w-6" />
              Dispatch Dashboard
            </h1>
            <p className="text-muted-foreground">
              Manage order dispatch and tracking
            </p>
          </div>
        </div>

        {/* Search - Fixed */}
        <div className="flex-shrink-0 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by product, order ID, or customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Dispatch Tabs - Scrollable content */}
        <div className="flex-1 min-h-0 flex flex-col">
          <Tabs defaultValue="ready" className="h-full flex flex-col">
            <TabsList className="flex-shrink-0">
              <TabsTrigger value="ready">
                <Clock className="h-4 w-4 mr-2" />
                Ready to Dispatch
                <Badge variant="secondary" className="ml-2">{filteredReadyItems.length}</Badge>
              </TabsTrigger>
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

            {/* Ready to Dispatch Tab */}
            <TabsContent value="ready" className="flex-1 mt-4 overflow-hidden">
              <div className="h-full overflow-y-auto custom-scrollbar pr-2 space-y-4">
                {filteredReadyItems.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                      <h3 className="font-semibold text-lg mb-2">No items ready to dispatch</h3>
                      <p className="text-muted-foreground">
                        All orders have been dispatched or are still in production.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  filteredReadyItems.map(({ customer, order_id, order_uuid, item }) => (
              <Card key={`${order_id}-${item.item_id}`} className="card-hover overflow-visible transition-all duration-200 hover:shadow-lg relative">
                <CardContent className="p-0 overflow-visible">
                  {/* Priority bar */}
                  <div 
                    className={`h-1 ${
                      item.priority_computed === 'blue' ? 'bg-priority-blue' :
                      item.priority_computed === 'yellow' ? 'bg-priority-yellow' :
                      'bg-priority-red'
                    }`}
                  />
                  
                  <div className="p-4">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      {/* Item info */}
                      <div className="flex-1 min-w-0">
                        {/* Order ID - Always visible */}
                        <Link 
                          to={`/orders/${order_id}`}
                          className="text-sm font-bold text-primary hover:underline"
                        >
                          {order_id}
                        </Link>
                        
                        <div className="flex items-center gap-2 mb-1 flex-wrap mt-1">
                          <h3 className="font-semibold truncate text-foreground">{item.product_name}</h3>
                          <span className="text-sm text-muted-foreground">— Qty {item.quantity}</span>
                          <PriorityBadge priority={item.priority_computed} showLabel />
                          <Badge 
                            variant={item.current_stage === 'dispatch' ? 'success' : 'stage-production'}
                          >
                            {item.current_stage === 'dispatch' ? 'Ready to Ship' : 'Packing'}
                          </Badge>
                        </div>
                        
                        {/* Customer */}
                        <div className="text-sm">
                          <span className="font-medium text-foreground">{customer.name}</span>
                          {customer.address && <p className="text-muted-foreground">{customer.address}</p>}
                          {customer.phone && <p className="text-muted-foreground">{customer.phone}</p>}
                        </div>
                        {item.files && item.files.length > 0 && (
                          <FilePreview files={item.files} compact />
                        )}
                      </div>

                      {/* Delivery info */}
                      <div className="text-sm lg:text-right">
                        <p className="font-medium text-foreground">Delivery Date</p>
                        <p className="text-muted-foreground">
                          {format(item.delivery_date, 'MMM d, yyyy')}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handlePrintSlip(order_id, item)}
                            >
                              <Package className="h-4 w-4 mr-2" />
                              Print Slip
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Print dispatch slip for this item</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              size="sm" 
                              className="bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => handleMarkDispatched(order_id, order_uuid || '', item.item_id, item.product_name)}
                            >
                              <Truck className="h-4 w-4 mr-2" />
                              Mark Dispatched
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Enter dispatch details and mark as shipped</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
                  ))
                )}
              </div>
            </TabsContent>

            {/* Dispatched Tab */}
            <TabsContent value="dispatched" className="flex-1 mt-4 overflow-hidden">
              <div className="h-full overflow-y-auto custom-scrollbar pr-2 space-y-4">
                {filteredDispatchedItems.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="font-semibold text-lg mb-2">No dispatched items</h3>
                      <p className="text-muted-foreground">
                        Items that have been dispatched will appear here.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  filteredDispatchedItems.map(({ customer, order_id, order_uuid, item }) => (
                    <Card key={`${order_id}-${item.item_id}`} className="card-hover overflow-visible transition-all duration-200 hover:shadow-lg relative border-green-200 dark:border-green-800">
                      <CardContent className="p-0 overflow-visible">
                        <div className="h-1 bg-green-500" />
                        <div className="p-4">
                          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                            <div className="flex-1 min-w-0">
                              <Link 
                                to={`/orders/${order_id}`}
                                className="text-sm font-bold text-primary hover:underline"
                              >
                                {order_id}
                              </Link>
                              <div className="flex items-center gap-2 mb-1 flex-wrap mt-1">
                                <h3 className="font-semibold truncate text-foreground">{item.product_name}</h3>
                                <Badge variant="success">Dispatched</Badge>
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
              <div className="h-full overflow-y-auto custom-scrollbar pr-2 space-y-4">
                {filteredDeliveredItems.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <PackageCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="font-semibold text-lg mb-2">No delivered items</h3>
                      <p className="text-muted-foreground">
                        Items that have been delivered will appear here.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  filteredDeliveredItems.map(({ customer, order_id, order_uuid, item }) => (
                    <Card key={`${order_id}-${item.item_id}`} className="card-hover overflow-visible transition-all duration-200 hover:shadow-lg relative border-blue-200 dark:border-blue-800">
                      <CardContent className="p-0 overflow-visible">
                        <div className="h-1 bg-blue-500" />
                        <div className="p-4">
                          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                            <div className="flex-1 min-w-0">
                              <Link 
                                to={`/orders/${order_id}`}
                                className="text-sm font-bold text-primary hover:underline"
                              >
                                {order_id}
                              </Link>
                              <div className="flex items-center gap-2 mb-1 flex-wrap mt-1">
                                <h3 className="font-semibold truncate text-foreground">{item.product_name}</h3>
                                <Badge variant="success" className="bg-blue-500">Delivered</Badge>
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

        {/* Dispatch Validation Dialog */}
        {selectedItem && (
          <DispatchValidationDialog
            open={validationDialogOpen}
            onOpenChange={setValidationDialogOpen}
            productName={selectedItem.productName}
            orderId={selectedItem.orderId}
            onConfirm={confirmDispatch}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
