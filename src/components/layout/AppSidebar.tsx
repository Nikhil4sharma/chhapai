
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
  ChevronRight,
  PackageCheck,
  Package,
  TrendingUp,
  BookOpen,
  Building2,
  Briefcase,
  ChevronDown,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useOrders } from '@/features/orders/context/OrderContext';
import { useMemo, useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  badgeVariant?: 'priority-red' | 'priority-yellow' | 'default';
  roles?: string[]; // roles that can see this item
}

interface NavGroup {
  title: string;
  items: NavItem[];
  roles?: string[];
}

interface AppSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function AppSidebar({ isOpen, onToggle }: AppSidebarProps) {
  const location = useLocation();
  const { isAdmin, role, profile, user, isLoading: authLoading } = useAuth();
  const { orders, getCompletedOrders, getOrdersForDepartment } = useOrders();

  // State for collapsible sections
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    'Overview': true,
    'Modules': true,
    'Administration': true, // Default open for admin
  });

  const toggleGroup = (title: string) => {
    setOpenGroups(prev => ({ ...prev, [title]: !prev[title] }));
  };

  // Calculate real-time badges
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

    const completedOrders = getCompletedOrders();
    completedOrders.forEach(order => {
      order.items.forEach(item => {
        if (item.is_dispatched || item.current_stage === 'completed') {
          counts.dispatched++;
        }
      });
    });

    // Helper to count per department
    const countDept = (deptName: string, targetCounts: typeof counts, targetUrgent: typeof urgentCounts) => {
      const deptOrders = getOrdersForDepartment(deptName as any); // Type assertion for generic string
      deptOrders.forEach(order => {
        order.items.forEach(item => {
          const itemDept = (item.assigned_department || item.current_stage)?.toLowerCase();
          if (itemDept === deptName && !item.is_dispatched && item.current_stage !== 'completed') {
            // @ts-ignore - dynamic key access
            targetCounts[deptName]++;
            if (item.priority_computed === 'red') {
              // @ts-ignore
              targetUrgent[deptName]++;
            }
          }
        });
      });
    };

    ['sales', 'design', 'prepress', 'production', 'outsource'].forEach(d => countDept(d, counts, urgentCounts));

    // Dispatch special case
    const activeOrders = orders.filter(o => !o.is_completed && !o.archived_from_wc);
    activeOrders.forEach(order => {
      order.items.forEach(item => {
        const dept = (item.assigned_department || item.current_stage)?.toLowerCase();
        if ((dept === 'dispatch' || dept === 'ready_to_dispatch' || (item.current_stage as string) === 'ready_to_dispatch')
          && !item.is_dispatched && item.current_stage !== 'completed') {
          counts.dispatch++;
          if (item.priority_computed === 'red') urgentCounts.dispatch++;
        }
      });
    });

    return { counts, urgentCounts };
  }, [orders, getOrdersForDepartment, getCompletedOrders]);

  const navGroups: NavGroup[] = useMemo(() => [
    {
      title: 'Overview',
      items: [
        { label: 'Dashboard', path: '/', icon: LayoutDashboard },
        { label: 'Track Order', path: '/track', icon: PackageCheck },
      ]
    },
    {
      title: 'Modules',
      items: [
        {
          label: 'Inventory',
          path: '/inventory',
          icon: Layers,
          roles: ['admin', 'production', 'prepress', 'super_admin']
        },
        {
          label: 'Customers',
          path: '/customers',
          icon: Users,
          roles: ['admin', 'sales', 'super_admin']
        },
        {
          label: 'Sales',
          path: '/sales',
          icon: ShoppingCart,
          roles: ['admin', 'super_admin'],
          badge: badges.counts.sales,
          badgeVariant: badges.urgentCounts.sales > 0 ? 'priority-red' : 'default'
        },
        {
          label: 'Design',
          path: '/design',
          icon: Palette,
          badge: badges.counts.design,
          badgeVariant: badges.urgentCounts.design > 0 ? 'priority-red' : 'default',
          roles: ['admin', 'super_admin'] // Only Admin can see, not Design users
        },
        {
          label: 'Prepress',
          path: '/prepress',
          icon: FileCheck,
          badge: badges.counts.prepress,
          badgeVariant: badges.urgentCounts.prepress > 0 ? 'priority-red' : 'default',
          roles: ['admin', 'prepress', 'super_admin']
        },
        {
          label: 'Production',
          path: '/production',
          icon: Factory,
          badge: badges.counts.production,
          badgeVariant: badges.urgentCounts.production > 0 ? 'priority-red' : 'default',
          roles: ['admin', 'production', 'super_admin']
        },
        {
          label: 'Outsource',
          path: '/outsource',
          icon: Building2,
          badge: badges.counts.outsource,
          badgeVariant: badges.urgentCounts.outsource > 0 ? 'priority-red' : 'default',
          roles: ['admin', 'outsource', 'sales', 'production', 'prepress', 'super_admin']
        },
        {
          label: 'Dispatch',
          path: '/dispatch',
          icon: Truck,
          badge: badges.counts.dispatch,
          badgeVariant: badges.urgentCounts.dispatch > 0 ? 'priority-red' : 'default',
          roles: ['admin', 'dispatch', 'sales', 'super_admin']
        },
      ]
    },

    {
      title: 'Administration',
      roles: ['admin', 'super_admin', 'hr_admin'],
      items: [
        { label: 'HR Portal', path: '/hr', icon: Briefcase },
        {
          label: 'HR Admin',
          path: '/admin/hr',
          icon: Users,
          roles: ['admin', 'super_admin', 'hr_admin']
        },
        {
          label: 'User Management',
          path: '/admin/users',
          icon: Users,
          roles: ['admin', 'super_admin']
        },
        {
          label: 'Settings',
          path: '/admin/settings',
          icon: Settings,
          roles: ['admin', 'super_admin']
        },
        {
          label: 'Reports',
          path: '/reports',
          icon: BarChart3,
          roles: ['admin', 'super_admin']
        },
      ]
    }
  ], [badges]);

  if (authLoading) return null;

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={onToggle}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 z-50 h-screen bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ease-in-out flex flex-col w-[250px]",
          !isOpen && "lg:w-[70px] -translate-x-full lg:translate-x-0"
        )}
      >
        {/* Header Logo Area */}
        <div className="h-16 flex items-center px-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div className={cn("flex items-center gap-3 overflow-hidden transition-all duration-300", !isOpen && "lg:opacity-0")}>
            <div className="h-8 w-8 flex items-center justify-center shrink-0">
              <img src="/chhapai-logo.png" alt="Chhapai" className="h-7 w-7 object-contain logo-dark-mode" />
            </div>
            <span className="font-bold text-lg text-slate-900 dark:text-white truncate tracking-tight">Chhapai</span>
          </div>

          {/* Collapse Button (Desktop) */}
          <Button
            variant="ghost"
            size="icon"
            className={cn("ml-auto hidden lg:flex h-7 w-7 hover:bg-slate-100 dark:hover:bg-slate-800", !isOpen && "absolute right-0 left-0 mx-auto top-4")}
            onClick={onToggle}
          >
            {isOpen ? <ChevronLeft className="h-4 w-4 text-slate-500" /> : <ChevronLeft className="h-4 w-4 rotate-180 text-slate-500" />}
          </Button>

          {/* Close Button (Mobile) */}
          <Button variant="ghost" size="icon" className="ml-auto lg:hidden" onClick={onToggle}>
            <X className="h-5 w-5" />
          </Button>
        </div>



        {/* Scrollable Nav Content */}
        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-2 custom-scrollbar">
          {navGroups.map((group) => {
            // Check group visibility
            if (group.roles && !group.roles.some(r => role && (role === r || (role as string) === 'super_admin'))) return null;

            // Filter items by role
            const visibleItems = group.items.filter(item =>
              !item.roles || (role && (item.roles.includes(role) || (role as string) === 'super_admin' || isAdmin))
            );

            if (visibleItems.length === 0) return null;

            // If sidebar is closed, don't show collapsible behavior, just icons
            if (!isOpen) {
              return (
                <div key={group.title} className="space-y-1 py-2 border-t border-slate-100 dark:border-slate-800 first:border-0">
                  {visibleItems.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) => cn(
                        "flex items-center justify-center h-10 w-10 mx-auto rounded-lg transition-all duration-200 group relative",
                        isActive
                          ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"
                          : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.badge ? (
                        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-950" />
                      ) : null}

                      {/* Tooltip */}
                      <div className="absolute left-full ml-4 px-2 py-1 bg-slate-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                        {item.label}
                      </div>
                    </NavLink>
                  ))}
                </div>
              );
            }

            return (
              <Collapsible
                key={group.title}
                open={openGroups[group.title]}
                onOpenChange={() => toggleGroup(group.title)}
                className="space-y-1"
              >
                <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider group cursor-pointer hover:text-slate-800 dark:hover:text-slate-300 transition-colors"
                  onClick={() => toggleGroup(group.title)}
                >
                  {group.title}
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 hover:bg-transparent">
                      <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", openGroups[group.title] ? "" : "-rotate-90")} />
                    </Button>
                  </CollapsibleTrigger>
                </div>

                <CollapsibleContent className="space-y-1 data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
                  {visibleItems.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => window.innerWidth < 1024 && onToggle()}
                      className={({ isActive }) => cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 group mx-2 text-sm",
                        isActive
                          ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-medium"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200"
                      )}
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon className={cn("h-4 w-4 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity", isActive && "opacity-100")} />

                          <span>{item.label}</span>

                          {item.badge ? (
                            <Badge
                              variant={item.badgeVariant === 'priority-red' ? 'destructive' : 'secondary'}
                              className="ml-auto h-5 px-1.5 min-w-[1.25rem] flex items-center justify-center text-[10px] font-bold"
                            >
                              {item.badge}
                            </Badge>
                          ) : null}
                        </>
                      )}
                    </NavLink>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>

        {/* Footer / User Profile Snippet */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
          {isOpen && profile && (
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
                <span className="text-xs font-bold text-white">
                  {profile.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                  {profile.full_name || 'User'}
                </p>
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide truncate">
                    {role?.replace('_', ' ')}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}