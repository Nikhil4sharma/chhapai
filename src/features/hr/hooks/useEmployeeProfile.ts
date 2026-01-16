import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { HRProfile } from '../types';



export interface Employee {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    phone?: string;
    hr_profile: HRProfile | null;
    roles: { role: string; department: string }[];
    category?: 'office' | 'factory';
}

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
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchEmployees = async () => {
        try {
            setLoading(true);

            // 1. Fetch base employees (from employees table)
            const { data: employeesData, error: empError } = await supabase
                .from('employees')
                .select('*');

            if (empError) throw empError;

            // 2. Fetch profiles (for full_name, avatar, generic department, is_hidden)
            const { data: profilesData, error: profError } = await supabase
                .from('profiles')
                .select('*');

            if (profError) throw profError;

            // 3. Fetch HR profiles (for extended HR data)
            const { data: hrProfilesData, error: hrError } = await supabase
                .from('hr_profiles')
                .select('*');

            // Ignore PRGST116 (no rows) if it happens, but for select * it shouldn't
            if (hrError && hrError.code !== 'PGRST116') throw hrError;

            // 4. Fetch User Roles (for role-based department fallback)
            const { data: userRolesData, error: rolesError } = await supabase
                .from('user_roles')
                .select('*');

            if (rolesError) throw rolesError;

            // 5. Merge Data
            const mergedData: Employee[] = (employeesData || [])
                .filter(emp => {
                    const profile = profilesData?.find(p => p.id === emp.user_id);
                    const userRole = userRolesData?.find(ur => ur.user_id === emp.user_id);

                    // Filter out hidden users (Super Admin via is_hidden flag)
                    if (profile?.is_hidden) return false;

                    // Filter out admins and super_admins
                    if (userRole?.role === 'admin' || userRole?.role === 'super_admin') return false;

                    // Specific exclusions requested
                    if (emp.email === 'hi@chhapai.in' || profile?.full_name?.includes('Rajesh')) return false;

                    return true;
                })
                .map(emp => {
                    const profile = profilesData?.find(p => p.id === emp.user_id);
                    const hrProfile = hrProfilesData?.find(hr => hr.user_id === emp.user_id);
                    const userRole = userRolesData?.find(ur => ur.user_id === emp.user_id);

                    // Name Logic: Profile > Employee
                    let firstName = emp.first_name;
                    let lastName = emp.last_name;
                    if (profile?.full_name) {
                        const nameParts = profile.full_name.split(' ');
                        firstName = nameParts[0];
                        lastName = nameParts.slice(1).join(' ');
                    }

                    // Department Logic: HR Profile > Profile > Role
                    const department = hrProfile?.department || profile?.department || userRole?.role || 'Unassigned';

                    // Designation Logic: HR Profile > Role > 'No Designation' (Capitalize role)
                    const roleCapitalized = userRole?.role ? userRole.role.charAt(0).toUpperCase() + userRole.role.slice(1) : undefined;
                    const designation = hrProfile?.designation || roleCapitalized || 'No Designation';

                    return {
                        id: emp.user_id,
                        email: emp.email,
                        first_name: firstName,
                        last_name: lastName,
                        phone: emp.phone || profile?.phone,
                        hr_profile: {
                            ...hrProfile,
                            department: department, // Override/Ensure department is populated
                            designation: designation // Mapped designation
                        },
                        roles: userRole ? [{ role: userRole.role, department: department }] : [],
                        category: emp.category || 'office' // Add category mapping
                    };
                });

            setEmployees(mergedData);
        } catch (error) {
            console.error('Error fetching employee list:', error);
            // toast.error('Failed to fetch employees'); // Suppress to avoid spamming if one table fails
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEmployees();
    }, []);

    const filteredEmployees = employees.filter(emp => {
        const searchLower = searchQuery.toLowerCase();
        const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
        return (
            fullName.includes(searchLower) ||
            emp.email.toLowerCase().includes(searchLower) ||
            emp.hr_profile?.department?.toLowerCase().includes(searchLower) ||
            emp.hr_profile?.designation?.toLowerCase().includes(searchLower)
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

