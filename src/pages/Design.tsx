import { Upload, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getItemsByStage } from '@/data/mockData';
import { PriorityBadge } from '@/components/orders/PriorityBadge';
import { format } from 'date-fns';

export default function Design() {
  const designItems = getItemsByStage('design');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground">
            {designItems.length} item{designItems.length !== 1 ? 's' : ''} assigned to design
          </p>
        </div>
      </div>

      {/* Design Queue */}
      <div className="space-y-4">
        {designItems.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="h-12 w-12 mx-auto text-success mb-4" />
              <h3 className="font-semibold text-lg mb-2">All caught up!</h3>
              <p className="text-muted-foreground">No items currently need design work.</p>
            </CardContent>
          </Card>
        ) : (
          designItems.map(({ customer, order_id, item }) => (
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
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">{item.product_name}</h3>
                        <PriorityBadge priority={item.priority_computed} showLabel />
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {order_id} • {customer.name} • Qty: {item.quantity}
                      </p>
                      
                      {/* Specs */}
                      <div className="flex flex-wrap gap-2">
                        {item.specifications.paper && (
                          <Badge variant="outline" className="text-xs">
                            {item.specifications.paper}
                          </Badge>
                        )}
                        {item.specifications.size && (
                          <Badge variant="outline" className="text-xs">
                            {item.specifications.size}
                          </Badge>
                        )}
                        {item.specifications.finishing && (
                          <Badge variant="outline" className="text-xs">
                            {item.specifications.finishing}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Delivery info */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Due: {format(item.delivery_date, 'MMM d, yyyy')}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Proof
                      </Button>
                      <Button size="sm">
                        Mark Complete
                      </Button>
                    </div>
                  </div>

                  {/* Notes */}
                  {item.specifications.notes && (
                    <div className="mt-3 p-3 bg-secondary/50 rounded-lg">
                      <p className="text-sm">
                        <span className="font-medium">Notes:</span> {item.specifications.notes}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
