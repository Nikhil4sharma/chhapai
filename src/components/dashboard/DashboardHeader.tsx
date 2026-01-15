
import { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Plus, UserPlus, Settings, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

import { AddCustomerButton } from '@/components/common/actions/AddCustomerButton';

export function DashboardHeader() {
    const { profile, isAdmin, role } = useAuth();
    const navigate = useNavigate();
    const [greeting, setGreeting] = useState('');

    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 12) setGreeting('Good Morning');
        else if (hour < 18) setGreeting('Good Afternoon');
        else setGreeting('Good Evening');
    }, []);

    const today = new Date();

    return (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
                <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white tracking-tight">
                    {greeting}, <span className="bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">{profile?.full_name?.split(' ')[0] || 'User'}</span>
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm font-medium">
                    {format(today, 'EEEE, d MMMM yyyy')} • Overview
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                {isAdmin && (
                    <>
                        <AddCustomerButton />

                        <Button
                            variant="outline"
                            size="sm"
                            className="h-9 px-3 rounded-full border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-300 shadow-sm hover:shadow"
                            onClick={() => navigate('/settings')}
                        >
                            <Settings className="h-4 w-4 mr-2 text-slate-500" />
                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Config</span>
                        </Button>
                    </>
                )}

            </div>
        </div>
    );
}
