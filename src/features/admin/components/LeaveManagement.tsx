import { useState } from "react";
import { format } from "date-fns";
import { Check, X, Search, Plus, Filter, Edit, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { useAdminHR } from "@/features/hr/hooks/useAdminHR";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function LeaveManagement() {
    const {
        allLeaveRequests,
        employees,
        leaveTypes,
        updateLeaveStatus,
        createLeaveType,
        updateLeaveType,
        updateLeaveBalance,
        isLoading
    } = useAdminHR();

    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [rejectDialog, setRejectDialog] = useState<{ open: boolean; id: string | null }>({
        open: false,
        id: null
    });
    const [rejectionReason, setRejectionReason] = useState("");

    // Leave Type State
    const [isTypeDialogOpen, setIsTypeDialogOpen] = useState(false);
    const [editingType, setEditingType] = useState<any>(null);
    const [typeForm, setTypeForm] = useState({ name: "", days_allowed_per_year: 0, is_paid: true, color: "#6366f1" });

    // Balance Edit State
    const [isBalanceDialogOpen, setIsBalanceDialogOpen] = useState(false);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
    const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
    const [balanceForm, setBalanceForm] = useState({ balance: 0, used: 0 });


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

    // --- Leave Type Handlers ---
    const handleSaveType = async () => {
        try {
            if (editingType) {
                await updateLeaveType.mutateAsync({
                    id: editingType.id,
                    name: typeForm.name,
                    days_allowed_per_year: typeForm.days_allowed_per_year,
                    is_paid: typeForm.is_paid
                });
                toast.success("Leave type updated");
            } else {
                await createLeaveType.mutateAsync(typeForm);
                toast.success("Leave type created");
            }
            setIsTypeDialogOpen(false);
            setEditingType(null);
            setTypeForm({ name: "", days_allowed_per_year: 0, is_paid: true, color: "#6366f1" });
        } catch (error) {
            toast.error("Failed to save leave type");
        }
    };

    const openEditType = (type: any) => {
        setEditingType(type);
        setTypeForm({
            name: type.name,
            days_allowed_per_year: type.days_allowed_per_year,
            is_paid: type.is_paid,
            color: type.color
        });
        setIsTypeDialogOpen(true);
    };

    // --- Balance Handlers ---
    const handleSaveBalance = async () => {
        if (!selectedEmployeeId || !selectedTypeId) return;
        try {
            await updateLeaveBalance.mutateAsync({
                user_id: selectedEmployeeId,
                leave_type_id: selectedTypeId,
                year: new Date().getFullYear(),
                balance: balanceForm.balance,
                used: balanceForm.used
            });
            toast.success("Balance updated");
            setIsBalanceDialogOpen(false);
        } catch (error) {
            toast.error("Failed to update balance");
        }
    };

    const filteredRequests = allLeaveRequests?.filter(request => {
        const empName = getEmployeeName(request.user_id);
        const matchesSearch = empName.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = statusFilter === "all" || request.status === statusFilter;
        return matchesSearch && matchesFilter;
    });

    return (
        <Tabs defaultValue="requests" className="h-full space-y-4">
            <div className="flex items-center justify-between">
                <TabsList>
                    <TabsTrigger value="requests">Requests</TabsTrigger>
                    <TabsTrigger value="types">Leave Types</TabsTrigger>
                    <TabsTrigger value="balances">Employee Balances</TabsTrigger>
                </TabsList>
            </div>

            <TabsContent value="requests" className="h-full">
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
                                <Button variant={statusFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("all")}>All</Button>
                                <Button variant={statusFilter === "pending" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("pending")}>Pending</Button>
                                <Button variant={statusFilter === "approved" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("approved")}>Approved</Button>
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
                                        <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
                                    ) : filteredRequests?.length === 0 ? (
                                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No leave requests found</TableCell></TableRow>
                                    ) : (
                                        filteredRequests?.map((request) => (
                                            <TableRow key={request.id}>
                                                <TableCell>
                                                    <div className="font-medium">{getEmployeeName(request.user_id)}</div>
                                                    <div className="text-xs text-muted-foreground truncate max-w-[200px]" title={request.reason}>{request.reason}</div>
                                                </TableCell>
                                                <TableCell><Badge variant="outline">{request.leave_type?.name}</Badge></TableCell>
                                                <TableCell><div className="text-sm">{format(new Date(request.start_date), "MMM d")} - {format(new Date(request.end_date), "MMM d, y")}</div></TableCell>
                                                <TableCell>{request.days_count} days ({request.duration_type || 'full_day'})</TableCell>
                                                <TableCell>
                                                    <Badge variant={request.status === 'approved' ? 'default' : request.status === 'rejected' ? 'destructive' : 'secondary'}>{request.status}</Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {request.status === 'pending' && (
                                                        <div className="flex justify-end gap-2">
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:bg-green-50" onClick={() => handleApprove(request.id)}><Check className="h-4 w-4" /></Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => setRejectDialog({ open: true, id: request.id })}><X className="h-4 w-4" /></Button>
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
                </Card>
            </TabsContent>

            <TabsContent value="types">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Leave Types & Policy</CardTitle>
                            <CardDescription>Configure available leave types and their paid status</CardDescription>
                        </div>
                        <Button onClick={() => { setEditingType(null); setTypeForm({ name: "", days_allowed_per_year: 0, is_paid: true, color: "#6366f1" }); setIsTypeDialogOpen(true); }}>
                            <Plus className="w-4 h-4 mr-2" /> Add Type
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Days/Year</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {leaveTypes?.map((type: any) => (
                                    <TableRow key={type.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: type.color }} />
                                                {type.name}
                                            </div>
                                        </TableCell>
                                        <TableCell>{type.days_allowed_per_year}</TableCell>
                                        <TableCell>
                                            <Badge variant={type.is_paid ? "default" : "outline"} className={type.is_paid ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}>
                                                {type.is_paid ? "Paid" : "Unpaid"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" onClick={() => openEditType(type)}>
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="balances">
                <Card>
                    <CardHeader>
                        <CardTitle>Employee Balances</CardTitle>
                        <CardDescription>Manually adjust leave balances for employees</CardDescription>
                        <div className="mt-4">
                            <Label>Select Employee to Edit</Label>
                            <div className="relative max-w-sm mt-1">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search employee by name..."
                                    className="pl-8"
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {employees?.filter((e: any) => e.full_name?.toLowerCase().includes(searchQuery.toLowerCase()))
                                .map((emp: any) => (
                                    <div key={emp.user_id} className="border p-4 rounded-lg bg-slate-50 dark:bg-slate-900">
                                        <div className="font-semibold mb-2">{emp.full_name}</div>
                                        <div className="space-y-2">
                                            {leaveTypes?.map((type: any) => (
                                                <div key={type.id} className="flex items-center justify-between text-sm">
                                                    <span>{type.name}</span>
                                                    <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => {
                                                        setSelectedEmployeeId(emp.user_id);
                                                        setSelectedTypeId(type.id);
                                                        // Note: Ideally we pre-fill this with actual balance if API returned it coupled with employees.
                                                        // For now initializing with default/0 and relying on Admin to know or Set New value.
                                                        // Improvement: specific hook to get user balance.
                                                        setBalanceForm({ balance: type.days_allowed_per_year, used: 0 });
                                                        setIsBalanceDialogOpen(true);
                                                    }}>
                                                        Manage
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>

            {/* Reject Dialog */}
            <Dialog open={rejectDialog.open} onOpenChange={(open) => setRejectDialog({ ...rejectDialog, open })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Leave Request</DialogTitle>
                        <DialogDescription>Please provide a reason for rejection.</DialogDescription>
                    </DialogHeader>
                    <Textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Reason..." />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRejectDialog({ open: false, id: null })}>Cancel</Button>
                        <Button variant="destructive" onClick={handleReject}>Reject</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit/Create Type Dialog */}
            <Dialog open={isTypeDialogOpen} onOpenChange={setIsTypeDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingType ? "Edit Leave Type" : "Add Leave Type"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid gap-2">
                            <Label>Name</Label>
                            <Input value={typeForm.name} onChange={e => setTypeForm({ ...typeForm, name: e.target.value })} />
                        </div>
                        <div className="grid gap-2">
                            <Label>Days Allowed (Per Year)</Label>
                            <Input type="number" value={typeForm.days_allowed_per_year} onChange={e => setTypeForm({ ...typeForm, days_allowed_per_year: Number(e.target.value) })} />
                        </div>
                        <div className="flex items-center space-x-2">
                            <Switch checked={typeForm.is_paid} onCheckedChange={checked => setTypeForm({ ...typeForm, is_paid: checked })} />
                            <Label>Paid Leave (Salary Deducted if Unchecked)</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsTypeDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveType}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Balance Edit Dialog */}
            <Dialog open={isBalanceDialogOpen} onOpenChange={setIsBalanceDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Adjust Balance</DialogTitle>
                        <DialogDescription>Manually override balance and used days.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid gap-2">
                            <Label>Total Quota (Days)</Label>
                            <Input type="number" value={balanceForm.balance} onChange={e => setBalanceForm({ ...balanceForm, balance: Number(e.target.value) })} />
                        </div>
                        <div className="grid gap-2">
                            <Label>Used Days</Label>
                            <Input type="number" value={balanceForm.used} onChange={e => setBalanceForm({ ...balanceForm, used: Number(e.target.value) })} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsBalanceDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveBalance}>Update Balance</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Tabs>
    );
}
