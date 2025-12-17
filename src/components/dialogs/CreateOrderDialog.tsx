import { useState } from 'react';
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
import { collection, doc, setDoc, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

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
    { id: crypto.randomUUID(), name: '', quantity: 1, specifications: {} }
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
    setProducts([{ id: crypto.randomUUID(), name: '', quantity: 1, specifications: {} }]);
    setDeliveryDate(undefined);
    setPriority('blue');
    setGlobalNotes('');
    setNewSpecKey('');
    setNewSpecValue('');
    setActiveProductIndex(null);
    setOrderNumber('');
    setOrderNumberError(null);
  };

  // Check if order number already exists
  const checkOrderNumberDuplicate = async (orderNum: string): Promise<boolean> => {
    if (!orderNum.trim()) return false;
    
    try {
      setIsCheckingDuplicate(true);
      // Check in orders collection
      const ordersQuery = query(
        collection(db, 'orders'),
        where('order_id', '==', orderNum.trim())
      );
      const ordersSnapshot = await getDocs(ordersQuery);
      
      if (!ordersSnapshot.empty) {
        return true; // Duplicate found
      }
      
      return false; // No duplicate
    } catch (error) {
      console.error('Error checking order number:', error);
      return false; // On error, allow creation (fail-safe)
    } finally {
      setIsCheckingDuplicate(false);
    }
  };

  // Validate order number on change
  const handleOrderNumberChange = async (value: string) => {
    setOrderNumber(value);
    setOrderNumberError(null);
    
    if (!value.trim()) {
      setOrderNumberError('Order number is required');
      return;
    }
    
    const isDuplicate = await checkOrderNumberDuplicate(value);
    if (isDuplicate) {
      setOrderNumberError('Order number already exists');
    }
  };

  const addProduct = () => {
    setProducts([...products, { id: crypto.randomUUID(), name: '', quantity: 1, specifications: {} }]);
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
    if (!key.trim() || !value.trim()) return;
    const newProducts = [...products];
    newProducts[productIndex].specifications[key] = value;
    setProducts(newProducts);
    setNewSpecKey('');
    setNewSpecValue('');
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
      if (Object.keys(products[i].specifications).length === 0) {
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
      
      // Create order
      const orderRef = doc(collection(db, 'orders'));
      await setDoc(orderRef, {
        order_id: orderNumber.trim(),
        customer_name: customerData.name,
        customer_phone: customerData.phone,
        customer_email: customerData.email,
        customer_address: customerData.address,
        billing_city: customerData.city,
        billing_state: customerData.state,
        billing_pincode: customerData.pincode,
        shipping_name: customerData.name,
        shipping_phone: customerData.phone,
        shipping_address: customerData.address,
        shipping_city: customerData.city,
        shipping_state: customerData.state,
        shipping_pincode: customerData.pincode,
        delivery_date: Timestamp.fromDate(deliveryDate!),
        priority: priority,
        source: 'manual',
        global_notes: globalNotes,
        created_by: user.uid,
        is_completed: false,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });

      // Create order items for each product
      for (const product of products) {
        await setDoc(doc(collection(db, 'order_items')), {
          order_id: orderRef.id,
          product_name: product.name,
          quantity: product.quantity,
          specifications: product.specifications,
          priority: priority,
          current_stage: 'sales',
          assigned_department: 'sales',
          delivery_date: Timestamp.fromDate(deliveryDate!),
          need_design: false,
          is_ready_for_production: false,
          is_dispatched: false,
          created_at: Timestamp.now(),
          updated_at: Timestamp.now(),
        });
      }

      // Create timeline entry
      await setDoc(doc(collection(db, 'timeline')), {
        order_id: orderRef.id,
        stage: 'sales',
        action: 'created',
        performed_by: user.uid,
        performed_by_name: 'System',
        notes: `Order created manually with ${products.length} product(s)`,
        is_public: true,
        created_at: Timestamp.now(),
      });

      // Auto-log work action for order creation
      await autoLogWorkAction(
        user.uid,
        user.displayName || 'Unknown',
        'sales',
        orderRef.id,
        orderNumber.trim(),
        null,
        'sales',
        'order_created',
        `Created manual order with ${products.length} product(s)`,
        0,
        products.map(p => p.name).join(', '),
        new Date(),
        new Date()
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
                      placeholder="e.g., WC-12345 or MAN-001"
                      value={orderNumber}
                      onChange={(e) => handleOrderNumberChange(e.target.value)}
                      disabled={isCheckingDuplicate}
                      className={orderNumberError ? "border-destructive" : ""}
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
                    placeholder="Enter customer name"
                    value={customerData.name}
                    onChange={(e) => setCustomerData({...customerData, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer_phone">Phone</Label>
                  <Input
                    id="customer_phone"
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
                    placeholder="City"
                    value={customerData.city}
                    onChange={(e) => setCustomerData({...customerData, city: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    placeholder="State"
                    value={customerData.state}
                    onChange={(e) => setCustomerData({...customerData, state: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pincode">Pincode</Label>
                  <Input
                    id="pincode"
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
                          <Label>Product Name *</Label>
                          <Input
                            placeholder="Enter product name"
                            value={product.name}
                            onChange={(e) => updateProduct(index, 'name', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Quantity</Label>
                          <Input
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
                              }}
                            >
                              + {key}
                            </Button>
                          ))}
                        </div>

                        {/* Add spec form */}
                        <div className="flex gap-2">
                          <Input
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
                            onClick={() => addSpecification(index, newSpecKey, newSpecValue)}
                            disabled={!newSpecKey.trim() || !newSpecValue.trim() || activeProductIndex !== index}
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
