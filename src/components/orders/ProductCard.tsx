import { format } from 'date-fns';
import { Package, Calendar, User, ChevronRight } from 'lucide-react';
import { OrderItem, Order } from '@/types/order';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PriorityBadge } from './PriorityBadge';
import { StageBadge } from './StageBadge';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface ProductCardProps {
  item: OrderItem;
  order: Order;
  className?: string;
  compact?: boolean;
  showActions?: boolean;
  onAction?: (action: string, item: OrderItem) => void;
}

export function ProductCard({ 
  item, 
  order, 
  className, 
  compact = false,
  showActions = false,
  onAction,
}: ProductCardProps) {
  const stageSequence = item.current_substage 
    ? `${item.current_stage} → ${item.current_substage}` 
    : item.current_stage;

  return (
    <Card className={cn("card-hover overflow-hidden", className)}>
      <CardContent className="p-0">
        {/* Priority bar */}
        <div 
          className={cn(
            "h-1",
            item.priority_computed === 'blue' && "bg-priority-blue",
            item.priority_computed === 'yellow' && "bg-priority-yellow",
            item.priority_computed === 'red' && "bg-priority-red",
          )}
        />
        
        <div className={cn("p-4", compact && "p-3")}>
          {/* Order ID - Always visible */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <Link 
              to={`/orders/${order.order_id}`}
              className="text-sm font-bold text-primary hover:underline"
            >
              {order.order_id}
            </Link>
            <PriorityBadge priority={item.priority_computed} />
          </div>

          {/* Customer Name */}
          <p className="text-xs text-muted-foreground mb-1">
            {order.customer.name}
          </p>

          {/* Product Name & Quantity */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <h4 className="font-semibold text-foreground truncate">
                  {item.product_name}
                </h4>
                <p className="text-xs text-muted-foreground">
                  Qty: {item.quantity}
                </p>
              </div>
            </div>
          </div>

          {/* Current Stage with sequence */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <StageBadge stage={item.current_stage} />
            {item.current_substage && (
              <Badge variant="outline" className="text-xs">
                {item.current_substage}
              </Badge>
            )}
          </div>

          {/* Delivery Date */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Calendar className="h-3 w-3" />
            <span>
              {item.delivery_date 
                ? format(item.delivery_date, 'MMM d, yyyy')
                : 'No date set'
              }
            </span>
          </div>

          {/* Assigned User */}
          {item.assigned_to_name && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <User className="h-3 w-3" />
              <span>{item.assigned_to_name}</span>
            </div>
          )}

          {/* Actions */}
          {showActions && onAction && (
            <div className="flex gap-2 mt-3 pt-3 border-t border-border">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={() => onAction('view', item)}
              >
                View Details
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          )}

          {/* View Order Link */}
          {!showActions && (
            <Button variant="ghost" size="sm" className="w-full justify-between mt-2" asChild>
              <Link to={`/orders/${order.order_id}`}>
                View Order
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
