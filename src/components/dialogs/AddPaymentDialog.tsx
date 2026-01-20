
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { financeService } from '@/services/financeService';
import { toast } from 'sonner';
import { Loader2, IndianRupee, CreditCard, Banknote, Smartphone, Globe, ArrowRight, Wallet, ShoppingBag } from 'lucide-react';
import { PaymentMethod } from '@/types/finance';
import { WCOrder } from '@/services/woocommerce';

interface AddPaymentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    customerId: string;
    customerName: string;
    linkedOrderId?: string;
    orders?: WCOrder[];
    onSuccess?: () => void;
}

export function AddPaymentDialog({ open, onOpenChange, customerId, customerName, linkedOrderId, orders = [], onSuccess }: AddPaymentDialogProps) {
    const [amount, setAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('online');
    const [note, setNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [mode, setMode] = useState<'credit' | 'order'>('credit');
    const [selectedOrderId, setSelectedOrderId] = useState<string>('');

    // Filter for unpaid orders
    const unpaidOrders = (orders || []).filter(o => o.status !== 'completed' && o.status !== 'cancelled' && o.status !== 'refunded');

    useEffect(() => {
        if (open) {
            setAmount('');
            setIsSubmitting(false);

            if (linkedOrderId) {
                setMode('order');
                setSelectedOrderId(linkedOrderId);
                const linkedOrder = orders.find(o => String(o.id) === linkedOrderId || o.number === linkedOrderId);
                // Auto-fill remaining amount if known
                if (linkedOrder) {
                    setAmount(String(Math.ceil(parseFloat(linkedOrder.total)))); // Simple total for now, pending would be better if passed
                }
                setNote(`Payment for Order #${linkedOrderId}`);
            } else {
                setMode('credit');
                setSelectedOrderId('');
                setNote('Advance Payment');
            }
        }
    }, [open, linkedOrderId, orders]);

    // Derived State
    const isNegative = parseFloat(amount) < 0;
    const isAmountValid = amount && !isNaN(Number(amount)) && Number(amount) !== 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isAmountValid) {
            toast.error("Please enter a valid amount");
            return;
        }

        setIsSubmitting(true);
        try {
            const targetOrderId = mode === 'order' ? selectedOrderId : undefined;

            // If mode is order, we must resolve the UUID if we only have the numeric ID selected
            // But wait, selectedOrderId corresponds to whatever we put in <SelectItem value=...>
            // Let's ensure selectedOrderId IS the UUID if available.
            // Or better: Lookup order by selectedOrderId and get its UUID.

            let finalTargetId = targetOrderId;
            if (mode === 'order' && targetOrderId) {
                const selectedOrder = orders.find(o => String(o.id) === targetOrderId);
                if (selectedOrder?.uuid) {
                    finalTargetId = selectedOrder.uuid;
                } else if (selectedOrder) {
                    console.warn("Selected order has no UUID, payment might fail if FK enforced", selectedOrder);
                }
            }

            if (mode === 'order' && !finalTargetId) {
                toast.error("Please select an order to pay");
                setIsSubmitting(false);
                return;
            }

            // Auto-adjust note for debits if empty
            let finalNote = note;
            if (isNegative && !note) {
                finalNote = "Debit / Adjustment";
            }

            await financeService.addPayment(
                customerId,
                Number(amount),
                paymentMethod,
                finalNote,
                finalTargetId
            );

            toast.success(Number(amount) > 0
                ? `Payment of ₹${amount} recorded successfully`
                : `Debit of ₹${Math.abs(Number(amount))} recorded successfully`
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
            <DialogContent className="sm:max-w-md bg-white dark:bg-slate-950 p-0 gap-0 overflow-hidden border-none shadow-2xl">
                {/* Header */}
                <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 p-6 pb-4">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            {isNegative ? (
                                <div className="bg-red-100 text-red-600 p-1.5 rounded-lg"><ArrowRight className="h-5 w-5 rotate-45" /></div>
                            ) : (
                                <div className="bg-emerald-100 text-emerald-600 p-1.5 rounded-lg"><ArrowRight className="h-5 w-5 -rotate-45" /></div>
                            )}
                            {isNegative ? "Record Debit" : "Receive Payment"}
                        </DialogTitle>
                        <DialogDescription className="text-slate-500">
                            {isNegative
                                ? `Deducting amount from ${customerName}'s balance.`
                                : `Recording payment from ${customerName}.`
                            }
                        </DialogDescription>
                    </DialogHeader>

                    <div className="mt-6">
                        <Tabs value={mode} onValueChange={(v) => {
                            setMode(v as any);
                            setNote(v === 'credit' ? 'Advance Payment' : `Payment for Order #${unpaidOrders[0]?.number || '...'}`);
                            if (v === 'order' && unpaidOrders.length > 0) setSelectedOrderId(unpaidOrders[0].id.toString()); // Default to first unpaid
                        }} className="w-full">
                            <TabsList className="grid w-full grid-cols-2 h-10 bg-slate-200/50 dark:bg-slate-800 p-1 rounded-xl">
                                <TabsTrigger value="credit" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 font-medium">Add to Wallet</TabsTrigger>
                                <TabsTrigger value="order" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 font-medium">Pay Specific Order</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">

                    {mode === 'order' && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                            <Label htmlFor="order-select" className="text-xs font-semibold uppercase text-slate-500 tracking-wide">Select Order</Label>
                            <Select value={selectedOrderId} onValueChange={(val) => {
                                setSelectedOrderId(val);
                                const order = orders.find(o => String(o.id) === val);
                                if (order) {
                                    setNote(`Payment for Order #${order.number}`);
                                    setAmount(String(Math.ceil(parseFloat(order.total))));
                                }
                            }}>
                                <SelectTrigger className="w-full h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                                    <SelectValue placeholder="Select an unpaid order..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {unpaidOrders.length > 0 ? (
                                        unpaidOrders.map(order => (
                                            <SelectItem key={order.id} value={String(order.id)} className="py-3">
                                                <div className="flex justify-between w-full gap-4">
                                                    <span className="font-medium">Order #{order.number}</span>
                                                    <span className="text-muted-foreground">₹{order.total}</span>
                                                </div>
                                            </SelectItem>
                                        ))
                                    ) : (
                                        <div className="p-2 text-sm text-center text-muted-foreground">No unpaid orders found</div>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="amount" className="text-xs font-semibold uppercase text-slate-500 tracking-wide">Amount (₹)</Label>
                        <div className="relative group">
                            <div className={`absolute left-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${isNegative ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
                                }`}>
                                <IndianRupee className="h-4 w-4" />
                            </div>
                            <Input
                                id="amount"
                                type="number"
                                placeholder="0.00"
                                className={`pl-14 h-14 text-xl font-bold transition-all ${isNegative
                                    ? 'text-red-600 border-red-200 focus-visible:ring-red-500/20 bg-red-50/10'
                                    : 'text-emerald-700 border-slate-200 focus-visible:ring-emerald-500/20 bg-emerald-50/10'
                                    }`}
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                step="any"
                                autoFocus
                            />
                            {isNegative && (
                                <p className="text-[10px] text-red-500 font-medium absolute right-3 top-1/2 -translate-y-1/2 bg-white dark:bg-slate-900 px-2 py-1 rounded shadow-sm border border-red-100">Debit Mode</p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase text-slate-500 tracking-wide">Payment Method</Label>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { id: 'online', label: 'Online / Card', icon: CreditCard },
                                { id: 'upi', label: 'UPI', icon: Smartphone },
                                { id: 'cash', label: 'Cash', icon: Banknote },
                                { id: 'bank', label: 'Bank Transfer', icon: Globe },
                            ].map((m) => (
                                <div
                                    key={m.id}
                                    onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                                    className={`cursor-pointer flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 ${paymentMethod === m.id
                                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm dark:bg-indigo-900/20 dark:border-indigo-500 dark:text-indigo-300'
                                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800'
                                        }`}
                                >
                                    <m.icon className={`h-5 w-5 mb-1.5 ${paymentMethod === m.id ? 'stroke-2' : 'stroke-1.5'}`} />
                                    <span className="text-xs font-medium">{m.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="note" className="text-xs font-semibold uppercase text-slate-500 tracking-wide">Reference Note</Label>
                        <Input
                            id="note"
                            placeholder="e.g. Transaction ID, Check #, 'Advance'..."
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="h-10 border-slate-200 focus-visible:ring-indigo-500/20"
                        />
                    </div>

                    <DialogFooter className="pt-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-11 rounded-lg border-slate-200 hover:bg-slate-50 hover:text-slate-900 font-medium">Cancel</Button>
                        <Button type="submit" disabled={isSubmitting || !isAmountValid} className={`h-11 rounded-lg px-8 font-semibold shadow-lg transition-all ${isNegative
                            ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-200 dark:shadow-none'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 dark:shadow-none'
                            }`}>
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            {isNegative ? 'Record Debit' : 'Confirm Payment'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
