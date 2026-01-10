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
import { Truck, Store, CalendarIcon, Package, Search } from 'lucide-react';
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
    const [address, setAddress] = useState(''); // If overriding customer address? Usually use Order address.
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
            } else {
                isValid = !!courierName; // Courier name mandatory? Maybe optional at decision stage
                // Actually Sales must specify "BlueDart" or "Uber" etc?
                // Let's make Courier Name mandatory for decision if courier selected
                isValid = courierName.length > 0;
                data.courier_company = courierName;
                data.is_express = isExpress;
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
    }, [dispatchMode, courierName, isExpress, trackingNumber, dispatchDate, mode, onDataChange, onValidChange]);

    return (
        <div className="space-y-6 animate-in slide-in-from-top-2 duration-300">

            {/* Mode Selection (Only for Decision Mode) */}
            {mode === 'decision' && (
                <div className="space-y-3">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Dispatch Method</Label>
                    <RadioGroup
                        value={dispatchMode}
                        onValueChange={(v) => setDispatchMode(v as 'pickup' | 'courier')}
                        className="grid grid-cols-2 gap-4"
                    >
                        <div>
                            <RadioGroupItem value="pickup" id="pickup" className="peer sr-only" />
                            <Label
                                htmlFor="pickup"
                                className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-transparent p-4 hover:bg-muted/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 peer-data-[state=checked]:text-primary cursor-pointer transition-all"
                            >
                                <Store className="mb-3 h-6 w-6" />
                                <span className="font-semibold">Customer Pickup</span>
                            </Label>
                        </div>
                        <div>
                            <RadioGroupItem value="courier" id="courier" className="peer sr-only" />
                            <Label
                                htmlFor="courier"
                                className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-transparent p-4 hover:bg-muted/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 peer-data-[state=checked]:text-primary cursor-pointer transition-all"
                            >
                                <Truck className="mb-3 h-6 w-6" />
                                <span className="font-semibold">Courier / Delivery</span>
                            </Label>
                        </div>
                    </RadioGroup>
                </div>
            )}

            {/* Courier Details Form */}
            {(dispatchMode === 'courier' || mode === 'finalize') && (
                <div className="bg-muted/20 p-5 rounded-xl border border-border/50 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs">Courier Service <span className="text-red-500">*</span></Label>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="BlueDart, DTDC, Uber..."
                                    className="pl-9"
                                    value={courierName}
                                    onChange={(e) => setCourierName(e.target.value)}
                                />
                            </div>
                        </div>

                        {mode === 'decision' && (
                            <div className="flex items-center space-x-2 pt-8">
                                <input
                                    type="checkbox"
                                    id="express"
                                    checked={isExpress}
                                    onChange={(e) => setIsExpress(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <Label htmlFor="express" className="cursor-pointer font-normal">Mark as Express / Urgent</Label>
                            </div>
                        )}

                        {mode === 'finalize' && (
                            <div className="space-y-2">
                                <Label className="text-xs">Tracking Number <span className="text-red-500">*</span></Label>
                                <Input
                                    placeholder="AWB / Tracking #"
                                    value={trackingNumber}
                                    onChange={(e) => setTrackingNumber(e.target.value)}
                                />
                            </div>
                        )}
                    </div>

                    {mode === 'finalize' && (
                        <div className="space-y-2">
                            <Label className="text-xs">Dispatch Date <span className="text-red-500">*</span></Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !dispatchDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dispatchDate ? format(dispatchDate, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={dispatchDate}
                                        onSelect={setDispatchDate}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
