
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { WCCustomer, syncWCCustomers } from '@/services/woocommerce';
import { toast } from 'sonner';

export function useWooCommerce() {
    const [customers, setCustomers] = useState<WCCustomer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSynced, setLastSynced] = useState<Date | null>(null);

    // Fetch from local Supabase table & Merge with Real-time Order Stats
    const fetchLocalCustomers = useCallback(async () => {
        try {
            const [customersResponse, ordersResponse] = await Promise.all([
                supabase
                    .from('wc_customers')
                    .select('*')
                    .neq('id', '00000000-0000-0000-0000-000000000000'),
                supabase
                    .from('orders')
                    .select('customer_email, order_total, created_at')
            ]);

            if (customersResponse.error) throw customersResponse.error;
            if (ordersResponse.error) throw ordersResponse.error;

            const wcCustomers = customersResponse.data || [];
            const localOrders = ordersResponse.data || [];

            // Aggregate Local Stats by Email
            const localStats = localOrders.reduce((acc, order) => {
                const email = order.customer_email?.toLowerCase();
                if (!email) return acc;

                if (!acc[email]) {
                    acc[email] = { count: 0, total: 0, lastActive: null };
                }
                acc[email].count += 1;
                acc[email].total += (order.order_total || 0);

                // Track latest order date
                if (order.created_at) {
                    const orderDate = new Date(order.created_at);
                    if (!acc[email].lastActive || orderDate > acc[email].lastActive!) {
                        acc[email].lastActive = orderDate;
                    }
                }

                return acc;
            }, {} as Record<string, { count: number; total: number; lastActive: Date | null }>);

            // Merge WC Data with Local Real-time Stats
            const mergedCustomers = wcCustomers.map(c => {
                const email = c.email.toLowerCase();
                const stats = localStats[email];

                if (stats) {
                    // Determine latest date
                    const wcDate = c.last_order_date ? new Date(c.last_order_date) : null;
                    const localDate = stats.lastActive;
                    let latestDate = c.last_order_date;

                    if (localDate && (!wcDate || localDate > wcDate)) {
                        latestDate = localDate.toISOString();
                    }

                    return {
                        ...c,
                        orders_count: Math.max(c.orders_count || 0, stats.count),
                        total_spent: Math.max(Number(c.total_spent) || 0, stats.total),
                        last_order_date: latestDate
                    };
                }
                return c;
            });

            // Sort by activity (Most recent / Highest spender logic could be applied here, currently simplified to just set)
            // Let's keep the backend sort or re-sort locally if needed.
            // Since we merged, let's sort by orders_count desc to show active customers
            mergedCustomers.sort((a, b) => (b.orders_count || 0) - (a.orders_count || 0));

            setCustomers(mergedCustomers);
        } catch (err) {
            console.error('Error fetching cached WC customers:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial load + Polling interval (5 minutes)
    useEffect(() => {
        fetchLocalCustomers();

        const intervalId = setInterval(() => {
            console.log('Polling WooCommerce Sync...');
            syncWCCustomers()
                .then(() => {
                    fetchLocalCustomers(); // Refresh local data after sync
                    setLastSynced(new Date());
                })
                .catch(err => console.error('Auto-sync failed:', err));
        }, 5 * 60 * 1000); // 5 minutes

        return () => clearInterval(intervalId);
    }, [fetchLocalCustomers]);

    // Manual Sync Trigger
    const syncNow = async () => {
        setIsSyncing(true);
        try {
            await syncWCCustomers();
            await fetchLocalCustomers();
            setLastSynced(new Date());
            toast.success("WooCommerce customers synced successfully");
        } catch (error) {
            console.error(error);
            toast.error("Failed to sync with WooCommerce");
        } finally {
            setIsSyncing(false);
        }
    };

    const deleteCustomer = async (id: string) => {
        try {
            const { error } = await supabase
                .from('wc_customers')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setCustomers(prev => prev.filter(c => c.id !== id));
            toast.success("Customer removed successfully");
        } catch (error) {
            console.error('Error deleting customer:', error);
            toast.error("Failed to delete customer");
        }
    };

    const deleteAllCustomers = async () => {
        try {
            const { error } = await supabase
                .from('wc_customers')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

            if (error) throw error;

            setCustomers([]);
            toast.success("All customers removed successfully");
        } catch (error) {
            console.error('Error deleting all customers:', error);
            toast.error("Failed to delete all customers");
        }
    };

    return {
        customers,
        isLoading,
        isSyncing,
        lastSynced,
        syncNow,
        refetch: fetchLocalCustomers,
        deleteCustomer,
        deleteAllCustomers
    };
}
