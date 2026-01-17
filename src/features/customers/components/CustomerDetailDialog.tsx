
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
import {
    Mail, Phone, MapPin, Copy, Check, Edit2, ExternalLink, Package, ShoppingBag,
    Calendar, ArrowUpRight, TrendingUp, User, CreditCard, Truck,
    ChevronDown, X, Search, Banknote, Smartphone, Globe, RefreshCw
} from 'lucide-react';
import { WCCustomer, WCOrder, fetchCustomerOrders } from '@/services/woocommerce';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { AddPaymentDialog } from '@/components/dialogs/AddPaymentDialog';
import { financeService } from '@/services/financeService';
import { PaymentTransaction, CustomerBalance, OrderPaymentStatus } from '@/types/finance';
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
    const [orders, setOrders] = useState<WCOrder[] | null>(null);
    const [loadingOrders, setLoadingOrders] = useState(false);

    // Payment Status Map: Key = Order Number (string), Value = Status
    const [paymentStatusMap, setPaymentStatusMap] = useState<Record<string, OrderPaymentStatus>>({});

    // Finance State
    const [ledger, setLedger] = useState<PaymentTransaction[]>([]);
    const [balance, setBalance] = useState<CustomerBalance>({ total_paid: 0, total_used: 0, balance: 0 });
    const [loadingFinance, setLoadingFinance] = useState(false);
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

    // Ledger UI State
    const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-high' | 'amount-low'>('date-desc');
    const [filterMode, setFilterMode] = useState<'all' | 'credit' | 'debit'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // State for local updates (since props are read-only)
    const [activeCustomer, setActiveCustomer] = useState<WCCustomer | null>(customer);

    // GST State
    const [startGstEdit, setStartGstEdit] = useState(false);
    const [gstNumber, setGstNumber] = useState(customer?.gst_number || '');
    const [activeTab, setActiveTab] = useState('overview');

    // Profile Editing State
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [editForm, setEditForm] = useState<Partial<WCCustomer>>({});

    useEffect(() => {
        if (customer) {
            setActiveCustomer(customer);
            setEditForm(customer);
            setGstNumber(customer.gst_number || '');
        }
    }, [customer]);

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [filterMode, sortBy, searchQuery, dateRange, itemsPerPage]);

    // Update GST State when customer changes
    useEffect(() => {
        setGstNumber(customer?.gst_number || '');
    }, [customer]);

    // Realtime subscription for orders
    useEffect(() => {
        if (!customer?.id) return;

        const ordersSubscription = supabase
            .channel(`customer-orders-${customer.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'orders',
                    filter: `customer_id=eq.${customer.id}`
                },
                (payload) => {
                    console.log('[Realtime] Order change:', payload);
                    // Refetch orders when any change occurs
                    if (open) {
                        supabase
                            .from('orders')
                            .select('*, order_items(*)')
                            .eq('customer_id', customer.id)
                            .order('created_at', { ascending: false })
                            .then(({ data }) => {
                                if (data) {
                                    const transformedOrders: WCOrder[] = data.map(order => ({
                                        id: order.wc_order_id || 0,
                                        number: order.wc_order_number || order.id.slice(0, 8),
                                        status: order.status || 'processing',
                                        date_created: order.created_at,
                                        total: order.total_amount?.toString() || '0',
                                        line_items: (order.order_items || []).map((item: any) => ({
                                            name: item.product_name,
                                            quantity: item.quantity,
                                            total: item.line_total?.toString() || '0',
                                            total_tax: '0',
                                            sku: '',
                                            meta_data: []
                                        })),
                                        meta_data: [],
                                        shipping: customer.shipping || {},
                                        billing: customer.billing || {},
                                        customer_note: ''
                                    }));
                                    setOrders(transformedOrders);
                                }
                            });
                    }
                }
            )
            .subscribe();

        return () => {
            ordersSubscription.unsubscribe();
        };
    }, [customer?.id, open]);

    // Realtime subscription for payments
    useEffect(() => {
        if (!customer?.id) return;

        const paymentsSubscription = supabase
            .channel(`customer-payments-${customer.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'payment_ledger',
                    filter: `customer_id=eq.${customer.id}`
                },
                (payload) => {
                    console.log('[Realtime] Payment change:', payload);
                    // Refetch finance data when payment changes
                    if (open) {
                        fetchFinanceData();
                    }
                }
            )
            .subscribe();

        return () => {
            paymentsSubscription.unsubscribe();
        };
    }, [customer?.id, open]);

    const handleUpdateGst = async () => {
        if (!customer?.id) return;
        try {
            const { error } = await supabase
                .from('wc_customers')
                .update({ gst_number: gstNumber })
                .eq('id', customer.id);

            if (error) throw error;
            toast.success("GST Number updated");
            setStartGstEdit(false);
        } catch (error) {
            console.error("Failed to update GST", error);
            toast.error("Failed to update GST Number");
        }
    };

    // Auto-Fetch Orders when dialog opens or customer changes
    useEffect(() => {
        if (open && customer) {
            // Fetch orders from Supabase database instead of WooCommerce API
            // This works for all customers (WC, CSV, Guest)
            const fetchOrders = async () => {
                try {
                    setLoadingOrders(true);
                    console.log('[Order Fetch] Customer ID:', customer.id);
                    console.log('[Order Fetch] Customer Email:', customer.email);

                    const { data, error } = await supabase
                        .from('orders')
                        .select('*, order_items(*)')
                        .or(`customer_id.eq.${customer.id}${customer.email ? `,customer_email.ilike.${customer.email}` : ''}`)
                        .order('created_at', { ascending: false });

                    console.log('[Order Fetch] Query Result:', { data, error, count: data?.length });

                    if (error) throw error;

                    // Transform Supabase orders to WCOrder format for compatibility
                    const transformedOrders: WCOrder[] = (data || []).map(order => ({
                        id: order.wc_order_id || 0,
                        number: order.wc_order_number || order.id.slice(0, 8),
                        status: order.status || 'processing',
                        date_created: order.created_at,
                        total: order.total_amount?.toString() || '0',
                        line_items: (order.order_items || []).map((item: any) => ({
                            name: item.product_name,
                            quantity: item.quantity,
                            total: item.line_total?.toString() || '0',
                            total_tax: '0', // Can be calculated if needed
                            sku: '',
                            meta_data: []
                        })),
                        meta_data: [],
                        shipping: {
                            first_name: customer.shipping?.first_name || '',
                            last_name: customer.shipping?.last_name || '',
                            company: customer.shipping?.company || '',
                            address_1: customer.shipping?.address_1 || '',
                            address_2: customer.shipping?.address_2 || '',
                            city: customer.shipping?.city || '',
                            state: customer.shipping?.state || '',
                            postcode: customer.shipping?.postcode || '',
                            country: customer.shipping?.country || ''
                        },
                        billing: customer.billing || {},
                        customer_note: ''
                    }));

                    console.log('[Order Fetch] Transformed Orders:', transformedOrders.length);
                    setOrders(transformedOrders);
                    fetchOrderPaymentStatuses(transformedOrders, customer.id);
                } catch (err) {
                    console.error('[Order Fetch] Error:', err);
                    setOrders([]);
                } finally {
                    setLoadingOrders(false);
                }
            };

            fetchOrders();
        }
    }, [open, customer?.id]);

    const handleSyncHistory = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setLoadingOrders(true);
        try {
            const { data, error } = await supabase.functions.invoke('woocommerce', {
                body: {
                    action: 'sync-customer-history',
                    wc_id: customer?.wc_id,
                    email: customer?.email,
                    phone: customer?.phone,
                    current_db_id: customer?.id
                }
            });

            if (error || !data.success) throw new Error(error?.message || data?.error || 'Sync failed');

            // Better Message Logic
            if (data.healed || (data.new_wc_id && customer && customer.wc_id !== data.new_wc_id)) {
                toast.success('Customer linked to WooCommerce Account! 🔗');
                // Update local view if ID was healed
                setActiveCustomer(prev => prev ? ({ ...prev, wc_id: data.new_wc_id }) : null);
            } else if (data.message.includes('Synced 0')) {
                toast.success('History is up to date.');
            } else {
                toast.success(data.message || 'Orders synced successfully');
            }

            // Refetch orders from database
            const { data: ordersData, error: ordersError } = await supabase
                .from('orders')
                .select('*, order_items(*)')
                .or(`customer_id.eq.${customer?.id}${customer?.email ? `,customer_email.ilike.${customer?.email}` : ''}`)
                .order('created_at', { ascending: false });

            if (!ordersError && ordersData) {
                const transformedOrders: WCOrder[] = ordersData.map(order => ({
                    id: order.wc_order_id || 0,
                    number: order.wc_order_number || order.id.slice(0, 8),
                    status: order.status || 'processing',
                    date_created: order.created_at,
                    total: order.total_amount?.toString() || '0',
                    line_items: (order.order_items || []).map((item: any) => ({
                        name: item.product_name,
                        quantity: item.quantity,
                        total: item.line_total?.toString() || '0',
                        total_tax: '0',
                        sku: '',
                        meta_data: []
                    })),
                    meta_data: [],
                    shipping: {
                        first_name: customer?.shipping?.first_name || '',
                        last_name: customer?.shipping?.last_name || '',
                        company: customer?.shipping?.company || '',
                        address_1: customer?.shipping?.address_1 || '',
                        address_2: customer?.shipping?.address_2 || '',
                        city: customer?.shipping?.city || '',
                        state: customer?.shipping?.state || '',
                        postcode: customer?.shipping?.postcode || '',
                        country: customer?.shipping?.country || ''
                    },
                    billing: customer?.billing || {},
                    customer_note: ''
                }));

                setOrders(transformedOrders);
                if (customer) {
                    fetchOrderPaymentStatuses(transformedOrders, customer.id);
                }
            }

        } catch (err: any) {
            console.error(err);
            toast.error('Sync failed: ' + err.message);
        } finally {
            setLoadingOrders(false);
        }
    };


    // Filtered & Paginated Ledger
    const filteredLedger = ledger.filter(txn => {
        // Mode Filter
        // Credit filter should show all CREDIT transactions (including refunds with negative amounts)
        if (filterMode === 'credit' && txn.transaction_type !== 'CREDIT') return false;
        // Debit filter should show: actual DEBIT transactions + negative CREDIT amounts (refunds)
        if (filterMode === 'debit' && !(txn.transaction_type === 'DEBIT' || (txn.transaction_type === 'CREDIT' && Number(txn.amount) < 0))) return false;

        // Date Filter
        if (dateRange) {
            const txnDate = new Date(txn.created_at).getTime();
            const start = dateRange.start ? new Date(dateRange.start).getTime() : 0;
            const end = dateRange.end ? new Date(dateRange.end).setHours(23, 59, 59, 999) : Infinity;
            if (txnDate < start || txnDate > end) return false;
        }

        // Search Filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const noteMatch = txn.reference_note?.toLowerCase().includes(query);
            const methodMatch = txn.payment_method?.toLowerCase().includes(query);
            const amountMatch = txn.amount.toString().includes(query);
            return noteMatch || methodMatch || amountMatch;
        }

        return true;
    })
        .sort((a, b) => {
            switch (sortBy) {
                case 'date-asc': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                case 'date-desc': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                case 'amount-high': return Number(b.amount) - Number(a.amount);
                case 'amount-low': return Number(a.amount) - Number(b.amount);
                default: return 0;
            }
        });

    const totalPages = Math.ceil(filteredLedger.length / itemsPerPage);
    const paginatedLedger = filteredLedger.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);



    const fetchOrderPaymentStatuses = async (wcOrders: WCOrder[], customerUuid: string) => {
        if (wcOrders.length === 0) return;

        try {
            // 1. Get Supabase UUIDs for these orders (mapping by order_id/number)
            const orderNumbers = wcOrders.map(o => o.number);
            const { data: sbOrders, error } = await supabase
                .from('orders')
                .select('id, order_id')
                .in('order_id', orderNumbers);

            if (error) throw error;
            if (!sbOrders || sbOrders.length === 0) return;

            // 2. Prepare payload for finance service
            // We need to map SB UUID back to WC Order Number later
            const uuidToNumberMap: Record<string, string> = {};
            const batchPayload: { order_id: string; total: number; customer_id: string }[] = [];

            sbOrders.forEach(sbOrder => {
                const wcOrder = wcOrders.find(o => o.number === sbOrder.order_id);
                if (wcOrder) {
                    uuidToNumberMap[sbOrder.id] = sbOrder.order_id;
                    batchPayload.push({
                        order_id: sbOrder.id,
                        total: parseFloat(wcOrder.total),
                        customer_id: customerUuid
                    });
                }
            });

            // 3. Fetch Statuses
            const statusMapUuid = await financeService.getBatchOrderPaymentStatus(batchPayload);

            // 4. Map back to Order Number
            const finalMap: Record<string, OrderPaymentStatus> = {};
            Object.entries(statusMapUuid).forEach(([uuid, status]) => {
                const orderNum = uuidToNumberMap[uuid];
                if (orderNum) {
                    finalMap[orderNum] = status;
                }
            });

            setPaymentStatusMap(finalMap);

        } catch (err) {
            console.error("Failed to fetch order payment statuses", err);
        }
    };

    const fetchFinanceData = async () => {
        if (!customer?.id) return;
        setLoadingFinance(true);
        try {
            const [ledgerData, balanceData] = await Promise.all([
                financeService.getCustomerLedger(customer.id),
                financeService.getCustomerBalance(customer.id)
            ]);
            setLedger(ledgerData);
            setBalance(balanceData);

            // Re-calc order statuses if we have orders loaded
            if (orders && orders.length > 0) {
                fetchOrderPaymentStatuses(orders, customer.id);
            }
        } catch (error) {
            console.error("Failed to fetch finance data", error);
        } finally {
            setLoadingFinance(false);
        }
    };

    useEffect(() => {
        if (open && customer?.id) {

            // Only fetch orders if we have a WC ID
            if (customer.wc_id) {
                setLoadingOrders(true);
                fetchCustomerOrders(customer.wc_id)
                    .then(fetchedOrders => {
                        setOrders(fetchedOrders);
                        // Fetch payment statuses once orders are loaded
                        fetchOrderPaymentStatuses(fetchedOrders, customer.id);
                    })
                    .catch(err => {
                        console.error("Failed to fetch orders", err);
                        toast.error("Could not load order history");
                    })
                    .finally(() => setLoadingOrders(false));
            }

            fetchFinanceData();

            // Realtime subscription for this specific customer's payments
            const channel = supabase
                .channel(`ledger-${customer.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'payment_ledger',
                        filter: `customer_id=eq.${customer.id}`
                    },
                    (payload) => {
                        console.log('Payment update received:', payload);
                        fetchFinanceData();
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [open, customer]);

    const handleSaveProfile = async () => {
        if (!customer?.id || !editForm) return;
        try {
            const { error } = await supabase
                .from('wc_customers')
                .update({
                    billing: editForm.billing,
                    shipping: editForm.shipping
                })
                .eq('id', customer.id);

            if (error) throw error;

            setActiveCustomer(prev => prev ? ({ ...prev, billing: editForm.billing, shipping: editForm.shipping }) : null);
            setIsEditingProfile(false);
            toast.success("Profile updated successfully");
        } catch (err) {
            console.error("Failed to update profile", err);
            toast.error("Failed to update profile");
        }
    };

    if (!activeCustomer) return null;
    const displayCustomer = activeCustomer;

    const copyToClipboard = (text: string, label: string) => {
        if (!text) return;
        if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                toast.success(`${label} copied!`);
            }).catch(err => {
                console.error('Failed to copy', err);
                toast.error(`Failed to copy ${label}`);
            });
        } else {
            // Fallback for non-secure contexts
            try {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand("copy");
                document.body.removeChild(textArea);
                toast.success(`${label} copied!`);
            } catch (err) {
                console.error('Fallback copy failed', err);
            }
        }
    };

    // Derived Stats (Real-time from fetched orders)
    const realtimeTotalOrders = orders ? orders.length : 0;
    const realtimeTotalSpent = orders ? orders.reduce((sum, order) => sum + (parseFloat(order.total) || 0), 0) : 0;

    // Fallback to customer string data if orders haven't loaded yet, or strictly use orders if loaded
    const displayTotalOrders = orders ? realtimeTotalOrders : (displayCustomer.orders_count || 0);
    const displayTotalSpent = orders ? realtimeTotalSpent : (displayCustomer.total_spent ? Number(displayCustomer.total_spent) : 0);

    // Calculate Average
    const avgOrderValue = displayTotalOrders > 0 ? (displayTotalSpent / displayTotalOrders).toFixed(2) : "0.00";

    // Display Name Logic
    const displayName = (displayCustomer.first_name || displayCustomer.last_name)
        ? [displayCustomer.first_name, displayCustomer.last_name].filter(Boolean).join(' ').trim()
        : (displayCustomer.email.split('@')[0] || 'Guest Customer');

    const addressString = [displayCustomer.billing?.city, displayCustomer.billing?.country].filter(Boolean).join(', ') || 'No location';

    // Recent products (simple extraction)
    const recentProducts = (orders || []).slice(0, 5).flatMap(o => o.line_items).slice(0, 5);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] sm:max-w-6xl h-[100vh] sm:h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-slate-50 dark:bg-slate-950 border-none shadow-2xl rounded-none sm:rounded-2xl ring-1 ring-slate-900/5 [&>button]:hidden">
                <DialogTitle className="sr-only">Customer Details: {displayName}</DialogTitle>

                {/* Header Section */}
                <div className="bg-white dark:bg-slate-900 border-b shrink-0 relative overflow-hidden">
                    {/* Background Decor */}

                    <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3 pointer-events-none" />

                    <button
                        onClick={() => onOpenChange(false)}
                        className="absolute right-3 top-3 sm:right-6 sm:top-6 z-50 p-2 rounded-full bg-slate-100/50 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                        aria-label="Close"
                    >
                        <X className="h-5 w-5" />
                    </button>


                    <div className="p-4 sm:p-8 relative z-10">
                        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-10">

                            {/* Avatar Section - Cleaned up */}
                            <div className="flex-shrink-0 relative group">
                                <Avatar className="h-24 w-24 sm:h-28 sm:w-28 md:h-32 md:w-32 border-4 border-white dark:border-slate-800 shadow-xl ring-1 ring-slate-100 dark:ring-slate-700 transition-transform duration-500 group-hover:scale-105">
                                    <AvatarImage src={customer.avatar_url} className="object-cover" />
                                    <AvatarFallback className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-3xl sm:text-4xl md:text-5xl font-bold">
                                        {(customer.first_name?.[0] || customer.email?.[0] || '?').toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                {/* WC Badge Removed Per Request */}
                            </div>

                            {/* Info Section - Tighter layout */}
                            <div className="flex-1 min-w-0 flex flex-col items-center md:items-start text-center md:text-left w-full space-y-4">
                                <div className="flex flex-col gap-2 w-full">
                                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate w-full">
                                        {displayName}
                                    </h2>

                                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm sm:text-base">
                                        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                                            <MapPin className="h-4 w-4 shrink-0" />
                                            <span className="truncate max-w-[200px] sm:max-w-md">{addressString}</span>
                                        </div>

                                        {/* GST Section */}
                                        <div className="flex items-center">
                                            {startGstEdit ? (
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        className="h-7 w-32 px-2 text-xs border rounded bg-slate-50 dark:bg-slate-800 focus:ring-2 ring-blue-500/20 outline-none"
                                                        value={gstNumber}
                                                        onChange={e => setGstNumber(e.target.value)}
                                                        placeholder="GSTIN"
                                                        autoFocus
                                                    />
                                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={handleUpdateGst}><Check className="h-3.5 w-3.5" /></Button>
                                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => setStartGstEdit(false)}><X className="h-3.5 w-3.5" /></Button>
                                                </div>
                                            ) : (
                                                <Badge
                                                    variant="secondary"
                                                    className="bg-purple-50/80 text-purple-700 border-purple-100 hover:bg-purple-100 cursor-pointer h-6 px-2.5 font-medium transition-colors"
                                                    onClick={() => setStartGstEdit(true)}
                                                >
                                                    {gstNumber ? `GST: ${gstNumber}` : '+ Add GST'}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    {/* Contact Chips */}
                                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1">
                                        {customer.email && (
                                            <div
                                                className="group flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100/50 dark:bg-slate-800/50 px-3 py-1.5 rounded-full cursor-pointer hover:bg-white hover:shadow-sm hover:text-blue-600 dark:hover:bg-slate-700 dark:hover:text-blue-400 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                                                onClick={() => copyToClipboard(displayCustomer.email, "Email")}
                                            >
                                                <Mail className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-500" />
                                                <span className="truncate max-w-[200px]">{displayCustomer.email}</span>
                                            </div>
                                        )}
                                        {displayCustomer.phone && (
                                            <div
                                                className="group flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100/50 dark:bg-slate-800/50 px-3 py-1.5 rounded-full cursor-pointer hover:bg-white hover:shadow-sm hover:text-emerald-600 dark:hover:bg-slate-700 dark:hover:text-emerald-400 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                                                onClick={() => copyToClipboard(displayCustomer.phone, "Phone")}
                                            >
                                                <Phone className="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-500" />
                                                {displayCustomer.phone}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Financial Stats Row - Enhanced & overflow fixed */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 w-full pt-4">
                                    {/* Paid Card */}
                                    <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-3 sm:p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/20 flex flex-col items-center md:items-start text-center md:text-left hover:shadow-md transition-all">
                                        <p className="text-[10px] sm:text-xs text-emerald-600/80 font-bold uppercase tracking-wider mb-1">Total Paid</p>
                                        <p className="text-lg sm:text-xl md:text-2xl font-bold text-emerald-700 dark:text-emerald-400 tracking-tight truncate w-full" title={`₹${balance.total_paid.toLocaleString()}`}>
                                            ₹{balance.total_paid.toLocaleString()}
                                        </p>
                                    </div>

                                    {/* Orders Card */}
                                    <div className="bg-blue-50/50 dark:bg-blue-900/10 p-3 sm:p-4 rounded-xl border border-blue-100 dark:border-blue-900/20 flex flex-col items-center md:items-start text-center md:text-left hover:shadow-md transition-all relative group">
                                        <p className="text-[10px] sm:text-xs text-blue-600/80 font-bold uppercase tracking-wider mb-1">Total Orders</p>
                                        <p className="text-lg sm:text-xl md:text-2xl font-bold text-blue-700 dark:text-blue-400 tracking-tight">{displayTotalOrders}</p>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="absolute top-2 right-2 h-6 w-6 text-blue-400 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 opacity-0 group-hover:opacity-100 transition-opacity"
                                            disabled={loadingOrders}
                                            onClick={handleSyncHistory}
                                        >
                                            <RefreshCw className={`h-3.5 w-3.5 ${loadingOrders ? 'animate-spin' : ''}`} />
                                            <span className="sr-only">Sync History</span>
                                        </Button>
                                    </div>

                                    {/* Spent Card */}
                                    <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-3 sm:p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/20 flex flex-col items-center md:items-start text-center md:text-left hover:shadow-md transition-all">
                                        <p className="text-[10px] sm:text-xs text-indigo-600/80 font-bold uppercase tracking-wider mb-1">Lifetime Spent</p>
                                        <p className="text-lg sm:text-xl md:text-2xl font-bold text-indigo-700 dark:text-indigo-400 tracking-tight truncate w-full" title={`₹${displayTotalSpent.toLocaleString()}`}>
                                            ₹{displayTotalSpent.toLocaleString()}
                                        </p>
                                    </div>

                                    {/* Wallet/Due Card */}
                                    <div className={`p-3 sm:p-4 rounded-xl border flex flex-col items-center md:items-start text-center md:text-left hover:shadow-md transition-all ${balance.balance >= 0 ? 'bg-teal-50/50 border-teal-100 dark:bg-teal-900/10 dark:border-teal-900/20' : 'bg-red-50/50 border-red-100 dark:bg-red-900/10 dark:border-red-900/20'}`}>
                                        <p className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1 ${balance.balance >= 0 ? 'text-teal-600/80' : 'text-red-600/80'}`}>
                                            {balance.balance >= 0 ? 'Wallet Balance' : 'Payment Due'}
                                        </p>
                                        <p className={`text-lg sm:text-xl md:text-2xl font-bold tracking-tight truncate w-full ${balance.balance >= 0 ? 'text-teal-700 dark:text-teal-400' : 'text-red-700 dark:text-red-400'}`} title={`₹${Math.abs(balance.balance).toLocaleString()}`}>
                                            ₹{Math.abs(balance.balance).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs Section */}
                <Tabs value={activeTab} className="flex-1 flex flex-col min-h-0 overflow-hidden"
                    onValueChange={(val) => {
                        setActiveTab(val);
                        if (val === 'ledger') fetchFinanceData();
                    }}
                >
                    <div className="px-6 bg-white dark:bg-slate-900 border-b overflow-x-auto no-scrollbar shrink-0">
                        <TabsList className="w-full justify-start h-auto p-0 bg-transparent space-x-6">
                            <TabsTrigger value="overview" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-1 py-3 text-slate-500 data-[state=active]:text-blue-600 font-medium transition-all whitespace-nowrap">Overview</TabsTrigger>
                            <TabsTrigger value="ledger" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-1 py-3 text-slate-500 data-[state=active]:text-blue-600 font-medium transition-all whitespace-nowrap">Ledger & Payments</TabsTrigger>
                            <TabsTrigger value="orders" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-1 py-3 text-slate-500 data-[state=active]:text-blue-600 font-medium transition-all whitespace-nowrap">Order History</TabsTrigger>
                        </TabsList>
                    </div>

                    {/* Sticky Header for Ledger Tab - Outside Scroll Area */}
                    {activeTab === 'ledger' && (
                        <div className="bg-white dark:bg-slate-950 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800/60 px-4 sm:px-6 py-2.5 sm:py-3 shadow-sm shrink-0">
                            {/* Single Row: Filters + Search + Add Payment */}
                            <div className="flex flex-wrap items-center gap-2 justify-between">
                                {/* Left: Filter Badges */}
                                <div className="flex items-center p-0.5 sm:p-1 bg-slate-100/80 dark:bg-slate-800/80 rounded-lg sm:rounded-xl border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-md">
                                    {['all', 'credit', 'debit'].map((mode) => (
                                        <button
                                            key={mode}
                                            onClick={() => setFilterMode(mode as any)}
                                            className={`px-4 py-1.5 sm:px-5 sm:py-2 text-xs sm:text-sm font-semibold rounded-md sm:rounded-lg transition-all duration-300 ${filterMode === mode
                                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm ring-1 ring-black/5 dark:ring-white/5'
                                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                                }`}
                                        >
                                            {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                        </button>
                                    ))}
                                </div>

                                {/* Date Range - Hide on Mobile */}
                                <div className="hidden md:flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <input
                                        type="date"
                                        className="bg-transparent text-xs p-1.5 focus:outline-none dark:text-slate-200 w-24"
                                        value={dateRange?.start || ''}
                                        onChange={e => setDateRange(prev => ({ start: e.target.value, end: prev?.end || '' }))}
                                    />
                                    <span className="text-slate-400 text-[10px]">TO</span>
                                    <input
                                        type="date"
                                        className="bg-transparent text-xs p-1.5 focus:outline-none dark:text-slate-200 w-24"
                                        value={dateRange?.end || ''}
                                        onChange={e => setDateRange(prev => ({ start: prev?.start || '', end: e.target.value }))}
                                    />
                                    {(dateRange?.start || dateRange?.end) && (
                                        <button onClick={() => setDateRange(null)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                                            <X className="h-3 w-3 text-slate-500" />
                                        </button>
                                    )}
                                </div>

                                <Button
                                    onClick={() => setPaymentDialogOpen(true)}
                                    size="sm"
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-200 dark:shadow-none rounded-lg sm:rounded-xl px-3 sm:px-4 h-9 sm:h-10 text-xs sm:text-sm font-semibold shrink-0"
                                >
                                    <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                                    <span className="hidden sm:inline">Add Payment</span>
                                    <span className="sm:hidden">Add</span>
                                </Button>

                                {/* Search - Right Side */}
                                <div className="relative w-full sm:w-48">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 sm:h-3.5 sm:w-3.5 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="h-9 sm:h-10 w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 pl-8 sm:pl-9 text-xs sm:text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:focus-visible:ring-slate-300"
                                    />
                                </div>
                            </div>

                            {/* Transaction History Title - Below Filters */}
                            <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-slate-200/60 dark:border-slate-800/60">
                                <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                    <CreditCard className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-slate-600 dark:text-slate-400" />
                                </div>
                                <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">Transaction History</h3>
                                <span className="text-[9px] sm:text-[10px] text-slate-500">({paginatedLedger.length} of {filteredLedger.length})</span>
                            </div>
                        </div>
                    )}



                    <div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/50 p-0">
                        <TabsContent value="overview" className="mt-0 space-y-6 px-3 py-4 sm:px-6 sm:pb-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
                            {/* Edit Profile Toggle */}
                            <div className="flex justify-between items-center">
                                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Profile Details</h3>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        if (isEditingProfile) {
                                            handleSaveProfile();
                                        } else {
                                            setIsEditingProfile(true);
                                        }
                                    }}
                                    className={`h-7 text-xs gap-1.5 ${isEditingProfile ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' : ''}`}
                                >
                                    {isEditingProfile ? <Check className="h-3 w-3" /> : <Edit2 className="h-3 w-3" />}
                                    {isEditingProfile ? 'Save Changes' : 'Edit Details'}
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Billing Address Card */}
                                <Card className="shadow-sm border-slate-200 dark:border-slate-800">
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center gap-2 text-slate-500">
                                            <CreditCard className="h-4 w-4" />
                                            <CardTitle className="text-base font-semibold">Billing Address</CardTitle>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        {isEditingProfile ? (
                                            <div className="space-y-2">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <input className="text-xs p-1.5 border rounded bg-white dark:bg-slate-900" placeholder="First Name" value={editForm.billing?.first_name || ''} onChange={(e) => setEditForm(prev => ({ ...prev, billing: { ...prev.billing, first_name: e.target.value } }))} />
                                                    <input className="text-xs p-1.5 border rounded bg-white dark:bg-slate-900" placeholder="Last Name" value={editForm.billing?.last_name || ''} onChange={(e) => setEditForm(prev => ({ ...prev, billing: { ...prev.billing, last_name: e.target.value } }))} />
                                                </div>
                                                <input className="w-full text-xs p-1.5 border rounded bg-white dark:bg-slate-900" placeholder="Company" value={editForm.billing?.company || ''} onChange={(e) => setEditForm(prev => ({ ...prev, billing: { ...prev.billing, company: e.target.value } }))} />
                                                <input className="w-full text-xs p-1.5 border rounded bg-white dark:bg-slate-900" placeholder="Address 1" value={editForm.billing?.address_1 || ''} onChange={(e) => setEditForm(prev => ({ ...prev, billing: { ...prev.billing, address_1: e.target.value } }))} />
                                                <input className="w-full text-xs p-1.5 border rounded bg-white dark:bg-slate-900" placeholder="Address 2" value={editForm.billing?.address_2 || ''} onChange={(e) => setEditForm(prev => ({ ...prev, billing: { ...prev.billing, address_2: e.target.value } }))} />
                                                <div className="grid grid-cols-2 gap-2">
                                                    <input className="text-xs p-1.5 border rounded bg-white dark:bg-slate-900" placeholder="City" value={editForm.billing?.city || ''} onChange={(e) => setEditForm(prev => ({ ...prev, billing: { ...prev.billing, city: e.target.value } }))} />
                                                    <input className="text-xs p-1.5 border rounded bg-white dark:bg-slate-900" placeholder="State" value={editForm.billing?.state || ''} onChange={(e) => setEditForm(prev => ({ ...prev, billing: { ...prev.billing, state: e.target.value } }))} />
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <input className="text-xs p-1.5 border rounded bg-white dark:bg-slate-900" placeholder="Postcode" value={editForm.billing?.postcode || ''} onChange={(e) => setEditForm(prev => ({ ...prev, billing: { ...prev.billing, postcode: e.target.value } }))} />
                                                    <input className="text-xs p-1.5 border rounded bg-white dark:bg-slate-900" placeholder="Phone" value={editForm.billing?.phone || ''} onChange={(e) => setEditForm(prev => ({ ...prev, billing: { ...prev.billing, phone: e.target.value } }))} />
                                                </div>
                                                <input className="w-full text-xs p-1.5 border rounded bg-white dark:bg-slate-900" placeholder="Email" value={editForm.billing?.email || ''} onChange={(e) => setEditForm(prev => ({ ...prev, billing: { ...prev.billing, email: e.target.value } }))} />
                                            </div>
                                        ) : (
                                            <div
                                                className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900 p-3 rounded-md border border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors group relative"
                                                onClick={() => {
                                                    const text = [
                                                        customer.billing?.first_name ? `${customer.billing.first_name} ${customer.billing.last_name || ''}` : '',
                                                        customer.billing?.company,
                                                        customer.billing?.address_1,
                                                        customer.billing?.city,
                                                        customer.billing?.state,
                                                        customer.billing?.postcode
                                                    ].filter(Boolean).join(', ');
                                                    copyToClipboard(text, "Billing Address");
                                                }}
                                            >
                                                <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Copy className="h-3 w-3 text-slate-400" />
                                                </div>
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
                                        )}
                                        {!isEditingProfile && (
                                            <div className="mt-3 space-y-1">
                                                {customer.billing?.email && (
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground group cursor-pointer hover:text-blue-600" onClick={() => copyToClipboard(customer.billing.email, "Billing Email")}>
                                                        <Mail className="h-3 w-3" /> {customer.billing.email} <Copy className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 ml-auto" />
                                                    </div>
                                                )}
                                                {customer.billing?.phone && (
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground group cursor-pointer hover:text-blue-600" onClick={() => copyToClipboard(customer.billing.phone, "Billing Phone")}>
                                                        <Phone className="h-3 w-3" /> {customer.billing.phone} <Copy className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 ml-auto" />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Shipping Address Card */}
                                <Card className="shadow-sm border-slate-200 dark:border-slate-800">
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center gap-2 text-slate-500">
                                            <Truck className="h-4 w-4" />
                                            <CardTitle className="text-base font-semibold">Shipping Address</CardTitle>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        {isEditingProfile ? (
                                            <div className="space-y-2">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <input className="text-xs p-1.5 border rounded bg-white dark:bg-slate-900" placeholder="First Name" value={editForm.shipping?.first_name || ''} onChange={(e) => setEditForm(prev => ({ ...prev, shipping: { ...prev.shipping, first_name: e.target.value } }))} />
                                                    <input className="text-xs p-1.5 border rounded bg-white dark:bg-slate-900" placeholder="Last Name" value={editForm.shipping?.last_name || ''} onChange={(e) => setEditForm(prev => ({ ...prev, shipping: { ...prev.shipping, last_name: e.target.value } }))} />
                                                </div>
                                                <input className="w-full text-xs p-1.5 border rounded bg-white dark:bg-slate-900" placeholder="Company" value={editForm.shipping?.company || ''} onChange={(e) => setEditForm(prev => ({ ...prev, shipping: { ...prev.shipping, company: e.target.value } }))} />
                                                <input className="w-full text-xs p-1.5 border rounded bg-white dark:bg-slate-900" placeholder="Address 1" value={editForm.shipping?.address_1 || ''} onChange={(e) => setEditForm(prev => ({ ...prev, shipping: { ...prev.shipping, address_1: e.target.value } }))} />
                                                <input className="w-full text-xs p-1.5 border rounded bg-white dark:bg-slate-900" placeholder="Address 2" value={editForm.shipping?.address_2 || ''} onChange={(e) => setEditForm(prev => ({ ...prev, shipping: { ...prev.shipping, address_2: e.target.value } }))} />
                                                <div className="grid grid-cols-2 gap-2">
                                                    <input className="text-xs p-1.5 border rounded bg-white dark:bg-slate-900" placeholder="City" value={editForm.shipping?.city || ''} onChange={(e) => setEditForm(prev => ({ ...prev, shipping: { ...prev.shipping, city: e.target.value } }))} />
                                                    <input className="text-xs p-1.5 border rounded bg-white dark:bg-slate-900" placeholder="State" value={editForm.shipping?.state || ''} onChange={(e) => setEditForm(prev => ({ ...prev, shipping: { ...prev.shipping, state: e.target.value } }))} />
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <input className="text-xs p-1.5 border rounded bg-white dark:bg-slate-900" placeholder="Postcode" value={editForm.shipping?.postcode || ''} onChange={(e) => setEditForm(prev => ({ ...prev, shipping: { ...prev.shipping, postcode: e.target.value } }))} />
                                                    <input className="text-xs p-1.5 border rounded bg-white dark:bg-slate-900" placeholder="Country" value={editForm.shipping?.country || ''} onChange={(e) => setEditForm(prev => ({ ...prev, shipping: { ...prev.shipping, country: e.target.value } }))} />
                                                </div>
                                            </div>
                                        ) : (
                                            <div
                                                className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900 p-3 rounded-md border border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors group relative"
                                                onClick={() => {
                                                    const text = [
                                                        customer.shipping?.first_name ? `${customer.shipping.first_name} ${customer.shipping.last_name || ''}` : '',
                                                        customer.shipping?.company,
                                                        customer.shipping?.address_1,
                                                        customer.shipping?.city,
                                                        customer.shipping?.state,
                                                        customer.shipping?.postcode
                                                    ].filter(Boolean).join(', ');
                                                    copyToClipboard(text, "Shipping Address");
                                                }}
                                            >
                                                <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Copy className="h-3 w-3 text-slate-400" />
                                                </div>
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
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Enhanced Customer Insights */}
                            <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-visible z-10">
                                <CardHeader className="bg-slate-50/50 dark:bg-slate-900/20 border-b border-slate-100 dark:border-slate-800 pb-3">
                                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                                        <TrendingUp className="h-4 w-4 text-indigo-500" /> Customer Insights
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 sm:p-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                                        {/* Insight Card 1: AOV & Frequency */}
                                        <div className="bg-indigo-50 dark:bg-indigo-950/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30 flex flex-col justify-between relative overflow-hidden group">
                                            <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-indigo-500/10 transition-colors" />
                                            <div>
                                                <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider mb-1">Avg Order Value</p>
                                                <p className="text-2xl font-bold text-indigo-900 dark:text-indigo-100">₹{avgOrderValue}</p>
                                            </div>

                                            {orders && orders.length > 1 && (
                                                <div className="mt-3 pt-3 border-t border-indigo-200 dark:border-indigo-800/50">
                                                    <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider mb-0.5">Purchase Frequency</p>
                                                    <p className="text-xs font-medium text-indigo-800 dark:text-indigo-200">
                                                        {(() => {
                                                            const first = new Date(orders[orders.length - 1].date_created).getTime();
                                                            const last = new Date(orders[0]?.date_created || new Date()).getTime();
                                                            const diffDays = (last - first) / (1000 * 60 * 60 * 24);
                                                            const freq = diffDays / orders.length;
                                                            return `Every ~${Math.round(freq)} days`;
                                                        })()}
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Insight Card 2: Loyalty Tier */}
                                        <div className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 p-4 rounded-xl border border-slate-700 shadow-lg flex flex-col justify-between text-white relative overflow-hidden">
                                            {/* Tier Background Effect */}
                                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>

                                            {(() => {
                                                const spent = displayTotalSpent;
                                                let tier = "Bronze";
                                                let nextTier = "Silver";
                                                let progress = 0;
                                                let color = "text-orange-300";
                                                let icon = CreditCard;

                                                if (spent > 50000) {
                                                    tier = "Gold"; nextTier = "Diamond"; progress = 100; color = "text-yellow-400";
                                                } else if (spent > 20000) {
                                                    tier = "Silver"; nextTier = "Gold"; progress = ((spent - 20000) / 30000) * 100; color = "text-slate-300";
                                                } else {
                                                    progress = (spent / 20000) * 100;
                                                }

                                                return (
                                                    <div className="relative z-10 h-full flex flex-col justify-between">
                                                        <div>
                                                            <div className="flex items-center justify-between">
                                                                <p className="text-[10px] text-slate-300 font-bold uppercase tracking-wider mb-1">Loyalty Tier</p>
                                                                {tier === 'Gold' && <Badge className="bg-yellow-400/20 text-yellow-300 border-yellow-400/50">High Value</Badge>}
                                                            </div>
                                                            <p className={`text-2xl font-bold ${color} drop-shadow-sm`}>{tier} Member</p>
                                                        </div>

                                                        <div className="mt-3">
                                                            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                                                <span>Progress to {nextTier}</span>
                                                                <span>{Math.min(100, Math.round(progress))}%</span>
                                                            </div>
                                                            <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                                                                <div className={`h-full rounded-full transition-all duration-1000 ${tier === 'Gold' ? 'bg-yellow-400' : tier === 'Silver' ? 'bg-slate-300' : 'bg-orange-400'}`} style={{ width: `${progress}%` }} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                        {/* Insight Card 3: Activity & Recency */}
                                        <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30 flex flex-col justify-between">
                                            <div>
                                                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider mb-1">Status</p>
                                                <div className="flex flex-wrap gap-2 mt-1">
                                                    {orders && orders.length > 0 && (() => {
                                                        const lastOrderDate = new Date(orders[0].date_created || new Date());
                                                        const daysSince = Math.floor((new Date().getTime() - lastOrderDate.getTime()) / (1000 * 3600 * 24));

                                                        return (
                                                            <>
                                                                {daysSince < 30 ? (
                                                                    <Badge className="bg-emerald-500 hover:bg-emerald-600 border-none shadow-sm">Active Recently</Badge>
                                                                ) : daysSince < 90 ? (
                                                                    <Badge className="bg-amber-500 hover:bg-amber-600 border-none shadow-sm">Dormant</Badge>
                                                                ) : (
                                                                    <Badge className="bg-red-500 hover:bg-red-600 border-none shadow-sm">Inactive</Badge>
                                                                )}
                                                            </>
                                                        )
                                                    })()}
                                                </div>
                                            </div>
                                            <div className="mt-3 text-xs text-emerald-800 dark:text-emerald-200">
                                                {orders && orders.length > 0 ? (
                                                    <span className="flex items-center gap-1.5">
                                                        <Calendar className="h-3.5 w-3.5 opacity-70" />
                                                        Last Order: {Math.floor((new Date().getTime() - new Date(orders[0]?.date_created || new Date()).getTime()) / (1000 * 3600 * 24))} days ago
                                                    </span>
                                                ) : <span className="italic opacity-70">No orders yet</span>}
                                            </div>
                                        </div>

                                        {/* Insight Card 4: Top Product */}
                                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Top Favorites</p>
                                                <Package className="h-3 w-3 text-slate-400" />
                                            </div>

                                            {orders && orders.length > 0 ? (
                                                <div className="space-y-2">
                                                    {/* Frequency map logic */}
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
                                                                <div key={idx} className="flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800 last:border-0 pb-1.5 last:pb-0">
                                                                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate pr-2 max-w-[120px]" title={name}>{name}</span>
                                                                    <Badge variant="secondary" className="h-4 px-1 text-[9px]">{count}</Badge>
                                                                </div>
                                                            ))
                                                        ) : <p className="text-xs text-slate-400">No product data</p>
                                                    })()}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-slate-400 italic mt-1">Order history needed</p>
                                            )}
                                        </div>

                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="ledger" className="mt-0 p-0 overflow-visible data-[state=inactive]:hidden custom-h-full">
                            <div className="flex flex-col h-full px-3 py-4 sm:px-6 sm:pb-6">
                                <Card className="shadow-none border-0 flex-1 flex flex-col min-h-0">
                                    <CardContent className="p-0">
                                        {paginatedLedger.length === 0 ? (
                                            <div className="text-center py-12 text-muted-foreground bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
                                                <CreditCard className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                                                <p className="font-medium">No transactions found</p>
                                                <p className="text-sm mt-1">Try adjusting your filters or search.</p>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                                    {paginatedLedger.map((txn) => {
                                                        const isCredit = txn.transaction_type === 'CREDIT';
                                                        const isRefund = isCredit && Number(txn.amount) < 0;

                                                        // Icon Logic
                                                        let Icon = isCredit ? ArrowUpRight : ShoppingBag;
                                                        let iconBg = isCredit ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-orange-100 dark:bg-orange-900/30';
                                                        let iconColor = isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400';

                                                        // Override for refunds (negative CREDIT amounts)
                                                        if (isRefund) {
                                                            iconBg = 'bg-red-100 dark:bg-red-900/30';
                                                            iconColor = 'text-red-600 dark:text-red-400';
                                                        } else if (isCredit) {
                                                            if (txn.payment_method === 'cash') { Icon = Banknote; iconBg = 'bg-green-100 dark:bg-green-900/30'; iconColor = 'text-green-600 dark:text-green-400'; }
                                                            if (txn.payment_method === 'upi') { Icon = Smartphone; iconBg = 'bg-purple-100 dark:bg-purple-900/30'; iconColor = 'text-purple-600 dark:text-purple-400'; }
                                                            if (txn.payment_method === 'online') { Icon = Globe; iconBg = 'bg-blue-100 dark:bg-blue-900/30'; iconColor = 'text-blue-600 dark:text-blue-400'; }
                                                        }

                                                        return (
                                                            <div key={txn.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors group border-b border-slate-100 dark:border-slate-800 last:border-0">
                                                                <div className="flex items-start sm:items-center gap-3 sm:gap-4">
                                                                    <div className={`h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 ${iconBg} ${iconColor} shadow-sm border border-black/5 dark:border-white/5`}>
                                                                        <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                                                                    </div>
                                                                    <div>
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                            <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">
                                                                                {isRefund ? (
                                                                                    <span className="text-red-600 dark:text-red-400">Refund</span>
                                                                                ) : isCredit ? (
                                                                                    <span>Received via <span className="capitalize">{txn.payment_method?.replace(/_/g, ' ') || 'Payment'}</span></span>
                                                                                ) : (
                                                                                    <span className="text-orange-600 dark:text-orange-400">Used for Order</span>
                                                                                )}
                                                                            </p>
                                                                            {txn.order_id && (
                                                                                <Badge variant="outline" className="h-4 sm:h-5 px-1 sm:px-1.5 text-[9px] sm:text-[10px] bg-slate-50 dark:bg-slate-900 text-slate-500 font-normal">
                                                                                    Order #{txn.order_id.slice(0, 8)}
                                                                                </Badge>
                                                                            )}
                                                                        </div>
                                                                        <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1 sm:gap-1.5">
                                                                            <Calendar className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                                                            {format(new Date(txn.created_at), "dd MMM yyyy")}
                                                                            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                                                                            {format(new Date(txn.created_at), "hh:mm a")}
                                                                        </p>
                                                                        {txn.reference_note && (
                                                                            <p className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-300 mt-1 sm:mt-1.5 bg-slate-100 dark:bg-slate-800 px-1.5 sm:px-2 py-0.5 rounded inline-block">
                                                                                {txn.reference_note}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="mt-2 sm:mt-0 text-right pl-11 sm:pl-0">
                                                                    <p className={`text-base sm:text-lg font-bold tabular-nums tracking-tight ${isRefund ? 'text-red-600 dark:text-red-400' :
                                                                        isCredit ? 'text-emerald-600 dark:text-emerald-400' :
                                                                            'text-orange-600 dark:text-orange-400'
                                                                        }`}>
                                                                        {isRefund ? '-' : isCredit ? '+' : '-'} ₹{Math.abs(Number(txn.amount)).toLocaleString()}
                                                                    </p>
                                                                    <p className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-medium tracking-wider mt-0.5">
                                                                        {isRefund ? 'Refund' : isCredit ? 'Credit' : 'Debit'}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>

                                                {/* Pagination Footer */}
                                                {totalPages > 1 && (
                                                    <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
                                                        <div className="text-xs text-slate-500">
                                                            Page {currentPage} of {totalPages}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                                disabled={currentPage === 1}
                                                                className="h-8 px-3 text-xs"
                                                            >
                                                                Previous
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                                disabled={currentPage === totalPages}
                                                                className="h-8 px-3 text-xs"
                                                            >
                                                                Next
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        <TabsContent value="orders" className="mt-0 p-0 overflow-visible data-[state=inactive]:hidden custom-h-full">
                            <div className="flex flex-col justify-start h-full min-h-0 px-3 pb-4 pt-0 sm:px-6">
                                {/* ... Existing Order History ... */}
                                {loadingOrders ? (
                                    <div className="space-y-4">
                                        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-white dark:bg-slate-900 animate-pulse rounded-lg border border-slate-200 dark:border-slate-800" />)}
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {orders?.map((order) => (
                                            <CollapsibleOrderCard
                                                key={order.id}
                                                order={order}
                                                paymentStatus={paymentStatusMap[order.number]}
                                            />
                                        ))}
                                        {orders?.length === 0 && (
                                            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground bg-white dark:bg-slate-900 rounded-lg border border-dashed border-slate-300 dark:border-slate-700">
                                                <ShoppingBag className="h-10 w-10 opacity-20 mb-3" />
                                                <p className="font-medium">No orders found</p>
                                                <p className="text-sm">This customer hasn't placed any orders yet.</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </TabsContent>
                    </div>
                </Tabs >
            </DialogContent >

            <AddPaymentDialog
                open={paymentDialogOpen}
                onOpenChange={setPaymentDialogOpen}
                customerId={customer.id}
                customerName={displayName}
                orders={orders}
                onSuccess={() => {
                    fetchFinanceData();
                    toast.success("Payment recorded and balance updated");
                }}
            />
        </Dialog >
    );
}

function CollapsibleOrderCard({ order, paymentStatus }: { order: WCOrder, paymentStatus?: OrderPaymentStatus }) {
    const [isOpen, setIsOpen] = useState(false);

    // Filter out internal meta keys (start with _)
    const getVisibleMeta = (metaData: any[]) => {
        if (!metaData || !Array.isArray(metaData)) return [];
        // Show everything except strict internal keys if user insists they are missing info
        return metaData.filter(m => m.key && !m.key.startsWith('_'));
    };

    const orderTotal = parseFloat(order.total);
    // Calculate paid/pending using logic from finance service if available, else standard WC total
    const paidAmount = paymentStatus?.paid_amount ?? 0;
    const pendingAmount = paymentStatus?.pending_amount ?? orderTotal;

    // Logic for Status:
    // If pending == 0 -> Fully Paid (Green)
    // If paid > 0 but pending > 0 -> Partially Paid (Yellow)
    // If paid == 0 -> Unpaid (Red)

    const isFullyPaid = pendingAmount <= 1.0; // Tolerance for float differences
    const isPartiallyPaid = paidAmount > 0 && pendingAmount > 1.0;

    let paymentBadge = null;
    let borderColor = "";

    if (isFullyPaid) {
        paymentBadge = <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 hover:bg-emerald-200 border-none px-2 py-0.5 text-[10px] shadow-sm">Paid</Badge>;
        borderColor = "border-l-4 border-l-emerald-500";
    } else if (isPartiallyPaid) {
        paymentBadge = <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400 hover:bg-yellow-200 border-none px-2 py-0.5 text-[10px] shadow-sm">
            Partially Paid (Due: ₹{pendingAmount.toLocaleString()})
        </Badge>;
        borderColor = "border-l-4 border-l-yellow-500";
    } else {
        // Fully Pending
        paymentBadge = <Badge className="bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 hover:bg-red-200 border-none px-2 py-0.5 text-[10px] shadow-sm">
            Due: ₹{pendingAmount.toLocaleString()}
        </Badge>;
        borderColor = "border-l-4 border-l-red-500";
    }

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <div className={`group transition-all duration-300 ease-in-out border rounded-2xl overflow-hidden bg-white dark:bg-slate-950/50 ${isOpen ? 'border-primary/20 shadow-lg ring-1 ring-primary/5' : 'border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-slate-200 dark:hover:border-slate-700'} ${borderColor}`}>
                <CollapsibleTrigger asChild>
                    <div className="p-5 flex items-center justify-between cursor-pointer select-none">
                        <div className="flex items-center gap-5">
                            <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-colors duration-300 ${isOpen ? 'bg-primary text-primary-foreground shadow-md' : 'bg-slate-50 dark:bg-slate-900 text-slate-500'}`}>
                                <ShoppingBag className="h-6 w-6 stroke-[1.5]" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2.5 mb-1">
                                    <span className="font-semibold text-base text-slate-900 dark:text-slate-100 tracking-tight">
                                        Order #{String(order.number || order.id).length < 10 ? order.number : String(order.number || order.id).slice(0, 8).toUpperCase()}
                                    </span>
                                    {paymentBadge}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                                    <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {format(new Date(order.date_created), "MMM dd, yyyy")}
                                    </span>
                                    <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                                    <span>{order.line_items?.length || 0} items</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">₹{orderTotal.toLocaleString()}</p>
                                <Badge variant={
                                    order.status === 'completed' ? 'default' :
                                        order.status === 'processing' ? 'secondary' :
                                            order.status === 'cancelled' ? 'destructive' : 'outline'
                                } className="mt-0.5 h-5 px-1.5 text-[10px] uppercase tracking-wider font-bold">
                                    {order.status}
                                </Badge>
                            </div>
                            <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
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

                                                            {/* Product Specs - Single Line + Read More */}
                                                            {meta.length > 0 && (
                                                                <ProductSpecsDisplay meta={meta} productName={item.name} />
                                                            )}
                                                        </div>

                                                        {/* Pricing Section - With GST */}
                                                        <div className="text-right shrink-0 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 min-w-[140px]">
                                                            <div className="space-y-1">
                                                                <div className="flex justify-between items-center gap-4 text-xs text-slate-500">
                                                                    <span>Rate</span>
                                                                    <span>₹{unitPrice.toLocaleString()}</span>
                                                                </div>

                                                                {/* GST Row */}
                                                                <div className="flex justify-between items-center gap-4 text-xs text-slate-500">
                                                                    <span>GST</span>
                                                                    <span>
                                                                        {item.total_tax && parseFloat(item.total_tax) > 0
                                                                            ? `₹${parseFloat(item.total_tax).toLocaleString()}`
                                                                            : '-'}
                                                                    </span>
                                                                </div>

                                                                <div className="h-px bg-slate-200 dark:bg-slate-700" />
                                                                <div className="flex justify-between items-center gap-4 text-sm font-bold text-slate-900 dark:text-slate-100">
                                                                    <span>Total</span>
                                                                    <span>₹{(itemTotal + (parseFloat(item.total_tax) || 0)).toLocaleString()}</span>
                                                                </div>
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
                        {/* Order Summary & Details Grid - HIDDEN PER REQUEST */}
                        {/* 
                        <div className="px-5 pb-5">
                             ... (Hidden content) ...
                        </div>
                        */}
                    </div>
                </CollapsibleContent>
            </div>
        </Collapsible>
    );
}

// Product Specs Display Component with Read More
function ProductSpecsDisplay({ meta, productName }: { meta: any[], productName: string }) {
    const [showDialog, setShowDialog] = useState(false);

    // Create single line summary
    const specsSummary = meta.map(m => `${(m.display_key || m.key).replace(/_/g, ' ')}: ${m.display_value || m.value}`).join(' • ');

    return (
        <>
            <div className="flex items-center gap-2">
                <p className="text-xs text-slate-600 dark:text-slate-400 truncate flex-1">
                    {specsSummary}
                </p>
                {meta.length > 2 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowDialog(true)}
                        className="h-6 px-2 text-[10px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 shrink-0"
                    >
                        Read More
                    </Button>
                )}
            </div>

            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-base">Product Specifications</DialogTitle>
                        <DialogDescription className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {productName}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                        {meta.map((m) => (
                            <div key={m.id} className="flex justify-between items-start gap-4 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                                <span className="font-medium text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 shrink-0">
                                    {(m.display_key || m.key).replace(/_/g, ' ')}
                                </span>
                                <span className="text-sm text-slate-700 dark:text-slate-300 font-medium text-right">
                                    {m.display_value || m.value}
                                </span>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
