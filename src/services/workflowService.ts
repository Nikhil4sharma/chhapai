import { supabase } from '@/integrations/supabase/client';
import {
    Department,
    ProductStatus,
    WORKFLOW_CONFIG,
    WorkflowAction,
    StatusConfig,
    WorkflowConfig
} from '@/types/workflow';
import { OrderItem, UserRole } from '@/types/order';

/**
 * Workflow Service
 * 
 * Manages the state machine for products moving through the factory.
 * Enforces strict transitions based on WORKFLOW_CONFIG.
 */

export const workflowService = {

    /**
     * Get available actions for a specific product based on its current state and user role.
     */
    getAvailableActions: (product: OrderItem, userRole: UserRole, config: WorkflowConfig = WORKFLOW_CONFIG): WorkflowAction[] => {
        // 1. Identify current Department and Status
        // Fallback to 'sales' and 'new_order' if undefined (migration support)
        const currentDeptId = product.assigned_department || product.current_stage || 'sales';
        const currentStatusId = product.status || 'new_order';

        // 2. Get Department Config
        const deptConfig = config[currentDeptId];
        if (!deptConfig) return [];

        // 3. Get Status Config
        const statusConfig = deptConfig.statuses.find(s => s.value === currentStatusId);
        if (!statusConfig) return [];

        // 4. Filter actions based on User Role
        const canAct =
            userRole === 'admin' ||
            userRole === 'super_admin' ||
            userRole === currentDeptId ||
            (currentDeptId === 'sales' && userRole === 'sales'); // Redundant but explicit

        if (!canAct) {
            return [];
        }

        return statusConfig.allowedActions;
    },

    /**
     * Get the display configuration for the current status
     */
    getStatusConfig: (product: OrderItem, config: WorkflowConfig = WORKFLOW_CONFIG): StatusConfig | undefined => {
        const currentDeptId = product.assigned_department || product.current_stage || 'sales';
        const currentStatusId = product.status || 'new_order';
        return config[currentDeptId]?.statuses.find(s => s.value === currentStatusId);
    },

    /**
     * Validate if a transition is allowed
     */
    validateTransition: (
        currentDept: Department,
        currentStatus: ProductStatus,
        targetDept: Department,
        targetStatus: ProductStatus,
        config: WorkflowConfig = WORKFLOW_CONFIG
    ): boolean => {
        const deptConfig = config[currentDept];
        const statusConfig = deptConfig?.statuses.find(s => s.value === currentStatus);

        if (!statusConfig) return false;

        return statusConfig.allowedActions.some(action =>
            (action.targetDepartment || currentDept) === targetDept &&
            action.targetStatus === targetStatus
        );
    },

    /**
     * EXECUTE MOVE
     * Moves a product to a new status/department.
     * Updates DB and Logs to Timeline.
     */
    moveProduct: async (
        orderId: string,
        itemId: string,
        actionId: string,
        userId: string,
        userName: string,
        config: WorkflowConfig = WORKFLOW_CONFIG,
        notes?: string
    ) => {
        // 1. Fetch current item to validate state (Concurrency check)
        const { data: item, error: fetchError } = await supabase
            .from('order_items')
            .select('*')
            .eq('id', itemId)
            .single();

        if (fetchError || !item) throw new Error('Item not found');

        const product = item as unknown as OrderItem; // Cast to use our types
        const currentDept = product.assigned_department || product.current_stage || 'sales';
        const currentStatus = product.status || 'new_order';

        // 2. Find the action definition
        const deptConfig = config[currentDept];
        const statusConfig = deptConfig?.statuses.find(s => s.value === currentStatus);
        const action = statusConfig?.allowedActions.find(a => a.id === actionId);

        if (!action) {
            throw new Error(`Invalid action ${actionId} for state ${currentDept}:${currentStatus}`);
        }

        // 3. Determine targets
        const targetDept = action.targetDepartment || currentDept;
        const targetStatus = action.targetStatus;

        if (!targetStatus) throw new Error('Action configuration error: No target status');

        // 4. Update the Order Item
        const updateData: any = {
            status: targetStatus,
            // Update department fields (both current_stage and assigned_department for compatibility)
            current_stage: targetDept === 'sales' ? 'sales' :
                targetDept === 'design' ? 'design' :
                    targetDept === 'prepress' ? 'prepress' :
                        targetDept === 'production' ? 'production' :
                            targetDept === 'outsource' ? 'outsource' : 'sales',
            assigned_department: targetDept === 'sales' ? 'sales' :
                targetDept === 'design' ? 'design' :
                    targetDept === 'prepress' ? 'prepress' :
                        targetDept === 'production' ? 'production' :
                            targetDept === 'outsource' ? 'outsource' : 'sales',
            updated_at: new Date().toISOString(),
            last_workflow_note: notes || null
        };

        // If moving to Sales for approval, SAVE current assignment as 'previous'
        if (targetDept === 'sales' || targetStatus === 'pending_for_customer_approval' || targetStatus === 'pending_client_approval') {
            updateData.previous_department = currentDept;
            updateData.previous_assigned_to = product.assigned_to || null;
        }

        const { error: updateError } = await supabase
            .from('order_items')
            .update(updateData)
            .eq('id', itemId);

        if (updateError) throw updateError;

        // 5. Log to Timeline
        const timelineEntry = {
            order_id: orderId,
            item_id: itemId,
            product_name: product.product_name,
            stage: targetDept, // legacy mapping
            action: 'status_changed',
            performed_by: userId,
            performed_by_name: userName,
            notes: `[Available Action: ${action.label}] ${notes || ''} \nMoved from ${currentDept} (${currentStatus}) to ${targetDept} (${targetStatus})`
        };

        await supabase.from('timeline').insert(timelineEntry);

        return { success: true, targetDept, targetStatus };
    }
};
