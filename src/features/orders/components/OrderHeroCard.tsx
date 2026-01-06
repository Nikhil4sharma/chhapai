import { format } from 'date-fns';
import { Calendar, Package, UserCircle, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PriorityBadge } from '@/features/orders/components/PriorityBadge';
import { StageBadge } from '@/features/orders/components/StageBadge';
import { Order, OrderItem, Priority } from '@/types/order';
import { cn } from '@/lib/utils';

interface OrderHeroCardProps {
    order: Order;
    mainItem: OrderItem | null;
    deliveryDate: Date | undefined;
}

export function OrderHeroCard({ order, mainItem, deliveryDate }: OrderHeroCardProps) {
    // Calculate days until delivery
    const daysUntilDelivery = deliveryDate
        ? Math.ceil((new Date(deliveryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        : null;

    // Priority-based styling
    const priorityStyles = {
        red: 'border-l-red-500 bg-gradient-to-r from-red-50/50 to-transparent dark:from-red-950/20',
        yellow: 'border-l-yellow-500 bg-gradient-to-r from-yellow-50/50 to-transparent dark:from-yellow-950/20',
        blue: 'border-l-blue-500 bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-950/20',
    };

    const urgencyText = daysUntilDelivery !== null
        ? daysUntilDelivery < 0
            ? `${Math.abs(daysUntilDelivery)} days overdue`
            : daysUntilDelivery === 0
                ? 'Due today'
                : daysUntilDelivery === 1
                    ? 'Due tomorrow'
                    : `${daysUntilDelivery} days remaining`
        : 'No delivery date set';

    return (
        <Card
            className={cn(
                "border-l-4 transition-all hover:shadow-md",
                priorityStyles[order.priority_computed]
            )}
        >
            <div className="p-6">
                {/* Header Row */}
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h2 className="text-3xl font-bold tracking-tight">#{order.order_id}</h2>
                            <PriorityBadge priority={order.priority_computed} showLabel />
                            {order.source === 'wordpress' && (
                                <Badge variant="outline" className="text-xs">WooCommerce</Badge>
                            )}
                            {order.is_completed && (
                                <Badge className="bg-green-500 text-xs">Completed</Badge>
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Created {format(new Date(order.created_at), 'MMM d, yyyy')}
                        </p>
                    </div>

                    {mainItem && (
                        <div className="text-right">
                            <StageBadge stage={mainItem.current_stage} />
                        </div>
                    )}
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                    {/* Delivery Date */}
                    <div className="flex items-start gap-3">
                        <div className={cn(
                            "p-2 rounded-lg",
                            order.priority_computed === 'red' ? 'bg-red-100 dark:bg-red-950/30' :
                                order.priority_computed === 'yellow' ? 'bg-yellow-100 dark:bg-yellow-950/30' :
                                    'bg-blue-100 dark:bg-blue-950/30'
                        )}>
                            <Calendar className={cn(
                                "h-5 w-5",
                                order.priority_computed === 'red' ? 'text-red-600 dark:text-red-400' :
                                    order.priority_computed === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' :
                                        'text-blue-600 dark:text-blue-400'
                            )} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground mb-1">Delivery Date</p>
                            <p className="font-semibold truncate">
                                {deliveryDate ? format(deliveryDate, 'MMM d, yyyy') : 'Not set'}
                            </p>
                            {daysUntilDelivery !== null && (
                                <p className={cn(
                                    "text-xs mt-1",
                                    daysUntilDelivery < 0 ? 'text-red-600 dark:text-red-400' :
                                        daysUntilDelivery <= 2 ? 'text-yellow-600 dark:text-yellow-400' :
                                            'text-muted-foreground'
                                )}>
                                    {urgencyText}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Items Count */}
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-muted">
                            <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-1">Order Items</p>
                            <p className="font-semibold">{order.items.length} {order.items.length === 1 ? 'item' : 'items'}</p>
                        </div>
                    </div>

                    {/* Assigned To */}
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-muted">
                            <UserCircle className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground mb-1">Assigned To</p>
                            <p className="font-semibold truncate">
                                {mainItem?.assigned_to_name || 'Unassigned'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
}
