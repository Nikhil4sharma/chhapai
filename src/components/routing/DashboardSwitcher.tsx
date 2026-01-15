import { useAuth } from '@/features/auth/context/AuthContext';
import { lazy } from 'react';

// Lazy load to avoid circular deps or bundle bloat, matching App.tsx strategy
// Lazy load to avoid circular deps or bundle bloat, matching App.tsx strategy
const Dashboard = lazy(() => import("@/features/dashboard/pages/Dashboard"));
const Sales = lazy(() => import("@/features/orders/pages/Sales"));
const Production = lazy(() => import("@/features/orders/pages/Production"));
const Design = lazy(() => import("@/features/orders/pages/Design"));
const Prepress = lazy(() => import("@/features/orders/pages/Prepress"));
const HRDashboard = lazy(() => import("@/features/admin/pages/HRDashboard"));

export function DashboardSwitcher() {
    const { role } = useAuth();

    // Role-based Dashboard Routing
    if (role === 'sales') return <Sales />;
    if (role === 'production') return <Production />;
    if (role === 'design') return <Design />;
    if (role === 'prepress') return <Prepress />;
    if (role === 'hr') return <HRDashboard />;

    // Otherwise show the Main Dashboard (Admin / Generic)
    return <Dashboard />;
}
