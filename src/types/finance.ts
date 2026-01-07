
export type TransactionType = 'CREDIT' | 'DEBIT';
export type PaymentMethod = 'cash' | 'upi' | 'bank' | 'online';

export interface PaymentTransaction {
    id: string;
    customer_id: string;
    order_id?: string | null;
    amount: number;
    transaction_type: TransactionType;
    payment_method: PaymentMethod;
    reference_note?: string;
    created_by?: string;
    created_at: string;

    // Optional joined fields
    order_number?: string; // If we join with orders
    created_by_name?: string; // If we join with profiles
}

export interface CustomerBalance {
    total_paid: number; // Sum of CREDITS
    total_used: number; // Sum of DEBITS
    balance: number;    // Paid - Used
}

export interface OrderPaymentStatus {
    order_total: number;
    paid_amount: number; // Sum of DEBITS linked to this order
    pending_amount: number;
}
