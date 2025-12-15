import { format } from 'date-fns';
import { ChevronRight, Calendar } from 'lucide-react';
import { Order } from '@/types/order';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PriorityBadge } from './PriorityBadge';
import { StageBadge } from './StageBadge';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface OrderCardProps {
  order: Order;
  className?: string;
  showAssignedUser?: boolean;
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
          {/* Header - Order ID, Priority, Stage */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">{order.order_id}</h3>
              <PriorityBadge priority={order.priority_computed} />
            </div>
            {mainItem && <StageBadge stage={mainItem.current_stage} />}
          </div>

          {/* Customer Name */}
          <p className="text-sm text-muted-foreground mb-2">
            {order.customer.name}
          </p>

          {/* Delivery Date */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <Calendar className="h-4 w-4" />
            <span>
              {order.order_level_delivery_date 
                ? format(order.order_level_delivery_date, 'MMM d, yyyy')
                : 'No date set'
              }
            </span>
            {additionalItems > 0 && (
              <span className="text-xs text-primary ml-auto">
                +{additionalItems} item{additionalItems > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* View Button */}
          <Button variant="ghost" size="sm" className="w-full justify-between" asChild>
            <Link to={`/orders/${order.order_id}`}>
              View Details
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
