import { format } from 'date-fns';
import { Calendar, Package, UserCircle, AlertCircle, Copy, Check, Mail, Phone, MapPin } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Order, OrderItem } from '@/types/order';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';

interface OrderStatusCardProps {
    order: Order;
    mainItem: OrderItem | null;
    deliveryDate: Date | undefined;
}

export function OrderStatusCard({ order, mainItem, deliveryDate }: OrderStatusCardProps) {
    const [copied, setCopied] = useState(false);

    // Calculate urgency
    const daysUntil = deliveryDate
        ? Math.ceil((new Date(deliveryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        : null;

    const urgencyColor =
        daysUntil === null ? 'text-muted-foreground' :
            daysUntil < 0 ? 'text-red-600 dark:text-red-400' :
                daysUntil <= 2 ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-blue-600 dark:text-blue-400';

    const priorityColors = {
        red: 'bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/20 border-red-200 dark:border-red-900',
        yellow: 'bg-gradient-to-br from-yellow-50 to-yellow-100/50 dark:from-yellow-950/30 dark:to-yellow-900/20 border-yellow-200 dark:border-yellow-900',
        blue: 'bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200 dark:border-blue-900',
    };

    // Department colors
    const deptColors = {
        sales: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
        design: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800',
        prepress: 'bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-200 dark:border-pink-800',
        production: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800',
        outsource: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
        dispatch: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
        completed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const copyCustomerDetails = async () => {
        const { customer } = order;
        const details = [
            customer.name,
            customer.email || '',
            customer.phone || '',
            [customer.address, customer.city, customer.state, customer.pincode]
                .filter(Boolean)
                .join(', ')
        ].filter(Boolean).join('\n');

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(details);
                setCopied(true);
                toast({
                    title: 'Copied!',
                    description: 'Customer details copied',
                });
                setTimeout(() => setCopied(false), 2000);
            } else {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = details;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                setCopied(true);
                toast({
                    title: 'Copied!',
                    description: 'Customer details copied',
                });
                setTimeout(() => setCopied(false), 2000);
            }
        } catch (err) {
            console.error('Copy failed:', err);
            toast({
                title: 'Copy failed',
                description: 'Please try selecting and copying manually',
                variant: 'destructive',
            });
        }
    };

    return (
        <Card className={cn("border-2 overflow-hidden", priorityColors[order.priority_computed])}>
            {/* Header: Order Number + Customer Name */}
            <div className="px-4 sm:px-6 py-3 border-b bg-background/50 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg sm:text-xl font-bold">
                            Order #{order.order_id}
                        </h2>
                        <span className="hidden sm:inline text-sm text-muted-foreground">•</span>
                        <p className="hidden sm:inline text-sm text-muted-foreground">
                            {order.customer.name}
                        </p>
                    </div>

                    {/* Priority Badge */}
                    <Badge
                        variant="outline"
                        className={cn(
                            "text-xs font-semibold",
                            order.priority_computed === 'red' && 'border-red-500 text-red-700 dark:text-red-400 bg-red-500/10',
                            order.priority_computed === 'yellow' && 'border-yellow-500 text-yellow-700 dark:text-yellow-400 bg-yellow-500/10',
                            order.priority_computed === 'blue' && 'border-blue-500 text-blue-700 dark:text-blue-400 bg-blue-500/10'
                        )}
                    >
                        {order.priority_computed === 'red' && (
                            <>
                                <AlertCircle className="h-3 w-3 mr-1" />
                                URGENT
                            </>
                        )}
                        {order.priority_computed === 'yellow' && 'HIGH'}
                        {order.priority_computed === 'blue' && 'NORMAL'}
                    </Badge>
                </div>
                <p className="sm:hidden text-xs text-muted-foreground mt-1">{order.customer.name}</p>
            </div>

            {/* Main Content: 2-Column Layout */}
            <div className="p-4 sm:p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    {/* Left: Order Info */}
                    <div className="space-y-3">
                        {/* Department & Status */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={cn("text-xs border", deptColors[mainItem?.current_stage as keyof typeof deptColors] || deptColors.sales)}>
                                {mainItem?.current_stage?.toUpperCase() || 'SALES'}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                                {mainItem?.status?.replace('_', ' ').toUpperCase() || 'NEW ORDER'}
                            </Badge>
                        </div>

                        {/* Quick Stats */}
                        <div className="grid grid-cols-2 gap-3">
                            {/* Delivery */}
                            <div className="bg-muted/50 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                    <p className="text-xs text-muted-foreground">Delivery</p>
                                </div>
                                <p className="text-sm font-semibold">
                                    {deliveryDate ? format(deliveryDate, 'MMM d') : 'Not set'}
                                </p>
                                {daysUntil !== null && (
                                    <p className={cn("text-xs font-medium mt-0.5", urgencyColor)}>
                                        {daysUntil < 0 ? `${Math.abs(daysUntil)}d overdue` :
                                            daysUntil === 0 ? 'Today' :
                                                `${daysUntil}d left`}
                                    </p>
                                )}
                            </div>

                            {/* Items */}
                            <div className="bg-muted/50 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <Package className="h-3.5 w-3.5 text-muted-foreground" />
                                    <p className="text-xs text-muted-foreground">Items</p>
                                </div>
                                <p className="text-sm font-semibold">{order.items.length}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {mainItem?.assigned_to_name || 'Unassigned'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Right: Customer Profile */}
                    <div className="bg-muted/30 rounded-lg p-3 sm:p-4">
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Avatar className="h-10 w-10 border-2">
                                    <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                                        {getInitials(order.customer.name)}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-semibold text-sm">{order.customer.name}</p>
                                    <p className="text-xs text-muted-foreground">Customer</p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={copyCustomerDetails}
                            >
                                {copied ? (
                                    <Check className="h-3.5 w-3.5 text-green-600" />
                                ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                )}
                            </Button>
                        </div>

                        <div className="space-y-2 text-xs">
                            {order.customer.email && (
                                <div className="flex items-center gap-2">
                                    <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                                    <a href={`mailto:${order.customer.email}`} className="text-primary hover:underline truncate">
                                        {order.customer.email}
                                    </a>
                                </div>
                            )}
                            {order.customer.phone && (
                                <div className="flex items-center gap-2">
                                    <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                                    <a href={`tel:${order.customer.phone}`} className="text-primary hover:underline">
                                        {order.customer.phone}
                                    </a>
                                </div>
                            )}
                            {order.customer.address && (
                                <div className="flex items-start gap-2">
                                    <MapPin className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                                    <p className="text-muted-foreground line-clamp-2">
                                        {order.customer.address}, {order.customer.city}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
}
