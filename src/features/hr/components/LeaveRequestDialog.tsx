import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { CalendarIcon, Loader2, Info, FileText } from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useHR } from "../hooks/useHR";
import { useAuth } from "@/features/auth/context/AuthContext";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

const formSchema = z.object({
    leave_type_id: z.string().min(1, "Please select a leave type"),
    duration_type: z.enum(['full_day', 'half_day_first', 'half_day_second', 'short_morning', 'short_evening']),
    date_range: z.object({
        from: z.date(),
        to: z.date().optional(),
    }),
    reason: z.string().min(5, "Reason is required"),
});

export function LeaveRequestDialog({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const [showPolicy, setShowPolicy] = useState(false);
    const { leaveTypes, applyLeave } = useHR();
    const { user } = useAuth();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            duration_type: 'full_day',
        },
    });

    const durationType = form.watch('duration_type');

    async function onSubmit(values: z.infer<typeof formSchema>) {
        if (!user) return;

        try {
            let daysCount = 0;
            let startDate = values.date_range.from;
            let endDate = values.date_range.to || values.date_range.from;

            if (values.duration_type === 'full_day') {
                if (!values.date_range.to) {
                    daysCount = 1;
                    endDate = startDate;
                } else {
                    daysCount = Math.max(
                        1,
                        Math.ceil(
                            (values.date_range.to.getTime() - values.date_range.from.getTime()) /
                            (1000 * 60 * 60 * 24)
                        ) + 1
                    );
                }
            } else if (values.duration_type.includes('half_day')) {
                daysCount = 0.5;
                endDate = startDate;
            } else if (values.duration_type.includes('short')) {
                daysCount = 0.25;
                endDate = startDate;
            }

            if (!endDate) endDate = startDate;

            await applyLeave.mutateAsync({
                user_id: user.id,
                leave_type_id: values.leave_type_id,
                start_date: startDate.toISOString(),
                end_date: endDate.toISOString(),
                days_count: daysCount,
                reason: values.reason,
                duration_type: values.duration_type as any
            });

            toast.success("Leave request submitted successfully");
            setOpen(false);
            form.reset({
                duration_type: 'full_day'
            });
        } catch (error) {
            toast.error("Failed to submit leave request");
            console.error(error);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className={cn("sm:max-w-[800px] p-0 overflow-hidden gap-0", showPolicy ? "sm:max-w-[900px]" : "sm:max-w-[600px]")}>
                <div className="flex h-full max-h-[90vh]">
                    {/* Main Form Section */}
                    <div className="flex-1 p-6 overflow-y-auto">
                        <DialogHeader className="mb-6">
                            <div className="flex items-center justify-between">
                                <DialogTitle className="text-xl font-semibold">Apply for Leave</DialogTitle>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowPolicy(!showPolicy)}
                                    className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                                >
                                    <FileText className="w-4 h-4 mr-2" />
                                    {showPolicy ? "Hide Policy" : "View Policy"}
                                </Button>
                            </div>
                            <DialogDescription>
                                Fill in the details below to submit your leave request.
                            </DialogDescription>
                        </DialogHeader>

                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                <FormField
                                    control={form.control}
                                    name="leave_type_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-base font-medium">Leave Type</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="h-12 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                                                        <SelectValue placeholder="Select leave category" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {leaveTypes?.map((type) => (
                                                        <SelectItem key={type.id} value={type.id}>
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: type.color }} />
                                                                {type.name}
                                                                <span className="text-xs text-muted-foreground ml-2">
                                                                    ({type.days_allowed_per_year} days/yr)
                                                                </span>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="duration_type"
                                    render={({ field }) => (
                                        <FormItem>
                                            <div className="flex items-center mb-2">
                                                <FormLabel className="text-base font-medium">Duration & Timing</FormLabel>
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Info className="w-4 h-4 ml-2 text-slate-400 cursor-help" />
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>Choose the duration of your leave.</p>
                                                            <ul className="list-disc pl-4 text-xs mt-1 space-y-1">
                                                                <li>Full Day: Entire working day(s)</li>
                                                                <li>Half Day: 4 hours (Morning/Afternoon)</li>
                                                                <li>Short Leave: 2 hours (Late Coming/Early Going)</li>
                                                            </ul>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <div
                                                    className={cn(
                                                        "cursor-pointer rounded-lg border-2 p-4 transition-all hover:bg-slate-50 dark:hover:bg-slate-900",
                                                        field.value === 'full_day' ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/20" : "border-transparent bg-slate-100 dark:bg-slate-800"
                                                    )}
                                                    onClick={() => field.onChange('full_day')}
                                                >
                                                    <p className="font-semibold text-sm">Full Day</p>
                                                    <p className="text-xs text-muted-foreground mt-1">Standard leave</p>
                                                </div>

                                                <div className="space-y-2">
                                                    <div
                                                        className={cn(
                                                            "cursor-pointer rounded-lg border-2 p-3 transition-all text-center",
                                                            field.value === 'half_day_first' ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/20" : "border-transparent bg-slate-100 dark:bg-slate-800"
                                                        )}
                                                        onClick={() => field.onChange('half_day_first')}
                                                    >
                                                        <p className="text-sm font-medium">First Half</p>
                                                    </div>
                                                    <div
                                                        className={cn(
                                                            "cursor-pointer rounded-lg border-2 p-3 transition-all text-center",
                                                            field.value === 'half_day_second' ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/20" : "border-transparent bg-slate-100 dark:bg-slate-800"
                                                        )}
                                                        onClick={() => field.onChange('half_day_second')}
                                                    >
                                                        <p className="text-sm font-medium">Second Half</p>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <div
                                                        className={cn(
                                                            "cursor-pointer rounded-lg border-2 p-3 transition-all text-center",
                                                            field.value === 'short_morning' ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/20" : "border-transparent bg-slate-100 dark:bg-slate-800"
                                                        )}
                                                        onClick={() => field.onChange('short_morning')}
                                                    >
                                                        <p className="text-sm font-medium">Morning (2h)</p>
                                                    </div>
                                                    <div
                                                        className={cn(
                                                            "cursor-pointer rounded-lg border-2 p-3 transition-all text-center",
                                                            field.value === 'short_evening' ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/20" : "border-transparent bg-slate-100 dark:bg-slate-800"
                                                        )}
                                                        onClick={() => field.onChange('short_evening')}
                                                    >
                                                        <p className="text-sm font-medium">Evening (2h)</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="date_range"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel className="text-base font-medium">{durationType === 'full_day' ? 'Select Dates' : 'Select Date'}</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button
                                                            variant={"outline"}
                                                            className={cn(
                                                                "w-full pl-3 text-left font-normal h-12 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800",
                                                                !field.value && "text-muted-foreground"
                                                            )}
                                                        >
                                                            {field.value?.from ? (
                                                                durationType === 'full_day' && field.value.to ? (
                                                                    <>
                                                                        {format(field.value.from, "LLL dd, y")} -{" "}
                                                                        {format(field.value.to, "LLL dd, y")}
                                                                    </>
                                                                ) : (
                                                                    format(field.value.from, "LLL dd, y")
                                                                )
                                                            ) : (
                                                                <span>Pick a date</span>
                                                            )}
                                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar
                                                        mode={durationType === 'full_day' ? "range" : "single"}
                                                        selected={field.value as any}
                                                        onSelect={(val) => {
                                                            if (durationType === 'full_day') {
                                                                field.onChange(val);
                                                            } else {
                                                                field.onChange({ from: val, to: val });
                                                            }
                                                        }}
                                                        disabled={(date) =>
                                                            date < new Date(new Date().setHours(0, 0, 0, 0))
                                                        }
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="reason"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-base font-medium">Reason</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    placeholder="Detailed reason for your leave request..."
                                                    className="resize-none min-h-[100px] bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <Button type="submit" disabled={applyLeave.isPending} className="w-full h-12 text-base bg-indigo-600 hover:bg-indigo-700">
                                    {applyLeave.isPending && (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    )}
                                    Submit Request
                                </Button>
                            </form>
                        </Form>
                    </div>

                    {/* Policy Sidebar */}
                    <AnimatePresence>
                        {showPolicy && (
                            <motion.div
                                initial={{ width: 0, opacity: 0 }}
                                animate={{ width: "auto", opacity: 1 }}
                                exit={{ width: 0, opacity: 0 }}
                                className="border-l border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 w-full md:w-80 lg:w-96"
                            >
                                <ScrollArea className="h-full p-4 md:p-6">
                                    <h3 className="font-semibold text-base md:text-lg mb-3 md:mb-4 text-slate-800 dark:text-slate-100">Leave Policy</h3>

                                    <div className="space-y-4 md:space-y-6">
                                        <div>
                                            <h4 className="font-medium text-xs md:text-sm text-slate-900 dark:text-slate-100 mb-2">Leave Types</h4>
                                            <div className="space-y-2 md:space-y-3">
                                                {leaveTypes?.map(type => (
                                                    <div key={type.id} className="bg-white dark:bg-slate-800 p-2.5 md:p-3 rounded-md shadow-sm border border-slate-100 dark:border-slate-700">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full flex-shrink-0" style={{ backgroundColor: type.color }} />
                                                            <span className="font-medium text-xs md:text-sm truncate">{type.name}</span>
                                                        </div>
                                                        <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{type.description}</p>
                                                        <Badge variant="secondary" className="mt-1.5 md:mt-2 text-[9px] md:text-[10px] px-1.5 py-0.5">{type.days_allowed_per_year} days/year</Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <h4 className="font-medium text-xs md:text-sm text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-1.5 md:gap-2">
                                                <Info className="w-3 h-3 flex-shrink-0" />
                                                Sandwich Rule
                                            </h4>
                                            <div className="text-[10px] md:text-xs text-slate-600 dark:text-slate-400 bg-amber-50 dark:bg-amber-900/20 p-2.5 md:p-3 rounded-md border border-amber-200 dark:border-amber-800">
                                                <p className="mb-1.5 md:mb-2">If a holiday falls between two leave days, it counts as a leave.</p>
                                                <p className="font-medium mb-0.5">Example:</p>
                                                <p className="leading-relaxed">Friday (Leave) + Sunday (Holiday) + Monday (Leave) = 4 Days Leave (Fri, Sat, Sun, Mon)</p>
                                            </div>
                                        </div>
                                    </div>
                                </ScrollArea>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </DialogContent>
        </Dialog>
    );
}
