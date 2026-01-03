import { useState, useEffect, useRef } from 'react';
import { Search, Package, Calendar, CheckCircle, Clock, Truck, Loader2, Mail, Sparkles, Moon, Sun, Copy, ExternalLink, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { Order, STAGE_LABELS, Stage, Priority, DispatchInfo } from '@/types/order';
import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { AppFooter } from '@/components/layout/AppFooter';
import { useTheme } from '@/contexts/ThemeContext';
import { toast } from '@/hooks/use-toast';

// Full stage order including outsource (for calculations)
const fullStageOrder: Stage[] = ['sales', 'design', 'prepress', 'production', 'outsource', 'dispatch', 'completed'];

// Display stage order (for customer-facing UI, outsource is shown as part of production)
const displayStageOrder: Stage[] = ['sales', 'design', 'prepress', 'production', 'dispatch', 'completed'];

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

// Helper to get the most advanced stage from all items
// CRITICAL: This uses current_stage from order_items as the single source of truth
const getMostAdvancedStage = (items: { current_stage: Stage }[]): Stage => {
  if (!items || items.length === 0) {
    console.log('[TrackOrder] getMostAdvancedStage: No items, returning sales');
    return 'sales';
  }
  
  let mostAdvancedIndex = -1;
  let mostAdvancedStage: Stage = 'sales';
  
  items.forEach(item => {
    const stageIndex = fullStageOrder.indexOf(item.current_stage);
    console.log(`[TrackOrder] getMostAdvancedStage: Item stage=${item.current_stage}, index=${stageIndex}, currentMaxIndex=${mostAdvancedIndex}`);
    
    if (stageIndex > mostAdvancedIndex) {
      mostAdvancedIndex = stageIndex;
      mostAdvancedStage = item.current_stage;
    }
  });
  
  console.log(`[TrackOrder] getMostAdvancedStage: Final stage=${mostAdvancedStage}, index=${mostAdvancedIndex}`);
  return mostAdvancedStage;
};

// Helper to convert stage for display (outsource -> production for customer view)
const getDisplayStage = (stage: Stage): Stage => {
  return stage === 'outsource' ? 'production' : stage;
};

// Helper to normalize order number input (accept numeric-only and auto-prepend WC-)
const normalizeOrderNumber = (input: string): string | null => {
  const trimmed = input.trim().toUpperCase();
  
  // If it already has a prefix (WC- or MAN-), validate and return as is
  const prefixedPattern = /^(WC|MAN)-\d+$/;
  if (prefixedPattern.test(trimmed)) {
    return trimmed;
  }
  
  // If it's just numbers, prepend WC- prefix
  const numericPattern = /^\d+$/;
  if (numericPattern.test(trimmed)) {
    return `WC-${trimmed}`;
  }
  
  // Invalid format
  return null;
};

// Helper to format order number for display (remove WC- prefix)
const formatOrderNumberForDisplay = (orderId: string): string => {
  // Remove WC- or MAN- prefix if present
  return orderId.replace(/^(WC|MAN)-/i, '');
};

function StageIndicator({ currentStage }: { currentStage: Stage }) {
  // Convert stage for display (outsource -> production)
  const displayStage = getDisplayStage(currentStage);
  let currentIndex = displayStageOrder.indexOf(displayStage);
  // Fallback to first stage if stage not found
  if (currentIndex === -1) currentIndex = 0;
  
  return (
    <div className="w-full overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
      <div className="flex items-center justify-between w-full min-w-[320px] sm:min-w-[500px] max-w-2xl mx-auto gap-2 sm:gap-4">
        {displayStageOrder.slice(0, -1).map((stage, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const animationDelay = index * 100;
          
          return (
            <div key={stage} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center flex-1 relative w-full">
                {/* Circle with proper spacing to prevent clipping */}
                <div className="relative mb-3 pt-1">
                  <div 
                    className={cn(
                      "h-10 w-10 xs:h-12 xs:w-12 sm:h-14 sm:w-14 rounded-full flex items-center justify-center text-xs xs:text-sm sm:text-base font-semibold transition-all duration-500 relative z-10",
                      isCompleted && "bg-success text-success-foreground shadow-lg shadow-success/50 scale-110",
                      isCurrent && "bg-primary text-primary-foreground ring-4 ring-primary/30 shadow-lg shadow-primary/50 scale-110 animate-pulse-soft",
                      !isCompleted && !isCurrent && "bg-muted text-muted-foreground"
                    )}
                    style={{ animationDelay: `${animationDelay}ms` }}
                  >
                    {isCompleted ? (
                      <CheckCircle className="h-5 w-5 xs:h-6 xs:w-6 sm:h-7 sm:w-7 animate-in fade-in zoom-in duration-300" />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>
                </div>
                {/* Stage label with responsive text sizing */}
                <span className={cn(
                  "text-[10px] xs:text-xs sm:text-sm mt-0 text-center font-medium transition-colors duration-300 px-1 break-words line-clamp-2",
                  (isCompleted || isCurrent) ? "text-foreground" : "text-muted-foreground"
                )}>
                  {STAGE_LABELS[stage]}
                </span>
              </div>
              {index < displayStageOrder.length - 2 && (
                <div className="flex-1 mx-1 xs:mx-2 sm:mx-4 relative min-w-[20px]">
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full transition-all duration-1000 ease-out rounded-full",
                        isCompleted ? "bg-success" : "bg-transparent"
                      )}
                      style={{ 
                        width: isCompleted ? '100%' : '0%',
                        transitionDelay: `${animationDelay}ms`
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
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
    current_stage: Stage; // CRITICAL: This is the source of truth from order_items.current_stage
    delivery_date: string | null;
    priority_computed: Priority;
    dispatch_info?: DispatchInfo | null; // Dispatch tracking details
    is_dispatched?: boolean;
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
  const [searchedOrder, setSearchedOrder] = useState<SearchedOrder | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const orderIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (searchedOrder) {
      setShowResults(true);
      // Small delay to ensure DOM is updated, then scroll to results
      setTimeout(() => {
        const resultsElement = document.querySelector('[data-order-results]');
        if (resultsElement) {
          resultsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 200);
    }
  }, [searchedOrder]);

  // CRITICAL: Real-time subscription for live order updates
  useEffect(() => {
    // Clean up previous subscription
    if (subscriptionRef.current) {
      console.log('[TrackOrder] Cleaning up subscription for order:', orderIdRef.current);
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }

    // Only subscribe if we have a searched order
    if (!searchedOrder?.id) {
      orderIdRef.current = null;
      return;
    }

    const orderId = searchedOrder.id;
    console.log('[TrackOrder] Setting up subscription for new order:', orderId, 'order_id:', searchedOrder.order_id);
    orderIdRef.current = orderId;

    console.log('[TrackOrder] Setting up real-time subscription for order:', orderId);

    // Subscribe to order_items changes for this specific order
    const channel = supabase
      .channel(`track-order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_items',
          filter: `order_id=eq.${orderId}`,
        },
        async (payload) => {
          console.log('[TrackOrder] Order items change received:', payload.eventType);
          
          // Refresh order data to get latest current_stage and dispatch_info
          if (orderIdRef.current === orderId) {
            await refreshOrderData(orderId);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        async (payload) => {
          console.log('[TrackOrder] Order change received:', payload.eventType);
          
          if (orderIdRef.current === orderId) {
            await refreshOrderData(orderId);
          }
        }
      )
      .subscribe();

    subscriptionRef.current = channel;

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [searchedOrder?.id]);

  // Helper function to refresh order data from database (PUBLIC - no auth required)
  const refreshOrderData = async (orderId: string) => {
    try {
      // PUBLIC TRACKING: Fetch latest order data - only safe fields
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          id,
          order_id,
          customer_name,
          delivery_date,
          is_completed,
          created_at
        `)
        .eq('id', orderId)
        .maybeSingle();

      if (orderError || !orderData) {
        console.error('[TrackOrder] Error refreshing order:', orderError);
        return;
      }

      // PUBLIC TRACKING: Fetch latest order items - only safe fields
      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          id,
          product_name,
          quantity,
          current_stage,
          delivery_date,
          dispatch_info,
          is_dispatched
        `)
        .eq('order_id', orderData.id);

      if (itemsError) {
        console.error('[TrackOrder] Error refreshing items:', itemsError);
        return;
      }

      // PUBLIC TRACKING: Fetch latest public timeline - only safe fields
      const { data: timelineData, error: timelineError } = await supabase
        .from('timeline')
        .select(`
          id,
          action,
          created_at,
          is_public
        `)
        .eq('order_id', orderData.id)
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (timelineError) {
        console.error('[TrackOrder] Error refreshing timeline:', timelineError);
        return;
      }

      // DEBUG: Log refreshed items with their current_stage
      console.log('[TrackOrder] Refreshed items from database:', itemsData?.map(item => ({
        product_name: item.product_name,
        current_stage: item.current_stage,
      })));

      // Update state with fresh data (CRITICAL: Uses current_stage from order_items as source of truth)
      const updatedOrder: SearchedOrder = {
        id: orderData.id,
        order_id: orderData.order_id,
        customer_name: orderData.customer_name,
        is_completed: orderData.is_completed || false,
        delivery_date: orderData.delivery_date || null,
        created_at: orderData.created_at || new Date().toISOString(),
        items: (itemsData || []).map(item => {
          // Parse dispatch_info if it exists
          let dispatchInfo: DispatchInfo | null = null;
          if (item.dispatch_info && typeof item.dispatch_info === 'object') {
            dispatchInfo = item.dispatch_info as DispatchInfo;
          }
          
          // CRITICAL: Use current_stage directly from order_items table (single source of truth)
          // Ensure we have a valid stage - cast to Stage type and validate
          const rawStage = item.current_stage;
          const currentStage: Stage = (rawStage && fullStageOrder.includes(rawStage as Stage)) 
            ? (rawStage as Stage) 
            : 'sales';
          console.log(`[TrackOrder] Refreshed item ${item.product_name}: raw_stage=${rawStage}, validated_stage=${currentStage}`);
          
          return {
            item_id: item.id,
            product_name: item.product_name,
            quantity: item.quantity,
            current_stage: currentStage,
            delivery_date: item.delivery_date || null,
            priority_computed: computePriority(item.delivery_date ? new Date(item.delivery_date) : null),
            dispatch_info: dispatchInfo,
            is_dispatched: item.is_dispatched || false,
          };
        }),
        timeline: (timelineData || []).map(entry => ({
          id: entry.id,
          action: entry.action,
          created_at: entry.created_at || new Date().toISOString(),
          is_public: entry.is_public !== false,
        })),
      };

      setSearchedOrder(updatedOrder);
    } catch (err) {
      console.error('[TrackOrder] Error refreshing order data:', err);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // CRITICAL: Clean up previous subscription before new search
    if (subscriptionRef.current) {
      console.log('[TrackOrder] Cleaning up previous subscription before new search');
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
      orderIdRef.current = null;
    }
    
    setSearchedOrder(null);
    setShowResults(false);
    
    if (!orderNumber.trim()) {
      setError('Please enter an order number');
      return;
    }

    setIsLoading(true);

    try {
      // Normalize order number (accept numeric-only and auto-prepend WC-)
      const normalizedOrderNumber = normalizeOrderNumber(orderNumber.trim());
      
      console.log('[TrackOrder] Searching for order:', {
        input: orderNumber.trim(),
        normalized: normalizedOrderNumber
      });
      
      if (!normalizedOrderNumber) {
        setError('Invalid order number format. Please enter a valid order number (e.g., 53529, WC-53277, or MAN-1234)');
        setIsLoading(false);
        return;
      }

      // PUBLIC TRACKING: Query order by order_id (no auth required)
      // Only select safe, public fields - never expose internal data
      // Try multiple search strategies: exact match, case-insensitive, with/without prefix
      let orderData = null;
      let orderError = null;
      
      // Strategy 1: Exact match with normalized number
      let searchResult = await supabase
        .from('orders')
        .select(`
          id,
          order_id,
          customer_name,
          delivery_date,
          is_completed,
          created_at
        `)
        .eq('order_id', normalizedOrderNumber)
        .maybeSingle();
      
      if (searchResult.data) {
        orderData = searchResult.data;
      } else if (searchResult.error) {
        orderError = searchResult.error;
      }
      
      // Strategy 2: Case-insensitive search if exact match failed
      if (!orderData) {
        searchResult = await supabase
          .from('orders')
          .select(`
            id,
            order_id,
            customer_name,
            delivery_date,
            is_completed,
            created_at
          `)
          .ilike('order_id', normalizedOrderNumber)
          .maybeSingle();
        
        if (searchResult.data) {
          orderData = searchResult.data;
        } else if (searchResult.error && !orderError) {
          orderError = searchResult.error;
        }
      }
      
      // Strategy 3: Try without prefix if normalized has prefix
      if (!orderData && normalizedOrderNumber.startsWith('WC-')) {
        const withoutPrefix = normalizedOrderNumber.replace(/^WC-/i, '');
        searchResult = await supabase
          .from('orders')
          .select(`
            id,
            order_id,
            customer_name,
            delivery_date,
            is_completed,
            created_at
          `)
          .eq('order_id', withoutPrefix)
          .maybeSingle();
        
        if (!searchResult.data) {
          searchResult = await supabase
            .from('orders')
            .select(`
              id,
              order_id,
              customer_name,
              delivery_date,
              is_completed,
              created_at
            `)
            .ilike('order_id', withoutPrefix)
            .maybeSingle();
        }
        
        if (searchResult.data) {
          orderData = searchResult.data;
        } else if (searchResult.error && !orderError) {
          orderError = searchResult.error;
        }
      }
      
      // Strategy 4: Try with original input (in case it's stored differently)
      if (!orderData && orderNumber.trim() !== normalizedOrderNumber) {
        searchResult = await supabase
          .from('orders')
          .select(`
            id,
            order_id,
            customer_name,
            delivery_date,
            is_completed,
            created_at
          `)
          .eq('order_id', orderNumber.trim())
          .maybeSingle();
        
        if (!searchResult.data) {
          searchResult = await supabase
            .from('orders')
            .select(`
              id,
              order_id,
              customer_name,
              delivery_date,
              is_completed,
              created_at
            `)
            .ilike('order_id', orderNumber.trim())
            .maybeSingle();
        }
        
        if (searchResult.data) {
          orderData = searchResult.data;
        } else if (searchResult.error && !orderError) {
          orderError = searchResult.error;
        }
      }
      
      console.log('[TrackOrder] Order query result:', {
        input: orderNumber.trim(),
        normalized: normalizedOrderNumber,
        found: orderData ? {
          id: orderData.id,
          order_id: orderData.order_id,
          customer: orderData.customer_name
        } : null,
        error: orderError
      });

      if (orderError) {
        console.error('[TrackOrder] Error querying order:', orderError);
        setError('An error occurred while searching. Please try again.');
        setIsLoading(false);
        return;
      }

      if (!orderData) {
        setError(`Order "${orderNumber.trim()}" not found. Please check the order number and try again.`);
        setIsLoading(false);
        return;
      }

      // PUBLIC TRACKING: Fetch order items - only safe fields
      // current_stage is the source of truth for tracking status
      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          id,
          product_name,
          quantity,
          current_stage,
          delivery_date,
          dispatch_info,
          is_dispatched
        `)
        .eq('order_id', orderData.id);

      if (itemsError) {
        console.error('[TrackOrder] Error querying items:', itemsError);
        throw itemsError;
      }

      // PUBLIC TRACKING: Fetch only public timeline entries
      const { data: timelineData, error: timelineError } = await supabase
        .from('timeline')
        .select(`
          id,
          action,
          created_at,
          is_public
        `)
        .eq('order_id', orderData.id)
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (timelineError) {
        console.error('[TrackOrder] Error querying timeline:', timelineError);
        throw timelineError;
      }

      // DEBUG: Log items with their current_stage to verify correct data
      console.log('[TrackOrder] Items from database:', itemsData?.map(item => ({
        product_name: item.product_name,
        current_stage: item.current_stage,
      })));

      const result: SearchedOrder = {
        id: orderData.id,
        order_id: orderData.order_id,
        customer_name: orderData.customer_name,
        is_completed: orderData.is_completed || false,
        delivery_date: orderData.delivery_date || null,
        created_at: orderData.created_at || new Date().toISOString(),
        items: (itemsData || []).map(item => {
          // Parse dispatch_info if it exists (stored as JSONB)
          let dispatchInfo: DispatchInfo | null = null;
          if (item.dispatch_info && typeof item.dispatch_info === 'object') {
            dispatchInfo = item.dispatch_info as DispatchInfo;
          }
          
          // CRITICAL: Use current_stage directly from order_items table (single source of truth)
          // This field is updated when order moves between departments/stages
          // Validate stage exists in fullStageOrder, default to 'sales' if invalid
          const rawStage = item.current_stage;
          const currentStage: Stage = (rawStage && fullStageOrder.includes(rawStage as Stage)) 
            ? (rawStage as Stage) 
            : 'sales';
          
          console.log(`[TrackOrder] Item ${item.product_name}: raw_stage=${rawStage}, validated_stage=${currentStage}`);
          
          return {
            item_id: item.id,
            product_name: item.product_name,
            quantity: item.quantity,
            current_stage: currentStage,
            delivery_date: item.delivery_date || null,
            priority_computed: computePriority(item.delivery_date ? new Date(item.delivery_date) : null),
            dispatch_info: dispatchInfo,
            is_dispatched: item.is_dispatched || false,
          };
        }),
        timeline: (timelineData || []).map(entry => ({
          id: entry.id,
          action: entry.action,
          created_at: entry.created_at || new Date().toISOString(),
          is_public: entry.is_public !== false,
        })),
      };

      console.log('[TrackOrder] Setting searched order:', {
        order_id: result.order_id,
        customer: result.customer_name,
        items_count: result.items.length
      });
      
      setSearchedOrder(result);
      setShowResults(true);
    } catch (err) {
      console.error('[TrackOrder] Error searching order:', err);
      setError('An error occurred while searching. Please try again.');
      setSearchedOrder(null);
      setShowResults(false);
    } finally {
      setIsLoading(false);
    }
  };

  const deliveryDaysRemaining = searchedOrder?.delivery_date 
    ? differenceInDays(new Date(searchedOrder.delivery_date), new Date())
    : null;

  return (
    <TooltipProvider>
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header - Sticky, no height locking */}
      <header className="bg-background/95 backdrop-blur-sm border-b border-border sticky top-0 z-50 shrink-0">
        <div className="container py-4 sm:py-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 sm:h-12 sm:w-12 flex items-center justify-center flex-shrink-0">
                <img 
                  src="/chhapai-logo.png" 
                  alt="Chhapai Logo" 
                  className="h-full w-full object-contain logo-dark-mode"
                />
              </div>
              <div>
                <h1 className="font-display font-bold text-xl sm:text-2xl text-foreground tracking-tight">
                  Chhapai
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground">Order Tracking System</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="relative"
              aria-label="Toggle theme"
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content - Flex-1 with overflow-y-auto for proper scrolling */}
      <main 
        className="flex-1 w-full overflow-y-auto overflow-x-hidden smooth-scroll" 
        style={{ WebkitOverflowScrolling: 'touch' }}
        data-scroll-container
      >
        <div className="container py-6 sm:py-8 lg:py-10 pb-24">
          {/* Search Section */}
          <div className="max-w-2xl mx-auto mb-8 sm:mb-12 px-4">
            <div className="text-center mb-8 animate-fade-in">
              <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/10 mb-4">
                <Search className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold mb-3 bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                Track Your Order
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto">
                Enter your order number to check the current status and delivery timeline
              </p>
            </div>

            <Card className="border-2 shadow-xl animate-fade-in" style={{ animationDelay: '100ms' }}>
              <CardContent className="p-4 sm:p-6">
                <form onSubmit={handleSearch} className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Enter order number (e.g., 53529 or WC-53277)"
                        value={orderNumber}
                        onChange={(e) => setOrderNumber(e.target.value)}
                        className="pl-12 h-12 sm:h-14 text-base border-2 focus:border-primary transition-colors"
                        disabled={isLoading}
                      />
                    </div>
                    <Button 
                      type="submit" 
                      size="lg" 
                      className="h-12 sm:h-14 px-6 sm:px-8 text-base font-semibold shadow-lg hover:shadow-xl transition-all w-full sm:w-auto"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          Tracking...
                        </>
                      ) : (
                        <>
                          <Search className="h-5 w-5 mr-2" />
                          Track Order
                        </>
                      )}
                    </Button>
                  </div>
                </form>

                {error && (
                  <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg animate-fade-in">
                    <p className="text-destructive text-sm font-medium">{error}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Results */}
          {searchedOrder && showResults && (
            <div 
              data-order-results 
              className="max-w-4xl mx-auto px-4 space-y-6 animate-fade-in" 
              style={{ paddingBottom: '4rem' }}
            >
              {/* Order Summary Card */}
              <Card className="border-2 shadow-xl overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle className="text-2xl sm:text-3xl font-display font-bold">
                          {formatOrderNumberForDisplay(searchedOrder.order_id)}
                        </CardTitle>
                        <Badge 
                          variant={searchedOrder.is_completed ? 'success' : 'default'}
                          className="text-sm font-semibold px-3 py-1"
                        >
                          {searchedOrder.is_completed ? 'Completed' : 'In Progress'}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Ordered on {format(new Date(searchedOrder.created_at), 'MMMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {/* Progress indicator - Sticky below header when scrolling, with smooth transitions */}
                  {searchedOrder.items.length > 0 && (
                    <div 
                      className="sticky top-[73px] z-40 bg-card/95 backdrop-blur-sm py-4 -mx-6 px-6 -mt-6 mb-6 border-b border-border/50 transition-all duration-300 shadow-sm"
                      style={{ WebkitBackdropFilter: 'blur(8px)' }}
                    >
                      <div className="mb-3 sm:mb-4 text-center">
                        <h3 className="text-base sm:text-lg font-semibold mb-2 transition-colors duration-300">Order Progress</h3>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          Currently in: <span className="font-medium text-foreground">
                            {STAGE_LABELS[getDisplayStage(getMostAdvancedStage(searchedOrder.items))]}
                          </span>
                        </p>
                        {/* CRITICAL: Display shows the actual current_stage from order_items (live, real-time) */}
                      </div>
                      <StageIndicator currentStage={getMostAdvancedStage(searchedOrder.items)} />
                    </div>
                  )}

                  {/* Delivery & Customer Info Grid - Collapsible */}
                  <Collapsible defaultOpen={true} className="space-y-4">
                    <CollapsibleTrigger className="flex items-center justify-between w-full text-left group">
                      <h4 className="text-base sm:text-lg font-semibold">Order Details</h4>
                      <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Expected delivery */}
                        {searchedOrder.delivery_date && (
                          <div className="relative p-4 sm:p-5 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border-2 border-primary/20 hover:border-primary/40 transition-all group">
                            <div className="flex items-start gap-3 sm:gap-4">
                              <div className="p-2 sm:p-3 bg-primary/20 rounded-lg group-hover:bg-primary/30 transition-colors shrink-0">
                                <Truck className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Expected Delivery</p>
                                <p className="text-base sm:text-lg font-bold mb-2">
                                  {format(new Date(searchedOrder.delivery_date), 'EEEE, MMMM d, yyyy')}
                                </p>
                                {deliveryDaysRemaining !== null && (
                                  <p className={cn(
                                    "text-xs sm:text-sm font-medium",
                                    deliveryDaysRemaining < 0 ? "text-destructive" :
                                    deliveryDaysRemaining <= 3 ? "text-yellow-500" :
                                    "text-success"
                                  )}>
                                    {deliveryDaysRemaining < 0 
                                      ? `${Math.abs(deliveryDaysRemaining)} days overdue`
                                      : deliveryDaysRemaining === 0
                                      ? "Due today"
                                      : `${deliveryDaysRemaining} days remaining`
                                    }
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Customer Info */}
                        {searchedOrder.customer_name && (
                          <div className="p-4 sm:p-5 bg-secondary/30 rounded-xl border-2 border-border hover:border-primary/40 transition-all">
                            <div className="flex items-start gap-3 sm:gap-4">
                              <div className="p-2 sm:p-3 bg-secondary rounded-lg shrink-0">
                                <Mail className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Customer</p>
                                <p className="text-base sm:text-lg font-bold break-words">{searchedOrder.customer_name}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </Card>

              {/* Items Card - Collapsible */}
              <Card className="border-2 shadow-xl animate-fade-in" style={{ animationDelay: '200ms' }}>
                <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
                  <Collapsible defaultOpen={true} className="w-full">
                    <CollapsibleTrigger className="flex items-center justify-between w-full group">
                      <CardTitle className="text-lg sm:text-xl font-display flex items-center gap-3">
                        <div className="p-2 bg-primary/20 rounded-lg">
                          <Package className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                        </div>
                        Items in this Order
                      </CardTitle>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-xs sm:text-sm">
                          {searchedOrder.items.length} {searchedOrder.items.length === 1 ? 'item' : 'items'}
                        </Badge>
                        <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="pt-4">
                        <div className="space-y-4">
                          {searchedOrder.items.map((item, index) => (
                            <div 
                              key={item.item_id}
                              className="group relative p-4 sm:p-5 bg-secondary/30 rounded-xl border-2 border-border hover:border-primary/40 hover:bg-secondary/50 transition-all duration-300 animate-fade-in"
                              style={{ animationDelay: `${300 + index * 50}ms` }}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-sm sm:text-base lg:text-lg mb-2 break-words">
                                    {item.product_name}
                                  </h4>
                                  <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                                    <span className="flex items-center gap-2">
                                      <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                      Quantity: <span className="font-semibold text-foreground">{item.quantity}</span>
                                    </span>
                                    {item.delivery_date && (
                                      <span className="flex items-center gap-2">
                                        <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                        Delivery: <span className="font-semibold text-foreground">
                                          {format(new Date(item.delivery_date), 'MMM d, yyyy')}
                                        </span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <Badge 
                                  variant={`stage-${item.current_stage}` as any} 
                                  className="shrink-0 text-xs sm:text-sm font-semibold px-3 sm:px-4 py-1.5 sm:py-2"
                                >
                                  {STAGE_LABELS[item.current_stage]}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </CardHeader>
                <CardContent className="hidden">
                  {/* Content moved to CollapsibleContent in header */}
                </CardContent>
              </Card>

              {/* Dispatch Tracking Card - Show if any item has tracking details */}
              {(() => {
                // Find items that have dispatch_info (tracking details)
                // Show tracking details if dispatch_info exists, regardless of stage or is_dispatched flag
                const dispatchedItems = searchedOrder.items.filter(item => 
                  item.dispatch_info && 
                  item.dispatch_info.tracking_number &&
                  item.dispatch_info.courier_company
                );
                
                if (dispatchedItems.length === 0) return null;

                return (
                  <Card className="border-2 shadow-xl animate-fade-in border-primary/20" style={{ animationDelay: '350ms' }}>
                    <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
                      <Collapsible defaultOpen={true} className="w-full">
                        <CollapsibleTrigger className="flex items-center justify-between w-full group">
                          <CardTitle className="text-lg sm:text-xl font-display flex items-center gap-3">
                            <div className="p-2 bg-primary/20 rounded-lg">
                              <Truck className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                            </div>
                            Shipment Tracking Details
                          </CardTitle>
                          <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="pt-4 pb-2">
                            <div className="space-y-4">
                              {dispatchedItems.map((item) => {
                                const dispatchInfo = item.dispatch_info!;
                                
                                // Generate tracking URL (common courier tracking patterns)
                                const getTrackingUrl = (courier: string, trackingNumber: string): string | null => {
                                  const courierLower = courier.toLowerCase();
                                  const tracking = trackingNumber.trim();
                                  
                                  // Common Indian courier tracking URLs
                                  if (courierLower.includes('delhivery') || courierLower.includes('delhivery')) {
                                    return `https://www.delhivery.com/track/package/${tracking}`;
                                  } else if (courierLower.includes('blue dart') || courierLower.includes('bluedart')) {
                                    return `https://www.bluedart.com/track/${tracking}`;
                                  } else if (courierLower.includes('dtdc') || courierLower.includes('dtdc')) {
                                    return `https://www.dtdc.in/tracking/tracking_results.asp?Ttype=awb_no&strCnno=${tracking}`;
                                  } else if (courierLower.includes('fedex') || courierLower.includes('fedex')) {
                                    return `https://www.fedex.com/fedextrack/?trknbr=${tracking}`;
                                  } else if (courierLower.includes('dtc') || courierLower.includes('dtc')) {
                                    return `https://www.dtcexpress.in/track/${tracking}`;
                                  }
                                  
                                  // Generic Google search fallback
                                  return `https://www.google.com/search?q=${encodeURIComponent(`${courier} tracking ${tracking}`)}`;
                                };
                                
                                const trackingUrl = getTrackingUrl(dispatchInfo.courier_company, dispatchInfo.tracking_number);
                                
                                return (
                                  <div 
                                    key={item.item_id}
                                    className="p-4 sm:p-5 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border-2 border-primary/20 hover:border-primary/40 transition-all"
                                  >
                                    <div className="space-y-3 sm:space-y-4">
                                      <div>
                                        <h4 className="font-semibold text-sm sm:text-base mb-2 sm:mb-3 break-words">{item.product_name}</h4>
                                      </div>
                                      
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                        <div>
                                          <p className="text-xs font-medium text-muted-foreground mb-1">Courier Company</p>
                                          <p className="text-sm sm:text-base font-semibold break-words">{dispatchInfo.courier_company}</p>
                                        </div>
                                        
                                        <div>
                                          <p className="text-xs font-medium text-muted-foreground mb-1">Dispatch Date</p>
                                          <p className="text-sm sm:text-base font-semibold">
                                            {format(new Date(dispatchInfo.dispatch_date), 'MMM d, yyyy')}
                                          </p>
                                        </div>
                                        
                                        <div className="sm:col-span-2">
                                          <div className="flex items-center justify-between mb-2">
                                            <p className="text-xs font-medium text-muted-foreground">Tracking Number</p>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Button
                                                  variant="ghost"
                                                  size="icon-sm"
                                                  onClick={async () => {
                                                    try {
                                                      const trackingDetails = `Order: ${searchedOrder.order_id}\nProduct: ${item.product_name}\nCourier: ${dispatchInfo.courier_company}\nTracking Number: ${dispatchInfo.tracking_number}\nDispatch Date: ${format(new Date(dispatchInfo.dispatch_date), 'MMM d, yyyy')}${trackingUrl ? `\nTrack: ${trackingUrl}` : ''}`;
                                                      await navigator.clipboard.writeText(trackingDetails);
                                                      toast({
                                                        title: "Copied!",
                                                        description: "All tracking details copied to clipboard",
                                                      });
                                                    } catch (err) {
                                                      console.error('Failed to copy:', err);
                                                      toast({
                                                        title: "Error",
                                                        description: "Failed to copy tracking details",
                                                        variant: "destructive",
                                                      });
                                                    }
                                                  }}
                                                  className="h-7 w-7"
                                                >
                                                  <Copy className="h-3.5 w-3.5" />
                                                </Button>
                                              </TooltipTrigger>
                                              <TooltipContent>Copy all tracking details</TooltipContent>
                                            </Tooltip>
                                          </div>
                                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                            <code className="flex-1 px-3 py-2 bg-background border border-border rounded-md text-xs sm:text-sm font-mono font-semibold break-all">
                                              {dispatchInfo.tracking_number}
                                            </code>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={async () => {
                                                try {
                                                  await navigator.clipboard.writeText(dispatchInfo.tracking_number);
                                                  toast({
                                                    title: "Copied!",
                                                    description: "Tracking number copied to clipboard",
                                                  });
                                                } catch (err) {
                                                  console.error('Failed to copy:', err);
                                                }
                                              }}
                                              className="shrink-0 w-full sm:w-auto"
                                            >
                                              <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-2" />
                                              Copy Number
                                            </Button>
                                          </div>
                                        </div>
                                      </div>
                                      
                                      {trackingUrl && (
                                        <div className="pt-1 sm:pt-2">
                                          <Button
                                            variant="default"
                                            className="w-full sm:w-auto text-sm"
                                            onClick={() => window.open(trackingUrl, '_blank', 'noopener,noreferrer')}
                                          >
                                            <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-2" />
                                            Track Shipment
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </CardHeader>
                    <CardContent className="hidden">
                      {/* Content moved to CollapsibleContent in header */}
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Timeline Card - Collapsible */}
              {searchedOrder.timeline.length > 0 && (
                <Card className="border-2 shadow-xl animate-fade-in" style={{ animationDelay: '400ms' }}>
                  <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
                    <Collapsible defaultOpen={true} className="w-full">
                      <CollapsibleTrigger className="flex items-center justify-between w-full group">
                        <CardTitle className="text-lg sm:text-xl font-display flex items-center gap-3">
                          <div className="p-2 bg-primary/20 rounded-lg">
                            <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                          </div>
                          Order Updates & Timeline
                        </CardTitle>
                        <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="pt-4 pb-2 px-1">
                          <div className="relative">
                            {/* Timeline Line */}
                            <div className="absolute left-[13px] xs:left-[15px] top-0 bottom-0 w-0.5 bg-border" />
                            
                            <div className="space-y-4 sm:space-y-6">
                              {searchedOrder.timeline.map((entry, index) => (
                                <div 
                                  key={`timeline-${entry.id}-${index}`}
                                  className="relative pl-10 xs:pl-12 animate-fade-in"
                                  style={{ animationDelay: `${500 + index * 100}ms` }}
                                >
                                  {/* Timeline Dot */}
                                  <div className="absolute left-0 top-1.5 h-6 w-6 xs:h-8 xs:w-8 rounded-full bg-primary border-3 xs:border-4 border-background shadow-lg flex items-center justify-center">
                                    <div className="h-1.5 w-1.5 xs:h-2 xs:w-2 rounded-full bg-primary-foreground" />
                                  </div>
                                  
                                  {/* Timeline Content */}
                                  <div className="pb-2">
                                    <p className="font-semibold text-sm sm:text-base mb-1 break-words">
                                      {entry.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                    </p>
                                    <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                                      <Clock className="h-3 w-3 xs:h-3.5 xs:w-3.5 shrink-0" />
                                      {format(new Date(entry.created_at), 'MMMM d, yyyy \'at\' h:mm a')}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </CardHeader>
                  <CardContent className="hidden">
                    {/* Content moved to CollapsibleContent in header */}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Help hint */}
          {!searchedOrder && !isLoading && (
            <div className="max-w-2xl mx-auto mt-12 text-center px-4 animate-fade-in">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                <Sparkles className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-base text-muted-foreground max-w-md mx-auto">
                Enter your order number above to track its progress through our production process in real-time.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer - Normal flow, always at bottom */}
      <div className="shrink-0 mt-auto">
        <AppFooter />
      </div>
    </div>
    </TooltipProvider>
  );
}
