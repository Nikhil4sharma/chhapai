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
                .from("hr_leaves")
                .select(`
                    *,
                    leave_type:hr_leave_types(*)
                `)
                .order("created_at", { ascending: false });

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
                .from("hr_leaves")
                .update({ status, rejection_reason })
                .eq("id", id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin", "hr", "leaves"] });
        },
    });

    const addHoliday = useMutation({
        mutationFn: async (holiday: Omit<Holiday, "id">) => {
            const { error } = await supabase
                .from("hr_holidays")
                .insert([holiday]);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin", "hr", "holidays"] });
            queryClient.invalidateQueries({ queryKey: ["hr", "holidays"] }); // Also invalidate user view
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
            queryClient.invalidateQueries({ queryKey: ["hr", "holidays"] });
        }
    });

    return {
        employees,
        allLeaveRequests,
        holidays,
        isLoading: isLoadingEmployees || isLoadingLeaves || isLoadingHolidays,
        updateLeaveStatus,
        addHoliday,
        deleteHoliday
    };
}
