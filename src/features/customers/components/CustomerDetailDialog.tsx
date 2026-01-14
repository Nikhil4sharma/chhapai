
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
import { Mail, Phone, MapPin, Copy, ExternalLink, Package, ShoppingBag, Calendar, ArrowUpRight, TrendingUp, User, CreditCard, Truck, ChevronDown, X } from 'lucide-react';
import { WCCustomer, WCOrder, fetchCustomerOrders } from '@/services/woocommerce';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { AddPaymentDialog } from '@/components/dialogs/AddPaymentDialog';
import { financeService } from '@/services/financeService';
import { PaymentTransaction, CustomerBalance } from '@/types/finance';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { importOrderFromWooCommerce } from '@/features/orders/services/supabaseOrdersService';
import { Loader2 } from 'lucide-react';

interface CustomerDetailDialogProps {
    customer: WCCustomer | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CustomerDetailDialog({ customer, open, onOpenChange }: CustomerDetailDialogProps) {
    const [orders, setOrders] = useState<WCOrder[]>([]);
    const [loadingOrders, setLoadingOrders] = useState(false);

    // Finance State
    const [ledger, setLedger] = useState<PaymentTransaction[]>([]);
    const [balance, setBalance] = useState<CustomerBalance>({ total_paid: 0, total_used: 0, balance: 0 });
    const [loadingFinance, setLoadingFinance] = useState(false);
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

    const fetchFinanceData = async () => {
        if (!customer?.wc_id) return;
        setLoadingFinance(true);
        try {
            // Check if wc_id exists as a customer_id in our ledger.
            // Note: our ledger uses UUID from wc_customers table. 
            // customer.id (from props) is the UUID from wc_customers table.
            // customer.wc_id is the WooCommerce ID (number).
            // We use customer.id (UUID) for ledger foreign key.
            const [ledgerData, balanceData] = await Promise.all([
                financeService.getCustomerLedger(customer.id),
                financeService.getCustomerBalance(customer.id)
            ]);
            setLedger(ledgerData);
            setBalance(balanceData);
        } catch (error) {
            console.error("Failed to fetch finance data", error);
        } finally {
            setLoadingFinance(false);
        }
    };

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

            fetchFinanceData();
        }
    }, [open, customer]);

    if (!customer) return null;

    const copyToClipboard = (text: string, label: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied!`);
    };

    // Derived Stats (Real-time from fetched orders)
    const realtimeTotalOrders = orders.length;
    const realtimeTotalSpent = orders.reduce((sum, order) => sum + (parseFloat(order.total) || 0), 0);

    // Fallback to customer string data if orders haven't loaded yet, or strictly use orders if loaded
    const displayTotalOrders = realtimeTotalOrders > 0 ? realtimeTotalOrders : (customer.orders_count || 0);
    const displayTotalSpent = realtimeTotalOrders > 0 ? realtimeTotalSpent : (customer.total_spent ? Number(customer.total_spent) : 0);

    // Calculate Average
    const avgOrderValue = displayTotalOrders > 0 ? (displayTotalSpent / displayTotalOrders).toFixed(2) : "0.00";

    // Display Name Logic
    const displayName = (customer.first_name || customer.last_name)
        ? [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim()
        : (customer.email.split('@')[0] || 'Guest Customer');

    const addressString = [customer.billing?.city, customer.billing?.country].filter(Boolean).join(', ') || 'No location';

    // Recent products (simple extraction)
    const recentProducts = orders.slice(0, 5).flatMap(o => o.line_items).slice(0, 5);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-950 border-none">
                <DialogTitle className="sr-only">Customer Details: {displayName}</DialogTitle>
                {/* Header Section */}
                <div className="bg-white dark:bg-slate-900 border-b shrink-0 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                    <button
                        onClick={() => onOpenChange(false)}
                        className="absolute right-4 top-4 z-50 p-2 rounded-full bg-white/80 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                        aria-label="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>

                    <div className="p-4 sm:p-6 pb-4 relative z-10">
                        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                            <div className="flex gap-4 sm:gap-5 items-center w-full sm:w-auto">
                                <Avatar className="h-16 w-16 sm:h-20 sm:w-20 border-4 border-slate-50 dark:border-slate-800 shadow-md ring-1 ring-slate-100 dark:ring-slate-700 transition-transform duration-500 hover:scale-105">
                                    <AvatarImage src={customer.avatar_url} className="object-cover" />
                                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-sky-600 text-white text-xl sm:text-2xl font-bold">
                                        {(customer.first_name?.[0] || customer.email?.[0] || '?').toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">{displayName}</h2>
                                    <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm mt-1">
                                        <div className="flex items-center gap-1 min-w-0 max-w-full">
                                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                                            <span className="truncate max-w-[150px] sm:max-w-none">{addressString}</span>
                                        </div>
                                        <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-[10px] h-5 hidden sm:inline-flex">ID: {customer.wc_id}</Badge>
                                    </div>
                                    <div className="flex items-center gap-2 mt-3 overflow-x-auto no-scrollbar max-w-full pb-1 sm:pb-0">
                                        {customer.email && (
                                            <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 sm:px-3 py-1.5 rounded-full cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 shrink-0" onClick={() => copyToClipboard(customer.email, "Email")}>
                                                <Mail className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" /> <span className="truncate max-w-[120px] sm:max-w-none">{customer.email}</span>
                                            </div>
                                        )}
                                        {customer.phone && (
                                            <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 sm:px-3 py-1.5 rounded-full cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 shrink-0" onClick={() => copyToClipboard(customer.phone, "Phone")}>
                                                <Phone className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" /> {customer.phone}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Quick Stats & Actions - Responsive Layout */}
                            <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-3 sm:gap-6 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl sm:bg-transparent sm:p-0 border sm:border-0 border-slate-100 dark:border-slate-800">
                                <div className="text-left sm:text-right">
                                    <p className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider font-semibold">Wallet</p>
                                    <p className={`text-lg sm:text-xl font-bold ${balance.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                        ₹{balance.balance.toLocaleString()}
                                    </p>
                                </div>
                                <div className="w-px bg-slate-200 dark:bg-slate-800 h-8 self-center mx-1 sm:mx-0"></div>
                                <div className="text-left sm:text-right">
                                    <p className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider font-semibold">Orders</p>
                                    <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">{displayTotalOrders}</p>
                                </div>
                                <div className="ml-2">
                                    <Button onClick={() => setPaymentDialogOpen(true)} size="sm" className="bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white shadow-lg shadow-slate-200 dark:shadow-none rounded-full px-4 h-9">
                                        <CreditCard className="h-4 w-4 sm:mr-2" />
                                        <span className="hidden sm:inline">Add Money</span>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs Section */}
                <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden"
                    onValueChange={(val) => {
                        if (val === 'ledger') fetchFinanceData();
                    }}
                >
                    <div className="px-6 bg-white dark:bg-slate-900 border-b">
                        <TabsList className="w-full justify-start h-auto p-0 bg-transparent space-x-6">
                            <TabsTrigger value="overview" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-1 py-3 text-slate-500 data-[state=active]:text-blue-600 font-medium transition-all">Overview</TabsTrigger>
                            <TabsTrigger value="ledger" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-1 py-3 text-slate-500 data-[state=active]:text-blue-600 font-medium transition-all">Ledger & Payments</TabsTrigger>
                            <TabsTrigger value="orders" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-1 py-3 text-slate-500 data-[state=active]:text-blue-600 font-medium transition-all">Order History</TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/50 p-6">
                        <TabsContent value="overview" className="mt-0 space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
                            {/* ... Overview Content (Keep Existing) ... */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Address Cards Logic Same as Before - Collapsed for brevity in this replacement block, but I need to include it or reference it. 
                                   Since I'm replacing the WHOLE component, I must include the original content. */}
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

                            {/* Enhanced Customer Insights */}
                            <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden">
                                <CardHeader className="bg-slate-50/50 dark:bg-slate-900/20 border-b border-slate-100 dark:border-slate-800 pb-3">
                                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                                        <TrendingUp className="h-4 w-4 text-indigo-500" /> Customer Insights
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 sm:p-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                                        {/* Insight Card 1: AOV */}
                                        <div className="bg-indigo-50 dark:bg-indigo-950/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30 flex flex-col justify-between">
                                            <div>
                                                <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider mb-1">Avg Order Value</p>
                                                <p className="text-2xl font-bold text-indigo-900 dark:text-indigo-100">₹{avgOrderValue}</p>
                                            </div>
                                            <div className="mt-3 flex items-center gap-1.5 text-xs text-indigo-700 dark:text-indigo-300">
                                                <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                                                Based on {displayTotalOrders} orders
                                            </div>
                                        </div>

                                        {/* Insight Card 2: Status */}
                                        <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30 flex flex-col justify-between">
                                            <div>
                                                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider mb-1">Relationships</p>
                                                <div className="flex flex-wrap gap-2 mt-1">
                                                    {displayTotalOrders > 5 ? (
                                                        <Badge className="bg-emerald-500 hover:bg-emerald-600 border-none shadow-sm">VIP Customer</Badge>
                                                    ) : displayTotalOrders > 1 ? (
                                                        <Badge className="bg-blue-500 hover:bg-blue-600 border-none shadow-sm">Repeat</Badge>
                                                    ) : (
                                                        <Badge className="bg-slate-500 hover:bg-slate-600 border-none shadow-sm">New</Badge>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="mt-3 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                                                Total Spent: ₹{displayTotalSpent.toLocaleString()}
                                            </p>
                                        </div>

                                        {/* Insight Card 3: Top Product (Calculated) */}
                                        <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-xl border border-amber-100 dark:border-amber-900/30 sm:col-span-2 lg:col-span-2">
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">Top Ordered Products</p>
                                                <Package className="h-3 w-3 text-amber-500" />
                                            </div>

                                            {orders.length > 0 ? (
                                                <div className="space-y-2">
                                                    {/* Simple frequency map logic could be here, but for now we show recent/most frequent from visible orders */}
                                                    {(() => {
                                                        const productCounts: Record<string, number> = {};
                                                        orders.forEach(o => o.line_items?.forEach(i => {
                                                            productCounts[i.name] = (productCounts[i.name] || 0) + (i.quantity || 1);
                                                        }));
                                                        const topProducts = Object.entries(productCounts)
                                                            .sort(([, a], [, b]) => b - a)
                                                            .slice(0, 3);

                                                        return topProducts.length > 0 ? (
                                                            topProducts.map(([name, count], idx) => (
                                                                <div key={idx} className="flex items-center justify-between text-xs border-b border-amber-100 dark:border-amber-900/30 last:border-0 pb-1 last:pb-0">
                                                                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate pr-2 max-w-[200px]">{name}</span>
                                                                    <span className="font-bold text-amber-700 dark:text-amber-500 whitespace-nowrap">{count} units</span>
                                                                </div>
                                                            ))
                                                        ) : <p className="text-xs text-slate-400">No product data available</p>
                                                    })()}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-slate-400 italic mt-1">Order history needed for insights</p>
                                            )}
                                        </div>

                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="ledger" className="mt-0 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                    <p className="text-sm font-medium text-slate-500">Total Paid (Credits)</p>
                                    <p className="text-2xl font-bold text-emerald-600 mt-1">₹{balance.total_paid.toLocaleString()}</p>
                                </div>
                                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                    <p className="text-sm font-medium text-slate-500">Total Used (Debits)</p>
                                    <p className="text-2xl font-bold text-blue-600 mt-1">₹{balance.total_used.toLocaleString()}</p>
                                </div>
                                <div className={`p-4 rounded-lg border shadow-sm ${balance.balance >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                                    <p className={`text-sm font-medium ${balance.balance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>Available Balance</p>
                                    <p className={`text-2xl font-bold mt-1 ${balance.balance >= 0 ? 'text-emerald-900' : 'text-red-900'}`}>₹{balance.balance.toLocaleString()}</p>
                                </div>
                            </div>

                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <CardTitle>Transaction History</CardTitle>
                                    <Button size="sm" onClick={() => setPaymentDialogOpen(true)}>
                                        <CreditCard className="h-4 w-4 mr-2" />
                                        Record Payment
                                    </Button>
                                </CardHeader>
                                <CardContent>
                                    {ledger.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground">
                                            No transactions yet.
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {ledger.map((txn) => (
                                                <div key={txn.id} className="flex items-center justify-between p-3 border-b last:border-0 hover:bg-slate-50 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${txn.transaction_type === 'CREDIT' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                                                            {txn.transaction_type === 'CREDIT' ? <ArrowUpRight className="h-5 w-5" /> : <ShoppingBag className="h-5 w-5" />}
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-slate-900">
                                                                {txn.transaction_type === 'CREDIT' ? 'Payment Received' : 'Order Application'}
                                                            </p>
                                                            <p className="text-xs text-slate-500">
                                                                {format(new Date(txn.created_at), "dd MMM yyyy, hh:mm a")} • {txn.payment_method}
                                                            </p>
                                                            {txn.reference_note && (
                                                                <p className="text-xs text-slate-500 italic mt-0.5">{txn.reference_note}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className={`font-bold ${txn.transaction_type === 'CREDIT' ? 'text-emerald-600' : 'text-slate-900'}`}>
                                                            {txn.transaction_type === 'CREDIT' ? '+' : '-'} ₹{Number(txn.amount).toLocaleString()}
                                                        </p>
                                                        {txn.order_id && <Badge variant="outline" className="text-[10px]">Order</Badge>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="orders" className="mt-0 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
                            {/* ... Existing Order History ... */}
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

            <AddPaymentDialog
                open={paymentDialogOpen}
                onOpenChange={setPaymentDialogOpen}
                customerId={customer.id}
                customerName={displayName}
                onSuccess={() => fetchFinanceData()}
            />
        </Dialog>
    );
}

function CollapsibleOrderCard({ order }: { order: WCOrder }) {
    const [isOpen, setIsOpen] = useState(false);

    // Filter out internal meta keys (start with _)
    const getVisibleMeta = (metaData: any[]) => {
        if (!metaData || !Array.isArray(metaData)) return [];
        // Show everything except strict internal keys if user insists they are missing info
        return metaData.filter(m => m.key && !m.key.startsWith('_'));
    };

    const orderTotal = parseFloat(order.total);
    const calculatedSubtotal = order.line_items.reduce((acc, item) => acc + parseFloat(item.total), 0);

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <div className={`group transition-all duration-300 ease-in-out border rounded-2xl overflow-hidden bg-white dark:bg-slate-950/50 ${isOpen ? 'border-primary/20 shadow-lg ring-1 ring-primary/5' : 'border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-slate-200 dark:hover:border-slate-700'}`}>
                <CollapsibleTrigger asChild>
                    <div className="p-5 flex items-center justify-between cursor-pointer select-none">
                        <div className="flex items-center gap-5">
                            <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-colors duration-300 ${isOpen ? 'bg-primary text-primary-foreground shadow-md' : 'bg-slate-50 dark:bg-slate-900 text-slate-500'}`}>
                                <ShoppingBag className="h-6 w-6 stroke-[1.5]" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2.5 mb-1">
                                    <span className="font-semibold text-base text-slate-900 dark:text-slate-100 tracking-tight">Order #{order.number}</span>
                                    <Badge variant="secondary" className={`capitalize font-medium px-2 py-0.5 rounded-full text-[10px] tracking-wide ${order.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' :
                                        order.status === 'processing' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' :
                                            order.status === 'cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400' :
                                                'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                        }`}>
                                        {order.status}
                                    </Badge>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                        <Calendar className="h-3.5 w-3.5" />
                                        {format(new Date(order.date_created), "MMM dd, yyyy")}
                                    </span>
                                    <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                                    <span>{order.line_items.length} items</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">₹{parseFloat(order.total).toLocaleString()}</p>
                            <div className={`flex items-center justify-end gap-1.5 text-xs font-medium transition-colors duration-300 ${isOpen ? 'text-primary' : 'text-slate-400'}`}>
                                {isOpen ? 'Hide Details' : 'View Details'}
                                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                            </div>
                        </div>
                    </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                    <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/10">
                        {/* Order Items Section - Redesigned List */}
                        <div className="p-5 space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Package className="h-4 w-4 text-slate-500" />
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Products</h4>
                            </div>

                            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 divide-y divide-slate-50 dark:divide-slate-800 overflow-hidden shadow-sm">
                                {order.line_items.map((item, idx) => {
                                    const meta = getVisibleMeta(item.meta_data);
                                    const itemTotal = parseFloat(item.total);
                                    const unitPrice = item.quantity > 0 ? itemTotal / item.quantity : 0;

                                    return (
                                        <div key={idx} className="p-5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <div className="flex flex-col sm:flex-row gap-4">
                                                {/* Quantity Badge */}
                                                <div className="shrink-0 pt-0.5">
                                                    <div className="h-10 w-10 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center justify-center text-sm font-bold border border-indigo-100 dark:border-indigo-800 shadow-sm">
                                                        {item.quantity}
                                                    </div>
                                                </div>

                                                {/* Main Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                                                        <div className="space-y-3">
                                                            {/* Product Name */}
                                                            <div>
                                                                <p className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">
                                                                    {item.name}
                                                                </p>
                                                                <div className="mt-1 flex items-center gap-2">
                                                                    {item.sku && (
                                                                        <Badge variant="outline" className="text-[10px] h-5 rounded px-1.5 font-normal text-slate-400 border-slate-200">
                                                                            SKU: {item.sku}
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Meta Specs Grid */}
                                                            {meta.length > 0 && (
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                                                                    {meta.map((m) => (
                                                                        <div key={m.id} className="flex gap-2 items-baseline">
                                                                            <span className="font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide shrink-0">
                                                                                {(m.display_key || m.key).replace(/_/g, ' ')}
                                                                            </span>
                                                                            <span className="text-slate-700 dark:text-slate-300 font-medium truncate">
                                                                                {m.display_value || m.value}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Pricing Section */}
                                                        <div className="text-right shrink-0 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 min-w-[120px]">
                                                            <div className="space-y-1">
                                                                <div className="flex justify-between items-center gap-4 text-xs text-slate-500">
                                                                    <span>Unit</span>
                                                                    <span>₹{unitPrice.toLocaleString()}</span>
                                                                </div>
                                                                <div className="h-px bg-slate-200 dark:bg-slate-700" />
                                                                <div className="flex justify-between items-center gap-4 text-sm font-bold text-slate-900 dark:text-slate-100">
                                                                    <span>Total</span>
                                                                    <span>₹{itemTotal.toLocaleString()}</span>
                                                                </div>
                                                                <p className="text-[10px] text-slate-400 text-right pt-0.5">
                                                                    (Excl. GST)
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Order Summary & Details Grid */}
                        {(order.shipping || order.customer_note || getVisibleMeta(order.meta_data).length > 0) && (
                            <div className="px-5 pb-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                                    {/* Shipping Address - Only show if valid */}
                                    {order.shipping && (order.shipping.address_1 || order.shipping.city) && (
                                        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                                            <div className="flex items-center gap-2 mb-3 text-slate-400">
                                                <MapPin className="h-3.5 w-3.5" />
                                                <span className="text-[10px] font-bold uppercase tracking-wider">Shipping To</span>
                                            </div>
                                            <div className="space-y-1 text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                                                <p className="text-slate-900 dark:text-slate-100">{order.shipping.first_name} {order.shipping.last_name}</p>
                                                <p>{order.shipping.address_1}</p>
                                                {order.shipping.address_2 && <p>{order.shipping.address_2}</p>}
                                                <p>{[order.shipping.city, order.shipping.state, order.shipping.postcode].filter(Boolean).join(', ')}</p>
                                                <p>{order.shipping.country}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Financial Breakdown & Notes */}
                                    <div className="space-y-4">
                                        {/* Notes - Only show if exists */}
                                        {order.customer_note && (
                                            <div className="bg-amber-50 dark:bg-amber-950/10 p-4 rounded-xl border border-amber-100 dark:border-amber-900/20">
                                                <div className="flex items-center gap-2 mb-2 text-amber-600/70 dark:text-amber-500/70">
                                                    <Copy className="h-3.5 w-3.5" />
                                                    <span className="text-[10px] font-bold uppercase tracking-wider">Customer Note</span>
                                                </div>
                                                <p className="text-sm text-amber-900 dark:text-amber-100 italic">"{order.customer_note}"</p>
                                            </div>
                                        )}

                                        {/* Cost Breakdown */}
                                        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                                            <div className="flex items-center gap-2 mb-3 text-slate-400">
                                                <CreditCard className="h-3.5 w-3.5" />
                                                <span className="text-[10px] font-bold uppercase tracking-wider">Payment Details</span>
                                            </div>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between text-slate-500">
                                                    <span>Subtotal (Items)</span>
                                                    <span>₹{calculatedSubtotal.toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between text-slate-500">
                                                    <span>Tax & Shipping (Est.)</span>
                                                    <span>₹{(orderTotal - calculatedSubtotal).toLocaleString()}</span>
                                                </div>
                                                <div className="h-px bg-slate-100 dark:bg-slate-800 my-2" />
                                                <div className="flex justify-between font-bold text-base text-slate-900 dark:text-slate-100">
                                                    <span>Total Paid</span>
                                                    <span>₹{orderTotal.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        )}
                    </div>
                </CollapsibleContent>
            </div>
        </Collapsible>
    );
}

