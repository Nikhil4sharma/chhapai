import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { autoLogWorkAction } from '@/utils/workLogHelper';
import { reservePaperForJob } from '@/services/inventory';
import { ProductItem, CustomerData, WooCommerceOrderData } from './types';
import { generateId, normalizeOrderNumberForComparison, computePriority } from './utils';

export function useCreateOrder(
    open: boolean,
    onOpenChange: (open: boolean) => void,
    onOrderCreated?: () => void
) {
    const { user, role, isAdmin } = useAuth();

    // -- State Definitions --

    // Loading States
    const [isCreating, setIsCreating] = useState(false);
    const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
    const [isFetchingWooCommerce, setIsFetchingWooCommerce] = useState(false);
    const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);

    // Order Details
    const [orderNumber, setOrderNumber] = useState('');
    const [orderNumberError, setOrderNumberError] = useState<string | null>(null);
    const [deliveryDate, setDeliveryDate] = useState<Date | undefined>(undefined);
    const [globalNotes, setGlobalNotes] = useState('');

    // WooCommerce Integration
    const [wooOrderData, setWooOrderData] = useState<WooCommerceOrderData | null>(null);
    const [isWooCommerceOrder, setIsWooCommerceOrder] = useState(false);
    const [wooCommerceCheckStatus, setWooCommerceCheckStatus] = useState<'idle' | 'checking' | 'found' | 'not_found' | 'error'>('idle');
    const [wooCommerceError, setWooCommerceError] = useState<string | null>(null);
    const [showPreviewCard, setShowPreviewCard] = useState(false);
    const [wooCommerceCached, setWooCommerceCached] = useState(false);
    const [wooCommerceImportedAt, setWooCommerceImportedAt] = useState<string | null>(null);
    const wooCommerceFetchOrderNumberRef = useRef<string | null>(null);

    // Customer Data
    const [customerData, setCustomerData] = useState<CustomerData>({
        name: '',
        phone: '',
        email: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
    });

    // Customer Search
    const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
    const [customerSearchQuery, setCustomerSearchQuery] = useState('');
    const [customerSearchResults, setCustomerSearchResults] = useState<any[]>([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

    // Products
    const [products, setProducts] = useState<ProductItem[]>([
        { id: generateId(), name: '', quantity: 1, specifications: {} }
    ]);
    const [activeProductIndex, setActiveProductIndex] = useState<number | null>(null); // For spec addition

    // Admin Assignment
    const [selectedDepartment, setSelectedDepartment] = useState<string>('sales');
    const [selectedUser, setSelectedUser] = useState<string>('');
    const [availableUsers, setAvailableUsers] = useState<any[]>([]);

    // GST
    const [isGST, setIsGST] = useState(false);

    // -- Effects --

    // Fetch users for admin selection
    useEffect(() => {
        if (isAdmin && open) {
            const fetchUsers = async () => {
                const { data } = await supabase
                    .from('profiles')
                    .select('user_id, full_name, department');
                if (data) setAvailableUsers(data);
            };
            fetchUsers();
        }
    }, [isAdmin, open]);

    // Reset form when dialog closes
    useEffect(() => {
        if (!open) {
            resetForm();
        }
    }, [open]);

    // -- Logic Helpers --

    const resetForm = useCallback(() => {
        setCustomerData({
            name: '',
            phone: '',
            email: '',
            address: '',
            city: '',
            state: '',
            pincode: '',
        });
        setProducts([{ id: generateId(), name: '', quantity: 1, price: 0, specifications: {} }]);
        setDeliveryDate(undefined);
        setGlobalNotes('');
        setActiveProductIndex(null);
        setOrderNumber('');
        setOrderNumberError(null);
        setWooOrderData(null);
        setIsWooCommerceOrder(false);
        setWooCommerceCheckStatus('idle');
        setWooCommerceError(null);
        setShowPreviewCard(false);
        setWooCommerceCached(false);
        setWooCommerceImportedAt(null);
        setCustomerSearchOpen(false);
        setCustomerSearchQuery('');
        setCustomerSearchResults([]);
        setIsGST(false);
    }, []);

    // Customer Search Logic
    const handleCustomerSearch = async () => {
        if (!customerSearchQuery || customerSearchQuery.length < 3) return;
        setIsSearchingCustomers(true);
        try {
            const { data, error } = await supabase.functions.invoke('woocommerce', {
                body: { action: 'search_customers', query: customerSearchQuery }
            });
            if (error) throw error;
            setCustomerSearchResults(data.customers || []);
        } catch (err) {
            console.error('Customer Search Error', err);
            toast({ title: "Search Failed", description: "Could not fetch customers", variant: "destructive" });
        } finally {
            setIsSearchingCustomers(false);
        }
    };

    const selectCustomer = async (c: any) => {
        setCustomerData(prev => ({
            ...prev,
            name: c.name,
            email: c.email || '',
            phone: c.phone || '',
            address: c.location || '',
        }));
        setCustomerSearchOpen(false);
        toast({ title: "Customer Selected", description: "Details autofilled." });

        if (c.id) {
            try {
                const { data, error } = await supabase.functions.invoke('woocommerce', {
                    body: { action: 'import_customer', wc_id: c.id }
                });

                if (!error && data?.customer?.id) {
                    console.log("Customer imported/linked:", data.customer.id);
                    setSelectedCustomerId(data.customer.id);
                }
            } catch (err) {
                console.error("Failed to link customer:", err);
            }
        }
    };

    // Duplicate Check Logic
    const checkOrderNumberDuplicate = useCallback(async (orderNum: string, wooOrderId?: number): Promise<{ isDuplicate: boolean; message?: string }> => {
        if (!orderNum.trim()) return { isDuplicate: false };

        try {
            setIsCheckingDuplicate(true);

            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .select('id, order_id')
                .eq('order_id', orderNum.trim())
                .maybeSingle();

            if (orderError && orderError.code !== 'PGRST116') {
                console.error('Error checking order number:', orderError);
                return { isDuplicate: false };
            }

            if (orderData) {
                return { isDuplicate: true, message: 'Order number already exists in Order Flow' };
            }

            if (wooOrderId) {
                const { data: wooOrderData, error: wooError } = await supabase
                    .from('orders')
                    .select('id, order_id, woo_order_id')
                    .eq('woo_order_id', wooOrderId.toString())
                    .maybeSingle();

                if (wooError && wooError.code !== 'PGRST116') return { isDuplicate: false };

                if (wooOrderData) {
                    return { isDuplicate: true, message: `This WooCommerce order already exists in Order Flow (Order ID: ${wooOrderData.order_id})` };
                }
            }

            return { isDuplicate: false };
        } catch (error) {
            console.error('Error checking order number:', error);
            return { isDuplicate: false };
        } finally {
            setIsCheckingDuplicate(false);
        }
    }, []);

    const duplicateCheckTimerRef = useRef<NodeJS.Timeout | null>(null);

    const handleOrderNumberChange = useCallback((value: string) => {
        setOrderNumber(value);

        if (duplicateCheckTimerRef.current) clearTimeout(duplicateCheckTimerRef.current);

        setOrderNumberError(null);
        setWooOrderData(null);
        setIsWooCommerceOrder(false);
        setWooCommerceCheckStatus('idle');
        setWooCommerceError(null);
        wooCommerceFetchOrderNumberRef.current = null;

        setCustomerData({
            name: '', phone: '', email: '', address: '', city: '', state: '', pincode: '',
        });
        setProducts([{ id: generateId(), name: '', quantity: 1, specifications: {} }]);
        setDeliveryDate(undefined);
        setProducts([{ id: generateId(), name: '', quantity: 1, specifications: {} }]);
        setDeliveryDate(undefined);
        setGlobalNotes('');
        setSelectedCustomerId(null);

        if (!value.trim()) {
            setOrderNumberError('Order number is required');
            return;
        }

        duplicateCheckTimerRef.current = setTimeout(async () => {
            const result = await checkOrderNumberDuplicate(value);
            if (result.isDuplicate) {
                setOrderNumberError(result.message || 'Order number already exists');
            }
        }, 500);
    }, [checkOrderNumberDuplicate]);


    // WooCommerce Fetch Logic
    const checkWooCommerceOrder = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();

        // Validation
        if (!orderNumber.trim()) {
            toast({ title: 'Error', description: 'Order number is required', variant: 'destructive' });
            return;
        }

        if (!customerData.name || !customerData.name.trim()) {
            toast({ title: 'Error', description: 'Customer name is required', variant: 'destructive' });
            return;
        }

        if (products.length === 0 || products.some(p => !p.name.trim())) {
            toast({ title: 'Error', description: 'At least one product with a name is required', variant: 'destructive' });
            return;
        }


        if (!isAdmin && role !== 'sales') {
            toast({ title: "Access Denied", description: "Only Admin and Sales can check WooCommerce orders", variant: "destructive" });
            return;
        }

        const trimmedOrderNumber = orderNumber.trim();

        try {
            setIsFetchingWooCommerce(true);
            setWooCommerceCheckStatus('checking');
            setWooCommerceError(null);
            wooCommerceFetchOrderNumberRef.current = trimmedOrderNumber;
            setWooOrderData(null);
            setIsWooCommerceOrder(false);

            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const response = await fetch(`${supabaseUrl}/functions/v1/woocommerce`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
                },
                body: JSON.stringify({
                    action: 'order-by-number',
                    orderNumber: trimmedOrderNumber
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.message || 'Failed to check WooCommerce order');
            }

            const data = await response.json();

            if (wooCommerceFetchOrderNumberRef.current !== trimmedOrderNumber) return;

            if (data.found && data.order) {
                // Normalize for comparison sanity check
                // We assume normalizeOrderNumberForComparison is available in scope or imports
                const requestedNormalized = normalizeOrderNumberForComparison ? normalizeOrderNumberForComparison(trimmedOrderNumber) : trimmedOrderNumber.replace(/\D/g, '');
                const receivedNormalizedNumber = normalizeOrderNumberForComparison ? normalizeOrderNumberForComparison(data.order.order_number) : data.order.order_number.toString().replace(/\D/g, '');
                const receivedNormalizedId = data.order.id.toString();

                // Relaxed Validation: Match either Number OR ID
                const matchesNumber = receivedNormalizedNumber && requestedNormalized && receivedNormalizedNumber === requestedNormalized;
                const matchesId = receivedNormalizedId && requestedNormalized && receivedNormalizedId === requestedNormalized;

                if (!matchesNumber && !matchesId) {
                    setWooCommerceError(`Order number mismatch: Expected ${trimmedOrderNumber}, but got ${data.order.order_number} (ID: ${data.order.id})`);
                    setWooCommerceCheckStatus('error');
                    return;
                }

                setWooCommerceCheckStatus('found');
                setWooOrderData(data.order);
                setShowPreviewCard(true);
                setWooCommerceCached(false); // Not supported in main function yet
                setWooCommerceImportedAt(null);
            } else {
                setWooCommerceCheckStatus('not_found');
            }
        } catch (error: any) {
            console.error('WooCommerce Check Error:', error);
            setWooCommerceCheckStatus('error');
            setWooCommerceError(error.message);
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsFetchingWooCommerce(false);
        }
    }, [orderNumber, role, isAdmin]);

    const handleConfirmImport = useCallback(async () => {
        if (!wooOrderData || !user) return;

        // Cache import (fire and forget)
        const wooOrderId = wooOrderData.id;
        if (wooOrderId) {
            const { data: existing } = await supabase.from('woocommerce_imports').select('id').eq('woocommerce_order_id', wooOrderId).maybeSingle();
            if (!existing) {
                supabase.from('woocommerce_imports').insert({
                    woocommerce_order_id: wooOrderId,
                    order_number: wooOrderData.order_number || orderNumber,
                    sanitized_payload: wooOrderData,
                    imported_by: user.id
                }).then(({ error }) => {
                    if (error) console.error('Cache error', error);
                });
            }
        }

        // Search for existing customer to link (Read-Only check)
        let linkedCustomerId: string | null = null;
        try {
            if (wooOrderData.customer_email) {
                const { data: existing } = await supabase
                    .from('wc_customers')
                    .select('id')
                    .eq('email', wooOrderData.customer_email)
                    .limit(1)
                    .maybeSingle();
                if (existing) linkedCustomerId = existing.id;
            }
            if (!linkedCustomerId && wooOrderData.customer_phone) {
                const { data: existing } = await supabase
                    .from('wc_customers')
                    .select('id')
                    .eq('phone', wooOrderData.customer_phone)
                    .limit(1)
                    .maybeSingle();
                if (existing) linkedCustomerId = existing.id;
            }
        } catch (err) {
            console.error("Error linking customer:", err);
        }

        if (linkedCustomerId) {
            setSelectedCustomerId(linkedCustomerId);
        }

        // Populate Form
        setCustomerData({
            name: wooOrderData.customer_name || '',
            phone: wooOrderData.customer_phone || '',
            email: wooOrderData.customer_email || '',
            address: wooOrderData.billing_address || '',
            city: wooOrderData.billing_city || '',
            state: wooOrderData.billing_state || '',
            pincode: wooOrderData.billing_pincode || '',
        });

        if (wooOrderData.line_items?.length) {
            setProducts(wooOrderData.line_items.map((item: any) => ({
                id: generateId(),
                name: item.name || '',
                quantity: item.quantity || 1,
                price: item.price ? Number(item.price) : (Number(item.total) / (Number(item.quantity) || 1)) || 0,
                specifications: {
                    ...(item.specifications || {}),
                    ...(Array.isArray(item.meta_data) ? item.meta_data.reduce((acc: any, meta: any) => {
                        if (!meta.key.startsWith('_')) {
                            acc[meta.key] = meta.value;
                        }
                        return acc;
                    }, {}) : {}),
                },
            })));
        }

        if (wooOrderData.order_date) {
            const orderDate = new Date(wooOrderData.order_date);
            const delivery = new Date(orderDate);
            delivery.setDate(delivery.getDate() + 7);
            setDeliveryDate(delivery);
        }

        setGlobalNotes(`Order imported from WooCommerce\nOrder Number: ${wooOrderData.order_number}\nTotal: ${wooOrderData.currency} ${wooOrderData.order_total}\nPayment Status: ${wooOrderData.payment_status}`);

        setIsWooCommerceOrder(true);
        setShowPreviewCard(false);
        if (isAdmin) setSelectedDepartment('sales');
        toast({ title: "Order Imported", description: "Form populated from WooCommerce. Review and click Create." });
    }, [wooOrderData, orderNumber, user, isAdmin]);


    // Product Helpers
    const addProduct = () => setProducts([...products, { id: generateId(), name: '', quantity: 1, specifications: {} }]);

    const removeProduct = (index: number) => {
        if (products.length > 1) setProducts(products.filter((_, i) => i !== index));
    };

    const updateProduct = (index: number, field: keyof ProductItem, value: any) => {
        const newProducts = [...products];
        newProducts[index] = { ...newProducts[index], [field]: value };
        setProducts(newProducts);
    };

    const addSpecification = (productIndex: number, key: string, value: string) => {
        if (!key.trim() || !value.trim()) return;
        const newProducts = [...products];
        if (!newProducts[productIndex].specifications) newProducts[productIndex].specifications = {};
        newProducts[productIndex].specifications[key.trim()] = value.trim();
        setProducts(newProducts);
    };

    const removeSpecification = (productIndex: number, key: string) => {
        const newProducts = [...products];
        delete newProducts[productIndex].specifications[key];
        setProducts(newProducts);
    };


    // Submission Logic
    const handleCreate = async () => {
        // Validation
        const errors = [];
        if (isAdmin && (!selectedDepartment || !selectedUser)) errors.push("Admin must assign department and user");
        if (!orderNumber.trim()) errors.push("Order number is required");
        if (!customerData.name.trim()) errors.push("Customer name is required");
        if (!deliveryDate) errors.push("Delivery date is required");

        products.forEach((p, i) => {
            if (!p.name.trim()) errors.push(`Product ${i + 1} name required`);
            const hasSpecs = Object.keys(p.specifications || {}).length > 0;
            if (!hasSpecs) errors.push(`Product ${i + 1} needs at least one specification`);
        });

        if (errors.length > 0) {
            toast({ title: "Validation Error", description: errors[0], variant: "destructive" });
            return;
        }

        const dupCheck = await checkOrderNumberDuplicate(orderNumber, wooOrderData?.id);
        if (dupCheck.isDuplicate) {
            toast({ title: "Duplicate Order", description: dupCheck.message, variant: "destructive" });
            return;
        }

        setIsCreating(true);

        try {
            if (!user) throw new Error('User not authenticated');

            const { data: profile } = await supabase.from('profiles').select('full_name').eq('user_id', user.id).single();
            const userName = profile?.full_name || user.email || 'Unknown';
            const finalDept = isAdmin ? selectedDepartment : 'sales';
            // Auto-assign creating user (Sales) if not Admin.
            // If Admin, use selected user.
            const finalUser = isAdmin ? selectedUser : user.id;
            const computedPriority = computePriority(deliveryDate);

            // Determine Status
            let initialStatus = 'new_order';
            if (finalDept === 'design') initialStatus = 'design_in_progress';
            else if (finalDept === 'prepress') initialStatus = 'prepress_in_progress';
            else if (finalDept === 'production') initialStatus = 'production_in_progress';
            else if (finalDept === 'outsource') initialStatus = 'sent_to_vendor';

            let orderId: string;

            if (isWooCommerceOrder && wooOrderData) {
                // 🚀 ATOMIC RPC PATH (System Design Fix)
                const rpcPayload = {
                    order_id: orderNumber.trim(), // Use the CONFIRMED order number
                    assigned_user_id: finalUser, // CRITICAL: This was missing!
                    status: wooOrderData.status || 'processing',
                    payment_status: 'pending', // Force pending to allow manual payment tracking
                    total: isWooCommerceOrder ? (wooOrderData.order_total || 0) : 0,
                    customer: {
                        id: wooOrderData.customer_id?.toString() || `guest-${customerData.email}`,
                        name: customerData.name,
                        email: customerData.email,
                        phone: customerData.phone,
                        address: customerData.address,
                        // RPC will use this to upsert wc_customers safely
                    },
                    items: products.map(p => ({
                        name: p.name,
                        quantity: Number(p.quantity),
                        price: Number(p.price) || 0,
                        specs: p.specifications
                    }))
                };

                const { data: newOrderId, error: rpcError } = await supabase.rpc('import_wc_order', {
                    payload: rpcPayload
                });

                if (rpcError) throw rpcError;
                orderId = newOrderId;

                // 🪄 POST-RPC ENRICHMENT (Metadata that RPC doesn't handle)
                const { error: patchError } = await supabase.from('orders').update({
                    global_notes: globalNotes, // Corrected column name
                    delivery_date: deliveryDate ? deliveryDate.toISOString() : null,
                    priority: computedPriority,
                    assigned_user: finalUser,
                    created_by: user.id,
                    current_department: finalDept,
                    order_status: initialStatus,
                    order_total: isWooCommerceOrder ? (wooOrderData.order_total || 0) : 0, // Ensure total is set
                    department_timeline: {
                        sales: {
                            status: 'completed',
                            assigned_to: finalDept === 'sales' ? (finalUser || user.id) : user.id,
                            timestamp: new Date().toISOString()
                        }
                    },
                    // Enhance Customer/Shipping info from Form if User edited it
                    customer_name: customerData.name,
                    customer_email: customerData.email,
                    customer_phone: customerData.phone,
                    customer_address: customerData.address,
                    billing_city: customerData.city,
                    billing_state: customerData.state,
                    billing_pincode: customerData.pincode,
                    shipping_name: customerData.name,
                    shipping_address: customerData.address,
                    shipping_city: customerData.city,
                    shipping_state: customerData.state,
                    shipping_pincode: customerData.pincode,
                    woo_order_id: wooOrderData.id?.toString(), // Ensure link
                    source: 'woocommerce'
                }).eq('id', orderId);

                if (patchError) console.error("Metadata patch warning:", patchError);

                // Update Items Metadata (Stage/Assignment)
                const { error: itemPatchError } = await supabase.from('order_items')
                    .update({
                        current_stage: finalDept,
                        assigned_department: finalDept,
                        delivery_date: deliveryDate ? deliveryDate.toISOString() : null,
                        priority: computedPriority,
                        status: initialStatus
                    })
                    .eq('order_id', orderId);

                if (itemPatchError) console.error("Item patch warning:", itemPatchError);


            } else {
                // MANUAL PATH (Legacy / Manual Orders)
                let finalCustomerId = selectedCustomerId;

                if (!finalCustomerId) {
                    if (customerData.email) {
                        const { data: ex } = await supabase.from('wc_customers').select('id').eq('email', customerData.email).maybeSingle();
                        if (ex) finalCustomerId = ex.id;
                    }
                    if (!finalCustomerId && customerData.phone) {
                        const { data: ex } = await supabase.from('wc_customers').select('id').eq('phone', customerData.phone).maybeSingle();
                        if (ex) finalCustomerId = ex.id;
                    }
                    if (!finalCustomerId) {
                        const nameParts = customerData.name.trim().split(' ');
                        const { data: newCust, error: custErr } = await supabase.from('wc_customers').insert({
                            wc_customer_id: `manual_${Date.now()}`,
                            email: customerData.email,
                            first_name: nameParts[0],
                            last_name: nameParts.slice(1).join(' '),
                            phone: customerData.phone
                        }).select('id').single();

                        if (custErr) throw custErr;
                        if (newCust) finalCustomerId = newCust.id;
                    }
                }

                // Insert Order (Manual)
                const calculatedProductTotal = products.reduce((sum, p) => sum + ((Number(p.quantity) || 1) * (Number(p.price) || 0)), 0);
                const taxAmount = isGST ? (calculatedProductTotal * 0.18) : 0;
                const finalTotal = calculatedProductTotal + taxAmount;

                const { data: order, error: orderError } = await supabase.from('orders').insert({
                    order_id: orderNumber.trim(),
                    customer_id: finalCustomerId,
                    priority: computedPriority,
                    delivery_date: deliveryDate ? deliveryDate.toISOString() : null,
                    global_notes: globalNotes,
                    created_by: user.id,
                    order_total: finalTotal, // Fixed col name
                    tax_amount: taxAmount, // Keeping if exists, but order_total is key
                    order_status: initialStatus,
                    assigned_user: finalUser,
                    source: 'manual',
                    current_department: finalDept,
                    customer_name: customerData.name,
                    customer_email: customerData.email,
                    customer_phone: customerData.phone,
                    customer_address: customerData.address,
                    billing_city: customerData.city,
                    billing_state: customerData.state,
                    billing_pincode: customerData.pincode,
                    department_timeline: {
                        sales: {
                            status: 'completed',
                            assigned_to: finalDept === 'sales' ? (finalUser || user.id) : user.id,
                            timestamp: new Date().toISOString()
                        }
                    }
                }).select().single();

                if (orderError) throw orderError;
                orderId = order.id;

                // Insert Items (Manual)
                const orderItems = products.map(p => ({
                    order_id: orderId,
                    product_name: p.name.trim(),
                    quantity: Number(p.quantity),
                    specifications: { ...p.specifications, workflow_status: initialStatus },
                    priority: computedPriority,
                    line_total: (Number(p.quantity) || 1) * (Number(p.price) || 0),
                    current_stage: finalDept,
                    assigned_department: finalDept,
                    delivery_date: deliveryDate?.toISOString(),
                }));
                const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
                if (itemsError) throw itemsError;

                // Inventory Reservation
                try {
                    await Promise.all(products.map(async (p) => {
                        if (p.paperId && p.paperRequired && p.paperRequired > 0) {
                            await reservePaperForJob(orderId, p.paperId, p.paperRequired, user.id);
                        }
                    }));
                } catch (invError) {
                    console.error("Inventory reservation failed", invError);
                }
            }

            // Timeline & Work Log (Common)
            await supabase.from('timeline').insert({
                order_id: orderId,
                stage: 'sales',
                action: 'created',
                performed_by: user.id,
                performed_by_name: userName,
                notes: isWooCommerceOrder ? `Imported from WC #${wooOrderData?.order_number}` : 'Created manually',
                is_public: true
            });

            await autoLogWorkAction(
                user.id, userName, 'sales', orderId, orderNumber.trim(), null, 'sales', 'order_created',
                isWooCommerceOrder ? 'Imported from WC' : 'Manual creation',
                1, products.map(p => p.name).join(', '),
                new Date(), new Date()
            );

            toast({ title: "Order Created", description: `Order ${orderNumber} created successfully.` });

            resetForm();
            onOpenChange(false);
            onOrderCreated?.();

        } catch (error: any) {
            console.error('Create Error', error);
            toast({ title: "Creation Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsCreating(false);
        }
    };

    return {
        // State
        isCreating,
        isCheckingDuplicate,
        isFetchingWooCommerce,
        isSearchingCustomers,
        orderNumber,
        orderNumberError,
        deliveryDate,
        globalNotes,
        wooOrderData,
        isWooCommerceOrder,
        wooCommerceCheckStatus,
        wooCommerceError,
        showPreviewCard,
        wooCommerceCached,
        wooCommerceImportedAt,
        customerData,
        customerSearchOpen,
        customerSearchQuery,
        customerSearchResults,
        products,
        activeProductIndex,
        selectedDepartment,
        selectedUser,
        availableUsers,
        departmentUsers: availableUsers.filter(u => {
            const name = (u.full_name || '').toLowerCase();
            if (name === 'hi' || name.includes('rajesh')) return false;
            return u.department === selectedDepartment || (selectedDepartment === 'sales' && u.department === 'admin');
        }),

        // Setters (if needed directly)
        setOrderNumber,
        setDeliveryDate,
        setGlobalNotes,
        setCustomerData,
        setCustomerSearchOpen,
        setCustomerSearchQuery,
        setSelectedDepartment,
        setSelectedUser,
        setActiveProductIndex,

        // Actions
        handleOrderNumberChange,
        checkWooCommerceOrder,
        isGST,
        setIsGST,
        handleConfirmImport,
        handleCustomerSearch,
        selectCustomer,
        addProduct,
        removeProduct,
        updateProduct,
        addSpecification,
        removeSpecification,
        handleCreate,
        resetForm,
        setShowPreviewCard, // Added this one as it's used in UI to cancel preview
        setWooOrderData, // Used to clear data on cancel
        setWooCommerceCheckStatus // Used to clear status on cancel
    };
}
