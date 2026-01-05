
import { forwardRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface SalarySlipProps {
    employeeName: string;
    employeeId: string;
    department: string;
    month: string;
    year: number;
    basicSalary: number;
    hra: number;
    pf: number;
    totalEarnings: number;
    totalDeductions: number;
    netPay: number;
}

export const SalarySlip = forwardRef<HTMLDivElement, SalarySlipProps>((props, ref) => {
    return (
        <div ref={ref} className="p-8 max-w-[210mm] mx-auto bg-white text-black print:p-0">
            <div className="border border-black p-4 min-h-[500px]">
                {/* Header */}
                <div className="text-center mb-8 border-b border-black pb-4">
                    <h1 className="text-2xl font-bold uppercase tracking-wide mb-2">Chhapai Private Limited</h1>
                    <p className="text-sm">123, Designated Industrial Park, New Delhi, India</p>
                    <h2 className="text-xl font-semibold mt-4 underline">Salary Slip</h2>
                    <p className="text-sm font-medium mt-1">For the month of {props.month} {props.year}</p>
                </div>

                {/* Employee Details */}
                <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                    <div>
                        <p><span className="font-bold">Employee Name:</span> {props.employeeName}</p>
                        <p><span className="font-bold">Designation:</span> {props.department}</p>
                        <p><span className="font-bold">Bank Name:</span> HDFC Bank (Mock)</p>
                    </div>
                    <div className="text-right">
                        <p><span className="font-bold">Employee ID:</span> {props.employeeId.slice(0, 8).toUpperCase()}</p>
                        <p><span className="font-bold">Date of Joining:</span> 01/01/2024</p>
                        <p><span className="font-bold">Account No:</span> ************1234</p>
                    </div>
                </div>

                <Separator className="bg-black my-4" />

                {/* Earnings & Deductions Table */}
                <div className="grid grid-cols-2 border border-black text-sm">
                    {/* Header */}
                    <div className="border-r border-black p-2 font-bold bg-gray-100 text-center">EARNINGS</div>
                    <div className="p-2 font-bold bg-gray-100 text-center">DEDUCTIONS</div>

                    {/* Row 1 */}
                    <div className="border-r border-black border-t border-black p-2 flex justify-between">
                        <span>Basic Salary</span>
                        <span>₹ {props.basicSalary.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-black p-2 flex justify-between">
                        <span>Provident Fund (PF)</span>
                        <span>₹ {props.pf.toFixed(2)}</span>
                    </div>

                    {/* Row 2 */}
                    <div className="border-r border-black border-t border-black p-2 flex justify-between">
                        <span>HRA (House Rent Allow.)</span>
                        <span>₹ {props.hra.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-black p-2 flex justify-between">
                        <span>Professional Tax</span>
                        <span>₹ 0.00</span>
                    </div>

                    {/* Row 3 */}
                    <div className="border-r border-black border-t border-black p-2 flex justify-between">
                        <span>Special Allowance</span>
                        <span>₹ 0.00</span>
                    </div>
                    <div className="border-t border-black p-2 flex justify-between">
                        <span>Income Tax (TDS)</span>
                        <span>₹ 0.00</span>
                    </div>

                    {/* Total */}
                    <div className="border-r border-black border-t border-black p-2 flex justify-between font-bold bg-gray-50">
                        <span>Total Earnings</span>
                        <span>₹ {props.totalEarnings.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-black p-2 flex justify-between font-bold bg-gray-50">
                        <span>Total Deductions</span>
                        <span>₹ {props.totalDeductions.toFixed(2)}</span>
                    </div>
                </div>

                <div className="mt-8 border border-black p-4 bg-gray-50">
                    <div className="flex justify-between items-center">
                        <span className="text-lg font-bold">NET PAYABLE:</span>
                        <span className="text-2xl font-bold">₹ {props.netPay.toFixed(2)}</span>
                    </div>
                    <p className="text-xs mt-2 italic capitalize">
                        (Amount in words: {convertNumberToWords(Math.round(props.netPay))} Rupees Only)
                    </p>
                </div>

                <div className="mt-16 flex justify-between text-sm">
                    <div className="text-center">
                        <p className="mb-8">__________________________</p>
                        <p>Employee Signature</p>
                    </div>
                    <div className="text-center">
                        <p className="mb-8 font-bold">Authorized Signatory</p>
                        <p>Director, Chhapai Pvt Ltd</p>
                    </div>
                </div>

                <div className="mt-12 text-center text-[10px] text-gray-500">
                    This is a computer-generated document and does not require a physical signature.
                    Generated via Chhapai Admin Portal.
                </div>
            </div>
        </div>
    );
});

// Simple number to words converter for Indian context
function convertNumberToWords(amount: number): string {
    return "Amount computed automatically"; // Placeholder for complex logic, keeping it simple for now
}
