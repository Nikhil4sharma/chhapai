import { useState } from 'react';
import { ChevronDown, ChevronRight, Package, Calendar, User } from 'lucide-react';
import { Order, OrderItem } from '@/types/order';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PriorityBadge } from './PriorityBadge';
import { StageBadge } from './StageBadge';
import { ProductCard } from './ProductCard';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface OrderAccordionProps {
  order: Order;
  className?: string;
  defaultOpen?: boolean;
  onProductAction?: (action: string, item: OrderItem) => void;
}

export function OrderAccordion({ 
  order, 
  className, 
  defaultOpen = false,
  onProductAction,
}: OrderAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  const itemCount = order.items.length;
  const urgentItems = order.items.filter(i => i.priority_computed === 'red').length;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardContent className="p-0 cursor-pointer hover:bg-secondary/30 transition-colors">
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
              <div className="flex items-center gap-3">
                {/* Expand/Collapse Icon */}
                <div className="text-muted-foreground">
                  {isOpen ? (
                    <ChevronDown className="h-5 w-5" />
                  ) : (
                    <ChevronRight className="h-5 w-5" />
                  )}
                </div>

                {/* Order Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link 
                      to={`/orders/${order.order_id}`}
                      className="font-bold text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {order.order_id}
                    </Link>
                    <PriorityBadge priority={order.priority_computed} />
                    <Badge variant="secondary" className="text-xs">
                      {itemCount} product{itemCount !== 1 ? 's' : ''}
                    </Badge>
                    {urgentItems > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {urgentItems} urgent
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {order.customer.name}
                  </p>
                </div>

                {/* Delivery Date */}
                <div className="text-right hidden sm:block">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {order.order_level_delivery_date 
                      ? format(order.order_level_delivery_date, 'MMM d, yyyy')
                      : 'No date'
                    }
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border bg-secondary/10">
            <div className="p-4 space-y-3">
              {order.items.map((item) => (
                <div 
                  key={item.item_id}
                  className="bg-background rounded-lg border border-border p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Product Header */}
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-foreground">
                          {item.product_name}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          — Qty {item.quantity}
                        </span>
                        <PriorityBadge priority={item.priority_computed} />
                      </div>

                      {/* Stage Info */}
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="text-xs text-muted-foreground">Stage:</span>
                        <StageBadge stage={item.current_stage} />
                        {item.current_substage && (
                          <>
                            <span className="text-muted-foreground">→</span>
                            <Badge variant="outline" className="text-xs">
                              {item.current_substage}
                            </Badge>
                          </>
                        )}
                      </div>

                      {/* Assigned User */}
                      {item.assigned_to_name && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span>{item.assigned_to_name}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <Link to={`/orders/${order.order_id}`}>
                        View
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
