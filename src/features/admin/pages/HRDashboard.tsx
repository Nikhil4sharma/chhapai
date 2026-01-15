import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Users, CalendarDays, Calculator, FileText, Calendar } from "lucide-react";
import { LeaveManagement } from "@/features/admin/components/LeaveManagement";
import { PayrollManagement } from "@/features/admin/components/PayrollManagement";
import { HolidayManagement } from "@/features/admin/components/HolidayManagement";
import { LeaveCalendarView } from "@/features/admin/components/LeaveCalendarView";
import { HRStatsCard } from "@/features/hr/components/HRStatsCard";
import { useAdminHR } from "@/features/hr/hooks/useAdminHR";
import EmployeeManagement from "@/features/hr/pages/EmployeeManagement";
import { isSameDay, parseISO } from "date-fns";
import { useState } from "react";

export default function HRDashboard() {
    const { employees, allLeaveRequests } = useAdminHR();
    const [activeTab, setActiveTab] = useState("overview");

    // Calculate Realtime Stats
    const stats = {
        totalEmployees: employees?.length || 0,
        onLeaveToday: allLeaveRequests?.filter(req => {
            if (req.status !== 'approved') return false;
            const today = new Date();
            const start = parseISO(req.start_date);
            const end = parseISO(req.end_date);
            return today >= start && today <= end;
        }).length || 0,
        pendingRequests: allLeaveRequests?.filter(req => req.status === 'pending').length || 0,
        payrollStatus: 'Pending'
    };

    return (
        <div className="container mx-auto p-6 space-y-8 animate-fade-in">
            <div className="flex flex-col gap-2">
                {/* Breadcrumb style header */}
                <div className="flex items-center text-sm text-muted-foreground mb-4">
                    <span>Home</span>
                    <span className="mx-2">›</span>
                    <span>Admin</span>
                    <span className="mx-2">›</span>
                    <span className="text-foreground font-medium">HR</span>
                </div>

                <h1 className="text-4xl font-bold tracking-tight text-foreground">HR Administration</h1>
                <p className="text-muted-foreground text-lg">Manage your organization's workforce, leave policies, and payroll.</p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-2 lg:grid-cols-6 h-auto p-1 bg-muted/50 rounded-xl">
                    <TabsTrigger value="overview" className="data-[state=active]:bg-background data-[state=active]:shadow-sm py-2.5 rounded-lg transition-all">Overview</TabsTrigger>
                    <TabsTrigger value="employees" className="data-[state=active]:bg-background data-[state=active]:shadow-sm py-2.5 rounded-lg transition-all">Employees</TabsTrigger>
                    <TabsTrigger value="leaves" className="data-[state=active]:bg-background data-[state=active]:shadow-sm py-2.5 rounded-lg transition-all">Leaves</TabsTrigger>
                    <TabsTrigger value="calendar" className="data-[state=active]:bg-background data-[state=active]:shadow-sm py-2.5 rounded-lg transition-all flex gap-2 items-center justify-center">
                        <Calendar className="h-4 w-4" /> Calendar
                    </TabsTrigger>
                    <TabsTrigger value="payroll" className="data-[state=active]:bg-background data-[state=active]:shadow-sm py-2.5 rounded-lg transition-all">Payroll</TabsTrigger>
                    <TabsTrigger value="holidays" className="data-[state=active]:bg-background data-[state=active]:shadow-sm py-2.5 rounded-lg transition-all">Holidays</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                    {/* Realtime Stats Overview */}
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                        <HRStatsCard
                            title="Total Employees"
                            value={stats.totalEmployees}
                            icon={Users}
                            description="Active workforce"
                            variant="blue"
                            onClick={() => setActiveTab("employees")}
                        />
                        <HRStatsCard
                            title="On Leave Today"
                            value={stats.onLeaveToday}
                            icon={CalendarDays}
                            description={stats.onLeaveToday > 0 ? "Check calendar for details" : "Full attendance"}
                            variant="orange"
                            onClick={() => setActiveTab("calendar")}
                        />
                        <HRStatsCard
                            title="Pending Requests"
                            value={stats.pendingRequests}
                            icon={FileText}
                            description={stats.pendingRequests > 0 ? "Requires approval" : "All caught up"}
                            variant="purple"
                            onClick={() => setActiveTab("leaves")}
                        />
                        <HRStatsCard
                            title="Payroll Status"
                            value={stats.payrollStatus}
                            icon={Calculator}
                            description={`For ${new Date().toLocaleString('default', { month: 'short' })} ${new Date().getFullYear()}`}
                            variant="green"
                            onClick={() => setActiveTab("payroll")}
                        />
                    </div>
                </TabsContent>

                <TabsContent value="employees">
                    <EmployeeManagement />
                </TabsContent>

                <TabsContent value="leaves">
                    <LeaveManagement />
                </TabsContent>

                <TabsContent value="calendar">
                    <LeaveCalendarView />
                </TabsContent>

                <TabsContent value="payroll">
                    <PayrollManagement />
                </TabsContent>

                <TabsContent value="holidays">
                    <HolidayManagement />
                </TabsContent>
            </Tabs>
        </div>
    );
}
