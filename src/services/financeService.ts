
import { supabase } from '@/integrations/supabase/client';
import { PaymentTransaction, TransactionType, PaymentMethod, CustomerBalance, OrderPaymentStatus } from '@/types/finance';

export const financeService = {
    /**
     * Add a payment (CREDIT) to the customer's wallet.
     * Optionally link to an order immediately (which means we also create a DEBIT).
     */
    /**
     * Add a payment (CREDIT) to the customer's ledger.
     * With new logic, this is just recording money in. The allocation is calculated dynamically.
     */
    async addPayment(
        customerId: string,
        amount: number,
        method: PaymentMethod,
        note: string,
        linkedOrderId?: string
    ) {
        // Create CREDIT entry
        const { data: creditData, error: creditError } = await supabase
            .from('payment_ledger')
            .insert({
                customer_id: customerId,
                amount: amount,
                transaction_type: 'CREDIT',
                payment_method: method,
                reference_note: note,
                order_id: linkedOrderId || null // Reference only, allocation is dynamic
            })
            .select()
            .single();

        if (creditError) throw creditError;
        return creditData;
    },

    /**
     * @deprecated Dynamic allocation is now used. This function is kept for compatibility but does nothing or simple log.
     */
    async applyPaymentToOrder(
        customerId: string,
        orderId: string,
        amount: number,
        note: string = 'Applied to order'
    ) {
        console.warn('applyPaymentToOrder is deprecated. Allocation is automatic.');
        return null;
    },

    /**
     * Get full ledger for a customer
     */
    async getCustomerLedger(customerId: string): Promise<PaymentTransaction[]> {
        const { data, error } = await supabase
            .from('payment_ledger')
            .select('*')
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as PaymentTransaction[];
    },

    /**
     * Calculate Customer Stats (Global Pool)
     */
    async getCustomerBalance(customerId: string): Promise<CustomerBalance> {
        // Fetch all credits (Payments)
        const { data: payments, error: payError } = await supabase
            .from('payment_ledger')
            .select('amount')
            .eq('customer_id', customerId)
            .eq('transaction_type', 'CREDIT');

        if (payError) throw payError;

        // Fetch all debits (Orders)
        const { data: orders, error: ordError } = await supabase
            .from('orders')
            .select('order_total')
            .eq('customer_id', customerId)
            .neq('order_status', 'cancelled'); // Exclude cancelled?

        if (ordError) throw ordError;

        const total_paid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
        const total_used = orders.reduce((sum, o) => sum + (o.order_total || 0), 0);

        return {
            total_paid,
            total_used,
            balance: total_paid - total_used // If positive, it's advance. If negative, it's due.
        };
    },

    /**
     * Get Order Payment Status - Calculated via FIFO
     */
    async getOrderPaymentStatus(orderId: string, orderTotal: number): Promise<OrderPaymentStatus> {
        // This is inefficient for single order if we strictly follow FIFO over all history.
        // We need to know the order's context.
        // For simplicity/performance, let's fetch the batch version for just this order's customer?
        // Or getting the customer ID is needed.
        // To avoid complexity, we can just return a placeholder or refactor caller to use batch.
        // Assuming caller has customerId, but here we just have orderId.

        // Let's resolve customerId first
        const { data: order } = await supabase
            .from('orders')
            .select('customer_id')
            .eq('id', orderId)
            .single();

        if (!order || !order.customer_id) {
            return { order_total: orderTotal, paid_amount: 0, pending_amount: orderTotal };
        }

        const map = await this.getBatchOrderPaymentStatus([{ order_id: orderId, total: orderTotal, customer_id: order.customer_id }]);
        return map[orderId];
    },

    /**
     * Batch fetch payment status with FIFO Allocation
     */
    async getBatchOrderPaymentStatus(orders: { order_id: string; total: number; customer_id?: string }[]): Promise<Record<string, OrderPaymentStatus>> {
        if (orders.length === 0) return {};

        // 1. Identify distinct customers
        const customerIds = [...new Set(orders.map(o => o.customer_id).filter(Boolean))] as string[];

        if (customerIds.length === 0) return {}; // Need customer IDs to calculate

        // 2. Fetch ALL Orders and ALL Payments for these customers
        // We need to order them by date created to perform FIFO
        const { data: allOrders, error: ordError } = await supabase
            .from('orders')
            .select('id, customer_id, order_total, created_at')
            .in('customer_id', customerIds)
            .neq('order_status', 'cancelled')
            .order('created_at', { ascending: true }); // Oldest first

        if (ordError) throw ordError;

        const { data: allPayments, error: payError } = await supabase
            .from('payment_ledger')
            .select('id, customer_id, amount, created_at')
            .in('customer_id', customerIds)
            .eq('transaction_type', 'CREDIT')
            .order('created_at', { ascending: true });

        if (payError) throw payError;

        // 3. Perform FIFO Allocation per customer
        const statusMap: Record<string, OrderPaymentStatus> = {};

        // Initialize requested orders map
        orders.forEach(o => {
            statusMap[o.order_id] = {
                order_total: o.total,
                paid_amount: 0,
                pending_amount: o.total,
                is_advance_covered: false
            };
        });

        customerIds.forEach(custId => {
            const custOrders = allOrders.filter(o => o.customer_id === custId);
            const custPayments = allPayments.filter(p => p.customer_id === custId);

            let availableCredit = custPayments.reduce((sum, p) => sum + Number(p.amount), 0);

            // Allocate credit to orders (Oldest First)
            custOrders.forEach((order) => {
                const orderTotal = Number(order.order_total || 0);
                let allocated = 0;

                if (availableCredit > 0) {
                    if (availableCredit >= orderTotal) {
                        allocated = orderTotal;
                        availableCredit -= orderTotal;
                    } else {
                        allocated = availableCredit;
                        availableCredit = 0;
                    }
                }

                // If this order is in our requested batch, update its status
                if (statusMap[order.id]) {
                    statusMap[order.id].paid_amount = allocated;
                    statusMap[order.id].pending_amount = orderTotal - allocated;

                    // Logic check: floating point precision?
                    if (statusMap[order.id].pending_amount < 0.01) statusMap[order.id].pending_amount = 0;
                }
            });

            // Note: availableCredit remaining is the "Advance Balance" for the customer
            // We could store/return this if needed for UI
        });

        return statusMap;
    }
};
