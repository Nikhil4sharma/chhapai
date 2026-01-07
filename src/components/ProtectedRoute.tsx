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
  // Role can be null initially, but if authReady is true (handled above) and user exists (handled above),
  // then a null role means the user HAS NO ROLE assigned in the DB.
  if (allowedRoles) {
    if (!role) {
      // User is logged in but has no role assigned
      console.warn('[ProtectedRoute] User has no role assigned. Access denied.');
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-4">You do not have a role assigned. Please contact the administrator.</p>
        </div>
      );
    }

    if (!isAdmin && !allowedRoles.includes(role)) {
      console.log('[ProtectedRoute] Role check failed:', { role, allowedRoles, isAdmin });
      // Redirect to dashboard if they have a role but just not this one. 
      // If they rely on this route for dashboard, we might loop? 
      // Dashboard usually has wide allowedRoles.

      // Special case: If user is blocked from Dashboard, show error
      if (location.pathname === '/' || location.pathname === '/dashboard') {
        // This implies their role isn't allowed on dashboard?? 
        // Dashboard route currently allows all roles implicitly via `allowedRoles`?
        // Actually Dashboard route definition in App.tsx doesn't have allowedRoles prop! 
        // It just uses ProtectedRoute. So ANY role is allowed.
        // This block only runs if allowedRoles is PASSED.
        return <Navigate to="/dashboard" replace />;
      }

      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}
