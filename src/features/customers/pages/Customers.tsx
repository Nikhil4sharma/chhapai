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
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import {
    Search,
    Download,
    Filter,
    MoreHorizontal,
    Users,
    ShoppingBag,
    IndianRupee,
    UserPlus,
    ArrowUpDown,
    Trash2,
    Calendar,
    ArrowDownAZ,
    ArrowUpNarrowWide,
    UserCircle,
    Shield
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type SortOption = 'date-new' | 'date-old' | 'spent-high' | 'orders-high' | 'name-asc';

export default function Customers() {
    const { customers, isLoading: isWCLoading, refetch, deleteCustomer, deleteAllCustomers } = useWooCommerce();
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'all' | 'high-value' | 'repeat' | 'my-customers'>('all');
    const [sortBy, setSortBy] = useState<SortOption>('date-new');

    const [selectedCustomer, setSelectedCustomer] = useState<WCCustomer | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [deleteWarningOpen, setDeleteWarningOpen] = useState(false);

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
    const totalRevenue = customers.reduce((sum, c) => sum + Number(c.total_spent), 0);
    const totalOrders = customers.reduce((sum, c) => sum + Number(c.orders_count), 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;


    // Filter & Sort Logic
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const filterParam = params.get('filter');
        if (filterParam === 'my') {
            setFilter('my-customers');
        }
    }, []);

    const processedCustomers = useMemo(() => {
        let result = customers.filter(c => {
            const searchLower = searchTerm.toLowerCase();
            const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
            const address = JSON.stringify(c.billing).toLowerCase();

            const matchesSearch =
                fullName.includes(searchLower) ||
                c.email.toLowerCase().includes(searchLower) ||
                c.phone.includes(searchLower) ||
                address.includes(searchLower);

            if (!matchesSearch) return false;

            if (filter === 'high-value') return Number(c.total_spent) > 10000;
            if (filter === 'repeat') return Number(c.orders_count) > 2;
            if (filter === 'my-customers') {
                if (!user) return false;
                // Check explicit assignment OR order history fallback
                const explicitlyAssigned = c.assigned_to === user.id;
                const hasMyOrders = orders.some(o =>
                    o.created_by === user.id &&
                    (o.customer.email === c.email || o.customer.phone === c.phone)
                );
                return explicitlyAssigned || hasMyOrders;
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
    }, [customers, searchTerm, filter, sortBy, orders, user]);

    const handleDownloadCSV = () => {
        const headers = ["ID", "Name", "Email", "Phone", "Total Spent", "Orders", "City", "Assigned To"];
        const rows = processedCustomers.map(c => [
            c.wc_id,
            `${c.first_name} ${c.last_name}`,
            c.email,
            c.phone,
            c.total_spent,
            c.orders_count,
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
            refetch(); // Refresh list to show new assignment
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
                                onClick={() => setImportOpen(true)}
                                className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200/50 dark:shadow-none transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <UserPlus className="h-4 w-4 mr-2" />
                                Import Customer
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Stats Cards - Refined */}
                <div className="grid gap-6 md:grid-cols-4">
                    {[
                        {
                            title: "Total Revenue",
                            value: `₹${totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
                            icon: IndianRupee,
                            color: "text-emerald-600",
                            bg: "bg-emerald-50",
                            darkBg: "dark:bg-emerald-900/20",
                            onClick: () => setFilter('high-value'),
                            active: filter === 'high-value'
                        },
                        {
                            title: "Avg. Order Value",
                            value: `₹${avgOrderValue.toFixed(0)}`,
                            icon: ShoppingBag,
                            color: "text-purple-600",
                            bg: "bg-purple-50",
                            darkBg: "dark:bg-purple-900/20",
                            onClick: () => setSortBy('spent-high'),
                            active: sortBy === 'spent-high'
                        },
                        {
                            title: "All Customers",
                            value: customers.length,
                            icon: Users,
                            color: "text-blue-600",
                            bg: "bg-blue-50",
                            darkBg: "dark:bg-blue-900/20",
                            onClick: () => setFilter('all'),
                            active: filter === 'all'
                        },
                        {
                            title: "Repeat Rate",
                            value: `${customers.length > 0 ? ((customers.filter(c => c.orders_count > 1).length / customers.length) * 100).toFixed(0) : 0}%`,
                            icon: ArrowUpNarrowWide,
                            color: "text-orange-600",
                            bg: "bg-orange-50",
                            darkBg: "dark:bg-orange-900/20",
                            onClick: () => setFilter('repeat'),
                            active: filter === 'repeat'
                        }
                    ].map((stat, i) => (
                        <Card key={i}
                            onClick={stat.onClick}
                            className={`border-none shadow-sm bg-white dark:bg-slate-900 ring-1 ring-slate-200/50 dark:ring-slate-800 transition-all hover:shadow-md cursor-pointer group ${stat.active ? 'ring-2 ring-blue-500 dark:ring-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                            <CardContent className="p-6 flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{stat.title}</p>
                                    <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2 tracking-tight">{stat.value}</h3>
                                </div>
                                <div className={`h-12 w-12 ${stat.bg} ${stat.darkBg} rounded-2xl flex items-center justify-center ${stat.color} ring-1 ring-inset ring-black/5 group-hover:scale-110 transition-transform`}>
                                    <stat.icon className="h-6 w-6" />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Controls Bar */}
                <div className="flex flex-col lg:flex-row gap-4 justify-between items-center bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm">
                    <div className="relative w-full lg:w-[400px] group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <Input
                            placeholder="Search by name, email, phone, or address..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 bg-transparent border-transparent focus-visible:ring-0 placeholder:text-slate-400 text-base"
                        />
                    </div>
                    <div className="flex items-center gap-2 w-full lg:w-auto p-1 overflow-x-auto">
                        {/* Sort Dropdown */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
                                    <ArrowUpDown className="h-3.5 w-3.5" />
                                    <span className="text-xs font-medium">Sort: {sortBy === 'date-new' ? 'Newest' : sortBy === 'spent-high' ? 'High Spenders' : 'Name'}</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuLabel>Sort Customers</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setSortBy('date-new')}>
                                    <Calendar className="h-3.5 w-3.5 mr-2 opacity-70" /> Newest Added
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setSortBy('name-asc')}>
                                    <ArrowDownAZ className="h-3.5 w-3.5 mr-2 opacity-70" /> Name (A-Z)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setSortBy('spent-high')}>
                                    <IndianRupee className="h-3.5 w-3.5 mr-2 opacity-70" /> Highest Spenders
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setSortBy('orders-high')}>
                                    <ArrowUpNarrowWide className="h-3.5 w-3.5 mr-2 opacity-70" /> Most Orders
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 gap-2 text-slate-600 hover:text-slate-900">
                                    <Filter className="h-3.5 w-3.5" />
                                    <span className="text-xs font-medium">{filter === 'all' ? 'Filter' : filter}</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => setFilter('all')}>All View</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setFilter('my-customers')}>My Customers</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setFilter('high-value')}>High Value ({'>'} ₹10k)</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setFilter('repeat')}>Repeat Buyers ({'>'} 2 orders)</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <Button variant="ghost" size="icon" onClick={handleDownloadCSV} title="Export CSV" className="h-8 w-8 ml-auto">
                            <Download className="h-4 w-4 text-slate-500" />
                        </Button>
                    </div>
                </div>

                {/* Customers Table - Refined */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden flex-1 flex flex-col">
                    <Table>
                        <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur border-b border-slate-100 dark:border-slate-800">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-[300px] font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider pl-6">Customer</TableHead>
                                <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Location</TableHead>
                                <TableHead className="text-center font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Assigned To</TableHead>
                                <TableHead className="text-right font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Orders</TableHead>
                                <TableHead className="text-right font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Spent</TableHead>
                                <TableHead className="text-right font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider pr-6">Activity</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isWCLoading ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="pl-6 py-4"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-full bg-slate-100 animate-pulse" /><div className="space-y-2"><div className="h-4 w-32 bg-slate-100 animate-pulse rounded" /><div className="h-3 w-20 bg-slate-100 animate-pulse rounded" /></div></div></TableCell>
                                        <TableCell><div className="h-4 w-24 bg-slate-100 animate-pulse rounded" /></TableCell>
                                        <TableCell><div className="h-4 w-24 bg-slate-100 animate-pulse rounded mx-auto" /></TableCell>
                                        <TableCell><div className="h-4 w-10 bg-slate-100 animate-pulse rounded ml-auto" /></TableCell>
                                        <TableCell><div className="h-4 w-16 bg-slate-100 animate-pulse rounded ml-auto" /></TableCell>
                                        <TableCell className="pr-6"><div className="h-4 w-24 bg-slate-100 animate-pulse rounded ml-auto" /></TableCell>
                                        <TableCell></TableCell>
                                    </TableRow>
                                ))
                            ) : processedCustomers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-[400px] text-center">
                                        <div className="flex flex-col items-center justify-center gap-3 max-w-md mx-auto">
                                            <div className="h-16 w-16 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-2">
                                                <Search className="h-8 w-8 text-slate-300" />
                                            </div>
                                            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">No customers found</h3>
                                            <p className="text-sm text-slate-500 text-center leading-relaxed">
                                                {searchTerm
                                                    ? `We couldn't find any customers matching "${searchTerm}". Try searching by name, email, or a different keyword.`
                                                    : "It looks like you haven't imported any customers yet. Get started by importing from WooCommerce."}
                                            </p>
                                            {!searchTerm && (
                                                <Button onClick={() => setImportOpen(true)} className="mt-4 bg-indigo-600 hover:bg-indigo-700">
                                                    Search & Import
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                processedCustomers.map((customer) => (
                                    <TableRow
                                        key={customer.id}
                                        className="cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group border-b border-slate-50 dark:border-slate-800/50"
                                        onClick={() => { setSelectedCustomer(customer); setDetailOpen(true); }}
                                    >
                                        <TableCell className="pl-6 py-3">
                                            <div className="flex items-center gap-4">
                                                <Avatar className="h-10 w-10 border-2 border-white dark:border-slate-800 shadow-sm group-hover:scale-105 transition-transform duration-200">
                                                    <AvatarImage src={customer.avatar_url} />
                                                    <AvatarFallback className="text-xs font-bold bg-gradient-to-br from-blue-50 to-sky-50 text-blue-600 dark:from-blue-950 dark:to-sky-950 dark:text-blue-400">
                                                        {(customer.first_name?.[0] || customer.email?.[0] || 'C').toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                        {(customer.first_name || customer.last_name)
                                                            ? `${customer.first_name} ${customer.last_name}`.trim()
                                                            : (customer.email.split('@')[0] || 'Guest').substring(0, 20)}
                                                    </span>
                                                    <span className="text-sm text-slate-600 dark:text-slate-200 font-medium mt-0.5">{customer.email}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm font-medium text-slate-600 dark:text-slate-200">
                                                {[customer.billing?.city, customer.billing?.country].filter(Boolean).join(', ') || <span className="text-slate-400 italic">No Location</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {customer.assigned_to ? (
                                                <div className="flex items-center justify-center gap-2" title={userMap[customer.assigned_to]?.name || 'Unknown'}>
                                                    <Tooltip>
                                                        <TooltipTrigger>
                                                            <Avatar className="h-6 w-6 ring-2 ring-white dark:ring-slate-900">
                                                                <AvatarFallback className="text-[10px] bg-indigo-100 text-indigo-700">
                                                                    {(userMap[customer.assigned_to]?.name?.[0] || '?').toUpperCase()}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top">
                                                            <p className="text-xs">{userMap[customer.assigned_to]?.name}</p>
                                                            <p className="text-[10px] text-muted-foreground">{userMap[customer.assigned_to]?.dept}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">Unassigned</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant="outline" className={`font-mono border-0 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 ${Number(customer.orders_count) > 5 ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' : ''}`}>
                                                {customer.orders_count}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-slate-700 dark:text-slate-200">
                                            ₹{customer.total_spent}
                                        </TableCell>
                                        <TableCell className="text-right text-xs text-slate-500 pr-6">
                                            {customer.last_order_date ? formatDistanceToNow(new Date(customer.last_order_date), { addSuffix: true }) : '-'}
                                        </TableCell>
                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => { setSelectedCustomer(customer); setDetailOpen(true); }}>
                                                        View Details
                                                    </DropdownMenuItem>
                                                    {(isAdmin || role === 'sales') && (
                                                        <DropdownMenuItem onClick={() => { setCustomerToAssign(customer); setAssignDialogOpen(true); }}>
                                                            <Shield className="h-3.5 w-3.5 mr-2 text-indigo-500" />
                                                            Assign to Sales
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => deleteCustomer(customer.id)} className="text-red-600 focus:text-red-700">
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
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
                    onImportSuccess={() => {
                        refetch();
                    }}
                />

                <AssignUserDialog
                    open={assignDialogOpen}
                    onOpenChange={setAssignDialogOpen}
                    department="sales" // Default to assigning to Sales for now
                    onAssign={handleAssignCustomer}
                    currentUserId={customerToAssign?.assigned_to}
                />

                <AlertDialog open={deleteWarningOpen} onOpenChange={setDeleteWarningOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will delete ALL imported customers from your dashboard. This action cannot be undone.
                                You can always re-import them from WooCommerce later.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteAllCustomers()} className="bg-red-600 hover:bg-red-700">
                                Delete All
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </TooltipProvider>
    );
}
