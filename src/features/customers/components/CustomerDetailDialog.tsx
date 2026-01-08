
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

import { AddPaymentDialog } from '@/components/dialogs/AddPaymentDialog';
import { financeService } from '@/services/financeService';
import { PaymentTransaction, CustomerBalance } from '@/types/finance';

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
                <div className="bg-white dark:bg-slate-900 border-b shrink-0 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
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
                <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
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

                            <Card className="shadow-sm border-slate-200 dark:border-slate-800">
                                <CardHeader>
                                    <CardTitle className="text-base font-semibold flex items-center gap-2"><TrendingUp className="h-4 w-4 text-blue-500" /> Customer Insights</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
                                            <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold uppercase mb-1">Avg Order Value</p>
                                            <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">₹{avgOrderValue}</p>
                                        </div>
                                        <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-lg">
                                            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold uppercase mb-1">Status</p>
                                            <p className="text-lg font-bold text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
                                                {displayTotalOrders > 2 ? 'Repeat Customer' : 'New Customer'}
                                                {displayTotalOrders > 5 && <Badge className="bg-emerald-500 hover:bg-emerald-600">VIP</Badge>}
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
                        <div className="space-y-4">
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

                            {/* Meta Data & GST Section */}
                            {order.meta_data && order.meta_data.length > 0 && (
                                <div className="space-y-3">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Additional Details</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {order.meta_data
                                            .filter(meta => !meta.key.startsWith('_') || meta.key.toLowerCase().includes('gst')) // Filter internal keys unless it's GST
                                            .map((meta) => (
                                                <div key={meta.id} className="bg-white dark:bg-slate-900 p-3 rounded border border-slate-100 dark:border-slate-800">
                                                    <p className="text-xs text-slate-500 mb-1 font-medium bg-slate-100 dark:bg-slate-800 inline-block px-1.5 py-0.5 rounded">
                                                        {meta.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                                    </p>
                                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 break-words">
                                                        {typeof meta.value === 'string' ? meta.value : JSON.stringify(meta.value)}
                                                    </p>
                                                </div>
                                            ))}
                                    </div>
                                    {/* Fallback if all keys were hidden but meta_data existed */}
                                    {order.meta_data.filter(meta => !meta.key.startsWith('_') || meta.key.toLowerCase().includes('gst')).length === 0 && (
                                        <p className="text-sm text-muted-foreground italic">No additional public details.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </CollapsibleContent>
            </div>
        </Collapsible>
    );
}
