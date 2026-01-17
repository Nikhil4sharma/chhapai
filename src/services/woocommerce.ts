
import { supabase } from '@/integrations/supabase/client';

export interface WCCustomer {
    id: string; // our database UUID
    wc_id: number;
    email: string;
    first_name: string;
    last_name: string;
    phone: string;
    billing: {
        first_name?: string;
        last_name?: string;
        company?: string;
        address_1?: string;
        address_2?: string;
        city?: string;
        state?: string;
        postcode?: string;
        country?: string;
        phone?: string;
        email?: string;
    };
    shipping: {
        first_name?: string;
        last_name?: string;
        company?: string;
        address_1?: string;
        address_2?: string;
        city?: string;
        state?: string;
        postcode?: string;
        country?: string;
    };
    avatar_url?: string;
    total_spent: number;
    orders_count: number;
    last_order_date?: string;
    last_synced_at: string;
    assigned_to?: string; // Mapped to 'assigned_manager' in UI previously, now aligned with DB
    assigned_to_name?: string; // Optional helper
    gst_number?: string;
    created_at?: string;
}

export interface WCOrder {
    id: number;
    number: string;
    status: string;
    date_created: string;
    total: string;
    line_items: Array<{
        name: string;
        quantity: number;
        total: string;
        sku: string;
        meta_data: Array<{
            id: number;
            key: string;
            value: any;
            display_key?: string;
            display_value?: string;
        }>;
    }>;
    meta_data: Array<{
        id: number;
        key: string;
        value: any;
    }>;
    shipping: {
        first_name: string;
        last_name: string;
        company: string;
        address_1: string;
        address_2: string;
        city: string;
        state: string;
        postcode: string;
        country: string;
    };
    customer_note?: string;
}

// Helper to invoke the Edge Function
export const syncWCCustomers = async () => {
    // DISABLED: Edge function doesn't support 'sync_customers' action
    // TODO: Implement customer sync differently or update edge function
    console.warn('syncWCCustomers is currently disabled - edge function does not support this action');
    return { data: null, error: null };

    /* 
    // We now use the main 'woocommerce' function which handles all WC admin actions
    const { data, error } = await supabase.functions.invoke('woocommerce', {
        body: { action: 'sync_customers' }
    });

    if (error) {
        console.error('Edge Function Invocation Error:', error);

        // Try to parse the response body from the error if available
        if (error instanceof Error && 'context' in error) {
            const context = (error as any).context;
            if (context && typeof context.json === 'function') {
                context.json().then((body: any) => {
                    console.error('Edge Function Error Body:', body);
                }).catch(() => {
                    console.error('Could not parse error body');
                });
            }
        }

        if (error instanceof Error) {
            console.error('Error Details:', error.message, error.stack);
        }
        throw error;
    }
    */
};

// Fetch order history for a specific customer from WC (real-time fetch)
export const fetchCustomerOrders = async (wcCustomerId: number) => {
    // UPDATED: Now points to the main 'woocommerce' function, not the broken 'woocommerce-fetch'
    const { data, error } = await supabase.functions.invoke('woocommerce', {
        body: { action: 'get_customer_orders', customer_id: wcCustomerId }
    });
    if (error) throw error;
    return data.orders as WCOrder[];
};
