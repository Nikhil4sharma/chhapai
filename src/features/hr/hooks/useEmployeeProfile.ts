import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { HRProfile } from '../types';

interface EmployeeWithProfile {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    department: string | null;
    hr_profile: HRProfile | null;
}

export function useEmployeeProfile(employeeId?: string) {
    const [employee, setEmployee] = useState<EmployeeWithProfile | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const fetchEmployee = async () => {
        if (!employeeId) return;

        setLoading(true);
        try {
            // Fetch from employees table
            const { data: empData, error: empError } = await supabase
                .from('employees')
                .select('*')
                .eq('user_id', employeeId)
                .single();

            if (empError) throw empError;

            const { data: hrProfile, error: hrError } = await supabase
                .from('hr_profiles')
                .select('*')
                .eq('user_id', employeeId)
                .maybeSingle();

            if (hrError && hrError.code !== 'PGRST116') throw hrError;

            setEmployee({
                id: empData.user_id,
                email: empData.email,
                first_name: empData.first_name,
                last_name: empData.last_name,
                department: hrProfile?.department || null,
                hr_profile: hrProfile
            });
        } catch (error: any) {
            console.error('Error fetching employee:', error);
            toast.error('Failed to load employee profile');
        } finally {
            setLoading(false);
        }
    };

    const updateHRProfile = async (updates: Partial<HRProfile>) => {
        if (!employeeId) return false;

        setSaving(true);
        try {
            const { data: existing } = await supabase
                .from('hr_profiles')
                .select('id')
                .eq('user_id', employeeId)
                .maybeSingle();

            if (existing) {
                const { error } = await supabase
                    .from('hr_profiles')
                    .update(updates)
                    .eq('user_id', employeeId);

                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('hr_profiles')
                    .insert({
                        user_id: employeeId,
                        ...updates
                    });

                if (error) throw error;
            }

            toast.success('Profile updated successfully');
            await fetchEmployee();
            return true;
        } catch (error: any) {
            console.error('Error updating HR profile:', error);
            toast.error('Failed to update profile');
            return false;
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        if (!employeeId) return;

        fetchEmployee();

        const channel = supabase
            .channel(`hr_profile_${employeeId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'hr_profiles',
                    filter: `user_id=eq.${employeeId}`
                },
                () => {
                    toast.info('Profile updated by HR');
                    fetchEmployee();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [employeeId]);

    return {
        employee,
        loading,
        saving,
        updateHRProfile,
        refetch: fetchEmployee
    };
}

export function useEmployeeList() {
    const [employees, setEmployees] = useState<EmployeeWithProfile[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            // Fetch from employees table instead of profiles
            const { data: employeeData, error: employeeError } = await supabase
                .from('employees')
                .select('*')
                .order('first_name');

            if (employeeError) throw employeeError;

            // Fetch HR profiles for all employees
            const { data: hrProfiles, error: hrError } = await supabase
                .from('hr_profiles')
                .select('*');

            if (hrError && hrError.code !== 'PGRST116') throw hrError;

            // Merge employee data with HR profiles
            const merged = (employeeData || []).map(emp => ({
                id: emp.user_id,
                email: emp.email,
                first_name: emp.first_name,
                last_name: emp.last_name,
                department: null, // Will get from hr_profile if exists
                hr_profile: hrProfiles?.find(hr => hr.user_id === emp.user_id) || null
            }));

            setEmployees(merged);
        } catch (error: any) {
            console.error('Error fetching employees:', error);
            toast.error('Failed to load employees');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEmployees();
    }, []);

    const filteredEmployees = employees.filter(emp => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            emp.first_name?.toLowerCase().includes(query) ||
            emp.last_name?.toLowerCase().includes(query) ||
            emp.email?.toLowerCase().includes(query) ||
            emp.hr_profile?.department?.toLowerCase().includes(query) ||
            emp.hr_profile?.designation?.toLowerCase().includes(query)
        );
    });

    return {
        employees: filteredEmployees,
        loading,
        searchQuery,
        setSearchQuery,
        refetch: fetchEmployees
    };
}

