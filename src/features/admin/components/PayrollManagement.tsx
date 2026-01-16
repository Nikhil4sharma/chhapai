import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Calculator, Save, CheckCircle2, AlertCircle, Edit2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useAdminHR } from "@/features/hr/hooks/useAdminHR";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export function PayrollManagement() {
    const { employees, updateBaseSalary, createPayrollRecord, isLoading } = useAdminHR();
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [isProcessing, setIsProcessing] = useState(false);

    // State for salary editing
    const [editSalaryId, setEditSalaryId] = useState<string | null>(null);
    const [editSalaryAmount, setEditSalaryAmount] = useState<string>("");

    // State for payroll additions/deductions per user (temporary state for calculation)
    const [payrollAdjustments, setPayrollAdjustments] = useState<Record<string, { additions: any[], deductions: any[] }>>({});

    const handleUpdateSalary = async (userId: string) => {
        const amount = parseFloat(editSalaryAmount);
        if (isNaN(amount) || amount < 0) return toast.error("Invalid salary amount");

        try {
            await updateBaseSalary.mutateAsync({ user_id: userId, amount });
            toast.success("Salary updated successfully");
            setEditSalaryId(null);
        } catch (error) {
            toast.error("Failed to update salary");
        }
    };

    const handleProcessPayroll = async () => {
        setIsProcessing(true);
        let processedCount = 0;

        try {
            for (const emp of employees || []) {
                const baseSalary = emp.hr_profiles?.[0]?.base_salary || 0;
                if (!baseSalary) continue;

                const adjustments = payrollAdjustments[emp.user_id] || { additions: [], deductions: [] };

                // Calculate Totals
                const totalAdditions = adjustments.additions.reduce((sum, item) => sum + item.amount, 0);
                const totalDeductions = adjustments.deductions.reduce((sum, item) => sum + item.amount, 0);

                // Standard Deductions (e.g. PF if applicable, mocked for now or use adjustments)
                // For this robust system, we assume admin manually adds deductions for now, or we can auto-add PF.
                // Let's stick to base + manual additions - manual deductions for flexibility.

                const netPayable = baseSalary + totalAdditions - totalDeductions;

                await createPayrollRecord.mutateAsync({
                    user_id: emp.user_id,
                    year: selectedYear,
                    month: selectedMonth + 1, // 1-12
                    base_salary: baseSalary,
                    additions: adjustments.additions,
                    deductions: adjustments.deductions,
                    total_payable: netPayable
                });

                processedCount++;
            }
            toast.success(`Payroll processed for ${processedCount} employees.`);
        } catch (error) {
            console.error(error);
            toast.error("Failed to process payroll. Some records might have failed.");
        } finally {
            setIsProcessing(false);
        }
    };

    // Helper to add adjustment
    const addAdjustment = (userId: string, type: 'additions' | 'deductions', description: string, amount: number) => {
        setPayrollAdjustments(prev => {
            const userAdj = prev[userId] || { additions: [], deductions: [] };
            return {
                ...prev,
                [userId]: {
                    ...userAdj,
                    [type]: [...userAdj[type], { description, amount }]
                }
            };
        });
    };

    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i); // 5 years range

    return (
        <div className="space-y-6">
            <Tabs defaultValue="structure" className="w-full">
                <TabsList>
                    <TabsTrigger value="structure">Salary Structure</TabsTrigger>
                    <TabsTrigger value="process">Process Payroll</TabsTrigger>
                </TabsList>

                {/* TAB 1: SALARY STRUCTURE */}
                <TabsContent value="structure">
                    <Card>
                        <CardHeader>
                            <CardTitle>Employee Salary Structure</CardTitle>
                            <CardDescription>Manage base salaries for all employees.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Employee</TableHead>
                                            <TableHead>Department</TableHead>
                                            <TableHead>Designation</TableHead>
                                            <TableHead>Base Salary (Monthly)</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {employees?.map((emp: any) => {
                                            const hrProfile = emp.hr_profiles?.[0];
                                            const isEditing = editSalaryId === emp.user_id;

                                            return (
                                                <TableRow key={emp.id}>
                                                    <TableCell className="font-medium">{emp.full_name}</TableCell>
                                                    <TableCell>{hrProfile?.department || "-"}</TableCell>
                                                    <TableCell>{hrProfile?.designation || "-"}</TableCell>
                                                    <TableCell>
                                                        {isEditing ? (
                                                            <Input
                                                                type="number"
                                                                value={editSalaryAmount}
                                                                onChange={(e) => setEditSalaryAmount(e.target.value)}
                                                                className="w-[120px]"
                                                            />
                                                        ) : (
                                                            <span className="font-mono">₹{(hrProfile?.base_salary || 0).toLocaleString()}</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {isEditing ? (
                                                            <div className="flex justify-end gap-2">
                                                                <Button size="sm" onClick={() => handleUpdateSalary(emp.user_id)}>Save</Button>
                                                                <Button size="sm" variant="ghost" onClick={() => setEditSalaryId(null)}>Cancel</Button>
                                                            </div>
                                                        ) : (
                                                            <Button size="sm" variant="outline" onClick={() => {
                                                                setEditSalaryId(emp.user_id);
                                                                setEditSalaryAmount((hrProfile?.base_salary || 0).toString());
                                                            }}>
                                                                <Edit2 className="h-4 w-4 mr-2" /> Edit
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 2: PROCESS PAYROLL */}
                <TabsContent value="process">
                    <Card>
                        <CardHeader>
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div>
                                    <CardTitle>Run Payroll</CardTitle>
                                    <CardDescription>Calculate and generate payroll records for the selected month.</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                                        <SelectTrigger className="w-[140px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {months.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                                        <SelectTrigger className="w-[100px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <Button onClick={handleProcessPayroll} disabled={isProcessing} className="bg-green-600 hover:bg-green-700">
                                        {isProcessing ? <Calculator className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
                                        Run Payroll
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
                                            <TableHead>Base Salary</TableHead>
                                            <TableHead>Additions</TableHead>
                                            <TableHead>Deductions</TableHead>
                                            <TableHead>Net Payable</TableHead>
                                            <TableHead className="text-right">Adjustments</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {employees?.map((emp: any) => {
                                            const baseSalary = emp.hr_profiles?.[0]?.base_salary || 0;
                                            const adj = payrollAdjustments[emp.user_id] || { additions: [], deductions: [] };
                                            const totalAdd = adj.additions.reduce((sum, i) => sum + i.amount, 0);
                                            const totalDed = adj.deductions.reduce((sum, i) => sum + i.amount, 0);
                                            const netWithAdj = baseSalary + totalAdd - totalDed;

                                            return (
                                                <TableRow key={emp.id}>
                                                    <TableCell className="font-medium">
                                                        {emp.full_name}
                                                        <div className="text-xs text-muted-foreground">{emp.hr_profiles?.[0]?.designation}</div>
                                                    </TableCell>
                                                    <TableCell>₹{baseSalary.toLocaleString()}</TableCell>
                                                    <TableCell className="text-green-600">
                                                        {totalAdd > 0 ? `+₹${totalAdd.toLocaleString()}` : "-"}
                                                        {adj.additions.map((a, i) => (
                                                            <div key={i} className="text-[10px] text-green-700">{a.description}</div>
                                                        ))}
                                                    </TableCell>
                                                    <TableCell className="text-red-600">
                                                        {totalDed > 0 ? `-₹${totalDed.toLocaleString()}` : "-"}
                                                        {adj.deductions.map((d, i) => (
                                                            <div key={i} className="text-[10px] text-red-700">{d.description}</div>
                                                        ))}
                                                    </TableCell>
                                                    <TableCell className="font-bold text-lg">₹{netWithAdj.toLocaleString()}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-1">
                                                            <Dialog>
                                                                <DialogTrigger asChild>
                                                                    <Button variant="outline" size="xs" className="h-7 text-xs">+ Add</Button>
                                                                </DialogTrigger>
                                                                <DialogContent>
                                                                    <DialogHeader>
                                                                        <DialogTitle>Add Adjustment for {emp.full_name}</DialogTitle>
                                                                    </DialogHeader>
                                                                    <AddAdjustmentForm onAdd={(type, desc, amt) => addAdjustment(emp.user_id, type, desc, amt)} />
                                                                </DialogContent>
                                                            </Dialog>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

function AddAdjustmentForm({ onAdd }: { onAdd: (type: 'additions' | 'deductions', desc: string, amt: number) => void }) {
    const [type, setType] = useState<'additions' | 'deductions'>('additions');
    const [desc, setDesc] = useState("");
    const [amount, setAmount] = useState("");

    return (
        <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={type} onValueChange={(v: any) => setType(v)}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="additions">Addition (Bonus, etc.)</SelectItem>
                            <SelectItem value="deductions">Deduction (PF, Tax)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Amount</Label>
                    <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
                </div>
            </div>
            <div className="space-y-2">
                <Label>Description</Label>
                <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. Performance Bonus" />
            </div>
            <DialogFooter>
                <Button onClick={() => {
                    if (desc && amount) {
                        onAdd(type, desc, parseFloat(amount));
                        setDesc("");
                        setAmount("");
                    }
                }}>Add</Button>
            </DialogFooter>
        </div>
    );
}
