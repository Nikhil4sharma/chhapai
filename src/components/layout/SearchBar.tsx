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

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="sm:max-w-md p-0 gap-0">
            <DialogHeader className="p-4 pb-0">
              <DialogTitle className="sr-only">Search Orders</DialogTitle>
            </DialogHeader>
            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  placeholder="Search orders, customers..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-10 pr-10"
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

            {results.length > 0 && (
              <ScrollArea className="max-h-[300px] border-t border-border">
                <div className="p-2">
                  {results.map((order) => (
                    <button
                      key={order.order_id}
                      className="w-full p-3 text-left rounded-lg hover:bg-secondary/50 transition-colors"
                      onClick={() => handleSelect(order.order_id)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-foreground">{order.order_id}</span>
                        <PriorityBadge priority={order.priority_computed} />
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-3 w-3" />
                        {order.customer.name}
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}

            {query.length >= 2 && results.length === 0 && (
              <div className="p-6 text-center text-muted-foreground border-t border-border">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No results found</p>
              </div>
            )}
          </DialogContent>
        </Dialog>
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