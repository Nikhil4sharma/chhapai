import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { cn } from '@/lib/utils';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/sales': 'Sales',
  '/design': 'Design',
  '/prepress': 'Prepress',
  '/production': 'Production',
  '/dispatch': 'Dispatch',
  '/team': 'Team',
  '/reports': 'Reports',
  '/settings': 'Settings',
};

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  
  const title = pageTitles[location.pathname] || 'Chhapai';

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
        
        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
          <div className="p-4 lg:p-6 animate-fade-in min-h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
