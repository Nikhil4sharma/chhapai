import { Menu, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserMenu } from './UserMenu';
import { ThemeToggle } from './ThemeToggle';
import { NotificationsDropdown } from './NotificationsDropdown';
import { SearchBar } from './SearchBar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

interface AppHeaderProps {
  onMenuClick: () => void;
  title?: string;
}

export function AppHeader({ onMenuClick, title = 'Dashboard' }: AppHeaderProps) {
  const navigate = useNavigate();

  const handleNewOrder = () => {
    toast({
      title: "New Order",
      description: "Create order feature coming soon",
    });
  };

  return (
    <TooltipProvider>
      <header className="sticky top-0 z-30 h-16 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between h-full px-4 lg:px-6">
          {/* Left section */}
          <div className="flex items-center gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={onMenuClick}
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle menu</TooltipContent>
            </Tooltip>
            <h1 className="text-xl font-display font-semibold text-foreground">
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
            
            <ThemeToggle />
            
            <NotificationsDropdown />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" className="hidden sm:flex gap-2" onClick={handleNewOrder}>
                  <Plus className="h-4 w-4" />
                  New Order
                </Button>
              </TooltipTrigger>
              <TooltipContent>Create a new order</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" className="sm:hidden" onClick={handleNewOrder}>
                  <Plus className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Create a new order</TooltipContent>
            </Tooltip>
            
            <UserMenu />
          </div>
        </div>
      </header>
    </TooltipProvider>
  );
}
