import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Truck, Store, CalendarIcon, Package, Search, Copy } from 'lucide-react';
import { DispatchInfo, OrderItem } from '@/types/order';

interface DispatchFlowProps {
    mode: 'decision' | 'finalize'; // 'decision' = Sales deciding Courier/Pickup, 'finalize' = Production entering tracking
    initialData?: Partial<DispatchInfo>;
    onDataChange: (data: any) => void;
    onValidChange: (isValid: boolean) => void;
}

export function DispatchFlow({ mode, initialData, onDataChange, onValidChange }: DispatchFlowProps) {
    const [dispatchMode, setDispatchMode] = useState<'pickup' | 'courier'>('courier');

    // Courier Decision Fields
    const [courierName, setCourierName] = useState(initialData?.courier_company || '');
    const [address, setAddress] = useState(initialData?.courier_address || '');
    const [addressNotes, setAddressNotes] = useState(initialData?.courier_notes || '');
    const [isExpress, setIsExpress] = useState(false);

    // Finalize Fields
    const [trackingNumber, setTrackingNumber] = useState(initialData?.tracking_number || '');
    const [dispatchDate, setDispatchDate] = useState<Date | undefined>(initialData?.dispatch_date ? new Date(initialData.dispatch_date) : new Date());

    // Validation & Data Sync
    useEffect(() => {
        const data: any = { mode: dispatchMode };
        let isValid = false;

        if (mode === 'decision') {
            if (dispatchMode === 'pickup') {
                isValid = true; // No extra fields needed
                data.status = 'waiting_for_pickup';
                data.notes = addressNotes; // Pass notes for pickup too
            } else {
                isValid = true; // Courier info is optional for Sales decision
                data.courier_company = courierName;
                data.is_express = isExpress;
                data.address = address; // Pass address back
                data.notes = addressNotes; // Pass notes back
                data.status = 'dispatch_pending';
            }
        }
        else if (mode === 'finalize') {
            // Production finalizing dispatch
            isValid = !!courierName && !!trackingNumber && !!dispatchDate;
            data.courier_company = courierName;
            data.tracking_number = trackingNumber;
            data.dispatch_date = dispatchDate?.toISOString();
            data.status = 'dispatched';
        }

        onDataChange(data);
        onValidChange(isValid);
    }, [dispatchMode, courierName, isExpress, trackingNumber, dispatchDate, mode, address, addressNotes, onDataChange, onValidChange]);

    return (
        <div className="space-y-6 animate-in slide-in-from-top-2 duration-300">

            {/* Mode Selection (Only for Decision Mode) */}
            {mode === 'decision' && (
                <div className="space-y-4">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Dispatch Method</Label>
                    <div className="grid grid-cols-2 gap-4">
                        <div
                            onClick={() => setDispatchMode('courier')}
                            className={cn(
                                "relative flex flex-col items-center justify-center p-6 rounded-2xl border-2 cursor-pointer transition-all hover:bg-primary/5 hover:border-primary/50 group",
                                dispatchMode === 'courier'
                                    ? "border-primary bg-primary/5 shadow-md scale-[1.02]"
                                    : "border-muted bg-card hover:shadow-sm"
                            )}
                        >
                            <div className={cn(
                                "w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors",
                                dispatchMode === 'courier' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary"
                            )}>
                                <Truck className="w-6 h-6 stroke-[1.5]" />
                            </div>
                            <h3 className={cn("font-bold text-lg", dispatchMode === 'courier' ? "text-primary" : "text-foreground")}>Ship via Courier</h3>
                            <p className="text-xs text-muted-foreground text-center mt-1">Send using 3rd party logistics</p>

                            {dispatchMode === 'courier' && (
                                <div className="absolute top-3 right-3 text-primary">
                                    <div className="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center">
                                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div
                            onClick={() => setDispatchMode('pickup')}
                            className={cn(
                                "relative flex flex-col items-center justify-center p-6 rounded-2xl border-2 cursor-pointer transition-all hover:bg-amber-500/5 hover:border-amber-500/50 group",
                                dispatchMode === 'pickup'
                                    ? "border-amber-500 bg-amber-500/5 shadow-md scale-[1.02]"
                                    : "border-muted bg-card hover:shadow-sm"
                            )}
                        >
                            <div className={cn(
                                "w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors",
                                dispatchMode === 'pickup' ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground group-hover:bg-amber-500/20 group-hover:text-amber-600"
                            )}>
                                <Store className="w-6 h-6 stroke-[1.5]" />
                            </div>
                            <h3 className={cn("font-bold text-lg", dispatchMode === 'pickup' ? "text-amber-600" : "text-foreground")}>Client Pickup</h3>
                            <p className="text-xs text-muted-foreground text-center mt-1">Customer collects from factory</p>

                            {dispatchMode === 'pickup' && (
                                <div className="absolute top-3 right-3 text-amber-600">
                                    <div className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center">
                                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Courier Details Form */}
            {(dispatchMode === 'courier' || mode === 'finalize') && (
                <div className="space-y-6 pt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">

                    {/* INFO CARD (Finalize Mode) */}
                    {mode === 'finalize' && (
                        <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
                            <div className="bg-muted/30 border-b px-5 py-3 flex items-center gap-2">
                                <Package className="w-4 h-4 text-muted-foreground" />
                                <h4 className="text-sm font-semibold text-foreground">Shipment Details</h4>
                                {initialData?.is_express && (
                                    <span className="ml-auto inline-flex items-center px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px] font-bold uppercase tracking-wide">
                                        Express
                                    </span>
                                )}
                            </div>

                            <div className="p-5 space-y-5">
                                {/* Address */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Delivery Address</Label>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 gap-1.5 text-xs text-muted-foreground hover:text-primary"
                                            onClick={() => {
                                                if (initialData?.courier_address) navigator.clipboard.writeText(initialData.courier_address);
                                            }}
                                        >
                                            <Copy className="h-3 w-3" /> Copy
                                        </Button>
                                    </div>
                                    <div className="p-3.5 bg-muted/20 rounded-xl border border-border/50 text-sm leading-relaxed text-foreground/90 font-medium">
                                        {initialData?.courier_address || <span className="text-muted-foreground italic">No address provided</span>}
                                    </div>
                                </div>

                                {/* Notes */}
                                {initialData?.courier_notes && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Instructions</Label>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 gap-1.5 text-xs text-muted-foreground hover:text-primary"
                                                onClick={() => {
                                                    if (initialData?.courier_notes) navigator.clipboard.writeText(initialData.courier_notes);
                                                }}
                                            >
                                                <Copy className="h-3 w-3" /> Copy
                                            </Button>
                                        </div>
                                        <div className="p-3.5 bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 rounded-xl border border-amber-100 dark:border-amber-900/30 text-sm">
                                            {initialData.courier_notes}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ACTION FIELDS */}
                    <div className="space-y-5">
                        {/* Courier & Express Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            {/* Courier Name - Optional for Decision */}
                            <div className="space-y-2">
                                <Label className="text-sm font-medium flex items-center gap-1">
                                    Courier Service
                                    {mode === 'finalize' && <span className="text-red-500">*</span>}
                                    {mode === 'decision' && <span className="text-muted-foreground font-normal text-xs ml-auto">(Preferred)</span>}
                                </Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder={mode === 'decision' ? "Preferred Courier (Optional)" : "BlueDart, DTDC, Uber..."}
                                        className="pl-9 h-11 rounded-xl bg-background border-input/80 focus:ring-primary/20 transition-all font-medium"
                                        value={courierName}
                                        onChange={(e) => setCourierName(e.target.value)}
                                    />
                                </div>
                            </div>

                            {mode === 'finalize' && (
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium flex items-center gap-1">
                                        Tracking Number <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        placeholder="Enter AWB / Tracking #"
                                        className="h-11 rounded-xl bg-background border-input/80 focus:ring-primary/20 transition-all font-mono text-sm"
                                        value={trackingNumber}
                                        onChange={(e) => setTrackingNumber(e.target.value)}
                                    />
                                </div>
                            )}

                            {mode === 'decision' && (
                                <div className="flex items-center pt-8 px-1">
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div className="relative flex items-center">
                                            <input
                                                type="checkbox"
                                                className="peer sr-only"
                                                checked={isExpress}
                                                onChange={(e) => setIsExpress(e.target.checked)}
                                            />
                                            <div className="w-5 h-5 border-2 border-muted-foreground/30 rounded-md peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
                                                <Truck className="w-3 h-3 text-primary-foreground opacity-0 peer-checked:opacity-100 transition-opacity" />
                                            </div>
                                        </div>
                                        <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground transition-colors">Mark as Express / Urgent</span>
                                    </label>
                                </div>
                            )}
                        </div>

                        {/* Date Picker (Finalize Only) */}
                        {mode === 'finalize' && (
                            <div className="space-y-2">
                                <Label className="text-sm font-medium flex items-center gap-1">
                                    Dispatch Date <span className="text-red-500">*</span>
                                </Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full h-12 justify-start text-left font-normal rounded-xl border-input/80",
                                                !dispatchDate && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-3 h-4 w-4 text-muted-foreground" />
                                            {dispatchDate ? format(dispatchDate, "PPP") : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0 rounded-xl shadow-lg border-border/50">
                                        <Calendar
                                            mode="single"
                                            selected={dispatchDate}
                                            onSelect={setDispatchDate}
                                            initialFocus
                                            className="p-3"
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        )}

                        {/* Simplified Decision Fields */}
                        {mode === 'decision' && (
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Notes / Instructions</Label>
                                <Textarea
                                    className="min-h-[80px] rounded-xl bg-background border-input/80 focus:ring-primary/20 transition-all resize-none p-4"
                                    placeholder="Any special handling or delivery instructions..."
                                    value={addressNotes}
                                    onChange={(e) => setAddressNotes(e.target.value)}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
