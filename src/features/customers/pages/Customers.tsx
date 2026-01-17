import { useState, useMemo, useEffect } from 'react';
import { useWooCommerce } from '@/hooks/useWooCommerce';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useOrders } from '@/features/orders/context/OrderContext';
import { CustomerDetailDialog } from '../components/CustomerDetailDialog';
import { CustomerImportDialog } from '../components/CustomerImportDialog';
import { AssignUserDialog } from '@/components/dialogs/AssignUserDialog';
import { WCCustomer } from '@/services/woocommerce';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Search,
    Download,
    Filter,
    MoreHorizontal,
    Users,
    UserPlus,
    ArrowUpDown,
    Trash2,
    RefreshCw,
    FileSpreadsheet
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSearchParams } from 'react-router-dom';

type SortOption = 'date-new' | 'date-old' | 'spent-high' | 'orders-high' | 'name-asc';

export default function Customers() {
    const [searchParams] = useSearchParams();
    const { customers, isLoading: isWCLoading, refetch, deleteCustomer, deleteAllCustomers } = useWooCommerce();
    const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
    const [filter, setFilter] = useState<'all' | 'high-value' | 'repeat' | 'my-customers'>('all');
    const [sortBy, setSortBy] = useState<SortOption>('date-new');
    const [selectedAlpha, setSelectedAlpha] = useState<string | null>(null);

    const [selectedCustomer, setSelectedCustomer] = useState<WCCustomer | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [deleteWarningOpen, setDeleteWarningOpen] = useState(false);


    // Deep Linking: Auto-open customer if "open" param is present
    useEffect(() => {
        const openId = searchParams.get('open');
        if (openId && customers.length > 0 && !detailOpen) {
            const customerToOpen = customers.find(c => c.id === openId);
            if (customerToOpen) {
                setSelectedCustomer(customerToOpen);
                setDetailOpen(true);
            }
        }
    }, [customers, searchParams]);

    // Assignment State
    const [assignDialogOpen, setAssignDialogOpen] = useState(false);
    const [customerToAssign, setCustomerToAssign] = useState<WCCustomer | null>(null);
    const [userMap, setUserMap] = useState<Record<string, { name: string; dept: string }>>({});

    const { user, isAdmin, role } = useAuth();
    const { orders } = useOrders();

    // Fetch User Profiles for "Assigned To" Display
    useEffect(() => {
        const fetchProfiles = async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('user_id, full_name, department');

            if (!error && data) {
                const map: Record<string, { name: string; dept: string }> = {};
                data.forEach(p => {
                    if (p.user_id) {
                        map[p.user_id] = { name: p.full_name || 'Unknown', dept: p.department || 'Unknown' };
                    }
                });
                setUserMap(map);
            }
        };
        fetchProfiles();
    }, []);

    // Derived Data
    const processedCustomers = useMemo(() => {
        let result = customers.filter(c => {
            const searchLower = searchTerm.toLowerCase();
            const fullName = [c.first_name || '', c.last_name || ''].filter(Boolean).join(' ').toLowerCase();
            const email = (c.email || '').toLowerCase();
            const phone = (c.phone || '');
            const address = c.billing ? JSON.stringify(c.billing).toLowerCase() : '';

            const matchesSearch =
                fullName.includes(searchLower) ||
                email.includes(searchLower) ||
                phone.includes(searchLower) ||
                address.includes(searchLower);

            if (!matchesSearch) return false;

            if (filter === 'high-value') return Number(c.total_spent || 0) > 10000;
            if (filter === 'repeat') return Number(c.orders_count || 0) > 2;

            // Allow searching by alphabet
            if (selectedAlpha && selectedAlpha !== 'ALL') {
                const firstLetter = (c.first_name || c.last_name || c.email || '').charAt(0).toUpperCase();
                if (firstLetter !== selectedAlpha) return false;
            }

            // HIDE NAMELESS CUSTOMERS STRICTLY
            const hasName = (c.first_name && c.first_name.trim().length > 0) || (c.last_name && c.last_name.trim().length > 0);
            if (!hasName) return false;

            if (filter === 'my-customers') {
                if (!user) return false;

                // 1. Strict Assignment Check
                if (c.assigned_to) {
                    return c.assigned_to === user.id;
                }

                // 2. Fallback: If UNASSIGNED, check order history
                // (Only claim unassigned customers via order history)
                const hasMyOrders = orders.some(o =>
                    o.created_by === user.id &&
                    (o.customer.email === c.email || o.customer.phone === c.phone)
                );
                return hasMyOrders;
            }

            return true;
        });

        // Sorting
        result.sort((a, b) => {
            switch (sortBy) {
                case 'date-new':
                    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
                case 'date-old':
                    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
                case 'spent-high':
                    return Number(b.total_spent) - Number(a.total_spent);
                case 'orders-high':
                    return Number(b.orders_count) - Number(a.orders_count);
                case 'name-asc':
                    return (a.first_name || '').localeCompare(b.first_name || '');
                default:
                    return 0;
            }
        });

        return result;
    }, [customers, searchTerm, filter, sortBy, orders, user, selectedAlpha]);

    const handleDownloadCSV = () => {
        const headers = ["ID", "Name", "Email", "Phone", "Total Spent", "Orders", "City", "Assigned To"];
        const rows = processedCustomers.map(c => [
            c.wc_id,
            [c.first_name, c.last_name].filter(Boolean).join(' '),
            c.email,
            c.phone,
            c.total_spent,
            c.orders_count,
            c.billing.city,
            c.billing.city,
            c.assigned_to ? userMap[c.assigned_to]?.name || 'Unknown' : 'Unassigned'
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "customers_export.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Customer list exported");
    };

    const handleAssignCustomer = async (userId: string, userName: string) => {
        if (!customerToAssign) return;
        try {
            const { error } = await supabase
                .from('wc_customers')
                .update({ assigned_to: userId })
                .eq('id', customerToAssign.id);

            if (error) throw error;

            toast.success(`Assigned to ${userName}`);
            await refetch(); // Refresh list to show new assignment
        } catch (err: any) {
            console.error('Assignment failed', err);
            toast.error('Failed to assign customer');
        }
    };

    return (
        <TooltipProvider>
            <div className="h-full flex flex-col gap-6 p-6 animate-fade-in max-w-[1600px] mx-auto w-full font-sans">
                {/* Sticky Header with Glassmorphism */}
                <div className="sticky top-0 z-10 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md pb-4 -mx-6 px-6 pt-2 border-b border-transparent transition-all duration-200">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Customers</h1>
                            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm font-medium">
                                {processedCustomers.length} active customers assigned
                            </p>
                        </div>
                        <div className="flex gap-2">
                            {customers.length > 0 && (isAdmin || role === 'sales') && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30">
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Manage
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Danger Zone</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => setDeleteWarningOpen(true)} className="text-red-600 focus:text-red-700">
                                            Delete All Customers
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                            <Button
                                onClick={async () => {
                                    try {
                                        toast.info("Syncing customer details from WooCommerce...");
                                        const { data, error } = await supabase.functions.invoke('woocommerce', {
                                            body: { action: 'sync-all-customers-details' }
                                        });
                                        if (error) throw error;
                                        if (data.success) {
                                            toast.success(data.message);
                                            refetch();
                                        } else {
                                            toast.error(data.error || "Sync failed");
                                        }
                                    } catch (err: any) {
                                        console.error("Sync failed", err);
                                        toast.error(err.message || "Failed to sync customer details");
                                    }
                                }}
                                variant="outline"
                                className="border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                            >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Sync Details
                            </Button>
                            <Button
                                onClick={() => setImportOpen(true)}
                                className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200/50 dark:shadow-none transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <FileSpreadsheet className="h-4 w-4 mr-2" />
                                Import CSV
                            </Button>
                        </div>
                    </div>
                </div>


                {/* Alphabet Filter Bar */}
                <div className="bg-white dark:bg-slate-900 rounded-xl p-2 shadow-sm border border-slate-100 dark:border-slate-800 -mt-2 overflow-x-auto no-scrollbar">
                    <div className="flex items-center gap-1 min-w-max">
                        <button
                            onClick={() => setSelectedAlpha(null)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${!selectedAlpha
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-none'
                                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                        >
                            ALL
                        </button>
                        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
                        {Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ').map((alpha) => (
                            <button
                                key={alpha}
                                onClick={() => setSelectedAlpha(alpha)}
                                className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-all ${selectedAlpha === alpha
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-none scale-110'
                                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600'
                                    }`}
                            >
                                {alpha}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content Area */}
                <div className="grid gap-6">
                    {/* Search & Actions Bar with Glassmorphism */}
                    <div className="sticky top-[88px] z-10 -mx-6 px-6 py-4 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-transparent">
                        <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
                            <div className="relative flex-1 group">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                <Input
                                    placeholder="Search by name, email, or usage..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500/20 rounded-xl transition-all shadow-sm hover:shadow-md"
                                />
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2 items-center">
                                <Tabs defaultValue="all" onValueChange={(val) => setFilter(val as any)} className="w-full sm:w-auto">
                                    <TabsList className="grid w-full sm:w-[300px] grid-cols-2 h-11 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                                        <TabsTrigger value="all" className="rounded-lg">All Customers</TabsTrigger>
                                        <TabsTrigger value="my-customers" className="rounded-lg">My Customers</TabsTrigger>
                                    </TabsList>
                                </Tabs>

                                <div className="flex gap-2 text-sm overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" className="h-11 rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800">
                                                <Filter className="mr-2 h-4 w-4 text-slate-500" />
                                                <span className="hidden sm:inline">Filter:</span>
                                                <span className="ml-1 font-semibold text-slate-700 dark:text-slate-300 capitalize">{['high-value', 'repeat'].includes(filter) ? filter.replace('-', ' ') : 'None'}</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48 rounded-xl p-1.5">
                                            <DropdownMenuItem onClick={() => setFilter('all')} className="rounded-lg">None</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setFilter('high-value')} className="rounded-lg">High Value</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setFilter('repeat')} className="rounded-lg">Repeat Customers</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>

                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" className="h-11 rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800">
                                                <ArrowUpDown className="mr-2 h-4 w-4 text-slate-500" />
                                                Sort: <span className="ml-1 font-semibold text-slate-700 dark:text-slate-300 capitalize">{sortBy.replace('-', ' ')}</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48 rounded-xl p-1.5">
                                            <DropdownMenuItem onClick={() => setSortBy('date-new')} className="rounded-lg">Newest First</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setSortBy('date-old')} className="rounded-lg">Oldest First</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setSortBy('spent-high')} className="rounded-lg">Highest Spender</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setSortBy('orders-high')} className="rounded-lg">Most Frequent</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setSortBy('name-asc')} className="rounded-lg">Name (A-Z)</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>

                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="outline" onClick={handleDownloadCSV} size="icon" className="h-11 w-11 rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0">
                                                <Download className="h-4 w-4 text-slate-500" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Export CSV</TooltipContent>
                                    </Tooltip>
                                </div>
                            </div>
                        </div>

                        {/* Customers List - Premium Card Layout */}
                        <div className="space-y-4 mt-6">
                            {isWCLoading ? (
                                // Skeleton Loader
                                Array(5).fill(0).map((_, i) => (
                                    <div key={i} className="flex items-center gap-4 p-4 bg-white dark:bg-slate-900 rounded-2xl animate-pulse">
                                        <div className="h-12 w-12 rounded-full bg-slate-200 dark:bg-slate-800" />
                                        <div className="space-y-2 flex-1">
                                            <div className="h-4 w-1/3 bg-slate-200 dark:bg-slate-800 rounded" />
                                            <div className="h-3 w-1/4 bg-slate-100 dark:bg-slate-900 rounded" />
                                        </div>
                                    </div>
                                ))
                            ) : processedCustomers.length === 0 ? (
                                <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                                    <div className="h-16 w-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                        <Users className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">No customers found</h3>
                                    <p className="text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                                        Try adjusting your search terms or filters.
                                    </p>
                                    <Button
                                        variant="link"
                                        onClick={() => { setSearchTerm(''); setFilter('all'); }}
                                        className="mt-4 text-blue-600 hover:text-blue-700"
                                    >
                                        Clear all filters
                                    </Button>
                                </div>
                            ) : (
                                <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-lg transition-all duration-500 overflow-hidden">
                                    {processedCustomers.map((customer) => (
                                        <div
                                            key={customer.id}
                                            className="group flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6 p-4 sm:p-5 border-b border-slate-50 dark:border-slate-800/50 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors"
                                        >
                                            {/* Avatar & Key Info */}
                                            <div
                                                className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 cursor-pointer w-full sm:w-auto"
                                                onClick={() => { setSelectedCustomer(customer); setDetailOpen(true); }}
                                            >
                                                <Avatar className="h-10 w-10 sm:h-14 sm:w-14 ring-2 ring-white dark:ring-slate-900 shadow-sm transition-transform group-hover:scale-105 shrink-0">
                                                    <AvatarImage src={customer.avatar_url} className="object-cover" />
                                                    <AvatarFallback className="bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 font-bold text-sm sm:text-lg">
                                                        {(customer.first_name?.[0] || customer.email?.[0] || '?').toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-blue-600 transition-colors">
                                                            {[customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'No Name'}
                                                        </h3>
                                                        {customer.billing?.city && (
                                                            <Badge variant="outline" className="hidden xs:flex text-[10px] h-5 px-1.5 font-medium text-slate-500 border-slate-200">
                                                                {customer.billing.city}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-500">
                                                        <span className="truncate max-w-[150px] sm:max-w-none">{customer.email}</span>
                                                        {customer.wc_id && (
                                                            <span className="hidden sm:inline-flex px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-mono text-slate-400">
                                                                #{customer.wc_id}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Mobile Actions Trigger (Absolute positioned or flexed) */}
                                                <div className="sm:hidden ml-auto">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-slate-400" onClick={(e) => e.stopPropagation()}>
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-48 rounded-xl">
                                                            <DropdownMenuItem onClick={() => { setSelectedCustomer(customer); setDetailOpen(true); }}>
                                                                View Profile
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => { setCustomerToAssign(customer); setAssignDialogOpen(true); }}>
                                                                Assign Manager
                                                            </DropdownMenuItem>
                                                            {(isAdmin || role === 'sales') && (
                                                                <>
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuItem
                                                                        onClick={() => deleteCustomer(customer.id)}
                                                                        className="text-red-600 focus:text-red-700 focus:bg-red-50"
                                                                    >
                                                                        Delete Customer
                                                                    </DropdownMenuItem>
                                                                </>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </div>

                                            {/* Stats Section */}
                                            <div className="flex items-center justify-between w-full sm:w-auto gap-4 sm:gap-8 mt-1 sm:mt-0 pl-[52px] sm:pl-0 border-t sm:border-0 border-slate-50 dark:border-slate-800 pt-3 sm:pt-0">
                                                {/* Assigned To */}
                                                <div className="flex flex-col sm:items-end min-w-[80px] sm:w-32 shrink-0">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Manager</span>
                                                    <div
                                                        className="flex items-center gap-1.5 sm:gap-2 cursor-pointer sm:hover:bg-slate-100 sm:dark:hover:bg-slate-800 rounded sm:px-2 sm:py-1 sm:-mr-2 transition-colors"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (isAdmin || role === 'sales') {
                                                                setCustomerToAssign(customer);
                                                                setAssignDialogOpen(true);
                                                            }
                                                        }}
                                                    >
                                                        {customer.assigned_to ? (
                                                            userMap[customer.assigned_to] ? (
                                                                <>
                                                                    <Avatar className="h-4 w-4 sm:h-5 sm:w-5">
                                                                        <AvatarFallback className="text-[8px] sm:text-[9px] bg-indigo-100 text-indigo-700">
                                                                            {userMap[customer.assigned_to].name.charAt(0)}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                    <span className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 truncate max-w-[80px]">
                                                                        {userMap[customer.assigned_to].name.split(' ')[0]}
                                                                    </span>
                                                                </>
                                                            ) : (
                                                                <span className="text-xs sm:text-sm text-slate-500 italic">Unknown</span>
                                                            )
                                                        ) : (
                                                            <span className="text-xs sm:text-sm text-slate-400 italic">Unassigned</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Orders Stats */}
                                                <div className="flex items-center gap-4 sm:gap-6">
                                                    <div className="flex flex-col items-end min-w-[50px] sm:w-20">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Orders</span>
                                                        <div className="flex items-center gap-1.5">
                                                            <div className={`hidden sm:block h-2 w-2 rounded-full ${customer.orders_count > 0 ? 'bg-emerald-500 ring-2 ring-emerald-100' : 'bg-slate-300'} animate-pulse`} />
                                                            <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">{customer.orders_count}</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col items-end min-w-[70px] sm:w-28">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Total Spent</span>
                                                        <span className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400">
                                                            ₹{Number(customer.total_spent).toLocaleString()}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Desktop Actions */}
                                                <div className="hidden sm:flex items-center ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                                                                <MoreHorizontal className="h-4 w-4 text-slate-400" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-48 rounded-xl">
                                                            <DropdownMenuItem onClick={() => { setSelectedCustomer(customer); setDetailOpen(true); }}>
                                                                View Profile
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => { setCustomerToAssign(customer); setAssignDialogOpen(true); }}>
                                                                Assign Manager
                                                            </DropdownMenuItem>
                                                            {(isAdmin || role === 'sales') && (
                                                                <>
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuItem
                                                                        onClick={() => deleteCustomer(customer.id)}
                                                                        className="text-red-600 focus:text-red-700 focus:bg-red-50"
                                                                    >
                                                                        Delete Customer
                                                                    </DropdownMenuItem>
                                                                </>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Dialogs */}
                    <CustomerDetailDialog
                        open={detailOpen}
                        onOpenChange={setDetailOpen}
                        customer={selectedCustomer}
                    />

                    <CustomerImportDialog
                        open={importOpen}
                        onOpenChange={setImportOpen}
                        onImportSuccess={() => refetch()}
                    />

                    <AssignUserDialog
                        open={assignDialogOpen}
                        onOpenChange={setAssignDialogOpen}
                        department="sales"
                        currentUserId={customerToAssign?.assigned_to}
                        onAssign={(userId, userName) => {
                            handleAssignCustomer(userId, userName);
                            setAssignDialogOpen(false);
                        }}
                    />

                    {/* Danger Zone: Delete All Customers */}
                    <AlertDialog open={deleteWarningOpen} onOpenChange={setDeleteWarningOpen}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. It will permanently delete ALL imported WooCommerce customers from the database.
                                    Local order associations will be preserved but unlinked.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={async () => {
                                        await deleteAllCustomers();
                                        setDeleteWarningOpen(false);
                                    }}
                                    className="bg-red-600 hover:bg-red-700"
                                >
                                    Delete All
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    {/* Customer Import Dialog */}
                    <CustomerImportDialog
                        open={importOpen}
                        onOpenChange={setImportOpen}
                        onImportSuccess={() => {
                            refetch(); // Refresh customer list after import
                            setImportOpen(false);
                        }}
                    />
                </div>
            </div>
        </TooltipProvider >
    );
}
