import { useState } from 'react';
import { Menu, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserMenu } from './UserMenu';
import { ThemeToggle } from './ThemeToggle';
import { NotificationsDropdown } from './NotificationsDropdown';
import { SearchBar } from './SearchBar';
import { CreateOrderDialog } from '@/components/dialogs/CreateOrderDialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useOrders } from '@/contexts/OrderContext';
import { useWorkLogs } from '@/contexts/WorkLogContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface AppHeaderProps {
  onMenuClick: () => void;
  title?: string;
}

export function AppHeader({ onMenuClick, title = 'Dashboard' }: AppHeaderProps) {
  const { refreshOrders } = useOrders();
  const { refreshWorkLogs } = useWorkLogs();
  const { isAdmin, role, isLoading } = useAuth();
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleOrderCreated = () => {
    refreshOrders();
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Refresh all data contexts
      await Promise.all([
        refreshOrders(),
        refreshWorkLogs(),
      ]);
      toast({
        title: "Refreshed",
        description: "Page content has been refreshed",
      });
    } catch (error) {
      console.error('Error refreshing:', error);
      toast({
        title: "Error",
        description: "Failed to refresh content",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <TooltipProvider>
      {/* Fixed Header - never scrolls */}
      <header className="flex-shrink-0 h-16 bg-background/95 backdrop-blur-md border-b border-border shadow-sm z-30">
        <div className="flex items-center justify-between h-full px-4 lg:px-6">
          {/* Left section */}
          <div className="flex items-center gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden hover:bg-accent"
                  onClick={onMenuClick}
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle menu</TooltipContent>
            </Tooltip>
            <h1 className="text-xl font-display font-semibold text-foreground tracking-tight">
              {title}
            </h1>
          </div>

          {/* Center section - Search (Desktop) */}
          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <SearchBar />
          </div>

          {/* Right section */}
          <div className="flex items-center gap-2">
            {/* Mobile Search */}
            <div className="md:hidden">
              <SearchBar isMobile />
            </div>
            
            {/* Manual Refresh Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh page content</TooltipContent>
            </Tooltip>
            
            <ThemeToggle />
            
            <NotificationsDropdown />

            {/* New Order button - Only visible to Sales and Admin - Wait for role to load */}
            {!isLoading && (isAdmin || role === 'sales') && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" className="hidden sm:flex gap-2 shadow-sm" onClick={() => setCreateOrderOpen(true)}>
                      <Plus className="h-4 w-4" />
                      New Order
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Create a new order</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" className="sm:hidden" onClick={() => setCreateOrderOpen(true)}>
                      <Plus className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Create a new order</TooltipContent>
                </Tooltip>
              </>
            )}
            
            <UserMenu />
          </div>
        </div>
      </header>

      <CreateOrderDialog 
        open={createOrderOpen} 
        onOpenChange={setCreateOrderOpen}
        onOrderCreated={handleOrderCreated}
      />
    </TooltipProvider>
  );
}
