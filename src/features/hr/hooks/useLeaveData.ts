import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { LeaveBalance, LeaveRequest, LeaveType } from '../types';

export function useLeaveData(userId?: string) {
    const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
    const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
    const [loading, setLoading] = useState(false);

    const currentYear = new Date().getFullYear();

    const fetchLeaveTypes = async () => {
        try {
            const { data, error } = await supabase
                .from('leave_types')
                .select('*')
                .order('name');

            if (error) throw error;
            setLeaveTypes(data || []);
        } catch (error: any) {
            console.error('Error fetching leave types:', error);
        }
    };

    const fetchLeaveBalances = async () => {
        if (!userId) return;

        try {
            const { data, error } = await supabase
                .from('leave_balances')
                .select(`
                    *,
                    leave_type:leave_types(*)
                `)
                .eq('user_id', userId)
                .eq('year', currentYear);

            if (error) throw error;
            setLeaveBalances(data || []);
        } catch (error: any) {
            console.error('Error fetching leave balances:', error);
        }
    };

    const fetchLeaveRequests = async () => {
        if (!userId) return;

        try {
            const { data, error } = await supabase
                .from('leave_requests')
                .select(`
                    *,
                    leave_type:leave_types(*)
                `)
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setLeaveRequests(data || []);
        } catch (error: any) {
            console.error('Error fetching leave requests:', error);
        }
    };

    const fetchAllLeaveData = async () => {
        setLoading(true);
        try {
            await Promise.all([
                fetchLeaveTypes(),
                fetchLeaveBalances(),
                fetchLeaveRequests()
            ]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!userId) return;

        fetchAllLeaveData();

        const balanceChannel = supabase
            .channel(`leave_balances_${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'leave_balances',
                    filter: `user_id=eq.${userId}`
                },
                () => {
                    fetchLeaveBalances();
                }
            )
            .subscribe();

        const requestChannel = supabase
            .channel(`leave_requests_${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'leave_requests',
                    filter: `user_id=eq.${userId}`
                },
                () => {
                    toast.info('Leave request updated');
                    fetchLeaveRequests();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(balanceChannel);
            supabase.removeChannel(requestChannel);
        };
    }, [userId]);

    const leaveStats = leaveBalances.reduce((acc, balance) => {
        const total = balance.leave_type?.days_allowed_per_year || 0;
        const used = balance.used || 0;
        const remaining = total - used;

        return {
            totalAllowed: acc.totalAllowed + total,
            totalUsed: acc.totalUsed + used,
            totalRemaining: acc.totalRemaining + remaining
        };
    }, { totalAllowed: 0, totalUsed: 0, totalRemaining: 0 });

    return {
        leaveTypes,
        leaveBalances,
        leaveRequests,
        leaveStats,
        loading,
        refetch: fetchAllLeaveData
    };
}
