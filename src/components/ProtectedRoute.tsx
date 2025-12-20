import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth, AppRole } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, isLoading, isAdmin, session, authReady, profileReady } = useAuth();
  const location = useLocation();

  // CRITICAL: Wait until auth is initialized AND profile is ready
  // This prevents auth flicker and premature redirects
  if (!authReady || !profileReady || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // CRITICAL: Only redirect if auth is ready AND profile is ready AND no session exists
  // Never logout user just because profile is temporarily null during initial load
  if (!session && authReady && profileReady) {
    console.log('[ProtectedRoute] No session after auth ready, redirecting to auth');
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // CRITICAL: If session exists but no user/profile yet, wait (shouldn't happen if profileReady is true)
  // This is a defensive check
  if (session && !user && profileReady) {
    // Session exists but user is null - this shouldn't happen, but wait a bit
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // CRITICAL: Check role-based access ONLY after profile is ready
  // Never deny access during initial hydration phase
  if (allowedRoles && profileReady) {
    // If role is still null after profileReady, it means user has no role
    // Allow access for now (defensive) - role checks should be done at page level
    if (role && !isAdmin && !allowedRoles.includes(role)) {
      console.log('[ProtectedRoute] Role check failed:', { role, allowedRoles, isAdmin });
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}
