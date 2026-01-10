
import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useOrders } from '@/features/orders/context/OrderContext';
import { useAuth } from '@/features/auth/context/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

// Helper to get initials
const getInitials = (name: string) => {
    return name
        ?.split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || '??';
};

interface UserStat {
    id: string;
    name: string;
    avatar_url?: string;
    department?: string;
    count: number;
    urgent: number;
}

export function UserWorkloadCard() {
    const { orders } = useOrders();
    const { isAdmin } = useAuth();
    const [profiles, setProfiles] = useState<Record<string, any>>({});
    const [isLoadingProfiles, setIsLoadingProfiles] = useState(true);

    // Fetch user profiles to display names
    useEffect(() => {
        const fetchProfiles = async () => {
            try {
                console.log("Fetching profiles for workload card...");
                const { data, error } = await supabase
                    .from('profiles')
                    .select('user_id, full_name, avatar_url, department'); // Fetch user_id

                if (error) {
                    console.error("Error fetching profiles:", error);
                }

                if (data) {
                    console.log(`Fetched ${data.length} profiles.`);
                    const profileMap = data.reduce((acc, profile) => {
                        // Use user_id as the key since assigned_to in orders refers to auth.users.id
                        // handling potential missing user_id if that ever happens (though it shouldn't for valid profiles)
                        if (profile.user_id) {
                            acc[profile.user_id] = profile;
                        }
                        return acc;
                    }, {} as Record<string, any>);
                    setProfiles(profileMap);
                } else {
                    console.warn("No profiles data received.");
                }
            } catch (error) {
                console.error("Exception fetching profiles:", error);
            } finally {
                setIsLoadingProfiles(false);
            }
        };

        fetchProfiles();
    }, []);

    const userStats = useMemo(() => {
        const stats: Record<string, UserStat> = {};

        orders.forEach(order => {
            if (order.is_completed) return;
            order.items.forEach(item => {
                if (item.is_dispatched) return;
                const assignee = item.assigned_to || 'unassigned';

                if (!stats[assignee]) {
                    const profile = profiles[assignee];

                    // Priority for Name: Profile Name > Item Assigned Name > Unknown
                    let displayName = 'Unknown User';
                    if (assignee === 'unassigned') displayName = 'Unassigned';
                    else if (profile?.full_name) displayName = profile.full_name;
                    else if (item.assigned_to_name) displayName = item.assigned_to_name;

                    // Priority for Dept: Profile Dept > Item Assigned Dept > Item Stage > No Dept
                    let displayDept = 'No Dept';
                    if (assignee === 'unassigned') displayDept = 'Queue';
                    else if (profile?.department) displayDept = profile.department;
                    else if (item.assigned_department) displayDept = item.assigned_department;
                    else if (item.current_stage) displayDept = item.current_stage;

                    stats[assignee] = {
                        id: assignee,
                        name: displayName,
                        avatar_url: profile?.avatar_url,
                        department: displayDept,
                        count: 0,
                        urgent: 0
                    };
                }
                stats[assignee].count++;
                if (item.priority_computed === 'red') stats[assignee].urgent++;
            });
        });

        // Sort by count descending
        return Object.values(stats).sort((a, b) => b.count - a.count);
    }, [orders, profiles]);

    return (
        <Card className="border-none shadow-sm hover:shadow-md transition-shadow bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm h-full flex flex-col">
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                    <span>{isAdmin ? "Team Workload" : "My Workload"}</span>
                    <span className="text-xs font-normal text-muted-foreground bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        {userStats.length} Active
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
                <ScrollArea className="h-[200px] pr-4">
                    {isLoadingProfiles ? (
                        <div className="flex justify-center items-center h-full py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {userStats.length === 0 ? (
                                <p className="text-sm text-slate-400 text-center py-4">No active assignments</p>
                            ) : (
                                userStats.map((stat) => (
                                    <div
                                        key={stat.id}
                                        className="flex items-center justify-between group cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 p-1.5 rounded-lg transition-colors"
                                        onClick={() => {
                                            if (stat.id !== 'unassigned') {
                                                // Navigate to specific department dashboard if known, otherwise main dashboard
                                                const targetPath = stat.department && stat.department !== 'No Dept' && stat.department !== 'Queue'
                                                    ? `/${stat.department.toLowerCase()}`
                                                    : '/dashboard';

                                                window.location.href = `${targetPath}?assigned_user=${stat.id}`;
                                            }
                                        }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-8 w-8 border border-slate-100 dark:border-slate-800">
                                                <AvatarImage src={stat.avatar_url} />
                                                <AvatarFallback className={`${stat.id === 'unassigned' ? 'bg-slate-100 text-slate-500' : 'bg-indigo-50 text-indigo-600'} text-[10px] font-bold`}>
                                                    {getInitials(stat.name)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-none mb-1">
                                                    {stat.name}
                                                </p>
                                                <p className="text-[10px] text-slate-400">
                                                    {stat.department ? (
                                                        <span className="uppercase tracking-wider opacity-90">{stat.department}</span>
                                                    ) : (
                                                        stat.id === 'unassigned' ? 'Queue' : 'No Dept'
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{stat.count}</div>
                                            {stat.urgent > 0 && (
                                                <div className="text-[10px] font-medium text-red-500">{stat.urgent} Urgent</div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
