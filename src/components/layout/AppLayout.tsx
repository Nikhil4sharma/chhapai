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
    <div className="min-h-screen bg-background flex">
      <AppSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader 
          onMenuClick={() => setSidebarOpen(!sidebarOpen)} 
          title={title}
        />
        
        <main className="flex-1 overflow-y-auto">
          <div className="container py-6 animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
