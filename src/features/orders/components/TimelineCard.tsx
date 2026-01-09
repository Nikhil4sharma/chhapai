import { useState } from 'react';
import { ChevronDown, ChevronUp, Clock, Maximize2 } from 'lucide-react';
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
import { TimelineEntry } from '@/types/order';
import { OrderTimeline } from './OrderTimeline';

interface TimelineCardProps {
    timeline: TimelineEntry[];
}

export function TimelineCard({ timeline }: TimelineCardProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Card className="hover:shadow-md transition-shadow">
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CardHeader className="py-3 px-4">
                    <div className="flex items-center justify-between">
                        <CollapsibleTrigger asChild>
                            <Button
                                variant="ghost"
                                className="flex-1 justify-between p-0 h-auto hover:bg-transparent"
                            >
                                <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-primary" />
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
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-2 rounded-full hover:bg-muted">
                                        <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl max-h-[85vh] p-0 overflow-hidden flex flex-col">
                                    <DialogHeader className="px-6 py-4 border-b">
                                        <DialogTitle className="flex items-center gap-2">
                                            <Clock className="h-5 w-5 text-primary" />
                                            Complete Activity Timeline
                                            <span className="text-muted-foreground text-sm font-normal ml-2">({timeline.length} entries)</span>
                                        </DialogTitle>
                                    </DialogHeader>
                                    <ScrollArea className="flex-1 p-6 bg-muted/5">
                                        <OrderTimeline entries={timeline} />
                                    </ScrollArea>
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>
                </CardHeader>

                <CollapsibleContent>
                    <CardContent className="px-4 pb-4 pt-0">
                        {timeline.length > 0 ? (
                            <div className="space-y-4">
                                {/* Preview: Show first 5 entries */}
                                <OrderTimeline entries={timeline.slice(0, 5)} />

                                {timeline.length > 5 && (
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button variant="outline" size="sm" className="w-full mt-2 text-xs border-dashed">
                                                View All {timeline.length} Entries
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-2xl max-h-[85vh] p-0 overflow-hidden flex flex-col">
                                            <DialogHeader className="px-6 py-4 border-b">
                                                <DialogTitle className="flex items-center gap-2">
                                                    <Clock className="h-5 w-5 text-primary" />
                                                    Complete Activity Timeline
                                                    <span className="text-muted-foreground text-sm font-normal ml-2">({timeline.length} entries)</span>
                                                </DialogTitle>
                                            </DialogHeader>
                                            <ScrollArea className="flex-1 p-6 bg-muted/5">
                                                <OrderTimeline entries={timeline} />
                                            </ScrollArea>
                                        </DialogContent>
                                    </Dialog>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                <Clock className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                <p className="text-sm">No activity yet</p>
                            </div>
                        )}
                    </CardContent>
                </CollapsibleContent>
            </Collapsible>
        </Card>
    );
}
