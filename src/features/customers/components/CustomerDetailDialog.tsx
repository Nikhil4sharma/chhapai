
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Mail, Phone, MapPin, Copy, ExternalLink, Package, ShoppingBag, Calendar, ArrowUpRight, TrendingUp, User, CreditCard, Truck, ChevronDown } from 'lucide-react';
import { WCCustomer, WCOrder, fetchCustomerOrders } from '@/services/woocommerce';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface CustomerDetailDialogProps {
    customer: WCCustomer | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CustomerDetailDialog({ customer, open, onOpenChange }: CustomerDetailDialogProps) {
    const [orders, setOrders] = useState<WCOrder[]>([]);
    const [loadingOrders, setLoadingOrders] = useState(false);

    useEffect(() => {
        if (open && customer?.wc_id) {
            setLoadingOrders(true);
            fetchCustomerOrders(customer.wc_id)
                .then(setOrders)
                .catch(err => {
                    console.error("Failed to fetch orders", err);
                    toast.error("Could not load order history");
                })
                .finally(() => setLoadingOrders(false));
        }
    }, [open, customer]);

    if (!customer) return null;

    const copyToClipboard = (text: string, label: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied!`);
    };

    // Derived Stats
    const totalOrders = orders.length || customer.orders_count || 0;
    const totalSpent = customer.total_spent ? Number(customer.total_spent) : 0;
    const avgOrderValue = totalOrders > 0 ? (totalSpent / totalOrders).toFixed(2) : 0;

    // Display Name Logic
    const displayName = (customer.first_name || customer.last_name)
        ? `${customer.first_name} ${customer.last_name}`.trim()
        : (customer.email.split('@')[0] || 'Guest Customer');

    const addressString = [customer.billing?.city, customer.billing?.country].filter(Boolean).join(', ') || 'No location';

    // Recent products (simple extraction)
    const recentProducts = orders.slice(0, 5).flatMap(o => o.line_items).slice(0, 5);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-950 border-none">
                <DialogTitle className="sr-only">Customer Details: {displayName}</DialogTitle>
                {/* Header Section */}
                <div className="bg-white dark:bg-slate-900 per-6 border-b shrink-0">
                    <div className="p-6 pb-4">
                        <div className="flex items-start justify-between">
                            <div className="flex gap-5 items-center">
                                <Avatar className="h-20 w-20 border-4 border-slate-50 dark:border-slate-800 shadow-md">
                                    <AvatarImage src={customer.avatar_url} />
                                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-2xl font-bold">
                                        {(customer.first_name?.[0] || customer.email?.[0] || '?').toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{displayName}</h2>
                                    <div className="flex items-center gap-2 text-muted-foreground text-sm mt-1">
                                        <MapPin className="h-3.5 w-3.5" />
                                        <span>{addressString}</span>
                                        <Badge variant="outline" className="ml-2 bg-slate-100 dark:bg-slate-800 text-[10px] h-5">ID: {customer.wc_id}</Badge>
                                    </div>
                                    <div className="flex items-center gap-3 mt-3">
                                        {customer.email && (
                                            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 px-2 py-1 rounded cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors" onClick={() => copyToClipboard(customer.email, "Email")}>
                                                <Mail className="h-3 w-3" /> {customer.email} <Copy className="h-2.5 w-2.5 ml-1 opacity-50" />
                                            </div>
                                        )}
                                        {customer.phone && (
                                            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 px-2 py-1 rounded cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors" onClick={() => copyToClipboard(customer.phone, "Phone")}>
                                                <Phone className="h-3 w-3" /> {customer.phone} <Copy className="h-2.5 w-2.5 ml-1 opacity-50" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Quick Stats in Header */}
                            <div className="flex gap-4">
                                <div className="text-right">
                                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Total Spent</p>
                                    <p className="text-xl font-bold text-slate-900 dark:text-slate-100">₹{totalSpent.toLocaleString()}</p>
                                </div>
                                <div className="w-px bg-slate-200 dark:bg-slate-800 h-10 self-center"></div>
                                <div className="text-right">
                                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Orders</p>
                                    <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{totalOrders}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs Section */}
                <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-6 bg-white dark:bg-slate-900 border-b">
                        <TabsList className="w-full justify-start h-auto p-0 bg-transparent space-x-6">
                            <TabsTrigger value="overview" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none px-1 py-3 text-slate-500 data-[state=active]:text-indigo-600 font-medium transition-all">Overview</TabsTrigger>
                            <TabsTrigger value="orders" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none px-1 py-3 text-slate-500 data-[state=active]:text-indigo-600 font-medium transition-all">Order History</TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/50 p-6">
                        <TabsContent value="overview" className="mt-0 space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Address Cards */}
                                <Card className="shadow-sm border-slate-200 dark:border-slate-800">
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center gap-2 text-slate-500">
                                            <CreditCard className="h-4 w-4" />
                                            <CardTitle className="text-base font-semibold">Billing Address</CardTitle>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900 p-3 rounded-md border border-slate-100 dark:border-slate-800">
                                            {[
                                                customer.billing?.first_name ? `${customer.billing.first_name} ${customer.billing.last_name || ''}` : null,
                                                customer.billing?.company,
                                                customer.billing?.address_1,
                                                customer.billing?.address_2,
                                                [customer.billing?.city, customer.billing?.state, customer.billing?.postcode].filter(Boolean).join(', '),
                                                customer.billing?.country
                                            ].filter(Boolean).map((line, i) => <div key={i}>{line}</div>)}
                                            {!customer.billing?.address_1 && <span className="text-muted-foreground italic">No billing address provided</span>}
                                        </div>
                                        <div className="mt-3 space-y-1">
                                            {customer.billing?.email && (
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Mail className="h-3 w-3" /> {customer.billing.email}</div>
                                            )}
                                            {customer.billing?.phone && (
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Phone className="h-3 w-3" /> {customer.billing.phone}</div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="shadow-sm border-slate-200 dark:border-slate-800">
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center gap-2 text-slate-500">
                                            <Truck className="h-4 w-4" />
                                            <CardTitle className="text-base font-semibold">Shipping Address</CardTitle>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900 p-3 rounded-md border border-slate-100 dark:border-slate-800">
                                            {[
                                                customer.shipping?.first_name ? `${customer.shipping.first_name} ${customer.shipping.last_name || ''}` : null,
                                                customer.shipping?.company,
                                                customer.shipping?.address_1,
                                                customer.shipping?.address_2,
                                                [customer.shipping?.city, customer.shipping?.state, customer.shipping?.postcode].filter(Boolean).join(', '),
                                                customer.shipping?.country
                                            ].filter(Boolean).map((line, i) => <div key={i}>{line}</div>)}
                                            {!customer.shipping?.address_1 && <span className="text-muted-foreground italic">Same as billing address</span>}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Recent Activity / Insights */}
                            <Card className="shadow-sm border-slate-200 dark:border-slate-800">
                                <CardHeader>
                                    <CardTitle className="text-base font-semibold flex items-center gap-2"><TrendingUp className="h-4 w-4 text-indigo-500" /> Customer Insights</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className="bg-indigo-50 dark:bg-indigo-950/20 p-4 rounded-lg">
                                            <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold uppercase mb-1">Avg Order Value</p>
                                            <p className="text-2xl font-bold text-indigo-900 dark:text-indigo-100">₹{avgOrderValue}</p>
                                        </div>
                                        <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-lg">
                                            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold uppercase mb-1">Status</p>
                                            <p className="text-lg font-bold text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
                                                {totalOrders > 2 ? 'Repeat Customer' : 'New Customer'}
                                                {totalOrders > 5 && <Badge className="bg-emerald-500 hover:bg-emerald-600">VIP</Badge>}
                                            </p>
                                        </div>
                                        <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-lg">
                                            <p className="text-xs text-purple-600 dark:text-purple-400 font-semibold uppercase mb-1">Last Active</p>
                                            <p className="text-lg font-bold text-purple-900 dark:text-purple-100">
                                                {customer.last_order_date ? format(new Date(customer.last_order_date), 'dd MMM yyyy') : 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="orders" className="mt-0 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
                            {loadingOrders ? (
                                <div className="space-y-4">
                                    {[1, 2, 3].map(i => <div key={i} className="h-24 bg-white dark:bg-slate-900 animate-pulse rounded-lg border border-slate-200 dark:border-slate-800" />)}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {orders.map((order) => (
                                        <CollapsibleOrderCard key={order.id} order={order} />
                                    ))}
                                    {orders.length === 0 && (
                                        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground bg-white dark:bg-slate-900 rounded-lg border border-dashed border-slate-300 dark:border-slate-700">
                                            <ShoppingBag className="h-10 w-10 opacity-20 mb-3" />
                                            <p className="font-medium">No orders found</p>
                                            <p className="text-sm">This customer hasn't placed any orders yet.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </TabsContent>
                    </div>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

function CollapsibleOrderCard({ order }: { order: WCOrder }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
                <CollapsibleTrigger asChild>
                    <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-full ${isOpen ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'} transition-colors`}>
                                <ShoppingBag className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-900 dark:text-slate-100">Order #{order.number}</span>
                                    <Badge className={`uppercase text-[10px] h-5 px-1.5 ${order.status === 'completed' ? 'bg-emerald-500 hover:bg-emerald-600' :
                                        order.status === 'processing' ? 'bg-blue-500 hover:bg-blue-600' :
                                            order.status === 'cancelled' ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-500'
                                        }`}>
                                        {order.status}
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {format(new Date(order.date_created), "dd MMM yyyy, hh:mm a")}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">₹{order.total}</p>
                            <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mt-0.5 group-hover:underline">
                                {isOpen ? 'Show Less' : 'View Items'}
                            </p>
                        </div>
                    </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <div className="bg-slate-50 dark:bg-slate-950/50 p-4 border-t border-slate-200 dark:border-slate-800">
                        <div className="space-y-3">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Order Items</p>
                            {order.line_items.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded border border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center text-xs font-bold text-slate-500">
                                            {item.quantity}x
                                        </div>
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{item.name}</span>
                                    </div>
                                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                        ₹{item.total}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </CollapsibleContent>
            </div>
        </Collapsible>
    );
}
