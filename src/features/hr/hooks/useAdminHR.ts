import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { HRProfile, LeaveRequest, Holiday, PayrollRecord } from "../types";

export function useAdminHR() {
    const queryClient = useQueryClient();

    // --- Queries ---

    const { data: employees, isLoading: isLoadingEmployees } = useQuery({
        queryKey: ["admin", "hr", "employees"],
        queryFn: async () => {
            // Fetch profiles joined with HR details via secure RPC
            const { data, error } = await supabase
                .rpc('get_admin_user_profiles');

            if (error) throw error;
            return data;
        },
    });

    const { data: allLeaveRequests, isLoading: isLoadingLeaves } = useQuery({
        queryKey: ["admin", "hr", "leaves"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("leave_requests")
                .select(`
                    *,
                    leave_type:leave_types(*)
                `)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data as LeaveRequest[];
        },
    });

    const { data: leaveTypes, isLoading: isLoadingTypes } = useQuery({
        queryKey: ["admin", "hr", "leave_types"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("leave_types")
                .select("*")
                .order("name");
            if (error) throw error;
            return data;
        },
    });

    const { data: holidays, isLoading: isLoadingHolidays } = useQuery({
        queryKey: ["admin", "hr", "holidays"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("hr_holidays")
                .select("*")
                .order("date", { ascending: true });

            if (error) throw error;
            return data as Holiday[];
        },
    });

    // --- Mutations ---

    const updateLeaveStatus = useMutation({
        mutationFn: async ({ id, status, rejection_reason }: { id: string, status: 'approved' | 'rejected', rejection_reason?: string }) => {
            const { error } = await supabase
                .from("leave_requests")
                .update({ status, rejection_reason })
                .eq("id", id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin", "hr", "leaves"] });
        },
    });

    const createLeaveType = useMutation({
        mutationFn: async (data: { name: string, days_allowed_per_year: number, description?: string, color?: string, is_paid?: boolean }) => {
            const { error } = await supabase
                .from("leave_types")
                .insert([data]);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin", "hr", "leave_types"] });
        },
    });

    const updateLeaveType = useMutation({
        mutationFn: async ({ id, ...data }: { id: string, name?: string, days_allowed_per_year?: number, is_paid?: boolean }) => {
            const { error } = await supabase
                .from("leave_types")
                .update(data)
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin", "hr", "leave_types"] });
        }
    });

    const updateLeaveBalance = useMutation({
        mutationFn: async ({ user_id, leave_type_id, year, balance, used }: { user_id: string, leave_type_id: string, year: number, balance: number, used: number }) => {
            // Check if exists
            const { data: existing } = await supabase
                .from('leave_balances')
                .select('id')
                .eq('user_id', user_id)
                .eq('leave_type_id', leave_type_id)
                .eq('year', year)
                .single();

            if (existing) {
                const { error } = await supabase
                    .from('leave_balances')
                    .update({ balance, used })
                    .eq('id', existing.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('leave_balances')
                    .insert([{ user_id, leave_type_id, year, balance, used }]);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin", "hr", "employees"] });
        }
    });

    const addHoliday = useMutation({
        mutationFn: async (holiday: Omit<Holiday, "id">) => {
            const { error } = await supabase
                .from("hr_holidays") // Use existing if correct, or change to holidays table if created? Assuming hr_holidays might be correct if created before
                .insert([holiday]);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin", "hr", "holidays"] });
        },
    });

    const deleteHoliday = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from("hr_holidays")
                .delete()
                .eq("id", id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin", "hr", "holidays"] });
        }
    });

    const updateBaseSalary = useMutation({
        mutationFn: async ({ user_id, amount, effective_date }: { user_id: string, amount: number, effective_date: string }) => {
            // First check if a salary record exists, if so update/insert history? 
            // For now, assume we update the hr_profiles 'salary' field or a dedicated salary table.
            // Based on previous steps, we added salary info to hr_profiles.
            const { error } = await supabase
                .from('hr_profiles')
                .update({
                    base_salary: amount,
                    salary_effective_date: effective_date
                })
                .eq('user_id', user_id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin", "hr", "employees"] });
        }
    });

    const createPayrollRecord = useMutation({
        mutationFn: async (data: any) => {
            const { error } = await supabase
                .from('hr_payroll_records')
                .insert([data]);

            if (error) throw error;
        },
        onSuccess: () => {
            // Invalidate payroll queries
            queryClient.invalidateQueries({ queryKey: ["admin", "hr", "payroll"] });
        }
    });

    return {
        employees,
        allLeaveRequests,
        leaveTypes,
        holidays,
        isLoading: isLoadingEmployees || isLoadingLeaves,
        updateLeaveStatus,
        createLeaveType,
        updateLeaveType,
        updateLeaveBalance,
        addHoliday,
        deleteHoliday,
        // Payroll
        updateBaseSalary,
        createPayrollRecord
    };
}
