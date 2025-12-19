import { useState, useEffect, useRef } from 'react';
import { Search, X, Package, User, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNavigate } from 'react-router-dom';
import { useOrders } from '@/contexts/OrderContext';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { PriorityBadge } from '@/components/orders/PriorityBadge';
import { Order } from '@/types/order';

interface SearchBarProps {
  className?: string;
  isMobile?: boolean;
}

export function SearchBar({ className, isMobile }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<Order[]>([]);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const { orders } = useOrders();

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const filtered = orders.filter(order => 
      order.order_id.toLowerCase().includes(query.toLowerCase()) ||
      order.customer.name.toLowerCase().includes(query.toLowerCase()) ||
      order.customer.phone?.includes(query) ||
      order.items.some(item => 
        item.product_name.toLowerCase().includes(query.toLowerCase())
      )
    );
    setResults(filtered.slice(0, 10)); // Limit to 10 results
  }, [query, orders]);

  const handleSelect = (orderId: string) => {
    navigate(`/orders/${orderId}`);
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Mobile Search Dialog
  if (isMobile) {
    return (
      <>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setIsOpen(true)}
        >
          <Search className="h-5 w-5" />
        </Button>

        {isOpen && (
          <div className="fixed inset-0 z-50">
            {/* Overlay */}
            <div 
              className="fixed inset-0 bg-black/80 animate-in fade-in-0"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Search Dialog - Top Positioned */}
            <div className="fixed top-4 left-4 right-4 z-50 bg-background border border-border rounded-lg shadow-lg max-h-[90vh] flex flex-col animate-in fade-in-0 zoom-in-95 slide-in-from-top-2">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="text-lg font-semibold">Search Orders</h2>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Search Input */}
              <div className="p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={inputRef}
                    placeholder="Search orders, customers, products..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-10 pr-10 h-11"
                    autoFocus
                  />
                  {query && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={() => setQuery('')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Results */}
              {results.length > 0 && (
                <ScrollArea className="flex-1 border-t border-border">
                  <div className="p-2 space-y-1">
                    {results.map((order) => (
                      <button
                        key={order.order_id}
                        className="w-full p-3 text-left rounded-lg hover:bg-secondary/50 transition-colors border border-transparent hover:border-border"
                        onClick={() => handleSelect(order.order_id)}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Package className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                            <span className="font-semibold text-foreground truncate">{order.order_id}</span>
                          </div>
                          <PriorityBadge priority={order.priority_computed} />
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="truncate">{order.customer.name}</span>
                          </div>
                          {order.customer.phone && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="truncate">{order.customer.phone}</span>
                            </div>
                          )}
                          {order.order_level_delivery_date && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                              <span>Delivery: {format(order.order_level_delivery_date, 'MMM d, yyyy')}</span>
                            </div>
                          )}
                          {order.items.length > 0 && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{order.items.length} item{order.items.length > 1 ? 's' : ''}</span>
                              {order.items[0]?.product_name && (
                                <span className="truncate">• {order.items[0].product_name}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {/* No Results */}
              {query.length >= 2 && results.length === 0 && (
                <div className="p-8 text-center text-muted-foreground border-t border-border">
                  <Search className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="font-medium mb-1">No results found</p>
                  <p className="text-xs">Try searching with order ID, customer name, or product name</p>
                </div>
              )}

              {/* Minimum Characters */}
              {query.length > 0 && query.length < 2 && (
                <div className="p-6 text-center text-muted-foreground border-t border-border">
                  <p className="text-sm">Type at least 2 characters to search</p>
                </div>
              )}
            </div>
          </div>
        )}
      </>
    );
  }

  // Desktop Search
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Search orders, customers... (⌘K)"
        className="pl-10 bg-secondary/50 border-0 focus-visible:ring-1 w-full"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query.length >= 2 && setResults(results)}
      />

      {/* Desktop Results Dropdown */}
      {results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          <ScrollArea className="max-h-[300px]">
            <div className="p-2">
              {results.map((order) => (
                <button
                  key={order.order_id}
                  className="w-full p-3 text-left rounded-lg hover:bg-secondary/50 transition-colors"
                  onClick={() => handleSelect(order.order_id)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-foreground">{order.order_id}</span>
                    </div>
                    <PriorityBadge priority={order.priority_computed} />
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {order.customer.name}
                    </span>
                    {order.order_level_delivery_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(order.order_level_delivery_date, 'MMM d')}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}