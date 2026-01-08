import { useAuth } from '@/features/auth/context/AuthContext';
import { lazy } from 'react';

// Lazy load to avoid circular deps or bundle bloat, matching App.tsx strategy
const Dashboard = lazy(() => import("@/features/dashboard/pages/Dashboard"));
const Sales = lazy(() => import("@/features/orders/pages/Sales"));

export function DashboardSwitcher() {
    const { role } = useAuth();

    // If role is sales, show the Sales Dashboard as default
    if (role === 'sales') {
        return <Sales />;
    }

    // Otherwise show the Main Dashboard
    return <Dashboard />;
}
