import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Calendar, Package, User, Trash2, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { autoLogWorkAction } from '@/utils/workLogHelper';

interface ProductItem {
  id: string;
  name: string;
  quantity: number;
  specifications: Record<string, string>;
}

interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderCreated?: () => void;
}

const DEFAULT_SPEC_KEYS = ['Size', 'Material', 'Finish', 'Color', 'Printing', 'Quantity Details'];

// Helper function to generate unique ID with fallback
const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for browsers that don't support crypto.randomUUID
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${Math.random().toString(36).substring(2, 9)}`;
};

export function CreateOrderDialog({ 
  open, 
  onOpenChange,
  onOrderCreated
}: CreateOrderDialogProps) {
  const { user, session } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [isFetchingWooCommerce, setIsFetchingWooCommerce] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [orderNumberError, setOrderNumberError] = useState<string | null>(null);
  const [wooOrderData, setWooOrderData] = useState<any>(null);
  const [isWooCommerceOrder, setIsWooCommerceOrder] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>(undefined);
  
  const [customerData, setCustomerData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
  });

  const [products, setProducts] = useState<ProductItem[]>([
    { id: generateId(), name: '', quantity: 1, specifications: {} }
  ]);

  const [globalNotes, setGlobalNotes] = useState('');
  const [priority, setPriority] = useState<string>('blue');
  const [newSpecKey, setNewSpecKey] = useState('');
  const [newSpecValue, setNewSpecValue] = useState('');
  const [activeProductIndex, setActiveProductIndex] = useState<number | null>(null);

  const resetForm = () => {
    setCustomerData({
      name: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
    });
    setProducts([{ id: generateId(), name: '', quantity: 1, specifications: {} }]);
    setDeliveryDate(undefined);
    setPriority('blue');
    setGlobalNotes('');
    setNewSpecKey('');
    setNewSpecValue('');
    setActiveProductIndex(null);
    setOrderNumber('');
    setOrderNumberError(null);
    setWooOrderData(null);
    setIsWooCommerceOrder(false);
  };

  // Check if order number already exists - enhanced to check both order_id and woo_order_id
  const checkOrderNumberDuplicate = useCallback(async (orderNum: string, wooOrderId?: number): Promise<{ isDuplicate: boolean; message?: string }> => {
    if (!orderNum.trim()) return { isDuplicate: false };
    
    try {
      setIsCheckingDuplicate(true);
      
      // Check by order_id
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('id, order_id')
        .eq('order_id', orderNum.trim())
        .maybeSingle();
      
      if (orderError && orderError.code !== 'PGRST116') {
        console.error('Error checking order number:', orderError);
        return { isDuplicate: false }; // On error, allow creation (fail-safe)
      }
      
      if (orderData) {
        return { isDuplicate: true, message: 'Order number already exists in Order Flow' };
      }
      
      // If we have woo_order_id, also check by that
      if (wooOrderId) {
        const { data: wooOrderData, error: wooError } = await supabase
          .from('orders')
          .select('id, order_id, woo_order_id')
          .eq('woo_order_id', wooOrderId.toString())
          .maybeSingle();
        
        if (wooError && wooError.code !== 'PGRST116') {
          console.error('Error checking woo_order_id:', wooError);
          return { isDuplicate: false };
        }
        
        if (wooOrderData) {
          return { isDuplicate: true, message: `This WooCommerce order already exists in Order Flow (Order ID: ${wooOrderData.order_id})` };
        }
      }
      
      return { isDuplicate: false };
    } catch (error) {
      console.error('Error checking order number:', error);
      return { isDuplicate: false }; // On error, allow creation (fail-safe)
    } finally {
      setIsCheckingDuplicate(false);
    }
  }, []);

  // Fetch WooCommerce order by number
  const fetchWooCommerceOrder = useCallback(async (orderNum: string) => {
    if (!orderNum.trim() || !session?.access_token) {
      return null;
    }

    try {
      setIsFetchingWooCommerce(true);
      console.log('[CreateOrderDialog] Fetching WooCommerce order:', orderNum);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        console.error('[CreateOrderDialog] Supabase URL not configured');
        return null;
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/woocommerce`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({
          action: 'order-by-number',
          orderNumber: orderNum.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.log('[CreateOrderDialog] WooCommerce order not found:', errorData);
        return null;
      }

      const data = await response.json();
      
      if (data.found && data.order) {
        console.log('[CreateOrderDialog] WooCommerce order found:', data.order.order_number);
        return data.order;
      }

      return null;
    } catch (error) {
      console.error('[CreateOrderDialog] Error fetching WooCommerce order:', error);
      return null;
    } finally {
      setIsFetchingWooCommerce(false);
    }
  }, [session]);

  // Autofill form from WooCommerce order data
  const autofillFromWooCommerce = useCallback((wooOrder: any) => {
    if (!wooOrder) return;

    console.log('[CreateOrderDialog] Autofilling form from WooCommerce order');

    // Format order number as WC-{number} for consistency with existing system
    const formattedOrderNumber = `WC-${wooOrder.id}`;
    setOrderNumber(formattedOrderNumber);

    // Autofill customer data
    setCustomerData({
      name: wooOrder.customer_name || '',
      phone: wooOrder.customer_phone || '',
      email: wooOrder.customer_email || '',
      address: wooOrder.billing_address || '',
      city: wooOrder.billing_city || '',
      state: wooOrder.billing_state || '',
      pincode: wooOrder.billing_pincode || '',
    });

    // Autofill products from line items
    if (wooOrder.line_items && wooOrder.line_items.length > 0) {
      const autofilledProducts = wooOrder.line_items.map((item: any) => ({
        id: generateId(),
        name: item.name || '',
        quantity: item.quantity || 1,
        specifications: item.specifications || {},
      }));
      setProducts(autofilledProducts);
    }

    // Set delivery date if available (parse from date_created or use a default)
    if (wooOrder.date_created) {
      const orderDate = new Date(wooOrder.date_created);
      // Set delivery date to 7 days from order date (or user can change)
      const defaultDeliveryDate = new Date(orderDate);
      defaultDeliveryDate.setDate(defaultDeliveryDate.getDate() + 7);
      setDeliveryDate(defaultDeliveryDate);
    }

    // Set global notes with order info
    const notes = `Order imported from WooCommerce\nOrder Number: ${wooOrder.order_number}\nTotal: ${wooOrder.currency} ${wooOrder.order_total}\nPayment Status: ${wooOrder.payment_status}`;
    setGlobalNotes(notes);

    setIsWooCommerceOrder(true);
    setWooOrderData(wooOrder);
  }, []);

  // Debounce timer refs
  const duplicateCheckTimerRef = useRef<NodeJS.Timeout | null>(null);
  const wooCommerceLookupTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Validate order number on change - immediate update, debounced duplicate check and WooCommerce lookup
  const handleOrderNumberChange = useCallback((value: string) => {
    // Immediately update the input value
    setOrderNumber(value);
    
    // Clear existing timers
    if (duplicateCheckTimerRef.current) {
      clearTimeout(duplicateCheckTimerRef.current);
    }
    if (wooCommerceLookupTimerRef.current) {
      clearTimeout(wooCommerceLookupTimerRef.current);
    }
    
    // Clear error and WooCommerce data immediately for better UX
    setOrderNumberError(null);
    setWooOrderData(null);
    setIsWooCommerceOrder(false);
    
    if (!value.trim()) {
      setOrderNumberError('Order number is required');
      return;
    }
    
    // Debounce the duplicate check - wait 500ms after user stops typing
    duplicateCheckTimerRef.current = setTimeout(async () => {
      const result = await checkOrderNumberDuplicate(value);
      if (result.isDuplicate) {
        setOrderNumberError(result.message || 'Order number already exists');
      }
    }, 500);
    
    // Debounce WooCommerce lookup - wait 600ms after user stops typing
    wooCommerceLookupTimerRef.current = setTimeout(async () => {
      const wooOrder = await fetchWooCommerceOrder(value);
      if (wooOrder) {
        autofillFromWooCommerce(wooOrder);
        // Check for duplicate with woo_order_id (use number format)
        const duplicateCheck = await checkOrderNumberDuplicate(value, Number(wooOrder.id));
        if (duplicateCheck.isDuplicate) {
          setOrderNumberError(duplicateCheck.message || 'This WooCommerce order already exists in Order Flow');
        }
      }
    }, 600);
  }, [checkOrderNumberDuplicate, fetchWooCommerceOrder, autofillFromWooCommerce]);

  // Handle order number field blur - trigger immediate lookup
  const handleOrderNumberBlur = useCallback(async () => {
    if (!orderNumber.trim()) return;
    
    // Clear timers
    if (duplicateCheckTimerRef.current) {
      clearTimeout(duplicateCheckTimerRef.current);
    }
    if (wooCommerceLookupTimerRef.current) {
      clearTimeout(wooCommerceLookupTimerRef.current);
    }
    
    // Immediate duplicate check
    const duplicateResult = await checkOrderNumberDuplicate(orderNumber);
    if (duplicateResult.isDuplicate) {
      setOrderNumberError(duplicateResult.message || 'Order number already exists');
      return;
    }
    
    // Immediate WooCommerce lookup
    const wooOrder = await fetchWooCommerceOrder(orderNumber);
    if (wooOrder) {
      autofillFromWooCommerce(wooOrder);
      // Check for duplicate with woo_order_id (use number format)
      const duplicateCheck = await checkOrderNumberDuplicate(orderNumber, Number(wooOrder.id));
      if (duplicateCheck.isDuplicate) {
        setOrderNumberError(duplicateCheck.message || 'This WooCommerce order already exists in Order Flow');
      }
    }
  }, [orderNumber, checkOrderNumberDuplicate, fetchWooCommerceOrder, autofillFromWooCommerce]);

  // Handle Enter key on order number field
  const handleOrderNumberKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleOrderNumberBlur();
    }
  }, [handleOrderNumberBlur]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (duplicateCheckTimerRef.current) {
        clearTimeout(duplicateCheckTimerRef.current);
      }
      if (wooCommerceLookupTimerRef.current) {
        clearTimeout(wooCommerceLookupTimerRef.current);
      }
    };
  }, []);

  const addProduct = () => {
    setProducts([...products, { id: generateId(), name: '', quantity: 1, specifications: {} }]);
  };

  const removeProduct = (index: number) => {
    if (products.length > 1) {
      const newProducts = products.filter((_, i) => i !== index);
      setProducts(newProducts);
    }
  };

  const updateProduct = (index: number, field: keyof ProductItem, value: any) => {
    const newProducts = [...products];
    newProducts[index] = { ...newProducts[index], [field]: value };
    setProducts(newProducts);
  };

  const addSpecification = (productIndex: number, key: string, value: string) => {
    if (!key.trim() || !value.trim()) {
      console.warn('[CreateOrderDialog] Cannot add specification: key or value is empty', { key, value, productIndex });
      return;
    }
    const newProducts = [...products];
    // Ensure specifications object exists
    if (!newProducts[productIndex].specifications) {
      newProducts[productIndex].specifications = {};
    }
    newProducts[productIndex].specifications[key.trim()] = value.trim();
    setProducts(newProducts);
    // Only clear if this was the active product
    if (activeProductIndex === productIndex) {
      setNewSpecKey('');
      setNewSpecValue('');
    }
    console.log('[CreateOrderDialog] Specification added:', { productIndex, key, value, specs: newProducts[productIndex].specifications });
  };

  const removeSpecification = (productIndex: number, key: string) => {
    const newProducts = [...products];
    delete newProducts[productIndex].specifications[key];
    setProducts(newProducts);
  };

  const validateForm = (): string | null => {
    if (!orderNumber.trim()) {
      return "Order number is required";
    }
    
    if (orderNumberError) {
      return orderNumberError;
    }

    if (!customerData.name.trim()) {
      return "Customer name is required";
    }

    if (!deliveryDate) {
      return "Delivery date is required";
    }

    for (let i = 0; i < products.length; i++) {
      if (!products[i].name.trim()) {
        return `Product ${i + 1} name is required`;
      }
      // CRITICAL: Check if specifications object exists and has at least one key with non-empty value
      const specs = products[i].specifications || {};
      const specKeys = Object.keys(specs).filter(key => specs[key] && String(specs[key]).trim());
      if (specKeys.length === 0) {
        console.warn('[CreateOrderDialog] Validation failed for product', i + 1, 'specifications:', specs);
        return `Product ${i + 1} requires at least one specification`;
      }
    }

    return null;
  };

  const handleCreate = async () => {
    const error = validateForm();
    if (error) {
      toast({
        title: "Validation Error",
        description: error,
        variant: "destructive",
      });
      return;
    }

    // Final duplicate check before creating (with woo_order_id if available)
    const finalCheck = await checkOrderNumberDuplicate(
      orderNumber.trim(), 
      wooOrderData?.id
    );
    if (finalCheck.isDuplicate) {
      toast({
        title: "Duplicate Order",
        description: finalCheck.message || "This order already exists in Order Flow.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      if (!user) throw new Error('User not authenticated');
      
      // Get user profile for name
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single();
      
      const userName = profileData?.full_name || user.email || 'Unknown';
      
      // Determine source and set WooCommerce fields if applicable
      const isWooCommerceSource = isWooCommerceOrder && wooOrderData;
      const orderSource = isWooCommerceSource ? 'woocommerce' : 'manual';
      const wooOrderId = isWooCommerceSource ? Number(wooOrderData.id) : null;
      
      // Use shipping data from WooCommerce if available, otherwise use billing
      const shippingName = isWooCommerceSource && wooOrderData.shipping_name
        ? wooOrderData.shipping_name
        : customerData.name;
      const shippingAddress = isWooCommerceSource && wooOrderData.shipping_address
        ? wooOrderData.shipping_address
        : customerData.address;
      const shippingCity = isWooCommerceSource && wooOrderData.shipping_city
        ? wooOrderData.shipping_city
        : customerData.city;
      const shippingState = isWooCommerceSource && wooOrderData.shipping_state
        ? wooOrderData.shipping_state
        : customerData.state;
      const shippingPincode = isWooCommerceSource && wooOrderData.shipping_pincode
        ? wooOrderData.shipping_pincode
        : customerData.pincode;

      // Create order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_id: orderNumber.trim(),
          customer_name: customerData.name,
          customer_phone: customerData.phone || null,
          customer_email: customerData.email || null,
          customer_address: customerData.address || null,
          billing_city: customerData.city || null,
          billing_state: customerData.state || null,
          billing_pincode: customerData.pincode || null,
          shipping_name: shippingName,
          shipping_phone: customerData.phone || null,
          shipping_address: shippingAddress || null,
          shipping_city: shippingCity || null,
          shipping_state: shippingState || null,
          shipping_pincode: shippingPincode || null,
          delivery_date: deliveryDate?.toISOString() || null,
          priority: priority,
          source: orderSource,
          woo_order_id: wooOrderId,
          order_total: isWooCommerceSource ? wooOrderData.order_total : null,
          payment_status: isWooCommerceSource ? wooOrderData.payment_status : null,
          order_status: isWooCommerceSource ? wooOrderData.payment_status : null,
          global_notes: globalNotes || null,
          created_by: user.id,
          is_completed: false,
        })
        .select()
        .single();

      if (orderError) throw orderError;
      if (!orderData) throw new Error('Order creation failed');

      // Create order items for each product
      // Ensure all data types are correct and required fields are present
      const orderItems = products.map((product, index) => {
        // Validate product data
        if (!product.name || product.name.trim() === '') {
          throw new Error('Product name is required');
        }
        if (!product.quantity || product.quantity < 1) {
          throw new Error('Product quantity must be at least 1');
        }

        // Get WooCommerce line item data if available
        const wooLineItem = isWooCommerceSource && wooOrderData.line_items 
          ? wooOrderData.line_items[index] 
          : null;

        return {
          order_id: orderData.id,
          product_name: product.name.trim(),
          quantity: Number(product.quantity), // Ensure it's a number
          // Ensure specifications is a valid JSONB object (empty object if null/undefined)
          specifications: product.specifications && typeof product.specifications === 'object' 
            ? product.specifications 
            : {},
          // Store WooCommerce meta data if available
          woo_meta: wooLineItem?.meta_data || null,
          priority: priority || 'blue', // Default priority
          current_stage: 'sales',
          assigned_department: 'sales',
          delivery_date: deliveryDate?.toISOString() || null,
          need_design: false,
          is_ready_for_production: false,
          is_dispatched: false,
        };
      });

      console.log('Inserting order items:', JSON.stringify(orderItems, null, 2));

      // Ensure all fields are properly formatted and no undefined values
      const cleanedOrderItems = orderItems.map(item => ({
        order_id: item.order_id,
        product_name: item.product_name,
        quantity: Number(item.quantity) || 1,
        specifications: item.specifications || {},
        priority: item.priority || 'blue',
        current_stage: item.current_stage || 'sales',
        assigned_department: item.assigned_department || 'sales',
        delivery_date: item.delivery_date || null,
        need_design: item.need_design !== undefined ? item.need_design : false,
        is_ready_for_production: item.is_ready_for_production !== undefined ? item.is_ready_for_production : false,
        is_dispatched: item.is_dispatched !== undefined ? item.is_dispatched : false,
        // Don't include item_id - let it be NULL (it's optional and UNIQUE)
        // item_id will be set later if needed
      }));

      const { error: itemsError, data: insertedItems } = await supabase
        .from('order_items')
        .insert(cleanedOrderItems)
        .select();

      if (itemsError) {
        console.error('Error inserting order items:', itemsError);
        console.error('Error details:', {
          code: itemsError.code,
          message: itemsError.message,
          details: itemsError.details,
          hint: itemsError.hint,
          status: itemsError.status,
          statusCode: itemsError.statusCode,
        });
        console.error('Items being inserted:', JSON.stringify(cleanedOrderItems, null, 2));
        
        // Provide more specific error message
        const errorMessage = itemsError.message || itemsError.details || JSON.stringify(itemsError);
        throw new Error(`Failed to create order items: ${errorMessage}. Please check that all required fields are provided and you have permission to create items.`);
      }

      console.log('Successfully inserted order items:', insertedItems);

      // Create timeline entry
      const timelineNotes = isWooCommerceSource
        ? `Order imported from WooCommerce (Order #${wooOrderData.order_number}) with ${products.length} product(s)`
        : `Order created manually with ${products.length} product(s)`;
      
      const { error: timelineError } = await supabase
        .from('timeline')
        .insert({
          order_id: orderData.id,
          stage: 'sales',
          action: 'created',
          performed_by: user.id,
          performed_by_name: userName,
          notes: timelineNotes,
          is_public: true,
        });

      if (timelineError) {
        console.error('Error creating timeline entry:', timelineError);
        // Don't throw - timeline is not critical
      }

      // Auto-log work action for order creation
      const startTime = new Date();
      const endTime = new Date();
      const workSummary = isWooCommerceSource
        ? `Imported order from WooCommerce (Order #${wooOrderData.order_number}) with ${products.length} product(s)`
        : `Created manual order with ${products.length} product(s)`;
      
      await autoLogWorkAction(
        user.id,
        userName,
        'sales',
        orderData.id,
        orderNumber.trim(),
        null,
        'sales',
        'order_created',
        workSummary,
        1, // Minimum 1 minute
        products.map(p => p.name).join(', '),
        startTime,
        endTime
      );

      toast({
        title: "Order Created",
        description: isWooCommerceSource
          ? `Order ${orderNumber.trim()} imported from WooCommerce with ${products.length} product(s)`
          : `Order ${orderNumber.trim()} has been created with ${products.length} product(s)`,
      });

      resetForm();
      onOpenChange(false);
      onOrderCreated?.();
    } catch (error: any) {
      console.error('Error creating order:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create order",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => {
      if (!value) resetForm();
      onOpenChange(value);
    }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create New Order
          </DialogTitle>
          <DialogDescription>
            Create a new manual order with customer details and multiple products
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)]">
          <div className="p-6 space-y-6">
            {/* Order Number Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Package className="h-4 w-4" />
                Order Information
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="order_number">Order Number *</Label>
                  <div className="space-y-1">
                    <Input
                      id="order_number"
                      name="order_number"
                      placeholder="e.g., 53509 or WC-12345 or MAN-001"
                      value={orderNumber}
                      onChange={(e) => handleOrderNumberChange(e.target.value)}
                      onBlur={handleOrderNumberBlur}
                      onKeyDown={handleOrderNumberKeyDown}
                      className={orderNumberError ? "border-destructive" : ""}
                      autoFocus
                      disabled={isWooCommerceOrder}
                    />
                    {(isCheckingDuplicate || isFetchingWooCommerce) && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        {isFetchingWooCommerce && <Loader2 className="h-3 w-3 animate-spin" />}
                        {isFetchingWooCommerce ? 'Checking WooCommerce...' : 'Checking availability...'}
                      </p>
                    )}
                    {isWooCommerceOrder && !isFetchingWooCommerce && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        ✓ Order details auto-filled from WooCommerce
                      </p>
                    )}
                    {!isWooCommerceOrder && !isFetchingWooCommerce && orderNumber.trim() && !orderNumberError && !isCheckingDuplicate && (
                      <p className="text-xs text-muted-foreground">No WooCommerce order found. Creating manual order.</p>
                    )}
                    {orderNumberError && (
                      <p className="text-xs text-destructive">{orderNumberError}</p>
                    )}
                    {!orderNumberError && orderNumber.trim() && !isCheckingDuplicate && !isFetchingWooCommerce && !isWooCommerceOrder && (
                      <p className="text-xs text-green-600">✓ Order number available</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Customer Details Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <User className="h-4 w-4" />
                Customer Details
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customer_name">Customer Name *</Label>
                  <Input
                    id="customer_name"
                    name="customer_name"
                    placeholder="Enter customer name"
                    value={customerData.name}
                    onChange={(e) => setCustomerData({...customerData, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer_phone">Phone</Label>
                  <Input
                    id="customer_phone"
                    name="customer_phone"
                    placeholder="Enter phone number"
                    value={customerData.phone}
                    onChange={(e) => setCustomerData({...customerData, phone: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer_email">Email</Label>
                <Input
                  id="customer_email"
                  name="customer_email"
                  type="email"
                  placeholder="Enter email address"
                  value={customerData.email}
                  onChange={(e) => setCustomerData({...customerData, email: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer_address">Address</Label>
                <Input
                  id="customer_address"
                  name="customer_address"
                  placeholder="Enter full address"
                  value={customerData.address}
                  onChange={(e) => setCustomerData({...customerData, address: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    name="city"
                    placeholder="City"
                    value={customerData.city}
                    onChange={(e) => setCustomerData({...customerData, city: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    name="state"
                    placeholder="State"
                    value={customerData.state}
                    onChange={(e) => setCustomerData({...customerData, state: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pincode">Pincode</Label>
                  <Input
                    id="pincode"
                    name="pincode"
                    placeholder="Pincode"
                    value={customerData.pincode}
                    onChange={(e) => setCustomerData({...customerData, pincode: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Order Settings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Delivery Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !deliveryDate && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {deliveryDate ? format(deliveryDate, "PPP") : "Select delivery date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarPicker
                      mode="single"
                      selected={deliveryDate}
                      onSelect={setDeliveryDate}
                      initialFocus
                      disabled={(date) => date < new Date()}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blue">Normal (Blue)</SelectItem>
                    <SelectItem value="yellow">Medium (Yellow)</SelectItem>
                    <SelectItem value="red">Urgent (Red)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Products Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Package className="h-4 w-4" />
                  Products ({products.length})
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addProduct}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Product
                </Button>
              </div>

              <div className="space-y-4">
                {products.map((product, index) => (
                  <Card key={product.id} className="relative">
                    <CardHeader className="pb-3 pt-4 px-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          Product {index + 1}
                          {Object.keys(product.specifications).length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {Object.keys(product.specifications).length} specs
                            </Badge>
                          )}
                        </CardTitle>
                        {products.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => removeProduct(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 px-4 pb-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`product_name_${index}`}>Product Name *</Label>
                          <Input
                            id={`product_name_${index}`}
                            name={`product_name_${index}`}
                            placeholder="Enter product name"
                            value={product.name}
                            onChange={(e) => updateProduct(index, 'name', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`product_quantity_${index}`}>Quantity</Label>
                          <Input
                            id={`product_quantity_${index}`}
                            name={`product_quantity_${index}`}
                            type="number"
                            min="1"
                            value={product.quantity}
                            onChange={(e) => updateProduct(index, 'quantity', parseInt(e.target.value) || 1)}
                          />
                        </div>
                      </div>

                      {/* Specifications */}
                      <div className="space-y-2">
                        <Label className="text-sm">Specifications * (at least 1 required)</Label>
                        
                        {/* Existing specs */}
                        {Object.keys(product.specifications).length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {Object.entries(product.specifications).map(([key, value]) => (
                              <Badge key={key} variant="secondary" className="py-1 px-2">
                                <span className="font-medium">{key}:</span> {value}
                                <button
                                  type="button"
                                  className="ml-1 hover:text-destructive"
                                  onClick={() => removeSpecification(index, key)}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* Quick add specs */}
                        <div className="flex flex-wrap gap-1 mb-2">
                          {DEFAULT_SPEC_KEYS.filter(key => !product.specifications[key]).map(key => (
                            <Button
                              key={key}
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => {
                                setActiveProductIndex(index);
                                setNewSpecKey(key);
                                // Focus the value input after setting key
                                setTimeout(() => {
                                  const valueInput = document.getElementById(`spec_value_${index}`);
                                  if (valueInput) {
                                    valueInput.focus();
                                  }
                                }, 100);
                              }}
                            >
                              + {key}
                            </Button>
                          ))}
                        </div>

                        {/* Add spec form */}
                        <div className="flex gap-2">
                          <Input
                            id={`spec_key_${index}`}
                            name={`spec_key_${index}`}
                            placeholder="Spec name (e.g., Size)"
                            value={activeProductIndex === index ? newSpecKey : ''}
                            onChange={(e) => {
                              setActiveProductIndex(index);
                              setNewSpecKey(e.target.value);
                            }}
                            onFocus={() => setActiveProductIndex(index)}
                            className="flex-1"
                          />
                          <Input
                            id={`spec_value_${index}`}
                            name={`spec_value_${index}`}
                            placeholder="Value (e.g., A4)"
                            value={activeProductIndex === index ? newSpecValue : ''}
                            onChange={(e) => {
                              setActiveProductIndex(index);
                              setNewSpecValue(e.target.value);
                            }}
                            onFocus={() => setActiveProductIndex(index)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addSpecification(index, newSpecKey, newSpecValue);
                              }
                            }}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              // Get current values from inputs for this specific product
                              const keyInput = document.getElementById(`spec_key_${index}`) as HTMLInputElement;
                              const valueInput = document.getElementById(`spec_value_${index}`) as HTMLInputElement;
                              const key = keyInput?.value.trim() || (activeProductIndex === index ? newSpecKey.trim() : '');
                              const value = valueInput?.value.trim() || (activeProductIndex === index ? newSpecValue.trim() : '');
                              
                              if (key && value) {
                                addSpecification(index, key, value);
                                // Clear inputs after adding
                                if (keyInput) keyInput.value = '';
                                if (valueInput) valueInput.value = '';
                                if (activeProductIndex === index) {
                                  setNewSpecKey('');
                                  setNewSpecValue('');
                                }
                              }
                            }}
                            disabled={(() => {
                              const keyInput = document.getElementById(`spec_key_${index}`) as HTMLInputElement;
                              const valueInput = document.getElementById(`spec_value_${index}`) as HTMLInputElement;
                              const hasKey = keyInput?.value.trim() || (activeProductIndex === index && newSpecKey.trim());
                              const hasValue = valueInput?.value.trim() || (activeProductIndex === index && newSpecValue.trim());
                              return !hasKey || !hasValue;
                            })()}
                          >
                            Add
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <Separator />

            {/* Order Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Order Notes</Label>
              <Textarea
                id="notes"
                placeholder="Enter any special instructions or notes..."
                value={globalNotes}
                onChange={(e) => setGlobalNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating || isCheckingDuplicate}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreate} 
            disabled={isCreating || isCheckingDuplicate || !!orderNumberError || !orderNumber.trim()}
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Create Order ({products.length} product{products.length > 1 ? 's' : ''})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
