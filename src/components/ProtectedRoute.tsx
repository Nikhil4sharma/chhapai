import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth, AppRole } from '@/features/auth/context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, isLoading, isAdmin, session, authReady } = useAuth();
  const location = useLocation();

  // CRITICAL: ONLY wait for authReady - profile/role loading is non-blocking
  if (!authReady || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // CRITICAL: Only redirect if auth is ready AND no session exists
  if (!session && authReady) {
    console.log('[ProtectedRoute] No session after auth ready, redirecting to auth');
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // CRITICAL: If session exists but no user, wait briefly (shouldn't happen normally)
  if (session && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // CRITICAL: Check role-based access
  // Role can be null initially (non-blocking load), so we check if it exists
  if (allowedRoles && role) {
    // Only check if role is loaded - if null, allow access (defensive)
    if (!isAdmin && !allowedRoles.includes(role)) {
      console.log('[ProtectedRoute] Role check failed:', { role, allowedRoles, isAdmin });
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}
