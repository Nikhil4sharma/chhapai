import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Palette,
  FileCheck,
  Factory,
  Truck,
  Settings,
  Users,
  BarChart3,
  X,
  ChevronLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useOrders } from '@/contexts/OrderContext';
import { useMemo } from 'react';

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  badgeVariant?: 'priority-red' | 'priority-yellow' | 'default';
  roles?: string[]; // roles that can see this item
}

interface AppSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function AppSidebar({ isOpen, onToggle }: AppSidebarProps) {
  const location = useLocation();
  const { isAdmin, role, profile } = useAuth();
  const { orders } = useOrders();

  // Calculate real-time badges from orders
  const badges = useMemo(() => {
    const counts = {
      sales: 0,
      design: 0,
      prepress: 0,
      production: 0,
      dispatch: 0,
    };
    
    const urgentCounts = {
      sales: 0,
      design: 0,
      prepress: 0,
      production: 0,
      dispatch: 0,
    };

    orders.forEach(order => {
      if (order.is_completed) return;
      order.items.forEach(item => {
        const stage = item.current_stage as keyof typeof counts;
        if (counts[stage] !== undefined) {
          counts[stage]++;
          if (item.priority_computed === 'red') {
            urgentCounts[stage]++;
          }
        }
      });
    });

    return { counts, urgentCounts };
  }, [orders]);

  // Define nav items with role-based visibility
  const navItems: NavItem[] = useMemo(() => {
    const items: NavItem[] = [
      { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { 
        label: 'Sales', 
        path: '/sales', 
        icon: ShoppingCart, 
        badge: badges.counts.sales,
        badgeVariant: badges.urgentCounts.sales > 0 ? 'priority-red' : undefined,
        roles: ['admin', 'sales']
      },
      { 
        label: 'Design', 
        path: '/design', 
        icon: Palette, 
        badge: badges.counts.design,
        badgeVariant: badges.urgentCounts.design > 0 ? 'priority-red' : undefined,
        roles: ['admin', 'design']
      },
      { 
        label: 'Prepress', 
        path: '/prepress', 
        icon: FileCheck, 
        badge: badges.counts.prepress,
        badgeVariant: badges.urgentCounts.prepress > 0 ? 'priority-red' : undefined,
        roles: ['admin', 'prepress']
      },
      { 
        label: 'Production', 
        path: '/production', 
        icon: Factory, 
        badge: badges.counts.production,
        badgeVariant: badges.urgentCounts.production > 0 ? 'priority-red' : badges.urgentCounts.production > 0 ? 'priority-yellow' : undefined,
        roles: ['admin', 'production']
      },
      { 
        label: 'Dispatch', 
        path: '/dispatch', 
        icon: Truck, 
        badge: badges.counts.dispatch,
        roles: ['admin', 'production']
      },
    ];

    return items;
  }, [badges]);

  const adminItems: NavItem[] = [
    { label: 'Team', path: '/team', icon: Users },
    { label: 'Reports', path: '/reports', icon: BarChart3 },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  // Filter nav items based on role
  const visibleNavItems = navItems.filter(item => {
    if (!item.roles) return true; // Dashboard is visible to all
    if (isAdmin) return true;
    return item.roles.includes(role || '');
  });

  const NavItemComponent = ({ item }: { item: NavItem }) => {
    const isActive = location.pathname === item.path;
    
    return (
      <NavLink
        to={item.path}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
          "hover:bg-sidebar-accent",
          isActive 
            ? "bg-sidebar-primary text-sidebar-primary-foreground" 
            : "text-sidebar-foreground/70 hover:text-sidebar-foreground"
        )}
      >
        <item.icon className="h-5 w-5 shrink-0" />
        <span className={cn("flex-1", !isOpen && "lg:hidden")}>{item.label}</span>
        {item.badge !== undefined && item.badge > 0 && isOpen && (
          <Badge variant={item.badgeVariant || 'default'} className="ml-auto">
            {item.badge}
          </Badge>
        )}
      </NavLink>
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={onToggle}
        />
      )}
      
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full bg-sidebar border-r border-sidebar-border transition-all duration-300 flex flex-col",
          "lg:relative lg:z-0",
          isOpen ? "w-64 translate-x-0" : "-translate-x-full lg:translate-x-0 lg:w-20"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
          <div className={cn("flex items-center gap-2", !isOpen && "lg:justify-center lg:w-full")}>
            <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <span className="text-sidebar-primary-foreground font-bold text-sm">C</span>
            </div>
            {isOpen && (
              <span className="font-display font-semibold text-lg text-sidebar-foreground">
                Chhapai
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={onToggle}
          >
            <X className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="hidden lg:flex"
            onClick={onToggle}
          >
            <ChevronLeft className={cn("h-5 w-5 transition-transform", !isOpen && "rotate-180")} />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
          <div className="space-y-1">
            {visibleNavItems.map((item) => (
              <NavItemComponent key={item.path} item={item} />
            ))}
          </div>
          
          {/* Admin section - only visible to admins */}
          {isAdmin && isOpen && (
            <div className="pt-4 mt-4 border-t border-sidebar-border">
              <p className="px-3 text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider mb-2">
                Admin
              </p>
              <div className="space-y-1">
                {adminItems.map((item) => (
                  <NavItemComponent key={item.path} item={item} />
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* Footer */}
        {isOpen && profile && (
          <div className="p-4 border-t border-sidebar-border">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-sidebar-accent flex items-center justify-center">
                <span className="text-sm font-medium text-sidebar-foreground">
                  {profile.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {profile.full_name || 'User'}
                </p>
                <p className="text-xs text-sidebar-foreground/60 truncate">
                  {role?.charAt(0).toUpperCase()}{role?.slice(1)} {isAdmin && '• Admin'}
                </p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}