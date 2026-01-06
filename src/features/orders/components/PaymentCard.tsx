import { useState } from 'react';
import { ChevronDown, ChevronUp, CreditCard, IndianRupee, Plus, Copy, Check } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from '@/components/ui/dialog';
import { Order } from '@/types/order';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface PaymentCardProps {
    order: Order;
    canView: boolean;
    onUpdatePayment?: (amount: number, mode: string) => Promise<void>;
}

export function PaymentCard({ order, canView, onUpdatePayment }: PaymentCardProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isAddingPayment, setIsAddingPayment] = useState(false);
    const [amount, setAmount] = useState('');
    const [paymentMode, setPaymentMode] = useState('cash');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { financials } = order;

    if (!canView) {
        return null;
    }

    const formatCurrency = (amount?: number) => {
        if (!amount) return '₹0';
        return `₹${amount.toLocaleString('en-IN')}`;
    };

    const paymentStatus = financials?.payment_status || 'pending';
    const statusColors = {
        paid: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400 border-green-200',
        pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400 border-yellow-200',
        processing: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 border-blue-200',
        partial: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400 border-orange-200',
    };

    const totalAmount = financials?.total || 0;
    const receivedAmount = financials?.amount_received || 0;
    const pendingAmount = totalAmount - receivedAmount;

    const handleAddPayment = async () => {
        if (!amount || parseFloat(amount) <= 0) {
            toast({
                title: 'Invalid Amount',
                description: 'Please enter a valid amount',
                variant: 'destructive',
            });
            return;
        }

        if (parseFloat(amount) > pendingAmount) {
            toast({
                title: 'Amount Too High',
                description: `Amount cannot exceed pending amount of ${formatCurrency(pendingAmount)}`,
                variant: 'destructive',
            });
            return;
        }

        setIsSubmitting(true);
        try {
            if (onUpdatePayment) {
                await onUpdatePayment(parseFloat(amount), paymentMode);
            }
            toast({
                title: 'Payment Added',
                description: `${formatCurrency(parseFloat(amount))} received via ${paymentMode}`,
            });
            setAmount('');
            setIsAddingPayment(false);
        } catch (error) {
            toast({
                title: 'Failed to add payment',
                description: 'Please try again',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Card>
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CardHeader className="pb-3">
                    <CollapsibleTrigger asChild>
                        <Button
                            variant="ghost"
                            className="w-full justify-between p-0 h-auto hover:bg-transparent"
                        >
                            <div className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4 text-muted-foreground" />
                                <h3 className="font-semibold text-sm">Payment Details</h3>
                            </div>
                            {isOpen ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                        </Button>
                    </CollapsibleTrigger>
                </CardHeader>

                <CollapsibleContent>
                    <CardContent className="space-y-4 pt-0">
                        {/* Payment Status */}
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Status</span>
                            <Badge className={cn("border", statusColors[paymentStatus as keyof typeof statusColors] || statusColors.pending)}>
                                {paymentStatus.toUpperCase()}
                            </Badge>
                        </div>

                        {/* Financial Details */}
                        {financials && (
                            <div className="space-y-3 pt-3 border-t">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Total Amount</span>
                                    <span className="font-semibold text-lg">{formatCurrency(financials.total)}</span>
                                </div>

                                {(financials.tax_cgst !== undefined || financials.tax_sgst !== undefined) && (
                                    <div className="space-y-2 text-xs">
                                        {financials.tax_cgst !== undefined && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-muted-foreground">CGST</span>
                                                <span>{formatCurrency(financials.tax_cgst)}</span>
                                            </div>
                                        )}
                                        {financials.tax_sgst !== undefined && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-muted-foreground">SGST</span>
                                                <span>{formatCurrency(financials.tax_sgst)}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex items-center justify-between text-sm pt-2 border-t">
                                    <span className="text-muted-foreground">Received</span>
                                    <span className="font-semibold text-green-600 dark:text-green-400">
                                        {formatCurrency(financials.amount_received)}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Pending</span>
                                    <span className="font-semibold text-yellow-600 dark:text-yellow-400">
                                        {formatCurrency(pendingAmount)}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Add Payment Button */}
                        {pendingAmount > 0 && onUpdatePayment && (
                            <Dialog open={isAddingPayment} onOpenChange={setIsAddingPayment}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="w-full mt-2">
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Payment
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Add Payment</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="amount">Amount Received</Label>
                                            <div className="relative">
                                                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    id="amount"
                                                    type="number"
                                                    placeholder="0.00"
                                                    value={amount}
                                                    onChange={(e) => setAmount(e.target.value)}
                                                    className="pl-10"
                                                    max={pendingAmount}
                                                />
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Pending: {formatCurrency(pendingAmount)}
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="mode">Payment Mode</Label>
                                            <Select value={paymentMode} onValueChange={setPaymentMode}>
                                                <SelectTrigger id="mode">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="cash">Cash</SelectItem>
                                                    <SelectItem value="upi">UPI</SelectItem>
                                                    <SelectItem value="card">Card</SelectItem>
                                                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                                    <SelectItem value="cheque">Cheque</SelectItem>
                                                    <SelectItem value="other">Other</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setIsAddingPayment(false)}>
                                            Cancel
                                        </Button>
                                        <Button onClick={handleAddPayment} disabled={isSubmitting}>
                                            {isSubmitting ? 'Adding...' : 'Add Payment'}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}

                        {!financials && (
                            <p className="text-sm text-muted-foreground text-center py-2">
                                No payment information available
                            </p>
                        )}
                    </CardContent>
                </CollapsibleContent>
            </Collapsible>
        </Card>
    );
}
