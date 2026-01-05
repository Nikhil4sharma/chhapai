import { useState } from "react";
import { format } from "date-fns";
import { Check, X, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useAdminHR } from "@/features/hr/hooks/useAdminHR";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function LeaveManagement() {
    const { allLeaveRequests, employees, updateLeaveStatus, isLoading } = useAdminHR();
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [rejectDialog, setRejectDialog] = useState<{ open: boolean; id: string | null }>({
        open: false,
        id: null
    });
    const [rejectionReason, setRejectionReason] = useState("");

    const getEmployeeName = (userId: string) => {
        const emp = employees?.find((e: any) => e.user_id === userId);
        return emp?.full_name || 'Unknown User';
    };

    const handleApprove = async (id: string) => {
        try {
            await updateLeaveStatus.mutateAsync({ id, status: 'approved' });
            toast.success("Leave approved");
        } catch (error) {
            toast.error("Failed to approve leave");
        }
    };

    const handleReject = async () => {
        if (!rejectDialog.id) return;
        try {
            await updateLeaveStatus.mutateAsync({
                id: rejectDialog.id,
                status: 'rejected',
                rejection_reason: rejectionReason
            });
            toast.success("Leave rejected");
            setRejectDialog({ open: false, id: null });
            setRejectionReason("");
        } catch (error) {
            toast.error("Failed to reject leave");
        }
    };

    const filteredRequests = allLeaveRequests?.filter(request => {
        const empName = getEmployeeName(request.user_id);
        const matchesSearch = empName.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = statusFilter === "all" || request.status === statusFilter;
        return matchesSearch && matchesFilter;
    });

    return (
        <Card className="h-full">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Leave Requests</CardTitle>
                        <CardDescription>Manage employee leave applications</CardDescription>
                    </div>
                </div>
                <div className="flex items-center gap-2 mt-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search employees..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant={statusFilter === "all" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setStatusFilter("all")}
                        >
                            All
                        </Button>
                        <Button
                            variant={statusFilter === "pending" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setStatusFilter("pending")}
                        >
                            Pending
                        </Button>
                        <Button
                            variant={statusFilter === "approved" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setStatusFilter("approved")}
                        >
                            Approved
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Employee</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Dates</TableHead>
                                <TableHead>Duration</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8">
                                        Loading...
                                    </TableCell>
                                </TableRow>
                            ) : filteredRequests?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        No leave requests found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredRequests?.map((request) => (
                                    <TableRow key={request.id}>
                                        <TableCell>
                                            <div className="font-medium">{getEmployeeName(request.user_id)}</div>
                                            <div className="text-xs text-muted-foreground truncate max-w-[200px]" title={request.reason}>
                                                {request.reason}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{request.leave_type?.name}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm">
                                                {format(new Date(request.start_date), "MMM d")} - {format(new Date(request.end_date), "MMM d, y")}
                                            </div>
                                        </TableCell>
                                        <TableCell>{request.days_count} days</TableCell>
                                        <TableCell>
                                            <Badge variant={
                                                request.status === 'approved' ? 'default' :
                                                    request.status === 'rejected' ? 'destructive' : 'secondary'
                                            }>
                                                {request.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {request.status === 'pending' && (
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                        onClick={() => handleApprove(request.id)}
                                                    >
                                                        <Check className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                        onClick={() => setRejectDialog({ open: true, id: request.id })}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>

            <Dialog open={rejectDialog.open} onOpenChange={(open) => setRejectDialog({ ...rejectDialog, open })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Leave Request</DialogTitle>
                        <DialogDescription>
                            Please provide a reason for rejecting this leave request.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Textarea
                            placeholder="Reason for rejection..."
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRejectDialog({ open: false, id: null })}>Cancel</Button>
                        <Button variant="destructive" onClick={handleReject}>Reject</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
