
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { WCCustomer, syncWCCustomers } from '@/services/woocommerce';
import { toast } from 'sonner';

export function useWooCommerce() {
    const [customers, setCustomers] = useState<WCCustomer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSynced, setLastSynced] = useState<Date | null>(null);

    // Fetch from local Supabase table
    const fetchLocalCustomers = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('wc_customers')
                .select('*')
                .order('last_order_date', { ascending: false }); // Show most active first

            if (error) throw error;
            setCustomers(data || []);
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
