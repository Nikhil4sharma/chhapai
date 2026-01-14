// WooCommerce Helper Functions
// Shared utilities for WooCommerce edge functions

/**
 * Parse product meta data from WooCommerce line items
 * Filters out internal WooCommerce meta and prevents duplicates
 */
export function parseProductMeta(metaData: any[]): { specifications: Record<string, string>; rawMeta: any[] } {
    const specifications: Record<string, string> = {};
    const rawMeta: any[] = [];
    const seenKeys = new Set<string>(); // Track seen keys to prevent duplicates

    if (!Array.isArray(metaData)) {
        return { specifications, rawMeta };
    }

    // Keys to skip (internal WooCommerce meta + common duplicates)
    const skipKeys = [
        '_reduced_stock',
        '_restock_refunded_items',
        '_product_addons',
        '_qty',
        'pa_', // Product attributes (handled separately)
    ];

    for (const meta of metaData) {
        if (!meta.key || meta.key.startsWith('_')) {
            continue;
        }

        // Skip if key matches any skip pattern
        if (skipKeys.some(skip => meta.key.includes(skip))) {
            continue;
        }

        const displayKey = meta.display_key || meta.key;
        const displayValue = meta.display_value || meta.value;

        // Skip if we've already seen this key (prevents duplicates)
        if (seenKeys.has(displayKey.toLowerCase())) {
            continue;
        }

        // Skip empty values
        if (!displayValue || (typeof displayValue === 'string' && !displayValue.trim())) {
            continue;
        }

        // Add to specifications
        const cleanValue = typeof displayValue === 'string' ? displayValue.trim() : String(displayValue);
        specifications[displayKey] = cleanValue;
        seenKeys.add(displayKey.toLowerCase());

        rawMeta.push({
            key: meta.key,
            display_key: displayKey,
            value: meta.value,
            display_value: displayValue,
        });
    }

    return { specifications, rawMeta };
}

/**
 * Build full address from WooCommerce address object
 */
export function buildFullAddress(addr: any): string {
    if (!addr) return '';
    const parts = [
        addr.address_1,
        addr.address_2,
        addr.city,
        addr.state,
        addr.postcode,
        addr.country,
    ].filter(Boolean);
    return parts.join(', ');
}

/**
 * Normalize order numbers for comparison
 * Removes prefixes and non-numeric characters
 */
export function normalizeOrderNumber(orderNum: string | number | null | undefined): string {
    if (!orderNum) return '';
    const str = orderNum.toString().trim();
    // Remove WC- or MAN- prefix if present
    const withoutPrefix = str.replace(/^(WC|MAN)-/i, '');
    // Return just the numeric part
    return withoutPrefix.replace(/\D/g, '');
}

/**
 * Get WooCommerce credentials from environment
 */
export function getWooCredentials(runtimeCreds?: any): {
    storeUrl: string | undefined;
    consumerKey: string | undefined;
    consumerSecret: string | undefined;
} {
    // @ts-ignore - Deno runtime
    const storeUrl = (runtimeCreds?.storeUrl || Deno.env.get('WOOCOMMERCE_STORE_URL'))?.replace(/\/$/, '');
    // @ts-ignore - Deno runtime
    const consumerKey = runtimeCreds?.consumerKey || Deno.env.get('WOOCOMMERCE_CONSUMER_KEY');
    // @ts-ignore - Deno runtime
    const consumerSecret = runtimeCreds?.consumerSecret || Deno.env.get('WOOCOMMERCE_CONSUMER_SECRET');

    return { storeUrl, consumerKey, consumerSecret };
}

/**
 * Create WooCommerce API auth header
 */
export function createWooAuth(consumerKey: string, consumerSecret: string): string {
    return btoa(`${consumerKey}:${consumerSecret}`);
}

/**
 * Format WooCommerce order for frontend
 */
export function formatWooOrder(wooOrder: any) {
    const parseProductSpecs = (lineItem: any) => {
        const { specifications } = parseProductMeta(lineItem.meta_data || []);
        return specifications;
    };

    return {
        found: true,
        order: {
            id: wooOrder.id,
            order_number: wooOrder.number || wooOrder.id,
            customer_id: wooOrder.customer_id,
            customer_name: `${wooOrder.billing?.first_name || ''} ${wooOrder.billing?.last_name || ''}`.trim() || 'Unknown',
            customer_email: wooOrder.billing?.email || '',
            customer_phone: wooOrder.billing?.phone || '',
            billing_address: buildFullAddress(wooOrder.billing),
            billing_city: wooOrder.billing?.city || '',
            billing_state: wooOrder.billing?.state || '',
            billing_pincode: wooOrder.billing?.postcode || '',
            shipping_name: wooOrder.shipping?.first_name
                ? `${wooOrder.shipping.first_name} ${wooOrder.shipping.last_name || ''}`.trim()
                : `${wooOrder.billing?.first_name || ''} ${wooOrder.billing?.last_name || ''}`.trim(),
            shipping_address: buildFullAddress(wooOrder.shipping) || buildFullAddress(wooOrder.billing),
            shipping_city: wooOrder.shipping?.city || wooOrder.billing?.city || '',
            shipping_state: wooOrder.shipping?.state || wooOrder.billing?.state || '',
            shipping_pincode: wooOrder.shipping?.postcode || wooOrder.billing?.postcode || '',
            order_total: parseFloat(wooOrder.total) || 0,
            tax_total: parseFloat(wooOrder.total_tax) || 0,
            payment_status: wooOrder.status || 'pending',
            payment_method: wooOrder.payment_method_title || wooOrder.payment_method || '',
            currency: wooOrder.currency || 'INR',
            line_items: (wooOrder.line_items || []).map((item: any) => ({
                id: item.id,
                product_id: item.product_id,
                variation_id: item.variation_id || null,
                name: item.name,
                quantity: parseInt(item.quantity) || 1,
                price: parseFloat(item.price) || 0,
                total: parseFloat(item.total) || 0,
                sku: item.sku || '',
                specifications: parseProductSpecs(item),
                meta_data: item.meta_data || [],
            })),
            shipping_lines: wooOrder.shipping_lines || [],
            fee_lines: wooOrder.fee_lines || [],
            coupon_lines: wooOrder.coupon_lines || [],
            date_created: wooOrder.date_created || wooOrder.date_created_gmt,
            date_modified: wooOrder.date_modified || wooOrder.date_modified_gmt,
            status: wooOrder.status,
        }
    };
}

/**
 * Create JSON response with CORS headers
 */
export function createResponse(data: any, status: number = 200, corsHeaders: any) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}
