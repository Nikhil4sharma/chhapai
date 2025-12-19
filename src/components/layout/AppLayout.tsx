import { useState } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { AppFooter } from './AppFooter';
import { cn } from '@/lib/utils';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Home } from 'lucide-react';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/orders': 'Orders',
  '/sales': 'Sales',
  '/design': 'Design',
  '/prepress': 'Prepress',
  '/production': 'Production',
  '/outsource': 'Outsource',
  '/dispatch': 'Dispatch',
  '/dispatched': 'Dispatched',
  '/team': 'Team',
  '/reports': 'Reports',
  '/analytics': 'Analytics Dashboard',
  '/reports/department-efficiency': 'Department Efficiency',
  '/reports/user-productivity': 'User Productivity',
  '/reports/vendor-analytics': 'Vendor Analytics',
  '/performance': 'Performance Reports',
  '/settings': 'Settings',
  '/profile': 'Profile',
  '/how-we-work': 'How We Work',
  '/admin': 'Admin',
};

const getBreadcrumbs = (pathname: string) => {
  const paths = pathname.split('/').filter(Boolean);
  const breadcrumbs = [{ label: 'Home', path: '/dashboard' }];
  
  let currentPath = '';
  paths.forEach((path, index) => {
    currentPath += `/${path}`;
    
    // Handle order detail pages specially
    if (path === 'orders' && paths[index + 1]) {
      const orderId = paths[index + 1];
      breadcrumbs.push({ label: 'Orders', path: '/orders' });
      breadcrumbs.push({ label: `Order ${orderId}`, path: currentPath });
      return; // Skip further processing
    }
    
    // Handle /orders path (without orderId) - show Orders page
    if (path === 'orders' && !paths[index + 1]) {
      breadcrumbs.push({ label: 'Orders', path: '/orders' });
      return; // Skip further processing
    }
    
    const title = pageTitles[currentPath] || path.charAt(0).toUpperCase() + path.slice(1);
    breadcrumbs.push({ label: title, path: currentPath });
  });
  
  return breadcrumbs;
};

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  
  // Normalize pathname - handle root path
  const normalizedPath = location.pathname === '/' ? '/dashboard' : location.pathname;
  const title = pageTitles[normalizedPath] || pageTitles[location.pathname] || 'Chhapai';
  const breadcrumbs = getBreadcrumbs(normalizedPath);

  return (
    <div className="h-screen w-screen overflow-hidden bg-background flex">
      {/* Fixed Sidebar - never scrolls */}
      <AppSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      {/* Main content area */}
      <div className={cn(
        "flex-1 flex flex-col h-screen overflow-hidden transition-all duration-300",
        sidebarOpen ? "lg:ml-0" : "lg:ml-0"
      )}>
        {/* Fixed Header */}
        <AppHeader 
          onMenuClick={() => setSidebarOpen(!sidebarOpen)} 
          title={title}
        />
        
        {/* Scrollable Content Area with Footer */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 relative">
          <main className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar min-h-0 pb-20 sm:pb-24">
            <div className="p-4 lg:p-6 animate-fade-in min-h-full pb-4">
              {/* Breadcrumb Navigation */}
              {location.pathname !== '/dashboard' && location.pathname !== '/' && (
                <Breadcrumb className="mb-4">
                  <BreadcrumbList>
                    {breadcrumbs.map((crumb, index) => (
                      <div key={`${crumb.path}-${index}`} className="flex items-center">
                        {index > 0 && <BreadcrumbSeparator />}
                        <BreadcrumbItem>
                          {index === 0 ? (
                            <BreadcrumbLink asChild>
                              <Link to={crumb.path} className="flex items-center gap-1">
                                <Home className="h-3.5 w-3.5" />
                                <span>{crumb.label}</span>
                              </Link>
                            </BreadcrumbLink>
                          ) : index === breadcrumbs.length - 1 ? (
                            <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                          ) : (
                            <BreadcrumbLink asChild>
                              <Link to={crumb.path}>{crumb.label}</Link>
                            </BreadcrumbLink>
                          )}
                        </BreadcrumbItem>
                      </div>
                    ))}
                  </BreadcrumbList>
                </Breadcrumb>
              )}
              <Outlet />
            </div>
          </main>
          
          {/* Fixed Footer - Always visible at bottom, mobile safe area support */}
          <div className="flex-shrink-0 relative z-30 bg-background border-t border-border shadow-lg pb-safe-mobile">
            <AppFooter />
          </div>
        </div>
      </div>
    </div>
  );
}
