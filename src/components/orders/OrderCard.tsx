import { format } from 'date-fns';
import { ChevronRight, Package, Calendar, User, MapPin, FileText } from 'lucide-react';
import { Order } from '@/types/order';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PriorityBadge } from './PriorityBadge';
import { StageBadge } from './StageBadge';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface OrderCardProps {
  order: Order;
  className?: string;
}

export function OrderCard({ order, className }: OrderCardProps) {
  const mainItem = order.items[0];
  const additionalItems = order.items.length - 1;

  return (
    <Card className={cn("card-hover overflow-hidden", className)}>
      <CardContent className="p-0">
        {/* Priority bar */}
        <div 
          className={cn(
            "h-1",
            order.priority_computed === 'blue' && "bg-priority-blue",
            order.priority_computed === 'yellow' && "bg-priority-yellow",
            order.priority_computed === 'red' && "bg-priority-red",
          )}
        />
        
        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">{order.order_id}</h3>
              <PriorityBadge priority={order.priority_computed} />
              {order.source === 'wordpress' && (
                <Badge variant="outline" className="text-xs">WP</Badge>
              )}
            </div>
            {mainItem && <StageBadge stage={mainItem.current_stage} />}
          </div>

          {/* Customer info */}
          <div className="space-y-1.5 mb-4">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-foreground">{order.customer.name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span className="truncate">{order.customer.address}</span>
            </div>
          </div>

          {/* Main item */}
          {mainItem && (
            <div className="bg-secondary/50 rounded-lg p-3 mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm">{mainItem.product_name}</span>
                <span className="text-sm text-muted-foreground">×{mainItem.quantity}</span>
              </div>
              {mainItem.specifications.paper && (
                <p className="text-xs text-muted-foreground">{mainItem.specifications.paper}</p>
              )}
              {additionalItems > 0 && (
                <p className="text-xs text-primary mt-1">+{additionalItems} more item{additionalItems > 1 ? 's' : ''}</p>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                {order.order_level_delivery_date 
                  ? format(order.order_level_delivery_date, 'MMM d, yyyy')
                  : 'No date set'
                }
              </span>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/orders/${order.order_id}`}>
                View <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
