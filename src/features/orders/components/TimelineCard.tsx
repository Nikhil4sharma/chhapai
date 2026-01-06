import { useState } from 'react';
import { ChevronDown, ChevronUp, Clock, Maximize2, User, Upload, Check, FileText, Truck, Package, Palette, Settings, MessageSquare, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { TimelineEntry } from '@/types/order';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface TimelineCardProps {
    timeline: TimelineEntry[];
}

// Department colors
const departmentColors = {
    sales: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    design: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400 border-purple-200 dark:border-purple-800',
    prepress: 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-400 border-pink-200 dark:border-pink-800',
    production: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400 border-orange-200 dark:border-orange-800',
    outsource: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
    dispatch: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400 border-green-200 dark:border-green-800',
    completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
};

// Action icons
const actionIcons = {
    created: Package,
    assigned: User,
    uploaded_proof: Upload,
    customer_approved: Check,
    final_proof_uploaded: FileText,
    sent_to_production: Settings,
    substage_started: Clock,
    substage_completed: Check,
    packed: Package,
    dispatched: Truck,
    note_added: MessageSquare,
};

function TimelineItem({ entry }: { entry: TimelineEntry }) {
    const Icon = actionIcons[entry.action as keyof typeof actionIcons] || AlertCircle;
    const deptColor = departmentColors[entry.stage as keyof typeof departmentColors] || departmentColors.sales;

    return (
        <div className="flex gap-3 group">
            {/* Icon */}
            <div className={cn("p-2 rounded-lg shrink-0 border", deptColor)}>
                <Icon className="h-4 w-4" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pb-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">
                            {entry.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </p>
                        <Badge variant="outline" className={cn("text-xs", deptColor)}>
                            {entry.stage}
                        </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                        {format(new Date(entry.created_at), 'MMM d, h:mm a')}
                    </span>
                </div>

                <p className="text-xs text-muted-foreground mb-1">
                    by <span className="font-medium text-foreground">{entry.performed_by_name}</span>
                </p>

                {entry.notes && (
                    <p className="text-sm text-muted-foreground mt-2 bg-muted/50 p-2 rounded">
                        {entry.notes}
                    </p>
                )}

                {entry.product_name && (
                    <p className="text-xs text-muted-foreground mt-1">
                        Product: <span className="font-medium">{entry.product_name}</span>
                    </p>
                )}
            </div>
        </div>
    );
}

export function TimelineCard({ timeline }: TimelineCardProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Card>
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CollapsibleTrigger asChild>
                            <Button
                                variant="ghost"
                                className="flex-1 justify-between p-0 h-auto hover:bg-transparent"
                            >
                                <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    <h3 className="font-semibold text-sm">
                                        Activity Timeline ({timeline.length})
                                    </h3>
                                </div>
                                {isOpen ? (
                                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                            </Button>
                        </CollapsibleTrigger>

                        {/* Full View Button */}
                        {timeline.length > 0 && (
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 ml-2">
                                        <Maximize2 className="h-4 w-4" />
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-3xl max-h-[80vh]">
                                    <DialogHeader>
                                        <DialogTitle>Complete Activity Timeline ({timeline.length} entries)</DialogTitle>
                                    </DialogHeader>
                                    <ScrollArea className="h-[60vh] pr-4">
                                        <div className="space-y-1">
                                            {timeline.map((entry) => (
                                                <TimelineItem key={entry.timeline_id} entry={entry} />
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>
                </CardHeader>

                <CollapsibleContent>
                    <CardContent className="pt-0">
                        {timeline.length > 0 ? (
                            <div className="max-h-96 overflow-y-auto space-y-1">
                                {timeline.slice(0, 5).map((entry) => (
                                    <TimelineItem key={entry.timeline_id} entry={entry} />
                                ))}
                                {timeline.length > 5 && (
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button variant="outline" size="sm" className="w-full mt-2">
                                                View All {timeline.length} Entries
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-3xl max-h-[80vh]">
                                            <DialogHeader>
                                                <DialogTitle>Complete Activity Timeline</DialogTitle>
                                            </DialogHeader>
                                            <ScrollArea className="h-[60vh] pr-4">
                                                <div className="space-y-1">
                                                    {timeline.map((entry) => (
                                                        <TimelineItem key={entry.timeline_id} entry={entry} />
                                                    ))}
                                                </div>
                                            </ScrollArea>
                                        </DialogContent>
                                    </Dialog>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                No activity yet
                            </p>
                        )}
                    </CardContent>
                </CollapsibleContent>
            </Collapsible>
        </Card>
    );
}
