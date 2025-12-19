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
  PackageCheck,
  Package,
  TrendingUp,
  BookOpen,
  Building2,
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
  const { isAdmin, role, profile, user, isLoading: authLoading } = useAuth();
  const { orders, getCompletedOrders, getOrdersForDepartment } = useOrders();

  // Calculate real-time badges from orders - count items per department
  // CRITICAL: Use getOrdersForDepartment to ensure badge count matches dashboard exactly
  // This ensures each department sees only their assigned items with proper visibility rules
  const badges = useMemo(() => {
    const counts = {
      sales: 0,
      design: 0,
      prepress: 0,
      production: 0,
      outsource: 0,
      dispatch: 0,
      dispatched: 0,
    };
    
    const urgentCounts = {
      sales: 0,
      design: 0,
      prepress: 0,
      production: 0,
      outsource: 0,
      dispatch: 0,
    };

    // Count dispatched items
    const completedOrders = getCompletedOrders();
    completedOrders.forEach(order => {
      order.items.forEach(item => {
        if (item.is_dispatched || item.current_stage === 'completed') {
          counts.dispatched++;
        }
      });
    });

    // Count items per department using getOrdersForDepartment (same logic as dashboards)
    // This ensures badge count matches exactly what user sees on dashboard
    const salesOrders = getOrdersForDepartment('sales');
    salesOrders.forEach(order => {
      order.items.forEach(item => {
        const dept = (item.assigned_department || item.current_stage)?.toLowerCase();
        if (dept === 'sales' && !item.is_dispatched && item.current_stage !== 'completed') {
          counts.sales++;
          if (item.priority_computed === 'red') urgentCounts.sales++;
        }
      });
    });

    const designOrders = getOrdersForDepartment('design');
    designOrders.forEach(order => {
      order.items.forEach(item => {
        const dept = (item.assigned_department || item.current_stage)?.toLowerCase();
        if (dept === 'design' && !item.is_dispatched && item.current_stage !== 'completed') {
          counts.design++;
          if (item.priority_computed === 'red') urgentCounts.design++;
        }
      });
    });

    const prepressOrders = getOrdersForDepartment('prepress');
    prepressOrders.forEach(order => {
      order.items.forEach(item => {
        const dept = (item.assigned_department || item.current_stage)?.toLowerCase();
        if (dept === 'prepress' && !item.is_dispatched && item.current_stage !== 'completed') {
          counts.prepress++;
          if (item.priority_computed === 'red') urgentCounts.prepress++;
        }
      });
    });

    const productionOrders = getOrdersForDepartment('production');
    productionOrders.forEach(order => {
      order.items.forEach(item => {
        const dept = (item.assigned_department || item.current_stage)?.toLowerCase();
        if (dept === 'production' && !item.is_dispatched && item.current_stage !== 'completed') {
          counts.production++;
          if (item.priority_computed === 'red') urgentCounts.production++;
        }
      });
    });

    const outsourceOrders = getOrdersForDepartment('outsource');
    outsourceOrders.forEach(order => {
      order.items.forEach(item => {
        const dept = (item.assigned_department || item.current_stage)?.toLowerCase();
        if (dept === 'outsource' && !item.is_dispatched && item.current_stage !== 'completed') {
          counts.outsource++;
          if (item.priority_computed === 'red') urgentCounts.outsource++;
        }
      });
    });

    // Count dispatch items (ready_to_dispatch stage)
    const activeOrders = orders.filter(o => !o.is_completed && !o.archived_from_wc);
    activeOrders.forEach(order => {
      order.items.forEach(item => {
        const dept = (item.assigned_department || item.current_stage)?.toLowerCase();
        if ((dept === 'dispatch' || dept === 'ready_to_dispatch' || item.current_stage === 'ready_to_dispatch') 
            && !item.is_dispatched && item.current_stage !== 'completed') {
          counts.dispatch++;
          if (item.priority_computed === 'red') urgentCounts.dispatch++;
        }
      });
    });

    return { counts, urgentCounts };
  }, [orders, getOrdersForDepartment, getCompletedOrders]);

  // Define nav items with role-based visibility
  const navItems: NavItem[] = useMemo(() => {
    const items: NavItem[] = [
      { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { 
        label: 'Orders', 
        path: '/orders', 
        icon: Package,
        badge: orders.filter(o => !o.is_completed && !o.archived_from_wc).reduce((sum, order) => sum + order.items.length, 0),
        roles: ['admin', 'sales'] // Only admin and sales can see Orders page
      },
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
        label: 'Outsource', 
        path: '/outsource', 
        icon: Building2, 
        badge: badges.counts.outsource,
        badgeVariant: badges.urgentCounts.outsource > 0 ? 'priority-red' : undefined,
        roles: ['admin', 'sales', 'prepress']
      },
      { 
        label: 'Dispatch', 
        path: '/dispatch', 
        icon: Truck, 
        badge: badges.counts.dispatch,
        roles: ['admin', 'production']
      },
      { 
        label: 'Dispatched', 
        path: '/dispatched', 
        icon: PackageCheck, 
        badge: badges.counts.dispatched,
        roles: ['admin', 'sales']
      },
    ];

    return items;
  }, [badges]);

  const adminItems: NavItem[] = [
    { label: 'Team', path: '/team', icon: Users },
    { label: 'Reports', path: '/reports', icon: BarChart3 },
    { label: 'Analytics', path: '/analytics', icon: TrendingUp, roles: ['admin'] },
    { label: 'Dept Efficiency', path: '/reports/department-efficiency', icon: Factory, roles: ['admin'] },
    { label: 'User Productivity', path: '/reports/user-productivity', icon: Users, roles: ['admin'] },
    { label: 'Vendor Analytics', path: '/reports/vendor-analytics', icon: Building2, roles: ['admin'] },
    { label: 'Performance', path: '/performance', icon: TrendingUp },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  // Filter nav items based on role
  // CRITICAL: Show all items if:
  // 1. Auth is loading
  // 2. User exists but role is not yet loaded (reload scenario)
  // This prevents sidebar from disappearing on page reload
  const visibleNavItems = navItems.filter(item => {
    // Public items (no roles restriction) - always visible
    if (!item.roles) return true;
    
    // If auth is still loading, show all items (optimistic rendering)
    if (authLoading) return true;
    
    // CRITICAL FIX: If user exists but role is null/undefined, show all items
    // This handles page reload where session exists but role fetch is pending
    if (user && !role) {
      return true; // Show all items until role is loaded
    }
    
    // If no user at all, hide role-based items
    if (!user) return false;
    
    // Admin sees everything
    if (isAdmin) return true;
    
    // Filter by role (role must exist at this point)
    return item.roles.includes(role);
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
      
      {/* Sidebar - Fixed position, full height, never scrolls with content */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 flex flex-col",
          "lg:sticky lg:z-40",
          isOpen ? "w-64 translate-x-0" : "-translate-x-full lg:translate-x-0 lg:w-20"
        )}
      >
        {/* Header - Fixed within sidebar */}
        <div className="flex-shrink-0 flex items-center justify-between h-16 px-4 border-b border-sidebar-border bg-sidebar">
          <div className={cn("flex items-center gap-3", !isOpen && "lg:justify-center lg:w-full")}>
            <div className="h-7 w-7 flex items-center justify-center flex-shrink-0">
              <img 
                src="/chhapai-logo.png" 
                alt="Chhapai Logo" 
                className="h-full w-full object-contain logo-dark-mode"
              />
            </div>
            {isOpen && (
              <span className="font-display font-bold text-xl text-sidebar-foreground tracking-tight">
                Chhapai.com
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
            className="hidden lg:flex hover:bg-sidebar-accent"
            onClick={onToggle}
          >
            <ChevronLeft className={cn("h-5 w-5 transition-transform duration-200", !isOpen && "rotate-180")} />
          </Button>
        </div>

        {/* Navigation - Scrollable within sidebar only */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-1 custom-scrollbar">
          <div className="space-y-1">
            {visibleNavItems.map((item) => (
              <NavItemComponent key={item.path} item={item} />
            ))}
          </div>
          
          {/* General section - visible to all */}
          {isOpen && (
            <div className="pt-4 mt-4 border-t border-sidebar-border">
              <p className="px-3 text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider mb-2">
                Resources
              </p>
              <div className="space-y-1">
                <NavItemComponent item={{ label: 'How We Work', path: '/how-we-work', icon: BookOpen }} />
              </div>
            </div>
          )}

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

          {/* Performance Reports - visible to non-admin users only */}
          {!isAdmin && isOpen && (
            <div className="pt-4 mt-4 border-t border-sidebar-border">
              <NavItemComponent item={{ label: 'Performance', path: '/performance', icon: TrendingUp }} />
            </div>
          )}
        </nav>

        {/* Footer - Fixed within sidebar */}
        {isOpen && profile && (
          <div className="flex-shrink-0 p-4 border-t border-sidebar-border bg-sidebar">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-sidebar-primary to-sidebar-accent flex items-center justify-center shadow-sm">
                <span className="text-sm font-medium text-sidebar-primary-foreground">
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