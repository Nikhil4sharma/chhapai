export interface HRProfile {
    id: string;
    joining_date: string | null;
    department: string | null;
    designation: string | null;
    employment_status: 'active' | 'probation' | 'terminated' | 'resigned';
    reporting_manager_id: string | null;
    bank_details: {
        account_number: string;
        ifsc: string;
        bank_name: string;
    } | null;
    base_salary: number | null;
}

export interface LeaveType {
    id: string;
    name: string;
    days_allowed_per_year: number;
    is_carry_forward: boolean;
    color: string;
}

export interface LeaveBalance {
    id: string;
    user_id: string;
    leave_type_id: string;
    year: number;
    balance: number;
    used: number;
    leave_type?: LeaveType; // Joined data
}

export interface LeaveRequest {
    id: string;
    user_id: string;
    leave_type_id: string;
    start_date: string;
    end_date: string;
    days_count: number;
    reason: string;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';
    approved_by: string | null;
    rejection_reason: string | null;
    created_at: string;
    leave_type?: LeaveType; // Joined data
    profile?: { // Joined data for admin view
        first_name: string;
        last_name: string;
    };
}

export interface Holiday {
    id: string;
    name: string;
    date: string;
    day_of_week: string;
    type: 'mandatory' | 'optional';
    year: number;
}

export interface PayrollRecord {
    id: string;
    user_id: string;
    month: number;
    year: number;
    base_salary: number;
    additions: { description: string; amount: number }[];
    deductions: { description: string; amount: number }[];
    total_payable: number;
    status: 'draft' | 'processed' | 'paid';
    payment_date: string | null;
    salary_slip_url: string | null;
}
