import { useState } from 'react';
import { Truck, Package, CheckCircle, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  const { orders, updateItemStage, addTimelineEntry, refreshOrders } = useOrders();
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
  const dispatchItems = orders.flatMap(order => 
    order.items
      .filter(item => 
        item.current_stage === 'dispatch' || 
        (item.current_stage === 'production' && item.current_substage === 'packing')
      )
      .map(item => ({
        order_id: order.order_id,
        order_uuid: order.id,
        customer: order.customer,
        item,
      }))
  );

  const filteredItems = dispatchItems.filter(({ order_id, customer, item }) =>
    item.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleMarkDispatched = (orderId: string, orderUUID: string, itemId: string, productName: string) => {
    setSelectedItem({ orderId, orderUUID: orderUUID || '', itemId, productName });
    setValidationDialogOpen(true);
  };

  const confirmDispatch = async (dispatchInfo: DispatchInfo) => {
    if (!selectedItem) return;

    try {
      // Save dispatch info to the order item
      const { error: updateError } = await supabase
        .from('order_items')
        .update({
          dispatch_info: JSON.parse(JSON.stringify(dispatchInfo)),
          current_stage: 'completed',
          is_dispatched: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedItem.itemId);

      if (updateError) throw updateError;

      // Add timeline entry for dispatch with details
      await addTimelineEntry({
        order_id: selectedItem.orderUUID,
        item_id: selectedItem.itemId,
        stage: 'dispatch',
        action: 'dispatched',
        performed_by: user?.id || '',
        performed_by_name: profile?.full_name || 'Unknown',
        notes: `Dispatched via ${dispatchInfo.courier_company} | AWB: ${dispatchInfo.tracking_number} | Date: ${dispatchInfo.dispatch_date}`,
        is_public: true,
      });

      // Check if all items are completed
      const order = orders.find(o => o.order_id === selectedItem.orderId);
      if (order) {
        const updatedItems = order.items.map(i => 
          i.item_id === selectedItem.itemId ? { ...i, current_stage: 'completed' as const, is_dispatched: true } : i
        );
        const allCompleted = updatedItems.every(i => i.current_stage === 'completed');

        if (allCompleted && order.id) {
          await supabase
            .from('orders')
            .update({ is_completed: true, updated_at: new Date().toISOString() })
            .eq('id', order.id);
        }
      }

      await refreshOrders();

      toast({
        title: "Item Dispatched",
        description: `${selectedItem.productName} dispatched via ${dispatchInfo.courier_company}`,
      });

      setValidationDialogOpen(false);
      setSelectedItem(null);
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
              <Truck className="h-6 w-6" />
              Dispatch
            </h1>
            <p className="text-muted-foreground">
              {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''} ready for dispatch
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by product, order ID, or customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Dispatch Queue */}
        <div className="space-y-4">
          {filteredItems.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <h3 className="font-semibold text-lg mb-2">No items to dispatch</h3>
                <p className="text-muted-foreground">
                  All orders have been dispatched or are still in production.
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredItems.map(({ customer, order_id, order_uuid, item }) => (
              <Card key={`${order_id}-${item.item_id}`} className="card-hover overflow-hidden">
                <CardContent className="p-0">
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
