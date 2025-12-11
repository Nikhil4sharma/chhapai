import { useState } from 'react';
import { Truck, Package, CheckCircle, Search, Filter } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PriorityBadge } from '@/components/orders/PriorityBadge';
import { format } from 'date-fns';
import { useOrders } from '@/contexts/OrderContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
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

export default function Dispatch() {
  const { orders, updateItemStage, addTimelineEntry } = useOrders();
  const { user, profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{
    orderId: string;
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
        customer: order.customer,
        item,
      }))
  );

  const filteredItems = dispatchItems.filter(({ order_id, customer, item }) =>
    item.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleMarkDispatched = (orderId: string, itemId: string, productName: string) => {
    setSelectedItem({ orderId, itemId, productName });
    setConfirmDialogOpen(true);
  };

  const confirmDispatch = () => {
    if (!selectedItem) return;

    // Update item to completed
    updateItemStage(selectedItem.orderId, selectedItem.itemId, 'completed');

    // Add timeline entry for dispatch
    addTimelineEntry({
      order_id: selectedItem.orderId,
      item_id: selectedItem.itemId,
      stage: 'dispatch',
      action: 'dispatched',
      performed_by: user?.id || '',
      performed_by_name: profile?.full_name || 'Unknown',
      notes: `Item dispatched: ${selectedItem.productName}`,
      is_public: true,
    });

    toast({
      title: "Item Dispatched",
      description: `${selectedItem.productName} has been marked as dispatched`,
    });

    setConfirmDialogOpen(false);
    setSelectedItem(null);
  };

  const handlePrintSlip = (orderId: string, item: any) => {
    // In production, this would generate a PDF
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
            filteredItems.map(({ customer, order_id, item }) => (
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
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold truncate text-foreground">{item.product_name}</h3>
                          <PriorityBadge priority={item.priority_computed} showLabel />
                          <Badge 
                            variant={item.current_stage === 'dispatch' ? 'success' : 'stage-production'}
                          >
                            {item.current_stage === 'dispatch' ? 'Ready to Ship' : 'Packing'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {order_id} • Qty: {item.quantity}
                        </p>
                        
                        {/* Customer */}
                        <div className="text-sm">
                          <span className="font-medium text-foreground">{customer.name}</span>
                          <p className="text-muted-foreground">{customer.address}</p>
                          <p className="text-muted-foreground">{customer.phone}</p>
                        </div>
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
                              onClick={() => handleMarkDispatched(order_id, item.item_id, item.product_name)}
                            >
                              <Truck className="h-4 w-4 mr-2" />
                              Mark Dispatched
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Mark this item as dispatched and complete</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Confirm Dialog */}
        <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Dispatch</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to mark "{selectedItem?.productName}" as dispatched? 
                This will complete the order item.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDispatch} className="bg-green-600 hover:bg-green-700">
                Confirm Dispatch
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
