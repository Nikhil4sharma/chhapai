import { Calendar as CalendarIcon, Wallet, Briefcase, Plus, Star, PartyPopper } from "lucide-react";
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
import { useHR } from "../hooks/useHR";
import { Badge } from "@/components/ui/badge";

export default function EmployeeDashboard() {
    const { leaveBalances, holidays, payrolls, leaveRequests, isLoading } = useHR();

    if (isLoading) {
        return (
            <div className="p-8 space-y-6">
                <Skeleton className="h-12 w-48" />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-32 rounded-xl" />
                    ))}
                </div>
            </div>
        );
    }

    const latestPayroll = payrolls?.[0];

    return (
        <div className="flex-1 space-y-6 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">My HR Dashboard</h2>
                <div className="flex items-center space-x-2">
                    <LeaveRequestDialog>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Apply Leave
                        </Button>
                    </LeaveRequestDialog>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Leave Balances Cards */}
                {leaveBalances?.map((balance) => (
                    <HRStatsCard
                        key={balance.id}
                        title={balance.leave_type?.name || "Leave"}
                        value={`${balance.balance - balance.used}/${balance.balance} Days`}
                        icon={Briefcase}
                        description="Available Balance"
                        className={balance.leave_type?.color === 'red' ? "border-red-200 bg-red-50 dark:bg-red-950/20" :
                            balance.leave_type?.color === 'blue' ? "border-blue-200 bg-blue-50 dark:bg-blue-950/20" :
                                "border-green-200 bg-green-50 dark:bg-green-950/20"}
                    />
                ))}
                {(!leaveBalances || leaveBalances.length === 0) && (
                    <HRStatsCard
                        title="Leave Balance"
                        value="0"
                        icon={Briefcase}
                        description="No leave balance assigned"
                    />
                )}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Upcoming Holidays</CardTitle>
                        <CardDescription>
                            Public and optional holidays for this year.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {holidays?.length === 0 && <p className="text-muted-foreground text-sm">No upcoming holidays.</p>}
                            {holidays?.map((holiday) => (
                                <div
                                    key={holiday.id}
                                    className="flex items-center justify-between p-4 border rounded-lg"
                                >
                                    <div className="flex items-center space-x-4">
                                        <div className={`p-2 rounded-full ${holiday.type === 'mandatory' ? 'bg-purple-100 text-purple-600' : 'bg-orange-100 text-orange-600'}`}>
                                            {holiday.day_of_week === 'Sunday' ? <PartyPopper className="h-4 w-4" /> : <Star className="h-4 w-4" />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium leading-none">
                                                {holiday.name}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {format(new Date(holiday.date), "EEEE")}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="font-bold">{format(new Date(holiday.date), "MMM dd")}</span>
                                        <span className="text-xs text-muted-foreground capitalize">{holiday.type}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Payroll Summary</CardTitle>
                        <CardDescription>Latest salary details</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {!latestPayroll ? (
                            <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                                <Wallet className="h-10 w-10 mb-2 opacity-20" />
                                <p>No payroll records found.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Month</span>
                                    <span className="font-medium">{format(new Date(latestPayroll.year, latestPayroll.month - 1), "MMMM yyyy")}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Base Salary</span>
                                    <span className="font-medium">₹{latestPayroll.base_salary.toLocaleString()}</span>
                                </div>
                                {latestPayroll.additions?.length > 0 && (
                                    <div className="border-t pt-2 mt-2">
                                        <span className="text-xs font-semibold text-green-600">Additions</span>
                                        {latestPayroll.additions.map((add, i) => (
                                            <div key={i} className="flex justify-between text-xs mt-1">
                                                <span>{add.description}</span>
                                                <span>+₹{add.amount}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {latestPayroll.deductions?.length > 0 && (
                                    <div className="border-t pt-2 mt-2">
                                        <span className="text-xs font-semibold text-red-600">Deductions</span>
                                        {latestPayroll.deductions.map((ded, i) => (
                                            <div key={i} className="flex justify-between text-xs mt-1">
                                                <span>{ded.description}</span>
                                                <span>-₹{ded.amount}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="border-t pt-4 mt-4 flex items-center justify-between font-bold">
                                    <span>Net Payable</span>
                                    <span className="text-xl text-primary">₹{latestPayroll.total_payable.toLocaleString()}</span>
                                </div>

                                {latestPayroll.salary_slip_url && (
                                    <Button variant="outline" className="w-full mt-4" size="sm" asChild>
                                        <a href={latestPayroll.salary_slip_url} target="_blank" rel="noopener noreferrer">Download Slip</a>
                                    </Button>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Leave History</CardTitle>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[200px]">
                        {leaveRequests?.length === 0 && <p className="text-muted-foreground text-sm">No leave history.</p>}
                        <div className="space-y-4">
                            {leaveRequests?.map(leave => (
                                <div key={leave.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                                    <div>
                                        <p className="font-medium text-sm">{leave.leave_type?.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {format(new Date(leave.start_date), "MMM dd")} - {format(new Date(leave.end_date), "MMM dd, yyyy")}
                                            <span className="ml-2">({leave.days_count} days)</span>
                                        </p>
                                    </div>
                                    <Badge variant={
                                        leave.status === 'approved' ? 'default' :
                                            leave.status === 'rejected' ? 'destructive' : 'secondary'
                                    } className="capitalize">
                                        {leave.status}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
