
export interface StatusConfig {
    value: string;
    label: string;
}

export interface DepartmentConfig {
    id: string;
    label: string;
    description: string;
    icon: string; // Lucide icon name
    color: string; // Tailwind text color class
    bg: string; // Tailwind bg color class
    statuses: StatusConfig[];
}

export interface WorkflowConfig {
    departments: DepartmentConfig[];
}

export const DEFAULT_WORKFLOW: WorkflowConfig = {
    departments: [
        {
            id: 'sales',
            label: 'Sales (Approval)',
            description: 'Submit for client approval',
            icon: 'ShoppingCart',
            color: 'text-blue-500',
            bg: 'bg-blue-500/10',
            statuses: [
                { value: 'design_pending_approval', label: 'Pending Approval' }
            ]
        },
        {
            id: 'production',
            label: 'Production',
            description: 'Design approved, ready for print',
            icon: 'Factory',
            color: 'text-emerald-500',
            bg: 'bg-emerald-500/10',
            statuses: [
                { value: 'design_completed', label: 'Design Completed' },
                { value: 'ready_for_production', label: 'Ready for Production' }
            ]
        },
        {
            id: 'prepress',
            label: 'Prepress',
            description: 'Send for print file preparation',
            icon: 'FileCheck',
            color: 'text-amber-500',
            bg: 'bg-amber-500/10',
            statuses: [
                { value: 'design_completed', label: 'Design Completed' },
                { value: 'ready_for_prepress', label: 'Ready for Prepress' }
            ]
        },
        {
            id: 'outsource',
            label: 'Outsource',
            description: 'External vendor work',
            icon: 'Building2',
            color: 'text-purple-500',
            bg: 'bg-purple-500/10',
            statuses: [
                { value: 'design_completed', label: 'Design Completed' },
                { value: 'ready_for_outsource', label: 'Ready for Outsource' }
            ]
        }
    ]
};
