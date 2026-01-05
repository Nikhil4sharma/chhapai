import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Calendar, Package, User, Trash2, X, AlertTriangle, CheckCircle2, Phone, Mail, MapPin, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/context/AuthContext';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';
import { autoLogWorkAction } from '@/utils/workLogHelper';
import { Priority } from '@/types/order';

// Helper to compute priority based on days until delivery
const computePriority = (deliveryDate: Date | null | undefined): Priority => {
  if (!deliveryDate) return 'blue';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const delivery = new Date(deliveryDate);
  delivery.setHours(0, 0, 0, 0);
  const daysUntil = Math.ceil((delivery.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntil > 5) return 'blue';
  if (daysUntil >= 3) return 'yellow';
  return 'red';
};

// Helper to normalize order numbers for comparison
const normalizeOrderNumberForComparison = (orderNum: string | number | null | undefined): string => {
  if (!orderNum) return '';
  const str = orderNum.toString().trim();
  const withoutPrefix = str.replace(/^(WC|MAN)-/i, '');
  return withoutPrefix.replace(/\D/g, '');
};

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

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${Math.random().toString(36).substring(2, 9)}`;
};

export function CreateOrderDialog({
  open,
  onOpenChange,
  onOrderCreated
}: CreateOrderDialogProps) {
  const { user, session, role, isAdmin } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [isFetchingWooCommerce, setIsFetchingWooCommerce] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [orderNumberError, setOrderNumberError] = useState<string | null>(null);
  const [wooOrderData, setWooOrderData] = useState<any>(null);
  const [isWooCommerceOrder, setIsWooCommerceOrder] = useState(false);
  const [wooCommerceCheckStatus, setWooCommerceCheckStatus] = useState<'idle' | 'checking' | 'found' | 'not_found' | 'error'>('idle');
  const [wooCommerceError, setWooCommerceError] = useState<string | null>(null);
  const [showPreviewCard, setShowPreviewCard] = useState(false);
  const [wooCommerceCached, setWooCommerceCached] = useState(false);
  const [wooCommerceImportedAt, setWooCommerceImportedAt] = useState<string | null>(null);
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>(undefined);

  // Customer Search State
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState<any[]>([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);


  // CRITICAL FIX: Track the order number that was used for the current WooCommerce fetch
  // This prevents race conditions where a slow fetch for order A completes after user
  // has already changed to order B, causing stale data to be imported
  const wooCommerceFetchOrderNumberRef = useRef<string | null>(null);

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
    setGlobalNotes('');
    setNewSpecKey('');
    setNewSpecValue('');
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
  };

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

  const selectCustomer = (c: any) => {
    setCustomerData({
      ...customerData,
      name: c.name,
      email: c.email || '',
      phone: c.phone || '',
      address: c.location || '', // Approximate, since location is just string in search result
      // We might want to fetch full details here if needed, but this is a good start
    });
    setCustomerSearchOpen(false);
    toast({ title: "Customer Selected", description: "Details autofilled." });

    // Optional: Also Trigger Import in background? 
    // The user requirement said "import kr ske". 
    // Let's do a quick background import to assign it to this user.
    if (c.id) {
      supabase.functions.invoke('woocommerce', {
        body: { action: 'import_customer', wc_id: c.id }
      }).then(({ error }) => {
        if (!error) console.log("Customer automatically assigned/imported.");
      });
    }
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

  // Manual WooCommerce order fetch - ONLY called on button click
  // This replaces automatic debounced fetching for better security and control
  const checkWooCommerceOrder = useCallback(async () => {
    if (!orderNumber.trim() || !session?.access_token) {
      toast({
        title: "Error",
        description: "Please enter an order number first",
        variant: "destructive",
      });
      return;
    }

    // Check if user has permission (admin or sales only)
    if (!isAdmin && role !== 'sales') {
      toast({
        title: "Access Denied",
        description: "Only Admin and Sales can check WooCommerce orders",
        variant: "destructive",
      });
      return;
    }

    const trimmedOrderNumber = orderNumber.trim();

    try {
      setIsFetchingWooCommerce(true);
      setWooCommerceCheckStatus('checking');
      setWooCommerceError(null);

      // CRITICAL FIX: Track which order number we're fetching for
      // This prevents stale responses from overwriting data for a different order
      wooCommerceFetchOrderNumberRef.current = trimmedOrderNumber;

      // CRITICAL: Clear any previous WooCommerce data before fetching new one
      setWooOrderData(null);
      setIsWooCommerceOrder(false);

      console.log('[CreateOrderDialog] Manually checking WooCommerce order:', trimmedOrderNumber, 'tracked ref:', wooCommerceFetchOrderNumberRef.current);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }

      const requestBody = {
        order_number: trimmedOrderNumber,
      };

      console.log('[CreateOrderDialog] Sending request with order_number:', requestBody.order_number);

      const response = await fetch(`${supabaseUrl}/functions/v1/woocommerce-fetch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorCode = errorData.error;
        const errorMessage = errorData.message || 'An error occurred';

        // Handle standardized error codes
        if (errorCode === 'UNAUTHORIZED' || response.status === 401 || response.status === 403) {
          setWooCommerceError('You are not authorized to check WooCommerce orders');
          setWooCommerceCheckStatus('error');
          toast({
            title: "Access Denied",
            description: "You are not authorized",
            variant: "destructive",
          });
          return;
        } else if (errorCode === 'ORDER_NOT_FOUND') {
          setWooCommerceCheckStatus('not_found');
          setWooCommerceError(null);
          return;
        } else if (errorCode === 'ORDER_NUMBER_MISMATCH') {
          setWooCommerceError(errorMessage);
          setWooCommerceCheckStatus('error');
          toast({
            title: "Order Mismatch",
            description: errorMessage,
            variant: "destructive",
          });
          return;
        } else if (errorCode === 'WOOCOMMERCE_ERROR' || response.status === 500) {
          setWooCommerceError(errorMessage || 'WooCommerce service unavailable');
          setWooCommerceCheckStatus('error');
          toast({
            title: "Service Unavailable",
            description: errorMessage || "WooCommerce service unavailable",
            variant: "destructive",
          });
          return;
        } else {
          // Generic error
          setWooCommerceError(errorMessage);
          setWooCommerceCheckStatus('error');
          toast({
            title: "Error",
            description: errorMessage,
            variant: "destructive",
          });
          return;
        }
      }

      const data = await response.json();

      // CRITICAL FIX: Verify this response is still valid for the current order number
      // If user changed order number while fetch was in progress, discard this stale response
      const currentOrderNumber = orderNumber.trim();
      if (wooCommerceFetchOrderNumberRef.current !== currentOrderNumber) {
        console.warn('[CreateOrderDialog] STALE RESPONSE IGNORED: Fetch was for', wooCommerceFetchOrderNumberRef.current, 'but current order is', currentOrderNumber);
        return; // Discard stale response
      }

      if (data.found && data.order) {
        console.log('[CreateOrderDialog] WooCommerce order found for order_number:', trimmedOrderNumber);
        console.log('[CreateOrderDialog] Received order data - order_number:', data.order.order_number);

        // CRITICAL FIX: Normalize both order numbers before comparison
        // WooCommerce might return order number in different format (e.g., "53534" vs "WC-53534")
        // We compare the numeric part only to handle format differences
        const requestedNormalized = normalizeOrderNumberForComparison(trimmedOrderNumber);
        const receivedOrderNumber = data.order.order_number?.toString().trim();
        const receivedNormalized = normalizeOrderNumberForComparison(receivedOrderNumber);

        console.log('[CreateOrderDialog] Order number comparison:', {
          requested: trimmedOrderNumber,
          requestedNormalized,
          received: receivedOrderNumber,
          receivedNormalized,
          match: requestedNormalized === receivedNormalized
        });

        // CRITICAL FIX: Compare normalized order numbers (numeric part only)
        // This handles cases where WooCommerce returns "53534" but we requested "WC-53534" or vice versa
        if (receivedNormalized && requestedNormalized && receivedNormalized !== requestedNormalized) {
          console.error('[CreateOrderDialog] ERROR: Order number mismatch after normalization!', {
            requested: trimmedOrderNumber,
            requestedNormalized,
            received: receivedOrderNumber,
            receivedNormalized
          });
          setWooCommerceError(`Order number mismatch: Expected ${trimmedOrderNumber}, but WooCommerce returned order ${receivedOrderNumber}. Please verify the order number.`);
          setWooCommerceCheckStatus('error');
          setWooOrderData(null);
          return;
        }

        // If normalized numbers match, proceed (even if format differs)
        console.log('[CreateOrderDialog] Order number verified - normalized match:', requestedNormalized);

        setWooCommerceCheckStatus('found');
        setWooCommerceError(null);
        // CRITICAL: Only set data if it matches the current order number
        setWooOrderData(data.order);
        // Show preview card instead of auto-importing
        setShowPreviewCard(true);
        setWooCommerceCached(data.cached || false);
        setWooCommerceImportedAt(data.imported_at || null);
      } else {
        // CRITICAL FIX: Verify this response is still valid before updating state
        const currentOrderNumber = orderNumber.trim();
        if (wooCommerceFetchOrderNumberRef.current !== currentOrderNumber) {
          console.warn('[CreateOrderDialog] STALE RESPONSE IGNORED: Fetch was for', wooCommerceFetchOrderNumberRef.current, 'but current order is', currentOrderNumber);
          return; // Discard stale response
        }

        console.log('[CreateOrderDialog] WooCommerce order not found for order_number:', trimmedOrderNumber);
        setWooCommerceCheckStatus('not_found');
        setWooCommerceError(null);
        // Clear any stale data
        setWooOrderData(null);
      }
    } catch (error: any) {
      console.error('[CreateOrderDialog] Error checking WooCommerce order:', error);
      setWooCommerceCheckStatus('error');

      // Network error
      if (error.message?.includes('fetch') || error.message?.includes('network')) {
        setWooCommerceError('Unable to connect to WooCommerce');
        toast({
          title: "Network Error",
          description: "Unable to connect to WooCommerce",
          variant: "destructive",
        });
      } else {
        setWooCommerceError(error.message || 'Failed to check WooCommerce order');
        toast({
          title: "Error",
          description: error.message || "Failed to check WooCommerce order",
          variant: "destructive",
        });
      }
    } finally {
      setIsFetchingWooCommerce(false);
    }
  }, [orderNumber, session, isAdmin, role, toast]);

  // Import WooCommerce order data - called when user clicks "Import Order from WooCommerce"
  // This autofills the form and locks imported fields for security
  // Handle confirmation and import WooCommerce order
  const handleConfirmImport = useCallback(async () => {
    if (!wooOrderData) return;

    // CRITICAL FIX: Verify wooOrderData belongs to the current order number
    const currentOrderNumber = orderNumber.trim();
    const wooOrderNumber = wooOrderData.order_number?.toString().trim();

    // Normalize both for comparison
    const currentNormalized = normalizeOrderNumberForComparison(currentOrderNumber);
    const wooNormalized = normalizeOrderNumberForComparison(wooOrderNumber);

    if (wooNormalized && currentNormalized && wooNormalized !== currentNormalized) {
      console.error('[CreateOrderDialog] IMPORT BLOCKED: Order mismatch');
      toast({
        title: "Order Mismatch",
        description: `WooCommerce data is for order ${wooOrderNumber}, but you're creating order ${currentOrderNumber}. Please check the order number again.`,
        variant: "destructive",
      });
      setWooOrderData(null);
      setWooCommerceCheckStatus('idle');
      setShowPreviewCard(false);
      return;
    }

    console.log('[CreateOrderDialog] Confirming import for order:', currentOrderNumber);

    // Cache the import in database (idempotency)
    if (!user) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive",
      });
      return;
    }

    try {
      const wooOrderId = wooOrderData.id;
      if (wooOrderId) {
        // Check if already cached
        const { data: existingCache } = await supabase
          .from('woocommerce_imports')
          .select('id')
          .eq('woocommerce_order_id', wooOrderId)
          .maybeSingle();

        // Only cache if not already cached
        if (!existingCache) {
          const { error: cacheError } = await supabase
            .from('woocommerce_imports')
            .insert({
              woocommerce_order_id: wooOrderId,
              order_number: wooOrderNumber || currentOrderNumber,
              sanitized_payload: wooOrderData,
              imported_by: user.id,
            });

          if (cacheError) {
            console.error('[CreateOrderDialog] Error caching import:', cacheError);
            // Continue with import even if cache fails
          }
        }
      }
    } catch (error) {
      console.error('[CreateOrderDialog] Error during cache operation:', error);
      // Continue with import even if cache fails
    }

    // Now proceed with import
    importWooCommerceOrder();
  }, [wooOrderData, orderNumber, user, toast]);

  const importWooCommerceOrder = useCallback(() => {
    if (!wooOrderData) return;

    console.log('[CreateOrderDialog] Importing WooCommerce order data for order:', orderNumber.trim());

    // Keep the order number as entered by user (don't auto-format)
    // User may have entered just the number, we keep it as is
    // Order number field becomes read-only after import

    // Autofill customer data (fields become read-only after import)
    setCustomerData({
      name: wooOrderData.customer_name || '',
      phone: wooOrderData.customer_phone || '',
      email: wooOrderData.customer_email || '',
      address: wooOrderData.billing_address || '',
      city: wooOrderData.billing_city || '',
      state: wooOrderData.billing_state || '',
      pincode: wooOrderData.billing_pincode || '',
    });

    // Autofill products from line items
    if (wooOrderData.line_items && wooOrderData.line_items.length > 0) {
      const autofilledProducts = wooOrderData.line_items.map((item: any) => ({
        id: generateId(),
        name: item.name || '',
        quantity: item.quantity || 1,
        specifications: item.specifications || {},
      }));
      setProducts(autofilledProducts);
    }

    // Set delivery date if available (parse from order_date or use a default)
    if (wooOrderData.order_date) {
      const orderDate = new Date(wooOrderData.order_date);
      // Set delivery date to 7 days from order date (or user can change)
      const defaultDeliveryDate = new Date(orderDate);
      defaultDeliveryDate.setDate(defaultDeliveryDate.getDate() + 7);
      setDeliveryDate(defaultDeliveryDate);
    }

    // Set global notes with order info
    const notes = `Order imported from WooCommerce\nOrder Number: ${wooOrderData.order_number}\nTotal: ${wooOrderData.currency} ${wooOrderData.order_total}\nPayment Status: ${wooOrderData.payment_status}`;
    setGlobalNotes(notes);

    setIsWooCommerceOrder(true);
    setShowPreviewCard(false);
    toast({
      title: "Order Imported",
      description: "WooCommerce order data has been imported. Customer fields are now locked.",
    });
  }, [wooOrderData, orderNumber, toast]);

  // Debounce timer ref for duplicate check only (NO automatic WooCommerce fetch)
  const duplicateCheckTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Validate order number on change - immediate update, debounced duplicate check ONLY
  // NO automatic WooCommerce lookup - user must click button manually
  const handleOrderNumberChange = useCallback((value: string) => {
    // Immediately update the input value
    setOrderNumber(value);

    // Clear existing timer
    if (duplicateCheckTimerRef.current) {
      clearTimeout(duplicateCheckTimerRef.current);
    }

    // Clear error and WooCommerce data when order number changes
    setOrderNumberError(null);
    setWooOrderData(null);
    setIsWooCommerceOrder(false);
    setWooCommerceCheckStatus('idle');
    setWooCommerceError(null);

    // CRITICAL FIX: Invalidate the fetch ref when order number changes
    // This ensures any in-flight fetches will be discarded as stale
    wooCommerceFetchOrderNumberRef.current = null;

    // IMPORTANT: Clear all imported form data when order number changes
    // This prevents showing data from previous order (e.g., 53534)
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
    setGlobalNotes('');

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
  }, [checkOrderNumberDuplicate]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (duplicateCheckTimerRef.current) {
        clearTimeout(duplicateCheckTimerRef.current);
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

      // Calculate priority automatically based on delivery date
      const computedPriority = computePriority(deliveryDate);

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
          priority: computedPriority, // Automatically calculated from delivery date
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
          priority: computedPriority, // Automatically calculated from delivery date
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
        priority: computedPriority, // Automatically calculated from delivery date
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
        <DialogTitle className="sr-only">Create New Order</DialogTitle>
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
                    <div className="flex gap-2">
                      <Input
                        id="order_number"
                        name="order_number"
                        placeholder="e.g., 53529"
                        value={orderNumber}
                        onChange={(e) => handleOrderNumberChange(e.target.value)}
                        className={orderNumberError ? "border-destructive" : ""}
                        autoFocus
                        readOnly={isWooCommerceOrder}
                      />
                      {/* Manual WooCommerce check button - only for Admin/Sales */}
                      {(isAdmin || role === 'sales') && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={checkWooCommerceOrder}
                          disabled={!orderNumber.trim() || isFetchingWooCommerce || isWooCommerceOrder}
                          className="whitespace-nowrap"
                        >
                          {isFetchingWooCommerce ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Checking...
                            </>
                          ) : (
                            'Check WooCommerce Order'
                          )}
                        </Button>
                      )}
                    </div>
                    {isCheckingDuplicate && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Checking availability...
                      </p>
                    )}
                    {/* WooCommerce check status messages */}
                    {wooCommerceCheckStatus === 'checking' && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Checking WooCommerce...
                      </p>
                    )}
                    {showPreviewCard && wooOrderData && (
                      <div className="mt-4 space-y-3">
                        <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                          <AlertTitle className="text-yellow-800 dark:text-yellow-200">Please verify this order carefully before importing</AlertTitle>
                          <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                            Review all details below to ensure this is the correct order.
                          </AlertDescription>
                        </Alert>

                        {wooCommerceCached && wooCommerceImportedAt && (
                          <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950">
                            <AlertDescription className="text-blue-700 dark:text-blue-300">
                              Previously imported on {format(new Date(wooCommerceImportedAt), 'PPpp')}
                            </AlertDescription>
                          </Alert>
                        )}

                        <Card className="border-2">
                          <CardHeader className="pb-3 px-4 sm:px-6">
                            <CardTitle className="text-base sm:text-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                              <span>Order Preview</span>
                              <Badge variant="outline" className="text-green-600 border-green-600 text-xs sm:text-sm">
                                <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />
                                Verified
                              </Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3 sm:space-y-4 px-4 sm:px-6 pb-4 sm:pb-6">
                            {/* Order Number & Date */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Order Number</p>
                                <p className="font-semibold text-sm sm:text-base break-all">{wooOrderData.order_number}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Order Date</p>
                                <p className="font-semibold text-sm sm:text-base flex items-center gap-1.5">
                                  <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                                  <span className="break-words">
                                    {wooOrderData.order_date ? format(new Date(wooOrderData.order_date), 'PP') : 'N/A'}
                                  </span>
                                </p>
                              </div>
                            </div>

                            <Separator />

                            {/* Customer Details */}
                            <div>
                              <p className="text-xs text-muted-foreground mb-2">Customer Details</p>
                              <div className="space-y-1.5 sm:space-y-2">
                                <p className="font-medium text-sm sm:text-base flex items-start sm:items-center gap-2 break-words">
                                  <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 mt-0.5 sm:mt-0 flex-shrink-0" />
                                  <span className="break-words">{wooOrderData.customer_name || 'N/A'}</span>
                                </p>
                                {wooOrderData.customer_phone && (
                                  <p className="text-xs sm:text-sm flex items-center gap-2 text-muted-foreground break-all">
                                    <Phone className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                                    <a href={`tel:${wooOrderData.customer_phone}`} className="hover:underline break-all">
                                      {wooOrderData.customer_phone}
                                    </a>
                                  </p>
                                )}
                                {wooOrderData.customer_email && (
                                  <p className="text-xs sm:text-sm flex items-center gap-2 text-muted-foreground break-all">
                                    <Mail className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                                    <a href={`mailto:${wooOrderData.customer_email}`} className="hover:underline break-all">
                                      {wooOrderData.customer_email}
                                    </a>
                                  </p>
                                )}
                                {wooOrderData.billing_address && (
                                  <p className="text-xs sm:text-sm flex items-start gap-2 text-muted-foreground">
                                    <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 mt-0.5 flex-shrink-0" />
                                    <span className="line-clamp-3 sm:line-clamp-2 break-words">{wooOrderData.billing_address}</span>
                                  </p>
                                )}
                              </div>
                            </div>

                            <Separator />

                            {/* Products */}
                            <div>
                              <p className="text-xs text-muted-foreground mb-2">Products</p>
                              <div className="space-y-2">
                                {wooOrderData.line_items && wooOrderData.line_items.length > 0 ? (
                                  wooOrderData.line_items.map((item: any, idx: number) => (
                                    <div key={idx} className="flex items-start gap-2 p-2 sm:p-2.5 bg-muted rounded-md">
                                      <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4 mt-0.5 flex-shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs sm:text-sm font-medium line-clamp-2 break-words">{item.name || 'Unnamed Product'}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Quantity: {item.quantity || 1}</p>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-xs sm:text-sm text-muted-foreground">No products found</p>
                                )}
                              </div>
                            </div>

                            <Separator />

                            {/* Order Total */}
                            <div className="flex items-center justify-between pt-1">
                              <p className="text-xs sm:text-sm text-muted-foreground font-medium">Order Total</p>
                              <p className="font-semibold text-base sm:text-lg flex items-center gap-1">
                                <span className="text-lg sm:text-xl">₹</span>
                                <span>{wooOrderData.order_total?.toFixed(2) || '0.00'}</span>
                                {wooOrderData.currency && wooOrderData.currency !== 'INR' && (
                                  <span className="text-xs text-muted-foreground ml-1">({wooOrderData.currency})</span>
                                )}
                              </p>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Confirmation Buttons */}
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 pt-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setShowPreviewCard(false);
                              setWooOrderData(null);
                              setWooCommerceCheckStatus('idle');
                            }}
                            className="flex-1 w-full sm:w-auto"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            variant="default"
                            onClick={handleConfirmImport}
                            className="flex-1 w-full sm:w-auto"
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            <span className="hidden sm:inline">Confirm & Import</span>
                            <span className="sm:hidden">Import</span>
                          </Button>
                        </div>
                      </div>
                    )}
                    {wooCommerceCheckStatus === 'not_found' && (
                      <p className="text-xs text-muted-foreground">
                        No WooCommerce order found. You can create a manual order.
                      </p>
                    )}
                    {wooCommerceCheckStatus === 'error' && wooCommerceError && (
                      <p className="text-xs text-destructive">{wooCommerceError}</p>
                    )}
                    {isWooCommerceOrder && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        ✓ Order imported from WooCommerce (fields are locked)
                      </p>
                    )}
                    {orderNumberError && (
                      <p className="text-xs text-destructive">{orderNumberError}</p>
                    )}
                    {!orderNumberError && orderNumber.trim() && !isCheckingDuplicate && !isFetchingWooCommerce && !isWooCommerceOrder && wooCommerceCheckStatus === 'idle' && (
                      <p className="text-xs text-muted-foreground">Enter order number and click "Check WooCommerce Order" if needed</p>
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
                <div className="grid gap-2">
                  <Label htmlFor="customer_name" className="after:content-['*'] after:ml-0.5 after:text-red-500">
                    Customer Name
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="customer_name"
                      placeholder="Enter customer name"
                      value={customerData.name}
                      onChange={(e) => setCustomerData(prev => ({ ...prev, name: e.target.value }))}
                      disabled={isWooCommerceOrder}
                      className={cn(!customerData.name && "text-muted-foreground")}
                    />
                    <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="icon" disabled={isWooCommerceOrder} title="Search WooCommerce Customer" className="shrink-0 border-dashed hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all">
                          <Search className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[380px] p-0 overflow-hidden shadow-xl border-slate-200 dark:border-slate-800" align="end">
                        <div className="p-3 border-b bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
                          <div className="flex items-center gap-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-3 h-10 shadow-sm focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
                            <Search className="h-4 w-4 text-slate-400" />
                            <Input
                              placeholder="Search by name, email, or phone..."
                              className="h-full border-none focus-visible:ring-0 px-0 shadow-none bg-transparent text-sm placeholder:text-slate-400"
                              value={customerSearchQuery}
                              onChange={(e) => setCustomerSearchQuery(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleCustomerSearch()}
                              autoFocus
                            />
                            {isSearchingCustomers && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />}
                          </div>
                        </div>
                        <ScrollArea className="h-[280px] bg-slate-50/30 dark:bg-slate-950/30">
                          {customerSearchResults.length > 0 ? (
                            <div className="p-1.5 space-y-1">
                              {customerSearchResults.map(c => (
                                <div
                                  key={c.id}
                                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-colors group border border-transparent hover:border-blue-100 dark:hover:border-blue-800/50"
                                  onClick={() => selectCustomer(c)}
                                >
                                  <Avatar className="h-9 w-9 border border-slate-200 dark:border-slate-700 bg-white">
                                    <AvatarImage src={c.avatar_url} />
                                    <AvatarFallback className="bg-blue-50 text-blue-600 text-xs font-bold dark:bg-blue-900/50 dark:text-blue-300">
                                      {(c.name?.[0] || '?').toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                      <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                                        {c.name}
                                      </span>
                                      <Badge variant="outline" className="text-[10px] h-4 bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 ml-2 shrink-0">
                                        #{c.id}
                                      </Badge>
                                    </div>
                                    <div className="flex flex-col gap-0.5 mt-0.5">
                                      {c.email && (
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                                          <Mail className="h-3 w-3 opacity-70" /> {c.email}
                                        </div>
                                      )}
                                      {c.location && (
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                                          <MapPin className="h-3 w-3 opacity-70" /> {c.location}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center h-[200px] text-center px-6">
                              {isSearchingCustomers ? (
                                <div className="flex flex-col items-center gap-2">
                                  <Loader2 className="h-8 w-8 animate-spin text-blue-500 opacity-50" />
                                  <p className="text-xs text-slate-500 font-medium">Searching...</p>
                                </div>
                              ) : (
                                <>
                                  <div className="h-12 w-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
                                    <Search className="h-5 w-5 text-slate-400" />
                                  </div>
                                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                    {customerSearchQuery.length < 3 ? "Start typing to search" : "No customers found"}
                                  </p>
                                  <p className="text-xs text-slate-500 mt-1 max-w-[180px]">
                                    {customerSearchQuery.length < 3
                                      ? "Enter at least 3 characters to search by name or email."
                                      : `We couldn't find any customers matching "${customerSearchQuery}".`}
                                  </p>
                                  {customerSearchQuery.length >= 3 && (
                                    <Button variant="link" size="sm" onClick={handleCustomerSearch} className="mt-2 text-blue-600 h-auto p-0">
                                      Try searching again
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer_phone">Phone</Label>
                  <Input
                    id="customer_phone"
                    name="customer_phone"
                    placeholder="Enter phone number"
                    value={customerData.phone}
                    onChange={(e) => setCustomerData({ ...customerData, phone: e.target.value })}
                    disabled={isWooCommerceOrder}
                    className={isWooCommerceOrder ? "bg-muted cursor-not-allowed" : ""}
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
                  onChange={(e) => setCustomerData({ ...customerData, email: e.target.value })}
                  disabled={isWooCommerceOrder}
                  className={isWooCommerceOrder ? "bg-muted cursor-not-allowed" : ""}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer_address">Address</Label>
                <Input
                  id="customer_address"
                  name="customer_address"
                  placeholder="Enter full address"
                  value={customerData.address}
                  onChange={(e) => setCustomerData({ ...customerData, address: e.target.value })}
                  disabled={isWooCommerceOrder}
                  className={isWooCommerceOrder ? "bg-muted cursor-not-allowed" : ""}
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
                    onChange={(e) => setCustomerData({ ...customerData, city: e.target.value })}
                    disabled={isWooCommerceOrder}
                    className={isWooCommerceOrder ? "bg-muted cursor-not-allowed" : ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    name="state"
                    placeholder="State"
                    value={customerData.state}
                    onChange={(e) => setCustomerData({ ...customerData, state: e.target.value })}
                    disabled={isWooCommerceOrder}
                    className={isWooCommerceOrder ? "bg-muted cursor-not-allowed" : ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pincode">Pincode</Label>
                  <Input
                    id="pincode"
                    name="pincode"
                    placeholder="Pincode"
                    value={customerData.pincode}
                    onChange={(e) => setCustomerData({ ...customerData, pincode: e.target.value })}
                    disabled={isWooCommerceOrder}
                    className={isWooCommerceOrder ? "bg-muted cursor-not-allowed" : ""}
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
              {/* Priority is automatically calculated based on delivery date */}
              {deliveryDate && (
                <div className="space-y-2">
                  <Label>Priority (Auto)</Label>
                  <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                    <span className="text-sm font-medium">
                      {computePriority(deliveryDate) === 'blue' && 'Normal (Blue) - > 5 days'}
                      {computePriority(deliveryDate) === 'yellow' && 'Medium (Yellow) - 3-5 days'}
                      {computePriority(deliveryDate) === 'red' && 'Urgent (Red) - < 3 days'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Priority is automatically set based on delivery date
                  </p>
                </div>
              )}
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
