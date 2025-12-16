import { useState } from 'react';
import { Search, Package, Calendar, CheckCircle, Clock, Truck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Order, STAGE_LABELS, Stage, Priority } from '@/types/order';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const stageOrder: Stage[] = ['sales', 'design', 'prepress', 'production', 'dispatch', 'completed'];

// Helper to compute priority based on days until delivery
const computePriority = (deliveryDate: Date | null): Priority => {
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

function StageIndicator({ currentStage }: { currentStage: Stage }) {
  const currentIndex = stageOrder.indexOf(currentStage);
  
  return (
    <div className="flex items-center justify-between w-full max-w-lg mx-auto my-8">
      {stageOrder.slice(0, -1).map((stage, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        
        return (
          <div key={stage} className="flex items-center">
            <div className="flex flex-col items-center">
              <div 
                className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                  isCompleted && "bg-success text-success-foreground",
                  isCurrent && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                  !isCompleted && !isCurrent && "bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  index + 1
                )}
              </div>
              <span className={cn(
                "text-xs mt-2 text-center",
                (isCompleted || isCurrent) ? "text-foreground font-medium" : "text-muted-foreground"
              )}>
                {STAGE_LABELS[stage]}
              </span>
            </div>
            {index < stageOrder.length - 2 && (
              <div 
                className={cn(
                  "h-1 w-8 sm:w-12 mx-1",
                  isCompleted ? "bg-success" : "bg-muted"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface SearchedOrder {
  id: string;
  order_id: string;
  customer_name: string;
  is_completed: boolean;
  delivery_date: string | null;
  created_at: string;
  items: {
    item_id: string;
    product_name: string;
    quantity: number;
    current_stage: Stage;
    delivery_date: string | null;
    priority_computed: Priority;
  }[];
  timeline: {
    id: string;
    action: string;
    created_at: string;
    is_public: boolean;
  }[];
}

export default function TrackOrder() {
  const [orderNumber, setOrderNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [searchedOrder, setSearchedOrder] = useState<SearchedOrder | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSearchedOrder(null);
    
    if (!orderNumber.trim()) {
      setError('Please enter an order number');
      return;
    }

    setIsLoading(true);

    try {
      // Validate order number format (must be MAN-xxx or WC-xxx)
      const trimmedOrderNumber = orderNumber.trim().toUpperCase();
      const orderIdPattern = /^(MAN|WC)-\d+$/;
      
      if (!orderIdPattern.test(trimmedOrderNumber)) {
        setError('Invalid order number format. Please enter a valid order number (e.g., WC-53277 or MAN-1234)');
        setIsLoading(false);
        return;
      }

      // Search for order by exact order_id match (case-insensitive)
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('id, order_id, customer_name, is_completed, delivery_date, created_at')
        .ilike('order_id', trimmedOrderNumber)
        .maybeSingle();

      if (orderError) throw orderError;

      if (!orderData) {
        setError('Order not found. Please check the order number and try again.');
        setIsLoading(false);
        return;
      }

      // Fetch order items
      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('id, product_name, quantity, current_stage, delivery_date')
        .eq('order_id', orderData.id);

      if (itemsError) throw itemsError;

      // Fetch public timeline entries
      const { data: timelineData, error: timelineError } = await supabase
        .from('timeline')
        .select('id, action, created_at, is_public')
        .eq('order_id', orderData.id)
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (timelineError) throw timelineError;

      const result: SearchedOrder = {
        id: orderData.id,
        order_id: orderData.order_id,
        customer_name: orderData.customer_name,
        is_completed: orderData.is_completed,
        delivery_date: orderData.delivery_date,
        created_at: orderData.created_at,
        items: (itemsData || []).map(item => ({
          item_id: item.id,
          product_name: item.product_name,
          quantity: item.quantity,
          current_stage: item.current_stage as Stage,
          delivery_date: item.delivery_date,
          priority_computed: computePriority(item.delivery_date ? new Date(item.delivery_date) : null),
        })),
        timeline: (timelineData || []).map(entry => ({
          id: entry.id,
          action: entry.action,
          created_at: entry.created_at,
          is_public: entry.is_public,
        })),
      };

      setSearchedOrder(result);
    } catch (err) {
      console.error('Error searching order:', err);
      setError('An error occurred while searching. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="container py-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">C</span>
            </div>
            <div>
              <h1 className="font-display font-bold text-xl">Chhapai</h1>
              <p className="text-sm text-muted-foreground">Order Tracking</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8">
        {/* Search Section */}
        <div className="max-w-xl mx-auto text-center mb-8">
          <h2 className="text-3xl font-display font-bold mb-2">Track Your Order</h2>
          <p className="text-muted-foreground mb-6">
            Enter your order number to check the current status
          </p>

          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Enter order number (e.g., WC-53277)"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  className="pl-10 h-12 text-base"
                />
              </div>
              <Button type="submit" size="lg" className="px-8" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Track'}
              </Button>
            </div>
            
            <Input
              type="tel"
              placeholder="Phone number (optional)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-12"
            />
          </form>

          {error && (
            <p className="mt-4 text-destructive text-sm">{error}</p>
          )}
        </div>

        {/* Results */}
        {searchedOrder && (
          <div className="max-w-3xl mx-auto animate-fade-in space-y-6">
            {/* Order Summary */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-display">{searchedOrder.order_id}</CardTitle>
                    <p className="text-muted-foreground mt-1">
                      Ordered on {format(new Date(searchedOrder.created_at), 'MMMM d, yyyy')}
                    </p>
                  </div>
                  <Badge 
                    variant={searchedOrder.is_completed ? 'success' : 'default'}
                    className="text-sm"
                  >
                    {searchedOrder.is_completed ? 'Completed' : 'In Progress'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {/* Progress indicator */}
                {searchedOrder.items[0] && (
                  <StageIndicator currentStage={searchedOrder.items[0].current_stage} />
                )}

                {/* Expected delivery */}
                {searchedOrder.delivery_date && (
                  <div className="flex items-center justify-center gap-3 p-4 bg-secondary/50 rounded-lg">
                    <Truck className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Expected Delivery</p>
                      <p className="text-muted-foreground">
                        {format(new Date(searchedOrder.delivery_date), 'EEEE, MMMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Items */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-display flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Items in this Order
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {searchedOrder.items.map((item) => (
                    <div 
                      key={item.item_id}
                      className="flex items-start justify-between gap-4 p-4 bg-secondary/30 rounded-lg"
                    >
                      <div>
                        <h4 className="font-medium">{item.product_name}</h4>
                        <p className="text-sm text-muted-foreground">Quantity: {item.quantity}</p>
                      </div>
                      <Badge variant={`stage-${item.current_stage}` as any}>
                        {STAGE_LABELS[item.current_stage]}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Timeline */}
            {searchedOrder.timeline.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-display flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Order Updates
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {searchedOrder.timeline.map((entry) => (
                      <div key={entry.id} className="flex gap-4">
                        <div className="h-2 w-2 mt-2 rounded-full bg-primary shrink-0" />
                        <div>
                          <p className="font-medium">
                            {entry.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(entry.created_at), 'MMM d, yyyy \'at\' h:mm a')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Help hint */}
        {!searchedOrder && !isLoading && (
          <div className="max-w-xl mx-auto mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              Enter your order number to track its progress through our production process.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-auto">
        <div className="container py-6 text-center text-sm text-muted-foreground">
          <p>© 2024 Chhapai. All rights reserved.</p>
          <p className="mt-1">
            Need help? Contact us at{' '}
            <a href="tel:+919876543210" className="text-primary hover:underline">
              +91 98765 43210
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}