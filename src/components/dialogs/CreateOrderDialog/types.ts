export interface ProductItem {
    id: string;
    name: string;
    quantity: number;
    price?: number;
    paperId?: string;
    paperRequired?: number;
    specifications: Record<string, string>;
}

export interface CreateOrderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onOrderCreated?: () => void;
}

export interface CustomerData {
    name: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
}

// Loose type for WooCommerce order data as it comes from an external API/Edge Function
export interface WooCommerceOrderData {
    id?: number;
    order_number?: string | number;
    order_date?: string;
    customer_name?: string;
    customer_phone?: string;
    customer_email?: string;
    billing_address?: string;
    billing_city?: string;
    billing_state?: string;
    billing_pincode?: string;
    shipping_name?: string;
    shipping_address?: string;
    shipping_city?: string;
    shipping_state?: string;
    shipping_pincode?: string;
    payment_status?: string;
    order_total?: number;
    currency?: string;
    line_items?: any[];
    [key: string]: any;
}
