import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LeaveBalance, LeaveRequest, Holiday, PayrollRecord, LeaveType, HRProfile } from "../types";
import { useAuth } from "@/features/auth/context/AuthContext";

export function useHR() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const { data: profileDetails, isLoading: isLoadingProfile } = useQuery({
        queryKey: ["hr", "profile", user?.id],
        queryFn: async () => {
            if (!user) return null;
            // Fetch HR profile and join with public profile
            const { data, error } = await supabase
                .from("hr_profiles")
                .select(`
                    *,
                    public_profile:profiles(
                        full_name,
                        email,
                        avatar_url,
                        phone
                    )
                `)
                .eq("user_id", user.id)
                .maybeSingle();

            if (error) {
                console.error("Error fetching HR profile:", error);
                throw error;
            }

            return {
                ...data,
                full_name: data?.public_profile?.full_name,
                email: data?.public_profile?.email,
                avatar_url: data?.public_profile?.avatar_url,
                phone: data?.public_profile?.phone
            } as HRProfile;
        },
        enabled: !!user
    });

    const { data: leaveBalances, isLoading: isLoadingBalances } = useQuery({
        queryKey: ["hr", "balances", user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await supabase
                .from("leave_balances")
                .select("*, leave_type:leave_types(*)")
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
                .from("leave_requests")
                .select("*, leave_type:leave_types(*)")
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
                .limit(1);

            if (error) throw error;
            return data as PayrollRecord[];
        },
        enabled: !!user,
    });

    const { data: leaveTypes } = useQuery({
        queryKey: ["hr", "leave_types"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("leave_types")
                .select("*");
            if (error) throw error;
            return data as LeaveType[];
        }
    });

    const applyLeave = useMutation({
        mutationFn: async (newLeave: Omit<LeaveRequest, "id" | "created_at" | "status" | "approved_by" | "rejection_reason" | "leave_type">) => {
            const { data, error } = await supabase
                .from("leave_requests")
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

    useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel(`hr_realtime_${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'leave_requests',
                    filter: `user_id=eq.${user.id}`
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["hr", "leaves"] });
                    queryClient.invalidateQueries({ queryKey: ["hr", "balances"] });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'leave_balances',
                    filter: `user_id=eq.${user.id}`
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["hr", "balances"] });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'hr_profiles',
                    filter: `user_id=eq.${user.id}`
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["hr", "profile"] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, queryClient]);

    return {
        profileDetails,
        leaveBalances,
        leaveRequests,
        holidays,
        payrolls,
        leaveTypes,
        applyLeave,
        isLoading: isLoadingBalances || isLoadingLeaves || isLoadingHolidays || isLoadingPayroll || isLoadingProfile,
    };
}
