import { useAuth } from '@/features/auth/context/AuthContext';
import { lazy } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

// Lazy load to avoid circular deps or bundle bloat, matching App.tsx strategy
// Lazy load to avoid circular deps or bundle bloat, matching App.tsx strategy
const AdminDashboard = lazy(() => import('@/features/admin/pages/Admin')); // Consolidated Admin Dashboard
const SalesDashboard = lazy(() => import('@/features/orders/pages/Sales'));
const DesignDashboard = lazy(() => import('@/features/orders/pages/Design'));
const PrepressDashboard = lazy(() => import('@/features/orders/pages/Prepress'));
const ProductionDashboard = lazy(() => import('@/features/orders/pages/Production'));
const DispatchDashboard = lazy(() => import('@/features/orders/pages/Dispatch'));
const HRDashboard = lazy(() => import('@/features/admin/pages/HRDashboard'));
// const EmployeeManagement = lazy(() => import('@/features/hr/pages/EmployeeManagement'));
const AccountsDashboard = lazy(() => import('@/features/accounts/pages/AccountsDashboard'));

export const DashboardSwitcher = () => {
    const { role, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // If we are already on a specific role dashboard, don't redirect
    // This allows direct linking
    if (location.pathname.includes('/admin') && role === 'admin') return <AdminDashboard />;
    if (location.pathname.includes('/sales') && role === 'sales') return <SalesDashboard />;
    if (location.pathname.includes('/design') && role === 'design') return <DesignDashboard />;
    if (location.pathname.includes('/prepress') && role === 'prepress') return <PrepressDashboard />;
    if (location.pathname.includes('/production') && role === 'production') return <ProductionDashboard />;
    if (location.pathname.includes('/dispatch') && role === 'dispatch') return <DispatchDashboard />;
    if (location.pathname.includes('/outsource') && role === 'outsource') return <ProductionDashboard />;
    if (location.pathname.includes('/hr') && role === 'hr') return <HRDashboard />;
    if (location.pathname.includes('/accounts') && role === 'accounts') return <AccountsDashboard />;

    // Default redirects based on role
    switch (role) {
        case 'admin':
            return <Navigate to="/sales" replace />;
        case 'sales':
            return <Navigate to="/sales" replace />;
        case 'design':
            return <Navigate to="/design" replace />;
        case 'prepress':
            return <Navigate to="/prepress" replace />;
        case 'production':
        case 'dispatch':
        case 'outsource':
            return <Navigate to="/production" replace />;
        case 'hr':
        case 'hr_admin':
            return <Navigate to="/admin/hr" replace />; // HR and HR Admin goes to HR dashboard
        case 'accounts':
            return <Navigate to="/accounts" replace />;
        case 'super_admin':
            return <Navigate to="/admin" replace />;
        default:
            return <Navigate to="/login" replace />;
    }
};
