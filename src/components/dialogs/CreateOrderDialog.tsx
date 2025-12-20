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
  const { user } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [orderNumberError, setOrderNumberError] = useState<string | null>(null);
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
  };

  // Check if order number already exists - memoized to avoid recreating on every render
  const checkOrderNumberDuplicate = useCallback(async (orderNum: string): Promise<boolean> => {
    if (!orderNum.trim()) return false;
    
    try {
      setIsCheckingDuplicate(true);
      // Check in orders table
      const { data, error } = await supabase
        .from('orders')
        .select('id')
        .eq('order_id', orderNum.trim())
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error checking order number:', error);
        return false; // On error, allow creation (fail-safe)
      }
      
      return !!data; // Return true if duplicate found
    } catch (error) {
      console.error('Error checking order number:', error);
      return false; // On error, allow creation (fail-safe)
    } finally {
      setIsCheckingDuplicate(false);
    }
  }, []);

  // Debounce timer ref for duplicate check
  const duplicateCheckTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Validate order number on change - immediate update, debounced duplicate check
  const handleOrderNumberChange = useCallback((value: string) => {
    // Immediately update the input value
    setOrderNumber(value);
    
    // Clear existing timer
    if (duplicateCheckTimerRef.current) {
      clearTimeout(duplicateCheckTimerRef.current);
    }
    
    // Clear error immediately for better UX
    setOrderNumberError(null);
    
    if (!value.trim()) {
      setOrderNumberError('Order number is required');
      return;
    }
    
    // Debounce the duplicate check - wait 500ms after user stops typing
    duplicateCheckTimerRef.current = setTimeout(async () => {
      const isDuplicate = await checkOrderNumberDuplicate(value);
      if (isDuplicate) {
        setOrderNumberError('Order number already exists');
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

    // Final duplicate check before creating
    const finalCheck = await checkOrderNumberDuplicate(orderNumber.trim());
    if (finalCheck) {
      toast({
        title: "Duplicate Order Number",
        description: "Order number already exists. Please use a different order number.",
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
          shipping_name: customerData.name,
          shipping_phone: customerData.phone || null,
          shipping_address: customerData.address || null,
          shipping_city: customerData.city || null,
          shipping_state: customerData.state || null,
          shipping_pincode: customerData.pincode || null,
          delivery_date: deliveryDate?.toISOString() || null,
          priority: priority,
          source: 'manual',
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
      const orderItems = products.map(product => {
        // Validate product data
        if (!product.name || product.name.trim() === '') {
          throw new Error('Product name is required');
        }
        if (!product.quantity || product.quantity < 1) {
          throw new Error('Product quantity must be at least 1');
        }

        return {
          order_id: orderData.id,
          product_name: product.name.trim(),
          quantity: Number(product.quantity), // Ensure it's a number
          // Ensure specifications is a valid JSONB object (empty object if null/undefined)
          specifications: product.specifications && typeof product.specifications === 'object' 
            ? product.specifications 
            : {},
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

      const { error: itemsError, data: insertedItems } = await supabase
        .from('order_items')
        .insert(orderItems)
        .select();

      if (itemsError) {
        console.error('Error inserting order items:', itemsError);
        console.error('Error details:', {
          code: itemsError.code,
          message: itemsError.message,
          details: itemsError.details,
          hint: itemsError.hint,
        });
        console.error('Items being inserted:', JSON.stringify(orderItems, null, 2));
        throw new Error(`Failed to create order items: ${itemsError.message || JSON.stringify(itemsError)}`);
      }

      console.log('Successfully inserted order items:', insertedItems);

      // Create timeline entry
      const { error: timelineError } = await supabase
        .from('timeline')
        .insert({
          order_id: orderData.id,
          stage: 'sales',
          action: 'created',
          performed_by: user.id,
          performed_by_name: userName,
          notes: `Order created manually with ${products.length} product(s)`,
          is_public: true,
        });

      if (timelineError) {
        console.error('Error creating timeline entry:', timelineError);
        // Don't throw - timeline is not critical
      }

      // Auto-log work action for order creation
      const startTime = new Date();
      const endTime = new Date();
      await autoLogWorkAction(
        user.id,
        userName,
        'sales',
        orderData.id,
        orderNumber.trim(),
        null,
        'sales',
        'order_created',
        `Created manual order with ${products.length} product(s)`,
        1, // Minimum 1 minute
        products.map(p => p.name).join(', '),
        startTime,
        endTime
      );

      toast({
        title: "Order Created",
        description: `Order ${orderNumber.trim()} has been created with ${products.length} product(s)`,
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
                      placeholder="e.g., WC-12345 or MAN-001"
                      value={orderNumber}
                      onChange={(e) => handleOrderNumberChange(e.target.value)}
                      className={orderNumberError ? "border-destructive" : ""}
                      autoFocus
                    />
                    {isCheckingDuplicate && (
                      <p className="text-xs text-muted-foreground">Checking availability...</p>
                    )}
                    {orderNumberError && (
                      <p className="text-xs text-destructive">{orderNumberError}</p>
                    )}
                    {!orderNumberError && orderNumber.trim() && !isCheckingDuplicate && (
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
