import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook to determine if the current user can view financial data
 * Only admin and sales roles can see order totals, item totals, tax, etc.
 */
export function useFinancialAccess() {
  const { role, isAdmin } = useAuth();
  
  const canViewFinancials = isAdmin || role === 'sales';
  
  return {
    canViewFinancials,
    role,
    isAdmin,
  };
}
