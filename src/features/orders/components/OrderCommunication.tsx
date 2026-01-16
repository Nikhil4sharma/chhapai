
import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import {
    Send,
    User,
    Paperclip,
    MessagesSquare,
    CheckCircle2,
    Calendar,
    Briefcase,
    FileText,
    Settings,
    Truck,
    AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { TimelineEntry } from '@/types/order';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useOrders } from '@/features/orders/context/OrderContext';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface OrderCommunicationProps {
    orderId: string;
    timeline: TimelineEntry[];
    globalNotes?: string;
    className?: string;
}

export function OrderCommunication({ orderId, timeline, globalNotes, className }: OrderCommunicationProps) {
    const { user, profile } = useAuth();
    const { addNote, isLoading } = useOrders();
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Filter and sort timeline
    const displayItems = timeline
        .filter(entry => entry.action === 'note_added' || entry.action === 'status_changed' || entry.action === 'assigned' || entry.action === 'customer_approved' || entry.notes)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [displayItems.length]);

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !user) return;
        setIsSending(true);
        try {
            await addNote(orderId, newMessage);
            setNewMessage('');
        } catch (error) {
            console.error('Failed to send message:', error);
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const getActionIcon = (action: string, stage?: string) => {
        if (action === 'customer_approved') return <CheckCircle2 className="w-4 h-4 text-green-600" />;
        if (action === 'status_changed') {
            if (stage === 'dispatch') return <Truck className="w-4 h-4 text-orange-600" />;
            return <Settings className="w-4 h-4 text-blue-600" />;
        }
        if (action === 'assigned') return <User className="w-4 h-4 text-purple-600" />;
        return <FileText className="w-4 h-4 text-gray-500" />;
    };

    return (
        <Card className={cn("flex flex-col h-[600px]", className)}>
            <CardHeader className="py-3 px-4 border-b bg-muted/20">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <MessagesSquare className="h-4 w-4" />
                    Team Communication & Activity
                    <Badge variant="secondary" className="ml-auto text-xs font-normal">
                        {displayItems.length} entries
                    </Badge>
                </CardTitle>
            </CardHeader>

            <CardContent className="flex-1 p-0 overflow-hidden relative flex flex-col">
                <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                    <div className="space-y-6">
                        {globalNotes && (
                            <div className="flex justify-center my-4">
                                <div className="bg-yellow-50 dark:bg-yellow-950/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-900 max-w-[90%] w-full text-center">
                                    <h4 className="text-xs font-semibold text-yellow-800 dark:text-yellow-500 mb-1 flex items-center justify-center gap-1">
                                        <AlertCircle className="h-3 w-3" />
                                        Important Order Notes
                                    </h4>
                                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                                        {globalNotes}
                                    </p>
                                </div>
                            </div>
                        )}

                        {displayItems.length === 0 && !globalNotes ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <MessagesSquare className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                <p className="text-sm">No activity yet. Start the conversation!</p>
                            </div>
                        ) : (
                            displayItems.map((item) => {
                                const isMe = item.performed_by === user?.id;
                                const isNote = item.action === 'note_added';
                                const isSystem = !isNote;

                                if (isSystem) {
                                    return (
                                        <div key={item.timeline_id} className="flex items-start gap-3 justify-center my-4 opacity-80">
                                            <div className="flex flex-col items-center max-w-[80%]">
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                                    {getActionIcon(item.action, item.stage)}
                                                    <span className="font-semibold">{item.performed_by_name}</span>
                                                    <span>•</span>
                                                    <span>{format(new Date(item.created_at), 'MMM d, h:mm a')}</span>
                                                </div>
                                                <div className="bg-muted/40 px-3 py-1.5 rounded-full text-xs text-center border">
                                                    <p>{item.notes || 'Status updated'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={item.timeline_id} className={cn("flex gap-3 max-w-[85%]", isMe ? "ml-auto flex-row-reverse" : "")}>
                                        <Avatar className="h-8 w-8 border">
                                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                                {item.performed_by_name?.charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className={cn("flex flex-col gap-1", isMe ? "items-end" : "items-start")}>
                                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                                <span className="font-medium text-foreground">{item.performed_by_name}</span>
                                                <span>{format(new Date(item.created_at), 'h:mm a')}</span>
                                            </div>
                                            <div className={cn(
                                                "px-4 py-2.5 rounded-2xl text-sm shadow-sm whitespace-pre-wrap leading-relaxed",
                                                isMe
                                                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                                                    : "bg-white dark:bg-muted border rounded-tl-sm"
                                            )}>
                                                {item.notes}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </ScrollArea>

                <div className="p-3 bg-background border-t">
                    <div className="relative flex items-end gap-2 p-2 rounded-xl border bg-muted/30 focus-within:bg-background focus-within:ring-2 ring-primary/20 transition-all">
                        <Textarea
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type a message or brief..."
                            className="min-h-[40px] max-h-[120px] resize-none border-0 bg-transparent focus-visible:ring-0 px-2 py-2 text-sm"
                            rows={1}
                        />
                        <div className="flex items-center pb-1 gap-1">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-full">
                                            <Paperclip className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Attach File (Coming Soon)</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

                            <Button
                                size="icon"
                                onClick={handleSendMessage}
                                disabled={!newMessage.trim() || isSending}
                                className="h-8 w-8 rounded-full shrink-0"
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                    <div className="flex justify-between items-center px-2 mt-2">
                        <p className="text-[10px] text-muted-foreground">
                            Press <kbd className="font-sans px-1 rounded bg-muted border">Enter</kbd> to send
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
