import { useState, useEffect } from 'react';
import { Menu, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserMenu } from './UserMenu';
import { ThemeToggle } from './ThemeToggle';
import { NotificationsDropdown } from './NotificationsDropdown';
import { ChatDrawer } from '@/features/chat/components/ChatDrawer';
import { SearchBar } from './SearchBar';
import { CreateOrderDialog } from '@/components/dialogs/CreateOrderDialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useOrders } from '@/features/orders/context/OrderContext';
import { useWorkLogs } from '@/contexts/WorkLogContext';
import { useAuth } from '@/features/auth/context/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { NewOrderButton } from '@/components/common/actions/NewOrderButton';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Listen for 'action=new_order' in URL
  useEffect(() => {
    if (searchParams.get('action') === 'new_order') {
      setCreateOrderOpen(true);
      // Optional: Clear param after opening, or leave it to allow refresh persistence?
      // Clearing it keeps URL clean.
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('action');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleOrderCreated = () => {
    refreshOrders();
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
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
      {/* Apple-style Glassmorphic Header */}
      <header className="flex-shrink-0 h-16 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800/60 shadow-sm z-30 sticky top-0 transition-all duration-300">
        <div className="flex items-center justify-between h-full px-4 md:px-6 max-w-[1920px] mx-auto w-full">
          {/* Left section */}
          <div className="flex items-center gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                  onClick={onMenuClick}
                >
                  <Menu className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle menu</TooltipContent>
            </Tooltip>
            {/* Title with improved typography */}
            <h1 className="text-xl font-display font-bold text-slate-800 dark:text-slate-100 tracking-tight hidden sm:block">
              {title}
            </h1>
          </div>

          {/* Center section - Search (Desktop) */}
          <div className="hidden md:flex flex-1 max-w-lg mx-12">
            <SearchBar />
          </div>

          {/* Right section */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* New Order button - Primary Action - FIRST priority on mobile */}
            {!isLoading && (isAdmin || role === 'sales') && (
              <>
                {/* Mobile: Icon only - RESTORED PREMIUM STYLING */}
                <div className="md:hidden">
                  <NewOrderButton onClick={() => setCreateOrderOpen(true)} collapsed={true} className="w-9 h-9" />
                </div>
                {/* Desktop: Full Button */}
                <div className="hidden md:block">
                  <NewOrderButton onClick={() => setCreateOrderOpen(true)} className="h-9" />
                </div>
              </>
            )}

            {/* Mobile Search */}
            <div className="md:hidden">
              <SearchBar isMobile />
            </div>

            {/* Manual Refresh Button - Hidden on Mobile */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hidden md:inline-flex"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh page content</TooltipContent>
            </Tooltip>

            {/* Theme Toggle - Visible on Mobile now */}
            <div>
              <ThemeToggle />
            </div>

            <ChatDrawer />
            <NotificationsDropdown />

            <div className="pl-2 border-l border-slate-200 dark:border-slate-800 ml-1">
              <UserMenu />
            </div>
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
