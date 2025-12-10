import { Truck, Package, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getItemsByStage } from '@/data/mockData';
import { PriorityBadge } from '@/components/orders/PriorityBadge';
import { format } from 'date-fns';

export default function Dispatch() {
  const dispatchItems = getItemsByStage('dispatch');
  // For demo, also show items ready for dispatch (production completed)
  const productionItems = getItemsByStage('production').filter(
    item => item.item.current_substage === 'packing'
  );

  const allItems = [...dispatchItems, ...productionItems];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground">
            {allItems.length} item{allItems.length !== 1 ? 's' : ''} ready for dispatch
          </p>
        </div>
      </div>

      {/* Dispatch Queue */}
      <div className="space-y-4">
        {allItems.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="h-12 w-12 mx-auto text-success mb-4" />
              <h3 className="font-semibold text-lg mb-2">No items to dispatch</h3>
              <p className="text-muted-foreground">All orders have been dispatched or are still in production.</p>
            </CardContent>
          </Card>
        ) : (
          allItems.map(({ customer, order_id, item }) => (
            <Card key={`${order_id}-${item.item_id}`} className="card-hover">
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
                        <h3 className="font-semibold truncate">{item.product_name}</h3>
                        <PriorityBadge priority={item.priority_computed} showLabel />
                        <Badge variant={item.is_ready_for_production ? 'success' : 'stage-production'}>
                          {item.is_ready_for_production ? 'Ready' : 'Packing'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {order_id} • Qty: {item.quantity}
                      </p>
                      
                      {/* Customer */}
                      <div className="text-sm">
                        <span className="font-medium">{customer.name}</span>
                        <p className="text-muted-foreground">{customer.address}</p>
                      </div>
                    </div>

                    {/* Delivery info */}
                    <div className="text-sm text-right">
                      <p className="font-medium">Delivery Date</p>
                      <p className="text-muted-foreground">
                        {format(item.delivery_date, 'MMM d, yyyy')}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Package className="h-4 w-4 mr-2" />
                        Print Slip
                      </Button>
                      <Button size="sm" variant="success">
                        <Truck className="h-4 w-4 mr-2" />
                        Mark Dispatched
                      </Button>
                    </div>
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
