import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { computePriority } from './utils';

interface OrderSummaryProps {
    deliveryDate: Date | undefined;
    setDeliveryDate: (date: Date | undefined) => void;
    globalNotes: string;
    setGlobalNotes: (notes: string) => void;
    isGST: boolean;
    setIsGST: (value: boolean) => void;
    isWooCommerceOrder: boolean;
}

export function OrderSummary({
    deliveryDate,
    setDeliveryDate,
    globalNotes,
    setGlobalNotes,
    isGST,
    setIsGST,
    isWooCommerceOrder
}: OrderSummaryProps) {
    const priority = computePriority(deliveryDate);

    return (
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="bg-blue-50/50 dark:bg-blue-950/20 px-4 sm:px-6 py-3 border-b border-blue-100 dark:border-blue-900/50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-blue-900 dark:text-blue-100">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500 shadow-sm">
                        <Calendar className="h-4 w-4 text-white" />
                    </div>
                    Delivery & Instructions
                </div>
            </div>
            <CardContent className="p-4 sm:p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="delivery_date" className="text-sm font-medium after:content-['*'] after:ml-0.5 after:text-red-500">
                            Delivery Date
                        </Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    id="delivery_date"
                                    variant="outline"
                                    className={cn(
                                        "w-full h-11 justify-start text-left font-normal border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all shadow-sm",
                                        !deliveryDate && "text-slate-400"
                                    )}
                                >
                                    <Calendar className="mr-2 h-4 w-4 text-blue-500" />
                                    {deliveryDate ? format(deliveryDate, "PPP") : "Select target date"}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <CalendarPicker
                                    mode="single"
                                    selected={deliveryDate}
                                    onSelect={setDeliveryDate}
                                    initialFocus
                                    className="rounded-md border border-slate-200 dark:border-slate-800 shadow-xl"
                                />
                            </PopoverContent>
                        </Popover>
                        {deliveryDate && (
                            <div className="flex items-center gap-2 mt-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-900/50 w-fit">
                                <div className={cn(
                                    "h-2 w-2 rounded-full",
                                    priority === 'red' ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" :
                                        priority === 'yellow' ? "bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]" :
                                            "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                                )} />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                    Priority: {priority.toUpperCase()}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes" className="text-sm font-medium">Order Instructions / Notes</Label>
                        <div className="relative group/notes">
                            <Textarea
                                id="notes"
                                placeholder="Enter any special packaging or delivery instructions..."
                                value={globalNotes}
                                onChange={(e) => setGlobalNotes(e.target.value)}
                                rows={4}
                                className="min-h-[120px] border-slate-200 dark:border-slate-800 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none bg-slate-50/30 dark:bg-slate-950/30"
                            />
                        </div>
                    </div>

                    {/* Only show GST toggle for manual orders */}
                    {!isWooCommerceOrder && (
                        <div className="flex items-center space-x-2">
                            <Label htmlFor="gst-mode" className="text-sm font-medium">Include 18% GST</Label>
                            <Switch id="gst-mode" checked={isGST} onCheckedChange={setIsGST} />
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
