import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Copy, RefreshCw, Search, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface OrderItem {
    id: string;
    product_name: string;
    quantity: number;
    line_total: number;
}

interface Order {
    id: string;
    order_id: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    customer_address: string;
    total_amount: number;
    status: string;
    items: OrderItem[];
    created_at: string;
}

export default function AccountsDashboard() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchOrders = async () => {
        setLoading(true);
        try {
            // Fetch orders with items
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    items:order_items(*)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setOrders(data || []);
        } catch (error: any) {
            console.error('Error fetching accounts data:', error);
            toast.error('Failed to load orders');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, []);

    const copyToClipboard = (text: string, label: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied!`);
    };

    // GST Calculation Helper (Assuming 18% inclusive or exclusive? Usually exclusive for B2B Invoice gen)
    // User asked "product wise gst details dikhe".
    // We will assume 18% GST.
    const calculateGST = (amount: number) => {
        return (amount * 0.18).toFixed(2);
    };

    const filteredOrders = orders.filter(order =>
        order.order_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customer_email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        Accounts Dashboard
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Manage invoices and view financial details
                    </p>
                </div>
                <Button onClick={fetchOrders} variant="outline" size="icon">
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            <Card className="border-t-4 border-t-blue-500 shadow-md">
                <CardHeader className="pb-3">
                    <div className="flex justify-between items-center">
                        <CardTitle>Orders & Invoices</CardTitle>
                        <div className="relative w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search orders..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="w-[120px]">Order ID</TableHead>
                                    <TableHead className="w-[200px]">Customer Details</TableHead>
                                    <TableHead>Product Breakdown (Qty x Price)</TableHead>
                                    <TableHead className="text-right w-[100px]">Amount</TableHead>
                                    <TableHead className="text-right w-[100px]">GST (18%)</TableHead>
                                    <TableHead className="text-right w-[100px]">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                            Loading accounts data...
                                        </TableCell>
                                    </TableRow>
                                ) : filteredOrders.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                            No orders found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredOrders.map((order) => {
                                        const orderTotal = order.total_amount || 0;
                                        const totalGST = calculateGST(orderTotal);
                                        const grandTotal = (orderTotal + parseFloat(totalGST)).toFixed(2);

                                        return (
                                            <TableRow key={order.id} className="group hover:bg-muted/30 transition-colors">
                                                <TableCell className="font-medium align-top">
                                                    <div
                                                        className="flex items-center gap-1 cursor-pointer hover:text-blue-600"
                                                        onClick={() => copyToClipboard(order.order_id, 'Order ID')}
                                                    >
                                                        #{order.order_id} <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                                                    </div>
                                                    <Badge variant="outline" className="mt-1 text-[10px]">{order.status}</Badge>
                                                </TableCell>
                                                <TableCell className="align-top">
                                                    <div className="space-y-1 text-sm">
                                                        <div
                                                            className="font-semibold cursor-pointer hover:text-blue-600 flex items-center gap-1"
                                                            onClick={() => copyToClipboard(order.customer_name, 'Name')}
                                                        >
                                                            {order.customer_name}
                                                        </div>
                                                        {order.customer_email && (
                                                            <div
                                                                className="text-xs text-muted-foreground cursor-pointer hover:text-blue-600 truncate max-w-[180px]"
                                                                onClick={() => copyToClipboard(order.customer_email, 'Email')}
                                                                title={order.customer_email}
                                                            >
                                                                {order.customer_email}
                                                            </div>
                                                        )}
                                                        {order.customer_phone && (
                                                            <div
                                                                className="text-xs text-muted-foreground cursor-pointer hover:text-blue-600"
                                                                onClick={() => copyToClipboard(order.customer_phone, 'Phone')}
                                                            >
                                                                {order.customer_phone}
                                                            </div>
                                                        )}
                                                        {order.customer_address && (
                                                            <div
                                                                className="text-xs text-muted-foreground cursor-pointer hover:text-blue-600 truncate max-w-[180px]"
                                                                onClick={() => copyToClipboard(order.customer_address, 'Address')}
                                                                title={order.customer_address}
                                                            >
                                                                {order.customer_address}
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="align-top">
                                                    <div className="space-y-2">
                                                        {order.items?.map((item, idx) => {
                                                            const itemGst = calculateGST(item.line_total || 0);
                                                            return (
                                                                <div key={idx} className="text-sm border-b border-dashed last:border-0 pb-1 last:pb-0">
                                                                    <div
                                                                        className="flex justify-between cursor-pointer hover:text-blue-600"
                                                                        onClick={() => copyToClipboard(`${item.product_name} x ${item.quantity}`, 'Product')}
                                                                    >
                                                                        <span className="font-medium">{item.product_name}</span>
                                                                        <span className="text-muted-foreground text-xs">x{item.quantity}</span>
                                                                    </div>
                                                                    <div className="flex justify-between text-xs text-muted-foreground">
                                                                        <span>Base: ₹{item.line_total}</span>
                                                                        <span className="text-blue-600 cursor-pointer" onClick={() => copyToClipboard(itemGst, 'GST Amount')}>
                                                                            GST (18%): ₹{itemGst}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right align-top font-medium">
                                                    ₹{orderTotal.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right align-top text-muted-foreground">
                                                    ₹{totalGST}
                                                </TableCell>
                                                <TableCell className="text-right align-top font-bold text-green-600">
                                                    <div
                                                        className="cursor-pointer hover:underline"
                                                        onClick={() => copyToClipboard(grandTotal, 'Grand Total')}
                                                    >
                                                        ₹{grandTotal}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
