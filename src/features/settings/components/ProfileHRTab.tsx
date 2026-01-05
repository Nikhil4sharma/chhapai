import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { format } from "date-fns";
import { Briefcase, Calendar, Wallet, FileText } from "lucide-react";
import { useHR } from "@/features/hr/hooks/useHR";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function ProfileHRTab() {
    const { leaveRequests, payrolls, leaveBalances, isLoading } = useHR();
    // We would also fetch employee details here if we had an endpoint for it
    // For now we use what we have

    if (isLoading) {
        return <div>Loading HR details...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Employment Details */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg font-display flex items-center gap-2">
                        <Briefcase className="h-5 w-5" />
                        Employment Details
                    </CardTitle>
                    <CardDescription>Your role and status</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <h4 className="text-sm font-medium text-muted-foreground">Joining Date</h4>
                            <p>--</p>
                        </div>
                        <div>
                            <h4 className="text-sm font-medium text-muted-foreground">Department</h4>
                            <p>--</p>
                        </div>
                        <div>
                            <h4 className="text-sm font-medium text-muted-foreground">Designation</h4>
                            <p>--</p>
                        </div>
                        <div>
                            <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
                            <Badge variant="outline">Active</Badge>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Leave History */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg font-display flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Leave History
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {leaveRequests?.length === 0 && <p className="text-sm text-muted-foreground">No leave history found.</p>}
                        {leaveRequests?.slice(0, 5).map(leave => (
                            <div key={leave.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                                <div>
                                    <p className="font-medium">{leave.leave_type?.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {format(new Date(leave.start_date), "MMM dd, yyyy")}
                                    </p>
                                </div>
                                <Badge variant={leave.status === 'approved' ? 'default' : 'secondary'}>
                                    {leave.status}
                                </Badge>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Payroll History */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg font-display flex items-center gap-2">
                        <Wallet className="h-5 w-5" />
                        Payroll History
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {payrolls?.length === 0 && <p className="text-sm text-muted-foreground">No payroll records found.</p>}
                        {payrolls?.map(payroll => (
                            <div key={payroll.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                                <div>
                                    <p className="font-medium">{format(new Date(payroll.year, payroll.month - 1), "MMMM yyyy")}</p>
                                    <p className="text-xs text-muted-foreground">
                                        Base: ₹{payroll.base_salary}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold">₹{payroll.total_payable}</span>
                                    {payroll.salary_slip_url && (
                                        <Button variant="ghost" size="icon" asChild>
                                            <a href={payroll.salary_slip_url} target="_blank" rel="noopener noreferrer">
                                                <FileText className="h-4 w-4" />
                                            </a>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Documents */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg font-display flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Documents
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">Company policies and other documents will appear here.</p>
                </CardContent>
            </Card>
        </div>
    );
}
