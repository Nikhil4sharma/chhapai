import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Search, Users, Briefcase, Award, Building2, Loader2, Plus } from 'lucide-react';
import { useEmployeeList } from '../hooks/useEmployeeProfile';
import { motion } from 'framer-motion';
import { AddTeamMemberDialog } from '@/components/dialogs/AddTeamMemberDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { EditTeamMemberDialog } from '@/components/dialogs/EditTeamMemberDialog';

export default function EmployeeManagement() {
    const { employees, loading, searchQuery, setSearchQuery, refetch: fetchEmployees } = useEmployeeList();
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
    const [statsFilter, setStatsFilter] = useState<'all' | 'active' | 'probation'>('all');
    const [addMemberOpen, setAddMemberOpen] = useState(false);

    const getInitials = (first: string, last: string) => {
        return `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase();
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'bg-emerald-500';
            case 'probation': return 'bg-amber-500';
            case 'terminated': return 'bg-red-500';
            case 'resigned': return 'bg-slate-500';
            default: return 'bg-slate-500';
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8">
            {/* Header */}
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                        <Users className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                            Employee Management
                        </h1>
                        <p className="text-slate-600 dark:text-slate-400">
                            Manage employee profiles, salaries, and details
                        </p>
                    </div>
                </div>
                <Button
                    onClick={() => setAddMemberOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg transition-all"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Employee
                </Button>
            </div>

            {/* Search Bar */}
            <Card className="mb-6 shadow-lg">
                <CardContent className="p-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <Input
                            placeholder="Search by name, email, department, or designation..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 h-12 text-base"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card
                    className={`shadow-sm cursor-pointer transition-all hover:shadow-md ${statsFilter === 'all' ? 'ring-2 ring-indigo-500' : ''}`}
                    onClick={() => setStatsFilter('all')}
                >
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500">Total Employees</p>
                                <p className="text-2xl font-bold text-indigo-600">{employees.length}</p>
                            </div>
                            <Users className="h-8 w-8 text-indigo-200" />
                        </div>
                    </CardContent>
                </Card>
                <Card
                    className={`shadow-sm cursor-pointer transition-all hover:shadow-md ${statsFilter === 'active' ? 'ring-2 ring-emerald-500' : ''}`}
                    onClick={() => setStatsFilter('active')}
                >
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500">Active</p>
                                <p className="text-2xl font-bold text-emerald-600">
                                    {employees.filter(e => e.hr_profile?.employment_status === 'active').length}
                                </p>
                            </div>
                            <Briefcase className="h-8 w-8 text-emerald-200" />
                        </div>
                    </CardContent>
                </Card>
                <Card
                    className={`shadow-sm cursor-pointer transition-all hover:shadow-md ${statsFilter === 'probation' ? 'ring-2 ring-amber-500' : ''}`}
                    onClick={() => setStatsFilter('probation')}
                >
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500">On Probation</p>
                                <p className="text-2xl font-bold text-amber-600">
                                    {employees.filter(e => e.hr_profile?.employment_status === 'probation').length}
                                </p>
                            </div>
                            <Award className="h-8 w-8 text-amber-200" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500">Departments</p>
                                <p className="text-2xl font-bold text-purple-600">
                                    {new Set(employees.map(e => e.hr_profile?.department)).size}
                                </p>
                            </div>
                            <Building2 className="h-8 w-8 text-purple-200" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Employee List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {employees
                    .filter(e => statsFilter === 'all' || e.hr_profile?.employment_status === statsFilter)
                    .map((employee) => (
                        <motion.div
                            key={employee.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Card
                                className="hover:shadow-xl transition-all cursor-pointer border-l-4 border-l-transparent hover:border-l-indigo-500 group overflow-hidden"
                                onClick={() => setSelectedEmployeeId(employee.id)}
                            >
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-4">
                                            <Avatar className="h-14 w-14 border-2 border-white shadow-md group-hover:scale-105 transition-transform">
                                                <AvatarFallback className="bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-600 font-bold text-lg">
                                                    {getInitials(employee.first_name || '', employee.last_name || '')}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 transition-colors">
                                                    {employee.first_name} {employee.last_name}
                                                </h3>
                                                <p className="text-sm text-slate-500">{employee.email}</p>
                                            </div>
                                        </div>
                                        <Badge className={getStatusColor(employee.hr_profile?.employment_status || 'active')}>
                                            {employee.hr_profile?.employment_status || 'Active'}
                                        </Badge>
                                    </div>

                                    <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                                        <div className="flex items-center text-sm text-slate-600 dark:text-slate-400">
                                            <Building2 className="h-4 w-4 mr-2 text-slate-400" />
                                            {employee.hr_profile?.department || 'Unassigned'}
                                        </div>
                                        <div className="flex items-center text-sm text-slate-600 dark:text-slate-400">
                                            <Briefcase className="h-4 w-4 mr-2 text-slate-400" />
                                            {employee.hr_profile?.designation || 'No Designation'}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}

                {employees.length === 0 && !loading && (
                    <div className="col-span-full text-center py-12 text-slate-500">
                        No employees found matching your search.
                    </div>
                )}
            </div>

            {loading && (
                <div className="flex items-center justify-center p-12">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                </div>
            )}

            <AddTeamMemberDialog
                open={addMemberOpen}
                onOpenChange={setAddMemberOpen}
                onAdd={async (data) => {
                    // Start Loading
                    try {
                        // 1. Create Auth User
                        const { data: authData, error: authError } = await supabase.auth.signUp({
                            email: data.email,
                            password: data.password,
                            options: {
                                data: {
                                    full_name: data.name,
                                    role: data.role,
                                },
                            },
                        });

                        if (authError) throw authError;
                        if (!authData.user) throw new Error('No user returned from signup');

                        // 2. Create Profile (Upsert to be safe)
                        const { error: profileError } = await supabase
                            .from('profiles')
                            .upsert([
                                {
                                    id: authData.user.id,
                                    email: data.email,
                                    full_name: data.name,
                                    updated_at: new Date().toISOString(),
                                }
                            ]);

                        if (profileError) throw profileError;

                        // 3. Assign Role & Department
                        const { error: roleError } = await supabase
                            .from('user_roles')
                            .upsert([
                                {
                                    user_id: authData.user.id,
                                    role: data.role as any, // Cast to any to avoid enum type mismatch if exact type not imported
                                    department: data.department
                                }
                            ]);

                        if (roleError) throw roleError;

                        toast({
                            title: "Success",
                            description: "Team member added successfully",
                        });

                        // Valid success, close dialog and refresh
                        setAddMemberOpen(false);
                        fetchEmployees();

                    } catch (error: any) {
                        console.error('Error adding member:', error);
                        toast({
                            title: "Error adding member",
                            description: error.message || "Unknown error occurred",
                            variant: "destructive",
                        });
                        throw error; // Re-throw so dialog stays open or handles loading state
                    }
                }}
            />
        </div>
    );
}
