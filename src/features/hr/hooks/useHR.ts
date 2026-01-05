import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LeaveBalance, LeaveRequest, Holiday, PayrollRecord, LeaveType } from "../types";
import { useAuth } from "@/features/auth/context/AuthContext";

export function useHR() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const { data: leaveBalances, isLoading: isLoadingBalances } = useQuery({
        queryKey: ["hr", "balances", user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await supabase
                .from("hr_leave_balances")
                .select("*, leave_type:hr_leave_types(*)")
                .eq("user_id", user.id);

            if (error) throw error;
            return data as LeaveBalance[];
        },
        enabled: !!user,
    });

    const { data: leaveRequests, isLoading: isLoadingLeaves } = useQuery({
        queryKey: ["hr", "leaves", user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await supabase
                .from("hr_leaves")
                .select("*, leave_type:hr_leave_types(*)")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data as LeaveRequest[];
        },
        enabled: !!user,
    });

    const { data: holidays, isLoading: isLoadingHolidays } = useQuery({
        queryKey: ["hr", "holidays"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("hr_holidays")
                .select("*")
                .gte("date", new Date().toISOString())
                .order("date", { ascending: true })
                .limit(5);

            if (error) throw error;
            return data as Holiday[];
        },
    });

    const { data: payrolls, isLoading: isLoadingPayroll } = useQuery({
        queryKey: ["hr", "payroll", user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await supabase
                .from("hr_payroll_records")
                .select("*")
                .eq("user_id", user.id)
                .order("year", { ascending: false })
                .order("month", { ascending: false })
                .limit(1); // Get latest

            if (error) throw error;
            return data as PayrollRecord[];
        },
        enabled: !!user,
    });

    const { data: leaveTypes } = useQuery({
        queryKey: ["hr", "leave_types"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("hr_leave_types")
                .select("*");
            if (error) throw error;
            return data as LeaveType[];
        }
    });

    const applyLeave = useMutation({
        mutationFn: async (newLeave: Omit<LeaveRequest, "id" | "created_at" | "status" | "approved_by" | "rejection_reason" | "leave_type">) => {
            const { data, error } = await supabase
                .from("hr_leaves")
                .insert([{ ...newLeave, status: 'pending' }])
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["hr", "leaves"] });
        },
    });

    return {
        leaveBalances,
        leaveRequests,
        holidays,
        payrolls,
        leaveTypes,
        applyLeave,
        isLoading: isLoadingBalances || isLoadingLeaves || isLoadingHolidays || isLoadingPayroll,
    };
}
