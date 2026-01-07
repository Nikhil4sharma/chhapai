
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { financeService } from '@/services/financeService';
import { toast } from 'sonner';
import { Loader2, IndianRupee, CreditCard, Banknote, Smartphone, Globe } from 'lucide-react';
import { PaymentMethod } from '@/types/finance';

interface AddPaymentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    customerId: string;
    customerName: string;
    linkedOrderId?: string; // Optional: if making a payment for a specific order
    onSuccess?: () => void;
}

export function AddPaymentDialog({ open, onOpenChange, customerId, customerName, linkedOrderId, onSuccess }: AddPaymentDialogProps) {
    const [amount, setAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('online');
    const [note, setNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [mode, setMode] = useState<'credit' | 'order'>('credit'); // credit = general deposit, order = pay for order

    // If linkedOrderId is provided, default to order payment mode
    useEffect(() => {
        if (open) {
            setAmount('');
            setNote('');
            if (linkedOrderId) {
                setMode('order');
                setNote(`Payment for Order #${linkedOrderId}`);
            } else {
                setMode('credit');
                setNote('Advance Payment');
            }
        }
    }, [open, linkedOrderId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            toast.error("Please enter a valid amount");
            return;
        }

        setIsSubmitting(true);
        try {
            // If mode is 'order', we link it. If 'credit', we don't.
            // Note: Even for 'order', we might want to Add Credit first then Apply Debit?
            // The service addPayment supports linkedOrderId to do both.

            await financeService.addPayment(
                customerId,
                Number(amount),
                paymentMethod,
                note,
                mode === 'order' ? linkedOrderId : undefined
            );

            toast.success(mode === 'order'
                ? `Payment of ₹${amount} received and applied to order.`
                : `₹${amount} added to customer wallet.`
            );
            onSuccess?.();
            onOpenChange(false);
        } catch (error: any) {
            console.error("Payment failed", error);
            toast.error(error.message || "Failed to record payment");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Receive Payment</DialogTitle>
                    <DialogDescription>
                        Record a payment from {customerName}.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {!linkedOrderId && (
                        <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="credit">Add to Wallet (Advance)</TabsTrigger>
                                <TabsTrigger value="order" disabled>Pay Specific Order</TabsTrigger> {/* Disabled if no order selected */}
                            </TabsList>
                        </Tabs>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="amount">Amount (₹)</Label>
                        <div className="relative">
                            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="amount"
                                type="number"
                                placeholder="0.00"
                                className="pl-9 text-lg font-bold"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                min="1"
                                step="any"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Payment Method</Label>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { id: 'cash', label: 'Cash', icon: Banknote },
                                { id: 'upi', label: 'UPI', icon: Smartphone },
                                { id: 'bank', label: 'Bank Transfer', icon: Globe }, // Use Globe for now
                                { id: 'online', label: 'Online / Card', icon: CreditCard },
                            ].map((m) => (
                                <div
                                    key={m.id}
                                    onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                                    className={`cursor-pointer flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${paymentMethod === m.id
                                            ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/20 dark:border-blue-500 dark:text-blue-300'
                                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400'
                                        }`}
                                >
                                    <m.icon className="h-5 w-5 mb-1" />
                                    <span className="text-xs font-medium">{m.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="note">Reference Note</Label>
                        <Input
                            id="note"
                            placeholder="e.g. Transaction ID, Check #, 'Advance for X'..."
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting || !amount}>
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Confirm Payment
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
