import { useState, useEffect } from 'react';
import { ArrowLeft, User, ChevronRight, Search, Building2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/context/AuthContext';
import { chatService } from '../services/chatService';
import { OrderConversation } from '../types/chat';

interface ChatSelectionFlowProps {
    onConversationSelected: (conversation: OrderConversation) => void;
    onCancel: () => void;
    preselectedDepartment?: string;
    preselectedOrder?: { id: string, order_id: string };
}

const DEPARTMENTS = ['Sales', 'Design', 'Prepress', 'Production', 'Outsource', 'Dispatch'];

export function ChatSelectionFlow({ onConversationSelected, onCancel, preselectedDepartment, preselectedOrder }: ChatSelectionFlowProps) {
    const { user } = useAuth();

    // Determine initial step based on props
    const getInitialStep = () => {
        if (preselectedDepartment) return 2;
        return 1;
    };

    const [step, setStep] = useState<1 | 2 | 3>(getInitialStep());

    const [selectedDept, setSelectedDept] = useState<string | null>(preselectedDepartment || null);
    const [selectedUser, setSelectedUser] = useState<{ id: string, name: string } | null>(null);
    const [selectedOrder, setSelectedOrder] = useState<{ id: string, order_id: string } | null>(preselectedOrder || null);

    const [users, setUsers] = useState<{ id: string, name: string }[]>([]);
    const [orders, setOrders] = useState<{ id: string, order_id: string, customer: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');

    // Step 2: Fetch Users when Dept selected
    useEffect(() => {
        if (selectedDept && step === 2) {
            const fetchUsers = async () => {
                setLoading(true);
                const { data } = await supabase
                    .from('profiles')
                    .select('user_id, full_name')
                    .ilike('department', selectedDept)
                    .neq('user_id', user?.id || ''); // Exclude self

                if (data) {
                    setUsers(data.map(u => ({ id: u.user_id, name: u.full_name || 'Unknown' })));
                }
                setLoading(false);
            };
            fetchUsers();
        }
    }, [selectedDept, step, user?.id]);

    // Step 3: Fetch Orders when User selected (ONLY if not preselected)
    // Step 3: Fetch Orders when User selected (ONLY if not preselected)
    useEffect(() => {
        if (selectedUser && step === 3 && !preselectedOrder) {
            const fetchOrders = async () => {
                setLoading(true);
                const userId = selectedUser.id;

                // 1. Find orders explicitly assigned to user via items
                const { data: itemData } = await supabase
                    .from('order_items')
                    .select('order_id')
                    .eq('assigned_to', userId);

                const itemOrderIds = itemData?.map(i => i.order_id) || [];

                // 2. Build query for orders: Assigned to user directly OR Created by user OR Contain assigned items
                // Note: We use a filter syntax for OR.
                // We want: (assigned_user = id) OR (created_by = id) OR (id IN itemOrderIds)

                let query = supabase
                    .from('orders')
                    .select('id, order_id, customer_name')
                    .eq('is_completed', false)
                    .order('created_at', { ascending: false })
                    .limit(50);

                // Complex OR filter
                // We construct a filter string.
                // assigned_user.eq.ID, created_by.eq.ID
                // If itemOrderIds > 0, we also want id.in.(list)

                const orConditions = [`assigned_user.eq.${userId}`, `created_by.eq.${userId}`];
                if (itemOrderIds.length > 0) {
                    orConditions.push(`id.in.(${itemOrderIds.join(',')})`);
                }

                query = query.or(orConditions.join(','));

                const { data, error } = await query;

                if (error) {
                    console.error("Error fetching user orders:", error);
                }

                if (data) {
                    setOrders(data.map(o => ({
                        id: o.id,
                        order_id: o.order_id,
                        customer: o.customer_name || 'Unknown',
                        product: 'Active Order'
                    })));
                } else {
                    setOrders([]);
                }
                setLoading(false);
            };
            fetchOrders();
        }
    }, [selectedUser, step, preselectedOrder]);

    const handleDeptSelect = (dept: string) => {
        setSelectedDept(dept);
        setStep(2);
        setSearch('');
    };

    const handleUserSelect = (u: { id: string, name: string }) => {
        setSelectedUser(u);

        // If order is already selected/pre-filled, skip step 3 and start chat
        if (selectedOrder) {
            startChat(selectedDept!, u.id, selectedOrder.id);
        } else {
            setStep(3);
            setSearch('');
        }
    };

    const handleOrderSelect = async (o: { id: string, order_id: string }) => {
        setSelectedOrder(o);
        await startChat(selectedDept!, selectedUser!.id, o.id);
    };

    const startChat = async (dept: string, userId: string, orderId: string) => {
        setLoading(true);
        try {
            const conv = await chatService.startConversation(orderId, userId, dept);
            onConversationSelected(conv);
        } catch (error) {
            console.error("Failed to start conversation", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredList = () => {
        if (step === 2) return users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()));
        if (step === 3) return orders.filter(o => o.order_id.toLowerCase().includes(search.toLowerCase()) || o.customer.toLowerCase().includes(search.toLowerCase()) || (o as any).product?.toLowerCase().includes(search.toLowerCase()));
        return [];
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
            {/* Header */}
            <div className="p-4 border-b bg-white dark:bg-slate-900 flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => {
                    // If we started at step 2 (preselected dept), going back cancels
                    if (preselectedDepartment && step === 2) return onCancel();

                    step > 1 ? setStep(step - 1 as any) : onCancel()
                }}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h3 className="font-semibold text-sm">
                        {step === 1 && "Select Department"}
                        {step === 2 && "Select User"}
                        {step === 3 && "Select Order"}
                    </h3>
                    <p className="text-[10px] text-muted-foreground">Step {step} of {preselectedOrder ? 2 : 3}</p>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden flex flex-col">
                {(step === 2 || (step === 3 && !preselectedOrder)) && (
                    <div className="p-3 border-b bg-white dark:bg-slate-900">
                        <div className="relative">
                            <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder={step === 2 ? "Search user..." : "Search order..."}
                                className="pl-8 bg-slate-100 dark:bg-slate-800 border-none text-slate-900 dark:text-slate-100 placeholder:text-slate-500"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                )}

                <ScrollArea className="flex-1">
                    <div className="p-2 space-y-1">
                        {step === 1 && DEPARTMENTS.map(dept => (
                            <button
                                key={dept}
                                onClick={() => handleDeptSelect(dept)}
                                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm border border-transparent hover:border-slate-100 dark:hover:border-slate-700 transition-all text-left group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                        <Building2 className="h-5 w-5" />
                                    </div>
                                    <span className="font-medium text-sm">{dept}</span>
                                </div>
                                <ChevronRight className="h-4 w-4 text-slate-300 opacity-0 group-hover:opacity-100" />
                            </button>
                        ))}

                        {step === 2 && filteredList().map((u: any) => (
                            <button
                                key={u.id}
                                onClick={() => handleUserSelect(u)}
                                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm border border-transparent hover:border-slate-100 dark:hover:border-slate-700 transition-all text-left"
                            >
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-9 w-9">
                                        <AvatarFallback className="bg-orange-50 text-orange-600 text-xs">
                                            {u.name.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="font-medium text-sm">{u.name}</span>
                                </div>
                                <ChevronRight className="h-4 w-4 text-slate-300" />
                            </button>
                        ))}

                        {step === 3 && !preselectedOrder && filteredList().map((o: any) => (
                            <button
                                key={o.id}
                                onClick={() => handleOrderSelect(o)}
                                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm border border-transparent hover:border-slate-100 dark:hover:border-slate-700 transition-all text-left"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded bg-slate-100 text-slate-500 flex items-center justify-center">
                                        <Package className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">#{o.order_id}</p>
                                        <p className="text-xs text-muted-foreground">{o.product} • {o.customer}</p>
                                    </div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-slate-300" />
                            </button>
                        ))}
                    </div>
                </ScrollArea>
            </div>
        </div>
    );
}
