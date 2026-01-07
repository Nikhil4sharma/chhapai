
import { useState } from "react";
import { format } from "date-fns";
import { FileText, Upload, Calculator, Download, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useAdminHR } from "@/features/hr/hooks/useAdminHR";
import { Badge } from "@/components/ui/badge";

export function PayrollManagement() {
    const { employees } = useAdminHR();
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth().toString());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [isProcessing, setIsProcessing] = useState(false);

    // Mock payroll calculation for UI demo
    const calculatePayroll = (baseSalary: number) => {
        if (!baseSalary) return 0;
        // Simple mock calculation: Base - PF (12%) + HRA (40%)
        return baseSalary + (baseSalary * 0.40) - (baseSalary * 0.12);
    };

    const processPayroll = () => {
        setIsProcessing(true);
        setTimeout(() => setIsProcessing(false), 2000);
    };

    const printSalarySlip = (emp: any) => {
        const baseSalary = emp.hr_employees?.[0]?.base_salary || 0;
        const hra = baseSalary * 0.40;
        const pf = baseSalary * 0.12;
        const netPayable = calculatePayroll(baseSalary);

        // Create a new window for printing
        const printWindow = window.open('', '', 'height=800,width=800');
        if (!printWindow) return;

        printWindow.document.write('<html><head><title>Salary Slip</title>');
        printWindow.document.write('<script src="https://cdn.tailwindcss.com"></script>');
        printWindow.document.write('</head><body>');
        printWindow.document.write(`
            <div class="p-8 max-w-[210mm] mx-auto border border-black min-h-[800px] font-serif">
                 <div class="text-center mb-8 border-b border-black pb-4">
                    <h1 class="text-2xl font-bold uppercase tracking-wide mb-2">Chhapai Private Limited</h1>
                    <p class="text-sm">123, Designated Industrial Park, New Delhi, India</p>
                    <h2 class="text-xl font-semibold mt-4 underline">Salary Slip</h2>
                    <p class="text-sm font-medium mt-1">For the month of ${format(date || new Date(), 'MMMM yyyy')}</p>
                </div>
                 <div class="grid grid-cols-2 gap-4 mb-6 text-sm">
                    <div>
                        <p><span class="font-bold">Name:</span> ${emp.full_name}</p>
                        <p><span class="font-bold">Role:</span> ${emp.role || 'Employee'}</p>
                    </div>
                     <div class="text-right">
                        <p><span class="font-bold">ID:</span> ${emp.user_id?.slice(0, 8).toUpperCase()}</p>
                        <p><span class="font-bold">Date:</span> ${new Date().toLocaleDateString()}</p>
                    </div>
                 </div>
                 
                 <table class="w-full border-collapse border border-black text-sm mb-8">
                    <tr>
                        <th class="border border-black p-2 bg-gray-100">EARNINGS</th>
                        <th class="border border-black p-2 bg-gray-100 text-right">AMOUNT</th>
                        <th class="border border-black p-2 bg-gray-100">DEDUCTIONS</th>
                        <th class="border border-black p-2 bg-gray-100 text-right">AMOUNT</th>
                    </tr>
                    <tr>
                        <td class="border border-black p-2">Basic Salary</td>
                        <td class="border border-black p-2 text-right">₹ ${baseSalary.toFixed(2)}</td>
                        <td class="border border-black p-2">Provident Fund (PF)</td>
                        <td class="border border-black p-2 text-right">₹ ${pf.toFixed(2)}</td>
                    </tr>
                    <tr>
                         <td class="border border-black p-2">HRA</td>
                        <td class="border border-black p-2 text-right">₹ ${hra.toFixed(2)}</td>
                         <td class="border border-black p-2">Canteen/Other</td>
                        <td class="border border-black p-2 text-right">₹ 0.00</td>
                    </tr>
                     <tr>
                        <td class="border border-black p-2 font-bold">Total Earnings</td>
                        <td class="border border-black p-2 text-right font-bold">₹ ${(baseSalary + hra).toFixed(2)}</td>
                         <td class="border border-black p-2 font-bold">Total Deductions</td>
                        <td class="border border-black p-2 text-right font-bold">₹ ${pf.toFixed(2)}</td>
                    </tr>
                 </table>
                 
                 <div class="border border-black p-4 bg-gray-50 mb-12">
                    <div class="flex justify-between items-center text-xl font-bold">
                        <span>NET PAYABLE</span>
                        <span>₹ ${netPayable.toFixed(2)}</span>
                    </div>
                 </div>
                 
                 <div class="flex justify-between mt-20 text-sm">
                    <div class="text-center">___________________<br>Employee</div>
                    <div class="text-center">___________________<br>Director</div>
                 </div>
                 
                 <div class="fixed bottom-0 w-full text-center text-[10px] text-gray-400">
                    Generated via Chhapai Admin Portal
                 </div>
            </div>
        `);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.print();
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                        <CardTitle>Payroll Processing</CardTitle>
                        <CardDescription>Manage monthly salary processing</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant={"outline"} className="w-[200px] justify-start text-left font-normal">
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {date ? format(date, "MMMM yyyy") : <span>Pick a month</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                                <Calendar
                                    mode="single"
                                    selected={date}
                                    onSelect={setDate}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                        <Button onClick={processPayroll} disabled={isProcessing}>
                            {isProcessing ? <Calculator className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
                            {isProcessing ? 'Processing' : 'Process'}
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
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Slip</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {employees?.map((emp: any) => {
                                const baseSalary = emp.hr_employees?.[0]?.base_salary || 0;
                                const netPayable = calculatePayroll(baseSalary);

                                return (
                                    <TableRow key={emp.id}>
                                        <TableCell className="font-medium">{emp.full_name}</TableCell>
                                        <TableCell>₹{baseSalary.toLocaleString()}</TableCell>
                                        <TableCell className="text-green-600">+₹{(baseSalary * 0.40).toLocaleString()}</TableCell>
                                        <TableCell className="text-red-600">-₹{(baseSalary * 0.12).toLocaleString()}</TableCell>
                                        <TableCell className="font-bold">₹{netPayable.toLocaleString()}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Processing</Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="outline" size="sm" onClick={() => printSalarySlip(emp)}>
                                                <Download className="h-4 w-4 mr-1" /> Slip
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                            {(!employees || employees.length === 0) && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                        No employees found to process payroll for.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
