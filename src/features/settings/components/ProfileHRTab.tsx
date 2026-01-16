import { useRef, useState } from "react";
import { Calendar as CalendarIcon, Wallet, Briefcase, Plus, PartyPopper, Clock, Mail, Shield, FileCheck, Phone, Camera, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { LeaveRequestDialog } from "@/features/hr/components/LeaveRequestDialog";
import { LeaveBalanceCard } from "@/features/hr/components/LeaveBalanceCard";
import { useHR } from "@/features/hr/hooks/useHR";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Progress } from "@/components/ui/progress";
import { uploadAvatar } from '@/services/supabaseStorage';
import { toast } from '@/hooks/use-toast';

export function ProfileHRTab() {
    const { user, profile, updateProfile, role } = useAuth();
    const { leaveBalances, holidays, payrolls, leaveRequests, isLoading, profileDetails } = useHR();
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        if (!file.type.startsWith('image/')) {
            toast({
                title: "Error",
                description: "Please upload an image file",
                variant: "destructive",
            });
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast({
                title: "Error",
                description: "Image must be less than 5MB",
                variant: "destructive",
            });
            return;
        }

        setIsUploadingAvatar(true);
        try {
            const uploadResult = await uploadAvatar(file, user.id);
            const { error: updateError } = await updateProfile({
                avatar_url: uploadResult.url,
            });

            if (updateError) throw updateError;

            toast({
                title: "Success",
                description: "Profile picture updated successfully",
            });
        } catch (error) {
            console.error('Error uploading avatar:', error);
            toast({
                title: "Error",
                description: "Failed to upload profile picture",
                variant: "destructive",
            });
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    if (isLoading) {
        return (
            <div className="p-4 md:p-8 space-y-8 w-full max-w-7xl mx-auto">
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
    const totalLeaves = leaveBalances?.reduce((sum, bal) => sum + (bal.leave_type?.days_allowed_per_year || 0), 0) || 0;
    const usedLeaves = leaveBalances?.reduce((sum, bal) => sum + (bal.used || 0), 0) || 0;
    const availableLeaves = totalLeaves - usedLeaves;
    const leavePercentage = totalLeaves > 0 ? (availableLeaves / totalLeaves) * 100 : 0;

    // Use profile from Auth context if HR profile details are missing name (fallback chain)
    // HR hook now joins 'phone' from public profile as well
    const displayName = profile?.full_name || profileDetails?.full_name || "Team Member";
    const displayPhone = profile?.phone || profileDetails?.phone || profileDetails?.public_profile?.phone || "No Phone";
    // Prioritize actual user role from user_roles table (via context) over designation/department
    const displayRole = role || profileDetails?.designation || profile?.department || "Employee";
    const displayDept = profileDetails?.department || profile?.department || "General";

    // Check both sources for avatar
    const displayAvatar = profile?.avatar_url || profileDetails?.avatar_url || "";

    return (
        <div className="flex-1 space-y-6 md:space-y-8 pt-2 w-full">

            {/* Hero Profile Section - Elegant Dark Theme */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl border border-white/5">
                {/* Subtle Ambient Glows */}
                <div className="absolute top-0 right-0 -mr-20 -mt-20 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 -ml-20 -mb-20 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl pointer-events-none"></div>

                <div className="relative p-6 md:p-10 flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-10">

                    {/* Avatar with Upload Overlay */}
                    <div className="relative group shrink-0">
                        <Avatar className="h-28 w-28 md:h-32 md:w-32 border-4 border-white/10 shadow-2xl ring-1 ring-white/20">
                            <AvatarImage src={displayAvatar} className="object-cover" />
                            <AvatarFallback className="text-3xl md:text-4xl font-light bg-gradient-to-br from-indigo-500 to-slate-600 text-white">
                                {displayName.charAt(0)}
                            </AvatarFallback>
                        </Avatar>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploadingAvatar}
                            className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer backdrop-blur-sm"
                        >
                            {isUploadingAvatar ? (
                                <Loader2 className="h-8 w-8 text-white animate-spin" />
                            ) : (
                                <Camera className="h-8 w-8 text-white/90 hover:text-white hover:scale-110 transition-transform" />
                            )}
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarUpload}
                            className="hidden"
                        />
                    </div>

                    {/* Profile Details */}
                    <div className="flex-1 text-center md:text-left space-y-4 w-full">
                        <div>
                            <div className="flex flex-col md:flex-row items-center justify-center md:justify-start gap-3 mb-2">
                                <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-white">{displayName}</h1>
                                <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-200 border-0 backdrop-blur-md px-3 py-0.5">
                                    {profileDetails?.employment_status || "Active"}
                                </Badge>
                            </div>
                            <p className="text-indigo-200/80 text-base md:text-lg flex flex-wrap items-center justify-center md:justify-start gap-2 font-light">
                                <Briefcase className="h-4 w-4" />
                                <span className="capitalize">{displayRole.replace('_', ' ')}</span>
                                <span className="hidden md:inline mx-1 opacity-30">|</span>
                                <span className="capitalize">{displayDept}</span>
                            </p>
                        </div>

                        {/* Responsive Details Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-indigo-100/70 mt-4 bg-white/5 p-4 rounded-xl border border-white/5 backdrop-blur-sm w-full">
                            <div className="flex items-center justify-center sm:justify-start gap-2 truncate">
                                <Shield className="h-3.5 w-3.5 shrink-0" />
                                <span className="font-mono tracking-wider truncate" title={user?.id}>ID: {user?.id?.slice(0, 8).toUpperCase()}</span>
                            </div>
                            <div className="flex items-center justify-center sm:justify-start gap-2 truncate">
                                <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                                <span>Joined {profileDetails?.joining_date ? format(new Date(profileDetails.joining_date), "MMM yyyy") : "N/A"}</span>
                            </div>
                            <div className="flex items-center justify-center sm:justify-start gap-2 truncate">
                                <Mail className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate" title={profileDetails?.email || user?.email}>{profileDetails?.email || user?.email || "No Email"}</span>
                            </div>
                            <div className="flex items-center justify-center sm:justify-start gap-2 truncate">
                                <Phone className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{displayPhone}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 w-full md:w-auto min-w-[160px]">
                        <LeaveRequestDialog>
                            <Button size="lg" className="w-full bg-white text-slate-900 hover:bg-indigo-50 font-semibold shadow-xl border-0 transition-all hover:scale-[1.02] active:scale-95">
                                <Plus className="mr-2 h-5 w-5" />
                                Apply for Leave
                            </Button>
                        </LeaveRequestDialog>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid gap-6 md:gap-8 grid-cols-1 lg:grid-cols-3">

                {/* Left Column: Stats & Leave Balances */}
                <div className="space-y-6 md:space-y-8 lg:col-span-2">

                    {/* Quick Stats - Premium Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Card className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-slate-500">Available Leaves</CardTitle>
                                <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                    <PartyPopper className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white">{availableLeaves}</div>
                                <Progress value={leavePercentage} className="h-1.5 mt-3 bg-slate-100 dark:bg-slate-800 [&>div]:bg-emerald-500" />
                                <p className="text-xs text-muted-foreground mt-2 font-medium">{usedLeaves} used of {totalLeaves} total</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-slate-500">Pending Requests</CardTitle>
                                <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                    <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                                    {leaveRequests?.filter(r => r.status === 'pending').length || 0}
                                </div>
                                <p className="text-xs text-muted-foreground mt-2 font-medium">Awaiting approval</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-slate-500">Next Holiday</CardTitle>
                                <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                                    <PartyPopper className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-lg font-bold truncate text-slate-900 dark:text-white">
                                    {holidays?.[0]?.name || "None"}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 font-medium">
                                    {holidays?.[0] ? format(new Date(holidays[0].date), "MMM dd, yyyy") : "Check calendar"}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Detailed Leave Balances */}
                    <div>
                        <div className="flex items-center justify-between mb-4 px-1">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Leave Balances</h3>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            {leaveBalances?.map((balance) => (
                                <LeaveBalanceCard
                                    key={balance.id}
                                    balance={balance}
                                    className="hover:shadow-md transition-shadow duration-200"
                                />
                            ))}
                            {(!leaveBalances || leaveBalances.length === 0) && (
                                <div className="col-span-2 py-8 text-center bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-500">
                                    No leave balances assigned.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Recent History */}
                    <Card className="overflow-hidden border-slate-200 dark:border-slate-800 shadow-sm">
                        <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                            <CardTitle>Recent Activity</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <ScrollArea className="h-[300px]">
                                {leaveRequests?.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                                        <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full mb-3">
                                            <FileCheck className="h-6 w-6 opacity-30" />
                                        </div>
                                        <p>No leave history found</p>
                                    </div>
                                )}
                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {leaveRequests?.map(leave => (
                                        <div key={leave.id} className="flex items-center justify-between p-4 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                                            <div className="flex items-start gap-4">
                                                <div className={`p-2 rounded-lg mt-1 ${leave.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                    leave.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                        'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
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
                <div className="space-y-6 md:space-y-8">

                    {/* Payroll Card - Elegant Dark/Gold Accent */}
                    <Card className="overflow-hidden border-orange-100 dark:border-orange-900/20 shadow-lg hover:shadow-xl transition-all group bg-gradient-to-br from-white to-orange-50/30 dark:from-slate-950 dark:to-slate-900">
                        <CardHeader className="border-b border-orange-100 dark:border-orange-900/20">
                            <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                                <span className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg text-orange-600">
                                    <Wallet className="h-4 w-4" />
                                </span>
                                Payroll Summary
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            {!latestPayroll ? (
                                profileDetails?.base_salary ? (
                                    <div className="space-y-6">
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Monthly Base Salary</p>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-3xl font-bold text-slate-900 dark:text-white">₹{profileDetails.base_salary.toLocaleString()}</span>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-lg">
                                            <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
                                                No recent payroll processed. This is your contracted base salary from HR records.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-[150px] text-muted-foreground">
                                        <p className="text-sm">No payroll records found.</p>
                                    </div>
                                )
                            ) : (
                                <div className="space-y-6">
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Net Pay</p>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-3xl font-bold text-slate-900 dark:text-white">₹{latestPayroll.total_payable.toLocaleString()}</span>
                                            <span className="text-sm text-muted-foreground">/ {format(new Date(latestPayroll.year, latestPayroll.month - 1), "MMM yyyy")}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-3 pt-4 border-t border-dashed border-slate-200 dark:border-slate-800">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Earnings</span>
                                            <span className="font-medium">₹{latestPayroll.base_salary.toLocaleString()}</span>
                                        </div>
                                        {latestPayroll.additions?.map((add, i) => (
                                            <div key={i} className="flex justify-between text-xs text-emerald-600">
                                                <span>{add.description}</span>
                                                <span>+₹{add.amount.toLocaleString()}</span>
                                            </div>
                                        ))}
                                        {latestPayroll.deductions?.map((ded, i) => (
                                            <div key={i} className="flex justify-between text-xs text-red-600">
                                                <span>{ded.description}</span>
                                                <span>-₹{ded.amount.toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {latestPayroll.salary_slip_url && (
                                        <Button variant="outline" className="w-full" size="sm" asChild>
                                            <a href={latestPayroll.salary_slip_url} target="_blank" rel="noopener noreferrer">Download Salary Slip</a>
                                        </Button>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Holidays List - Clean List */}
                    <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg">Upcoming Holidays</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                {holidays?.length === 0 && <p className="p-6 text-center text-muted-foreground text-sm">No upcoming holidays.</p>}
                                {holidays?.map((holiday) => (
                                    <div key={holiday.id} className="flex items-center gap-4 p-4 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                                        <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-lg border ${holiday.type === 'mandatory'
                                            ? 'bg-purple-50 border-purple-100 text-purple-700 dark:bg-purple-900/20 dark:border-purple-900/30 dark:text-purple-400'
                                            : 'bg-blue-50 border-blue-100 text-blue-700 dark:bg-blue-900/20 dark:border-blue-900/30 dark:text-blue-400'
                                            }`}>
                                            <span className="text-[10px] font-bold uppercase">{format(new Date(holiday.date), "MMM")}</span>
                                            <span className="text-lg font-bold leading-none">{format(new Date(holiday.date), "dd")}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-slate-900 dark:text-slate-200 truncate">{holiday.name}</p>
                                            <p className="text-xs text-muted-foreground">{format(new Date(holiday.date), "EEEE")}</p>
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
