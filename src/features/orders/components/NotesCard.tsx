import { useState } from 'react';
import { format } from 'date-fns';
import {
    MessageSquare, ChevronDown, ChevronUp, User,
    Calendar, AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { TimelineEntry } from '@/types/order';
import { cn } from '@/lib/utils';

interface NotesCardProps {
    notes: TimelineEntry[];
    globalNotes?: string;
}

// Department colors (matching other components)
const departmentColors = {
    sales: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    design: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400 border-purple-200 dark:border-purple-800',
    prepress: 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-400 border-pink-200 dark:border-pink-800',
    production: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400 border-orange-200 dark:border-orange-800',
    outsource: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
    dispatch: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400 border-green-200 dark:border-green-800',
    completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
};

export function NotesCard({ notes, globalNotes }: NotesCardProps) {
    const [isOpen, setIsOpen] = useState(true);

    // Strict filter: Only show manual user notes
    const displayNotes = notes.filter(n => n.action === 'note_added');

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
                                    <MessageSquare className="h-4 w-4 text-primary" />
                                    <h3 className="font-semibold text-sm">
                                        Notes & Communication
                                        {displayNotes.length > 0 &&
                                            <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                                                {displayNotes.length}
                                            </span>
                                        }
                                    </h3>
                                </div>
                                {isOpen ? (
                                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                            </Button>
                        </CollapsibleTrigger>
                    </div>
                </CardHeader>

                <CollapsibleContent>
                    <CardContent className="px-4 pb-4 pt-0">
                        {/* Global Notes Section if exists */}
                        {globalNotes && (
                            <div className="mb-4 bg-yellow-50 dark:bg-yellow-950/20 p-3 rounded-md border border-yellow-200 dark:border-yellow-900">
                                <h4 className="text-xs font-semibold text-yellow-800 dark:text-yellow-500 mb-1 flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" />
                                    Important Order Notes
                                </h4>
                                <p className="text-sm text-foreground whitespace-pre-wrap">
                                    {globalNotes}
                                </p>
                            </div>
                        )}

                        {/* Recent Notes List */}
                        {displayNotes.length > 0 ? (
                            <ScrollArea className="h-[300px] pr-4">
                                <div className="space-y-4">
                                    {displayNotes.map((note) => {
                                        const deptColor = departmentColors[note.stage as keyof typeof departmentColors] || departmentColors.sales;

                                        return (
                                            <div key={note.timeline_id} className="relative pl-4 border-l-2 border-muted pb-1 last:pb-0">
                                                {/* Timestamp dot */}
                                                <div className="absolute -left-[5px] top-0 h-2.5 w-2.5 rounded-full bg-muted-foreground/30 ring-4 ring-background" />

                                                <div className="flex flex-col gap-1">
                                                    {/* Header: User & Dept */}
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-semibold text-sm">
                                                                {note.performed_by_name || 'Unknown User'}
                                                            </span>
                                                            <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5 font-normal", deptColor)}>
                                                                {note.stage}
                                                            </Badge>
                                                        </div>
                                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                            <Calendar className="h-3 w-3" />
                                                            {format(new Date(note.created_at), 'MMM d, h:mm a')}
                                                        </span>
                                                    </div>

                                                    {/* Note Content */}
                                                    <div className="bg-muted/30 p-2.5 rounded-br-lg rounded-bl-lg rounded-tr-lg mt-1 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                                                        {note.notes}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </ScrollArea>
                        ) : (
                            !globalNotes && (
                                <div className="text-center py-8 text-muted-foreground">
                                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                    <p className="text-sm">No notes added yet</p>
                                </div>
                            )
                        )}
                    </CardContent>
                </CollapsibleContent>
            </Collapsible>
        </Card>
    );
}
