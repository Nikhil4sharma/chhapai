export type Department = 'sales' | 'design' | 'prepress' | 'production' | 'outsource';

export type SalesStatus =
    | 'new_order'
    | 'pending_client_approval'
    | 'client_approved'
    | 'client_rejected'
    | 'ready_for_dispatch'
    | 'completed'; // Changed from order_completed

export type DesignStatus =
    | 'design_in_progress'
    | 'waiting_client_approval' // User said waiting_client_approval, existing was waiting_for_client_approval. Let's align with user.
    | 'design_revision_required'
    | 'design_completed';

export type PrepressStatus =
    | 'proofread_in_progress'
    | 'waiting_sales_approval' // User said waiting_sales_approval
    | 'proof_approved'
    | 'proof_rejected';

export type OutsourceStatus =
    | 'sent_to_vendor'
    | 'vendor_in_progress' // User said vendor_in_progress
    | 'received_from_vendor';

export type ProductionStatus =
    | 'in_production' // Cover stages 1-6
    | 'ready_for_dispatch' // Stage 7
    | 'dispatched' // Stage 8
    | 'delivered'; // Stage 9

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
                    { id: 'assign_prepress', label: 'Assign to Prepress', targetDepartment: 'prepress', targetStatus: 'proofread_in_progress', style: 'secondary' },
                    { id: 'assign_outsource', label: 'Assign to Outsource', targetDepartment: 'outsource', targetStatus: 'sent_to_vendor', style: 'secondary' }
                ],
                color: 'bg-blue-100 text-blue-800'
            },
            {
                value: 'pending_client_approval',
                label: 'Pending Client Approval', // "Design se wapas aaya"
                allowedActions: [
                    { id: 'client_approve', label: 'Client Approved', targetStatus: 'client_approved', style: 'success' },
                    { id: 'client_reject', label: 'Client Rejected', targetStatus: 'client_rejected', style: 'danger' }
                ],
                color: 'bg-yellow-100 text-yellow-800'
            },
            {
                value: 'client_approved',
                label: 'Client Approved',
                allowedActions: [
                    { id: 'assign_prepress', label: 'Assign to Prepress', targetDepartment: 'prepress', targetStatus: 'proofread_in_progress', style: 'primary' },
                    { id: 'assign_production', label: 'Assign to Production', targetDepartment: 'production', targetStatus: 'in_production', style: 'secondary' } // "Rare case"
                ],
                color: 'bg-green-100 text-green-800'
            },
            {
                value: 'client_rejected',
                label: 'Client Rejected',
                allowedActions: [
                    { id: 'return_design', label: 'Back to Design', targetDepartment: 'design', targetStatus: 'design_revision_required', style: 'danger' }
                ],
                color: 'bg-red-100 text-red-800'
            },
            {
                value: 'ready_for_dispatch',
                label: 'Ready for Dispatch',
                allowedActions: [
                    { id: 'mark_dispatched', label: 'Mark Dispatched', targetStatus: 'completed', style: 'success' } // User said "Mark Dispatched", usually implies completion or tracking. Mapping to 'completed' for Sales view or should we add 'dispatched'? Sales usually closes it.
                    // User said "Ready to dispatch -> Mark Dispatched". 
                    // Let's assume 'completed' is the final state for Sales workflow in this system.
                ],
                color: 'bg-indigo-100 text-indigo-800'
            },
            {
                value: 'completed',
                label: 'Order Completed',
                allowedActions: [],
                color: 'bg-gray-100 text-gray-800'
            }
        ]
    },
    design: {
        id: 'design',
        label: 'Design',
        statuses: [
            {
                value: 'design_in_progress',
                label: 'Design In Progress',
                allowedActions: [
                    { id: 'send_approval', label: 'Send for Approval', targetDepartment: 'sales', targetStatus: 'pending_client_approval', style: 'primary' }, // User said "Send to Sales for Approval", mapping to Sales Dept and Pending Client Approval
                    { id: 'design_complete', label: 'Design Complete', targetStatus: 'design_completed', style: 'success' }
                ],
                color: 'bg-purple-100 text-purple-800'
            },
            {
                value: 'waiting_client_approval',
                label: 'Waiting Approval',
                allowedActions: [], // Blocked state? Or can pull back? User didn't specify pull back here.
                color: 'bg-yellow-100 text-yellow-800'
            },
            {
                value: 'design_revision_required',
                label: 'Revision Required',
                allowedActions: [
                    { id: 'restart_design', label: 'Start Revision', targetStatus: 'design_in_progress', style: 'primary' }
                ],
                color: 'bg-orange-100 text-orange-800'
            },
            {
                value: 'design_completed',
                label: 'Design Completed',
                allowedActions: [
                    { id: 'assign_prepress', label: 'Assign to Prepress', targetDepartment: 'prepress', targetStatus: 'proofread_in_progress', style: 'primary' },
                    { id: 'close_job', label: 'Close Job', targetDepartment: 'sales', targetStatus: 'completed', style: 'secondary' } // "Design-only job -> Complete"
                ],
                color: 'bg-green-100 text-green-800'
            }
        ]
    },
    prepress: {
        id: 'prepress',
        label: 'Prepress',
        statuses: [
            {
                value: 'proofread_in_progress',
                label: 'Proofreading',
                allowedActions: [
                    { id: 'send_proof', label: 'Send Proof to Sales', targetStatus: 'waiting_sales_approval', style: 'primary' }
                ],
                color: 'bg-amber-100 text-amber-800'
            },
            {
                value: 'waiting_sales_approval',
                label: 'Waiting Sales Approval',
                allowedActions: [
                    // Sales acts on this via Sales dept? Or does Prepress see buttons? 
                    // Usually Sales logs in and sees it in Sales dashboard? 
                    // "Sales approves" -> proof_approved.
                    // The item is technically in Prepress department but waiting on Sales. 
                    // If Sales user looks at it, they should see Approve/Reject.
                    // But RLS might restrict actions to Department.
                    // IMPORTANT: User said "Sales approves -> client_approved" (Wait, that was Sales section).
                    // In Prepress section: "Sales approves -> proof_approved".
                    // Who clicks the button? Salesman.
                    // So we need an action available to Sales role even if item is in Prepress. 
                    // logic in `getAvailableActions` handles userRole. 
                    { id: 'sales_approve_proof', label: 'Approve Proof', targetStatus: 'proof_approved', style: 'success' },
                    { id: 'sales_reject_proof', label: 'Reject Proof', targetStatus: 'proof_rejected', style: 'danger' }
                ],
                color: 'bg-yellow-100 text-yellow-800'
            },
            {
                value: 'proof_approved',
                label: 'Proof Approved',
                allowedActions: [
                    { id: 'assign_production', label: 'Assign to Production', targetDepartment: 'production', targetStatus: 'in_production', style: 'primary' },
                    { id: 'assign_outsource', label: 'Assign to Outsource', targetDepartment: 'outsource', targetStatus: 'sent_to_vendor', style: 'secondary' }
                ],
                color: 'bg-green-100 text-green-800'
            },
            {
                value: 'proof_rejected', // "Sales rejects -> Send back to Design"
                label: 'Proof Rejected',
                allowedActions: [
                    { id: 'return_design', label: 'Return to Design', targetDepartment: 'design', targetStatus: 'design_revision_required', style: 'danger' }
                ],
                color: 'bg-red-100 text-red-800'
            }
        ]
    },
    outsource: {
        id: 'outsource',
        label: 'Outsource',
        statuses: [
            {
                value: 'sent_to_vendor',
                label: 'Sent to Vendor',
                allowedActions: [
                    { id: 'mark_in_progress', label: 'Mark In Progress', targetStatus: 'vendor_in_progress', style: 'primary' }
                ],
                color: 'bg-purple-100 text-purple-800'
            },
            {
                value: 'vendor_in_progress',
                label: 'In Vendor Production',
                allowedActions: [
                    { id: 'mark_received', label: 'Mark Received', targetStatus: 'received_from_vendor', style: 'success' }
                ],
                color: 'bg-blue-100 text-blue-800'
            },
            {
                value: 'received_from_vendor',
                label: 'Received',
                allowedActions: [
                    { id: 'assign_prepress', label: 'Assign to Prepress', targetDepartment: 'prepress', targetStatus: 'proofread_in_progress', style: 'secondary' },
                    { id: 'assign_production', label: 'Assign to Production', targetDepartment: 'production', targetStatus: 'in_production', style: 'primary' }
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
                    // Moving stages is handled by specific UI, but we can have "Move Next" here as backup?
                    // User said "Any stage -> Move to Next Stage"
                    // And "Packing done -> Mark Ready to Dispatch"
                    { id: 'mark_ready_dispatch', label: 'Ready to Dispatch', targetStatus: 'ready_for_dispatch', style: 'success' }
                ],
                color: 'bg-emerald-100 text-emerald-800'
            },
            {
                value: 'ready_for_dispatch',
                label: 'Ready for Dispatch',
                allowedActions: [
                    { id: 'mark_dispatched', label: 'Mark Dispatched', targetStatus: 'dispatched', style: 'primary' }
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
