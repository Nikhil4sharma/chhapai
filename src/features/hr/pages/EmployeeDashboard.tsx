import { Calendar as CalendarIcon, Wallet, Briefcase, Plus, Star, PartyPopper, Clock, MapPin, Building, Phone, Mail, Shield } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { HRStatsCard } from "../components/HRStatsCard";
import { LeaveRequestDialog } from "../components/LeaveRequestDialog";
import { LeaveBalanceCard } from "../components/LeaveBalanceCard";
import { useHR } from "../hooks/useHR";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Progress } from "@/components/ui/progress";

export default function EmployeeDashboard() {
    const { user } = useAuth();
    const { leaveBalances, holidays, payrolls, leaveRequests, isLoading, profileDetails } = useHR();

    if (isLoading) {
        return (
            <div className="p-8 space-y-8 max-w-7xl mx-auto">
                <Skeleton className="h-64 w-full rounded-3xl" />
                <div className="grid gap-6 md:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-40 rounded-3xl" />
                    ))}
                </div>
            </div>
        );
    }

    const latestPayroll = payrolls?.[0];

    // Calculate total leaves for stats
    const totalLeaves = leaveBalances?.reduce((sum, bal) => sum + bal.total_days, 0) || 0;
    const usedLeaves = leaveBalances?.reduce((sum, bal) => sum + bal.used_days, 0) || 0;
    const availableLeaves = totalLeaves - usedLeaves;
    const leavePercentage = totalLeaves > 0 ? (availableLeaves / totalLeaves) * 100 : 0;

    return (
        <div className="flex-1 space-y-8 p-8 pt-6 max-w-[1600px] mx-auto bg-slate-50/50 dark:bg-black/20 min-h-screen">

            {/* Hero Profile Section */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 text-white shadow-xl">
                <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-white/10 blur-3xl"></div>
                <div className="absolute bottom-0 left-0 -ml-16 -mb-16 h-64 w-64 rounded-full bg-white/10 blur-3xl"></div>

                <div className="relative p-8 md:p-10 flex flex-col md:flex-row items-center md:items-start gap-8">
                    <Avatar className="h-32 w-32 border-4 border-white/20 shadow-2xl ring-4 ring-black/5">
                        <AvatarImage src={profileDetails?.avatar_url || ""} />
                        <AvatarFallback className="text-4xl font-bold bg-white/10 text-white backdrop-blur-md">
                            {profileDetails?.full_name?.charAt(0) || "U"}
                        </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 text-center md:text-left space-y-4">
                        <div>
                            <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{profileDetails?.full_name || "Welcome Back"}</h1>
                                <Badge variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-md">
                                    {profileDetails?.employment_status || "Active"}
                                </Badge>
                            </div>
                            <p className="text-indigo-100 text-lg flex items-center justify-center md:justify-start gap-2">
                                <Briefcase className="h-4 w-4" />
                                {profileDetails?.designation || "Team Member"}
                                <span className="mx-2 opacity-50">•</span>
                                {profileDetails?.department || "General"}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 md:flex gap-4 md:gap-8 text-sm text-indigo-100/80 bg-black/10 p-4 rounded-xl backdrop-blur-sm inline-flex">
                            <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4" />
                                <span>ID: <span className="text-white font-mono">{user?.id?.slice(0, 8).toUpperCase()}</span></span>
                            </div>
                            <div className="flex items-center gap-2">
                                <CalendarIcon className="h-4 w-4" />
                                <span>Joined: <span className="text-white">{profileDetails?.joining_date ? format(new Date(profileDetails.joining_date), "MMM yyyy") : "N/A"}</span></span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4" />
                                <span className="truncate max-w-[150px]">{profileDetails?.email || "No Email"}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 min-w-[200px]">
                        <LeaveRequestDialog>
                            <Button size="lg" className="bg-white text-indigo-600 hover:bg-indigo-50 font-semibold shadow-lg border-0">
                                <Plus className="mr-2 h-5 w-5" />
                                Apply for Leave
                            </Button>
                        </LeaveRequestDialog>
                        <Button variant="outline" className="bg-indigo-700/50 border-white/20 text-white hover:bg-indigo-700/70 backdrop-blur-md">
                            Update Profile
                        </Button>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid gap-8 md:grid-cols-3">

                {/* Left Column: Stats & Leave Balances */}
                <div className="space-y-8 md:col-span-2">

                    {/* Quick Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Card className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-slate-200/60 dark:border-slate-800/60 shadow-sm hover:shadow-md transition-all">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Available Leaves</CardTitle>
                                <PartyPopper className="h-4 w-4 text-emerald-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{availableLeaves}</div>
                                <Progress value={leavePercentage} className="h-1 mt-2 bg-emerald-100 [&>div]:bg-emerald-500" />
                                <p className="text-xs text-muted-foreground mt-2">of {totalLeaves} total days</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-slate-200/60 dark:border-slate-800/60 shadow-sm hover:shadow-md transition-all">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
                                <Clock className="h-4 w-4 text-amber-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                                    {leaveRequests?.filter(r => r.status === 'pending').length || 0}
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">Awaiting approval</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-slate-200/60 dark:border-slate-800/60 shadow-sm hover:shadow-md transition-all">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Next Holiday</CardTitle>
                                <PartyPopper className="h-4 w-4 text-purple-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-lg font-bold truncate text-purple-600 dark:text-purple-400">
                                    {holidays?.[0]?.name || "None"}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {holidays?.[0] ? format(new Date(holidays[0].date), "MMM dd, yyyy") : "Check calendar"}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Detailed Leave Balances */}
                    <div>
                        <h3 className="text-lg font-semibold mb-4 px-1">Your Leave Balances</h3>
                        <div className="grid gap-4 sm:grid-cols-2">
                            {leaveBalances?.map((balance) => (
                                <LeaveBalanceCard
                                    key={balance.id}
                                    balance={balance}
                                    className="hover:scale-[1.02] transition-transform duration-200 border-l-4"
                                />
                            ))}
                            {(!leaveBalances || leaveBalances.length === 0) && (
                                <div className="col-span-2 py-8 text-center bg-slate-100 rounded-xl border border-dashed text-slate-500">
                                    No leave balances assigned. Contact HR.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Recent History */}
                    <Card className="overflow-hidden border-slate-200/60 dark:border-slate-800/60 shadow-sm">
                        <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                            <CardTitle>Recent Activity</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <ScrollArea className="h-[300px]">
                                {leaveRequests?.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                                        <div className="p-3 bg-slate-100 rounded-full mb-3">
                                            <FileCheck className="h-6 w-6 opacity-30" />
                                        </div>
                                        <p>No leave history found</p>
                                    </div>
                                )}
                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {leaveRequests?.map(leave => (
                                        <div key={leave.id} className="flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors">
                                            <div className="flex items-start gap-4">
                                                <div className={`p-2 rounded-lg mt-1 ${leave.status === 'approved' ? 'bg-green-100 text-green-600' :
                                                        leave.status === 'rejected' ? 'bg-red-100 text-red-600' :
                                                            'bg-amber-100 text-amber-600'
                                                    }`}>
                                                    {leave.status === 'approved' ? <PartyPopper className="h-4 w-4" /> :
                                                        leave.status === 'rejected' ? <Shield className="h-4 w-4" /> :
                                                            <Clock className="h-4 w-4" />}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm text-slate-900 dark:text-slate-200">{leave.leave_type?.name} Request</p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        {format(new Date(leave.start_date), "MMM dd")} - {format(new Date(leave.end_date), "MMM dd, yyyy")}
                                                        <span className="ml-2 font-medium">({leave.days_count} days)</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <Badge variant={
                                                leave.status === 'approved' ? 'default' :
                                                    leave.status === 'rejected' ? 'destructive' : 'secondary'
                                            } className="capitalize shadow-none">
                                                {leave.status}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Payroll & Holidays */}
                <div className="space-y-8">

                    {/* Payroll Card */}
                    <Card className="overflow-hidden border-orange-100 dark:border-orange-900/20 shadow-lg hover:shadow-xl transition-all group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500 ease-in-out"></div>

                        <CardHeader className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border-b border-orange-100 dark:border-orange-900/20 relative">
                            <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                                <Wallet className="h-5 w-5" />
                                Latest Payroll
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 relative">
                            {!latestPayroll ? (
                                <div className="flex flex-col items-center justify-center h-[150px] text-muted-foreground">
                                    <div className="p-3 bg-orange-100 rounded-full mb-3 opacity-50">
                                        <Wallet className="h-8 w-8 text-orange-400" />
                                    </div>
                                    <p>No payroll records found.</p>
                                </div>
                            ) : (
                                <div className="space-y-5">
                                    <div className="flex items-center justify-between text-sm pb-4 border-b border-dashed border-slate-200 dark:border-slate-800">
                                        <span className="text-muted-foreground">Period</span>
                                        <span className="font-semibold">{format(new Date(latestPayroll.year, latestPayroll.month - 1), "MMMM yyyy")}</span>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">Earnings</span>
                                            <span className="font-medium">₹{latestPayroll.base_salary.toLocaleString()}</span>
                                        </div>
                                        {latestPayroll.additions?.map((add, i) => (
                                            <div key={i} className="flex justify-between text-xs text-green-600">
                                                <span>{add.description}</span>
                                                <span>+₹{add.amount}</span>
                                            </div>
                                        ))}
                                        {latestPayroll.deductions?.map((ded, i) => (
                                            <div key={i} className="flex justify-between text-xs text-red-600">
                                                <span>{ded.description}</span>
                                                <span>-₹{ded.amount}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="pt-4 bg-orange-50/50 -mx-6 -mb-6 p-6 flex items-center justify-between">
                                        <span className="font-bold text-orange-900/70 dark:text-orange-100/70">Net Pay</span>
                                        <span className="text-2xl font-bold text-orange-600">₹{latestPayroll.total_payable.toLocaleString()}</span>
                                    </div>

                                    {latestPayroll.salary_slip_url && (
                                        <Button variant="outline" className="w-full border-orange-200 hover:bg-orange-50 hover:text-orange-700" size="sm" asChild>
                                            <a href={latestPayroll.salary_slip_url} target="_blank" rel="noopener noreferrer">Download Salary Slip</a>
                                        </Button>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Holidays List */}
                    <Card className="border-slate-200/60 dark:border-slate-800/60 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg">Upcoming Holidays</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                {holidays?.length === 0 && <p className="p-6 text-center text-muted-foreground text-sm">No upcoming holidays.</p>}
                                {holidays?.map((holiday) => (
                                    <div key={holiday.id} className="flex items-center gap-4 p-4 hover:bg-slate-50/50 transition-colors group">
                                        <div className={`p-3 rounded-xl flex-shrink-0 text-center min-w-[60px] ${holiday.type === 'mandatory' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                                            }`}>
                                            <div className="text-xs uppercase font-bold">{format(new Date(holiday.date), "MMM")}</div>
                                            <div className="text-xl font-bold leading-none mt-0.5">{format(new Date(holiday.date), "dd")}</div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-slate-900 dark:text-slate-200 truncate">{holiday.name}</p>
                                            <p className="text-xs text-muted-foreground">{format(new Date(holiday.date), "EEEE")} • {holiday.type}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                </div>
            </div>
        </div>
    );
}

// Helper icon component since FileCheck wasn't imported
import { FileCheck } from "lucide-react";
