export type Department = 'sales' | 'design' | 'prepress' | 'production' | 'outsource';

export type SalesStatus =
    | 'new_order'
    | 'pending_for_customer_approval' // Generic pending state for Sales to review
    | 'customer_approved' // Specific status for approved design
    | 'approved' // Generic approved state (if needed in Sales view, though usually items move back to dept)
    | 'completed';

export type DesignStatus =
    | 'design_in_progress'
    | 'approved' // "Design Approved"
    | 'completed'; // "Design Completed" (Ready for next dept)

export type PrepressStatus =
    | 'prepress_in_progress'
    | 'approved'
    | 'completed';

export type OutsourceStatus =
    | 'outsource_in_progress'
    | 'received';

export type ProductionStatus =
    | 'in_production'
    | 'ready_for_dispatch'
    | 'dispatched'
    | 'delivered';

export type ProductStatus = SalesStatus | DesignStatus | PrepressStatus | OutsourceStatus | ProductionStatus;

export interface WorkflowAction {
    id: string;
    label: string;
    targetDepartment?: Department;
    targetStatus: ProductStatus;
    style?: 'primary' | 'secondary' | 'danger' | 'success';
    requiredRole?: string[];
}

export interface StatusConfig {
    value: ProductStatus;
    label: string;
    allowedActions: WorkflowAction[];
    color?: string;
}

export interface DepartmentConfig {
    id: Department;
    label: string;
    statuses: StatusConfig[];
}

export const WORKFLOW_CONFIG: Record<Department, DepartmentConfig> = {
    sales: {
        id: 'sales',
        label: 'Sales',
        statuses: [
            {
                value: 'new_order',
                label: 'New Order',
                allowedActions: [
                    { id: 'assign_design', label: 'Assign to Design', targetDepartment: 'design', targetStatus: 'design_in_progress', style: 'primary' },
                    { id: 'assign_prepress', label: 'Assign to Prepress', targetDepartment: 'prepress', targetStatus: 'prepress_in_progress', style: 'secondary' },
                    { id: 'assign_outsource', label: 'Assign to Outsource', targetDepartment: 'outsource', targetStatus: 'outsource_in_progress', style: 'secondary' }
                ],
                color: 'bg-blue-100 text-blue-800'
            },
            {
                value: 'pending_for_customer_approval',
                label: 'Pending Approval',
                allowedActions: [
                    // Actions here are dynamic ("Approve" sends back to previous dept).
                    // We define generic actions, logic in Service handles the routing based on 'previous_department'.
                    { id: 'sales_approve', label: 'Approve', targetStatus: 'approved', style: 'success' }, // targetStatus is placeholder, service logic overrides
                    { id: 'sales_reject', label: 'Reject', targetStatus: 'design_in_progress', style: 'danger' } // targetStatus placeholder
                ],
                color: 'bg-yellow-100 text-yellow-800'
            },
            {
                value: 'completed',
                label: 'Completed',
                allowedActions: [],
                color: 'bg-green-100 text-green-800'
            }
        ]
    },
    design: {
        id: 'design',
        label: 'Design',
        statuses: [
            {
                value: 'design_in_progress',
                label: 'In Progress',
                allowedActions: [
                    { id: 'send_approval', label: 'Send for Approval', targetDepartment: 'sales', targetStatus: 'pending_for_customer_approval', style: 'primary' }
                ],
                color: 'bg-purple-100 text-purple-800'
            },
            {
                value: 'approved',
                label: 'Approved',
                allowedActions: [
                    { id: 'assign_prepress', label: 'Handoff to Prepress', targetDepartment: 'prepress', targetStatus: 'prepress_in_progress', style: 'primary' },
                    { id: 'design_complete', label: 'Mark Completed', targetStatus: 'completed', style: 'secondary' }
                ],
                color: 'bg-green-100 text-green-800'
            },
            {
                value: 'completed',
                label: 'Design Completed',
                allowedActions: [
                    { id: 'assign_prepress', label: 'Assign to Prepress', targetDepartment: 'prepress', targetStatus: 'prepress_in_progress', style: 'primary' }
                ],
                color: 'bg-gray-100 text-gray-800'
            }
        ]
    },
    prepress: {
        id: 'prepress',
        label: 'Prepress',
        statuses: [
            {
                value: 'prepress_in_progress',
                label: 'In Progress',
                allowedActions: [
                    { id: 'send_approval', label: 'Send for Approval', targetDepartment: 'sales', targetStatus: 'pending_for_customer_approval', style: 'primary' }
                ],
                color: 'bg-amber-100 text-amber-800'
            },
            {
                value: 'approved',
                label: 'Approved',
                allowedActions: [
                    { id: 'assign_production', label: 'Handoff to Production', targetDepartment: 'production', targetStatus: 'in_production', style: 'primary' }
                ],
                color: 'bg-green-100 text-green-800'
            }
        ]
    },
    outsource: {
        id: 'outsource',
        label: 'Outsource',
        statuses: [
            {
                value: 'outsource_in_progress',
                label: 'In Progress',
                allowedActions: [
                    { id: 'send_approval', label: 'Send for Approval', targetDepartment: 'sales', targetStatus: 'pending_for_customer_approval', style: 'primary' }
                ],
                color: 'bg-purple-100 text-purple-800'
            },
            {
                value: 'received',
                label: 'Received',
                allowedActions: [
                    { id: 'assign_production', label: 'Handoff to Production', targetDepartment: 'production', targetStatus: 'in_production', style: 'primary' }
                ],
                color: 'bg-green-100 text-green-800'
            }
        ]
    },
    production: {
        id: 'production',
        label: 'Production',
        statuses: [
            {
                value: 'in_production',
                label: 'In Production',
                allowedActions: [
                    { id: 'mark_ready', label: 'Ready for Dispatch', targetStatus: 'ready_for_dispatch', style: 'primary' }
                ],
                color: 'bg-emerald-100 text-emerald-800'
            },
            {
                value: 'ready_for_dispatch',
                label: 'Ready for Dispatch',
                allowedActions: [
                    { id: 'mark_dispatched', label: 'Mark Dispatched', targetStatus: 'dispatched', style: 'secondary' }
                ],
                color: 'bg-blue-100 text-blue-800'
            },
            {
                value: 'dispatched',
                label: 'Dispatched',
                allowedActions: [
                    { id: 'mark_delivered', label: 'Mark Delivered', targetStatus: 'delivered', style: 'success' }
                ],
                color: 'bg-indigo-100 text-indigo-800'
            },
            {
                value: 'delivered',
                label: 'Delivered',
                allowedActions: [],
                color: 'bg-gray-100 text-gray-800'
            }
        ]
    }
};

export type WorkflowConfig = Record<Department, DepartmentConfig>;
export const DEFAULT_WORKFLOW: WorkflowConfig = WORKFLOW_CONFIG;
