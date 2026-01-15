import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { UserCircle, Badge as BadgeIcon, CheckCircle, Trash2, IndianRupee, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ProductCard } from '@/features/orders/components/ProductCard';
import { Order, OrderItem } from '@/types/order';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useFinancialAccess } from '@/hooks/useFinancialAccess';
import { useOrders } from '@/features/orders/context/OrderContext';
import { toast } from '@/hooks/use-toast';

interface OrderGroupListProps {
    products: { order: Order; item: OrderItem }[];
    emptyMessage?: string;
    onAddPayment?: (order: Order) => void;
    showFinancials?: boolean;
    assignableUsers?: { user_id: string; full_name: string; }[];
}

export function OrderGroupList({
    products,
    emptyMessage = "No orders found",
    onAddPayment,
    showFinancials = false, // Default False for safety, explicit opt-in
    assignableUsers
}: OrderGroupListProps) {
    const { isAdmin, role, user } = useAuth();
    const { assignOrderToUser, deleteOrder } = useOrders();
    const { canViewFinancials } = useFinancialAccess();

    // Determine effective access for financials
    const hasFinancialAccess = showFinancials && canViewFinancials;
    const canAssign = isAdmin || role === 'sales';
    const canDelete = isAdmin || role === 'sales';

    if (products.length === 0) {
        return (
            <Card>
                <CardContent className="py-12 text-center">
                    <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                    <h3 className="font-semibold text-lg mb-2">No products found</h3>
                    <p className="text-muted-foreground">{emptyMessage}</p>
                </CardContent>
            </Card>
        );
    }

    // Group items by order
    // Use useMemo to prevent frequent re-grouping if products are stable
    const orderGroups = useMemo(() => {
        const itemsByOrder = new Map<string, Array<{ order: Order; item: OrderItem }>>();
        products.forEach(({ order, item }) => {
            // Use a composite key or just order_id if unique enough
            const orderKey = order.order_id;
            if (!itemsByOrder.has(orderKey)) itemsByOrder.set(orderKey, []);
            itemsByOrder.get(orderKey)!.push({ order, item });
        });
        return Array.from(itemsByOrder.entries());
    }, [products]);

    return (
        <div className="space-y-6 pb-20">
            {orderGroups.map(([orderId, items]) => {
                const order = items[0].order;

                // Prepare items with suffixes if needed
                const itemsWithSuffixes = items.map(({ order, item }, index) => ({
                    order,
                    item,
                    suffix: items.length > 1 ? String.fromCharCode(65 + index) : ''
                }));

                // Basic Priority Logic (for spine color)
                const isUrgent = items.some(({ item }) => item.priority_computed === 'red');
                const isMedium = !isUrgent && items.some(({ item }) => item.priority_computed === 'yellow');

                let spineColor = 'bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700';
                let textColor = 'text-slate-500 dark:text-slate-400';

                if (isUrgent) {
                    spineColor = 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-900/50';
                    textColor = 'text-red-600 dark:text-red-400';
                } else if (isMedium) {
                    spineColor = 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-900/50';
                    textColor = 'text-yellow-600 dark:text-yellow-400';
                }

                return (
                    <div key={orderId} className="flex h-auto min-h-[250px] border rounded-lg shadow-sm bg-card overflow-hidden transition-all hover:shadow-md">

                        {/* Left Spine: Vertical Order ID */}
                        <div
                            className={`w-10 sm:w-12 flex flex-col items-center justify-center py-4 border-r ${spineColor} flex-shrink-0 cursor-pointer transition-colors hover:bg-opacity-80`}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (navigator?.clipboard) {
                                    navigator.clipboard.writeText(orderId).then(() => {
                                        toast({ title: "Copied", description: `Order #${orderId} copied` });
                                    });
                                }
                            }}
                        >
                            <div className="flex-1" />
                            <span
                                className={`text-sm font-bold tracking-widest whitespace-nowrap ${textColor}`}
                                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                            >
                                #{orderId}
                            </span>
                            <div className="flex-1" />
                        </div>

                        {/* Right Content */}
                        <div className="flex-1 overflow-hidden flex flex-col min-w-0">
                            {/* Header: Customer Info + Actions */}
                            <div className="px-4 py-2 border-b bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <Link
                                        to={`/customers?open=${order.customer.id || order.customer_id}&search=${encodeURIComponent(order.customer.name)}`}
                                        className="font-semibold text-sm hover:underline hover:text-primary transition-colors flex items-center gap-2"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <UserCircle className="h-4 w-4 text-muted-foreground" />
                                        {order.customer.name}
                                    </Link>

                                    {/* Financial Badge - Only if Access Allowed */}
                                    {hasFinancialAccess && order.financials && (
                                        <div className="hidden sm:block">
                                            {/* Note: Full payment status derivation might happen in parent or specialized hook. 
                                 For now, using basic order totals if available or skipping exact "Paid" badge logic 
                                 unless we pass paymentStatuses map. Simple visual for now. */}
                                            <Badge variant="outline" className="text-xs font-normal opacity-80">
                                                Total: ₹{order.financials.total?.toLocaleString() || '0'}
                                            </Badge>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    {/* Add Payment Action - Conditioned on Access */}
                                    {hasFinancialAccess && onAddPayment && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs gap-1 px-2 sm:px-3 bg-white dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onAddPayment(order);
                                            }}
                                        >
                                            <IndianRupee className="h-3 w-3" />
                                            <span className="hidden sm:inline">Add Payment</span>
                                        </Button>
                                    )}

                                    {/* Assign User Dropdown - Conditioned on Access */}
                                    {canAssign && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2 border border-dashed border-slate-300 dark:border-slate-700">
                                                    <UserCircle className="h-3 w-3" />
                                                    <span className="hidden sm:inline font-medium">
                                                        {order.assigned_user_name || "Unassigned"}
                                                    </span>
                                                    <ChevronDown className="h-3 w-3 opacity-50 hidden sm:block" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    onClick={() => { if (order.id && canAssign) assignOrderToUser(order.id, user!.id); }}
                                                    className="font-medium"
                                                >
                                                    Assign to Me
                                                </DropdownMenuItem>

                                                {assignableUsers && assignableUsers.length > 0 && (
                                                    <>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem disabled className="text-xs font-semibold opacity-70">
                                                            Assign to Team Member
                                                        </DropdownMenuItem>
                                                        {assignableUsers.map(u => (
                                                            <DropdownMenuItem
                                                                key={u.user_id}
                                                                onClick={() => {
                                                                    if (order.id) {
                                                                        assignOrderToUser(order.id, u.user_id);
                                                                    }
                                                                }}
                                                                className={order.assigned_user === u.user_id ? "bg-slate-100 dark:bg-slate-800" : ""}
                                                            >
                                                                {u.full_name}
                                                                {order.assigned_user === u.user_id && <CheckCircle className="ml-2 h-3 w-3 text-green-500" />}
                                                            </DropdownMenuItem>
                                                        ))}
                                                    </>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}

                                    {/* Delete Action - Conditioned on Access */}
                                    {canDelete && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (order.id) {
                                                    if (confirm('Are you sure you want to delete this order?')) {
                                                        deleteOrder(order.id);
                                                    }
                                                }
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Product Cards Container */}
                            <div className={`p-4 h-full overflow-x-auto overflow-y-hidden custom-scrollbar bg-slate-50/30 dark:bg-slate-900/10`}>
                                <div className={`flex gap-4 h-full items-start ${itemsWithSuffixes.length === 1 ? 'w-full' : ''}`}>
                                    {itemsWithSuffixes.map(({ order, item, suffix }) => {
                                        const count = itemsWithSuffixes.length;
                                        let widthClass = 'w-full sm:w-[320px]'; // Default mobile stacked, desktop fixed width for scroll

                                        if (count === 1) {
                                            widthClass = 'w-full max-w-full';
                                        } else if (count === 2) {
                                            // Desktop: 50% minus half gap (gap-4 is 1rem)
                                            widthClass = 'w-full md:w-[calc(50%-0.5rem)]';
                                        } else if (count === 3) {
                                            // Desktop: 33.33% minus 2/3 gap
                                            widthClass = 'w-full lg:w-[calc(33.33%-0.67rem)]';
                                        }

                                        return (
                                            <div
                                                key={`${order.order_id}-${item.item_id}`}
                                                className={`
                                                   flex-shrink-0 transition-all duration-300
                                                   ${widthClass}
                                                 `}
                                            >
                                                <ProductCard
                                                    order={order}
                                                    item={item}
                                                    productSuffix={suffix}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                        </div>
                    </div>
                );
            })}
        </div>
    );
}
