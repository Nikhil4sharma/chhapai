import { useState } from "react";
import { format, isSameDay, parseISO } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAdminHR } from "@/features/hr/hooks/useAdminHR";

export function LeaveCalendarView() {
    const { allLeaveRequests, employees } = useAdminHR();
    const [date, setDate] = useState<Date | undefined>(new Date());

    // Helper to get employee name from ID
    const getEmployeeName = (userId: string) => {
        const emp = employees?.find((e: any) => e.user_id === userId);
        return emp?.full_name || 'Unknown User';
    };

    // Filter only approved leaves for the calendar
    const approvedLeaves = allLeaveRequests?.filter(req => req.status === 'approved') || [];

    // Function to checking if a date has leaves
    const getLeavesForDate = (day: Date) => {
        return approvedLeaves.filter(leave => {
            const start = parseISO(leave.start_date);
            const end = parseISO(leave.end_date);
            return day >= start && day <= end;
        });
    };

    // Custom day renderer to show indicators
    const modifiers = {
        hasLeave: (day: Date) => getLeavesForDate(day).length > 0
    };

    const modifiersStyles = {
        hasLeave: {
            fontWeight: 'bold',
            textDecoration: 'underline',
            color: 'var(--primary)'
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
            <Card className="h-full">
                <CardHeader>
                    <CardTitle>Attendance Calendar</CardTitle>
                    <CardDescription>Visual overview of approved leaves.</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center">
                    <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        modifiers={modifiers}
                        modifiersStyles={modifiersStyles}
                        className="rounded-md border shadow p-4"
                    />
                </CardContent>
            </Card>

            <Card className="h-full">
                <CardHeader>
                    <CardTitle>
                        {date ? format(date, "MMMM d, yyyy") : "Select a Date"}
                    </CardTitle>
                    <CardDescription>Who is absent on this day?</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {date ? (
                            (() => {
                                const daysLeaves = getLeavesForDate(date);
                                if (daysLeaves.length === 0) {
                                    return (
                                        <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                                            <p>No leaves scheduled for this day.</p>
                                            <p className="text-sm mt-1">Everyone is present.</p>
                                        </div>
                                    );
                                }
                                return daysLeaves.map(leave => (
                                    <div key={leave.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <Avatar>
                                                <AvatarFallback>{getEmployeeName(leave.user_id).charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="font-medium">{getEmployeeName(leave.user_id)}</p>
                                                <p className="text-xs text-muted-foreground">{leave.leave_type?.name}</p>
                                            </div>
                                        </div>
                                        <Badge variant="outline" className={
                                            leave.leave_type?.name?.toLowerCase().includes('sick') ? 'text-red-600 border-red-200 bg-red-50' :
                                                leave.leave_type?.name?.toLowerCase().includes('casual') ? 'text-blue-600 border-blue-200 bg-blue-50' :
                                                    'text-orange-600 border-orange-200 bg-orange-50'
                                        }>
                                            On Leave
                                        </Badge>
                                    </div>
                                ));
                            })()
                        ) : (
                            <div className="text-center py-12 text-muted-foreground">
                                Select a date on the calendar to view details.
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
