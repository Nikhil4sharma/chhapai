import { Stage, UserRole } from '@/types/order';

/**
 * Determines if a button should be visible based on user role and item stage
 */
export interface ButtonVisibilityConfig {
  buttonType: 'assign' | 'move_stage' | 'upload' | 'add_note' | 'dispatch' | 'edit_specs' | 'set_priority' | 'mark_complete';
  userRole: UserRole;
  isAdmin: boolean;
  itemStage: Stage;
  itemAssignedDepartment?: UserRole;
  itemAssignedTo?: string;
  currentUserId?: string;
}

/**
 * Check if a button should be visible
 */
export function shouldShowButton(config: ButtonVisibilityConfig): boolean {
  const { buttonType, userRole, isAdmin, itemStage, itemAssignedDepartment, itemAssignedTo, currentUserId } = config;

  // Admin can see all buttons
  if (isAdmin) return true;

  // Button-specific visibility rules
  switch (buttonType) {
    case 'assign':
      // Sales and Admin can assign
      return userRole === 'sales';
    
    case 'move_stage':
      // Only users in the current department can move to next stage
      const stageToDept: Record<Stage, UserRole> = {
        sales: 'sales',
        design: 'design',
        prepress: 'prepress',
        production: 'production',
        outsource: 'prepress', // Prepress assigns to outsource
        dispatch: 'production',
        completed: 'production',
      };
      const requiredDept = stageToDept[itemStage];
      return userRole === requiredDept || itemAssignedDepartment === userRole;
    
    case 'upload':
      // Design, Prepress, Production can upload files
      return ['design', 'prepress', 'production'].includes(userRole);
    
    case 'add_note':
      // All users can add notes
      return true;
    
    case 'dispatch':
      // Only Production can dispatch
      return userRole === 'production';
    
    case 'edit_specs':
      // Only Sales can edit specs
      return userRole === 'sales';
    
    case 'set_priority':
      // Only Sales can set priority
      return userRole === 'sales';
    
    case 'mark_complete':
      // Only users in the current department can mark complete
      const completeDept = stageToDept[itemStage];
      return userRole === completeDept || itemAssignedDepartment === userRole;
    
    default:
      return false;
  }
}

/**
 * Get tooltip reason for why a button is disabled
 */
export function getButtonDisabledReason(config: ButtonVisibilityConfig): string | null {
  if (shouldShowButton(config)) return null;

  const { buttonType, userRole, itemStage, itemAssignedDepartment } = config;

  switch (buttonType) {
    case 'assign':
      return 'Only Sales can assign orders to departments';
    
    case 'move_stage':
      const stageToDept: Record<Stage, UserRole> = {
        sales: 'sales',
        design: 'design',
        prepress: 'prepress',
        production: 'production',
        outsource: 'prepress',
        dispatch: 'production',
        completed: 'production',
      };
      const requiredDept = stageToDept[itemStage];
      return `Only ${requiredDept} department can move items from ${itemStage} stage`;
    
    case 'upload':
      return 'Only Design, Prepress, and Production can upload files';
    
    case 'dispatch':
      return 'Only Production department can dispatch orders';
    
    case 'edit_specs':
      return 'Only Sales can edit product specifications';
    
    case 'set_priority':
      return 'Only Sales can set order priority';
    
    default:
      return 'You do not have permission to perform this action';
  }
}

/**
 * Check if user can perform action on item
 */
export function canPerformAction(
  action: string,
  userRole: UserRole,
  isAdmin: boolean,
  itemStage: Stage,
  itemAssignedDepartment?: UserRole,
  itemAssignedTo?: string,
  currentUserId?: string
): boolean {
  if (isAdmin) return true;

  // If item is assigned to a specific user, only that user can act on it
  if (itemAssignedTo && currentUserId && itemAssignedTo !== currentUserId) {
    return false;
  }

  // Check if user's department matches item's assigned department
  if (itemAssignedDepartment && itemAssignedDepartment !== userRole) {
    return false;
  }

  return true;
}

