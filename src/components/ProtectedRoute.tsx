import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth, AppRole } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, isLoading, isAdmin, session } = useAuth();
  const location = useLocation();

  // Show loading while checking session
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // CRITICAL: Check both user and session for better reliability
  // Sometimes user might be null but session exists (during reload)
  if (!user && !session) {
    console.log('[ProtectedRoute] No user or session, redirecting to auth');
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // If user exists but role is not loaded yet, wait a bit more
  if (user && !role && isLoading === false) {
    // Role might still be loading, show loading state
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Check role-based access
  if (allowedRoles && !isAdmin && role && !allowedRoles.includes(role)) {
    console.log('[ProtectedRoute] Role check failed:', { role, allowedRoles, isAdmin });
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
