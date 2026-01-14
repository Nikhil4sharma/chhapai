import { useState, useEffect, useRef } from 'react';
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    Send, Paperclip, Clock, Palette, CheckCircle2,
    FileText, User, AlertCircle, ArrowRight, MessageSquare, History, List
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'; // Added Tabs import
import { useOrders } from '@/features/orders/context/OrderContext';
import { useAuth } from '@/features/auth/context/AuthContext';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { OrderItem } from '@/types/order';

interface DesignBriefDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orderId: string;
    orderUUID: string;
    item: OrderItem;
    department?: string;
}

const getInitials = (name: string) => name ? name.substring(0, 2).toUpperCase() : '??';

export function DesignBriefDialog({ open, onOpenChange, orderId, orderUUID, item, department }: DesignBriefDialogProps) {
    const { user, profile } = useAuth();
    const { timeline, refreshOrders, updateItemSpecifications } = useOrders();

    // Derived state
    const targetDept = department || item.assigned_department || item.current_stage;
    const briefKey = targetDept === 'prepress' ? 'prepress_brief' :
        targetDept === 'production' ? 'production_brief' : 'design_brief';
    const deptLabel = targetDept.charAt(0).toUpperCase() + targetDept.slice(1);

    const [briefText, setBriefText] = useState(item.specifications?.[briefKey] || '');
    const [newMessage, setNewMessage] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [activeTab, setActiveTab] = useState<'chat' | 'history'>('chat');

    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (open) {
            setBriefText(item.specifications?.[briefKey] || '');
        }
    }, [open, item, briefKey]);

    // Derived Timelines, sorted Chronologically
    // 1. Chat Messages (Human to Human)
    const chatMessages = timeline.filter(t =>
        (t.item_id === item.item_id || !t.item_id) &&
        t.action === 'design_chat' &&
        !(t as any).deleted_at
    ).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // 2. System History (Status Changes, Assignments)
    const historyEntries = timeline.filter(t =>
        (t.item_id === item.item_id || !t.item_id) &&
        ['status_changed', 'note_added', 'assigned'].includes(t.action) &&
        !(t as any).deleted_at
    ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); // Newest first for log

    // Auto-scroll for chat
    useEffect(() => {
        if (open && activeTab === 'chat' && scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatMessages.length, open, activeTab]);

    const handleSaveBrief = async () => {
        setIsSaving(true);
        try {
            await updateItemSpecifications(orderUUID, item.item_id, { [briefKey]: briefText });
            toast({ title: "Saved", description: "Brief updated." });
        } catch (error) {
            toast({ title: "Error", description: "Failed to save.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !user) return;
        setIsSending(true);
        try {
            // 1. Insert Timeline Message
            await supabase.from('timeline').insert({
                order_id: orderUUID,
                item_id: item.item_id,
                product_name: item.product_name,
                stage: item.current_stage || 'design',
                action: 'design_chat',
                performed_by: user.id,
                performed_by_name: profile?.full_name || 'Design Team',
                notes: newMessage.trim(),
                is_public: true,
            });

            // 2. Notify Sales Manager / Assigned User
            if (item.assigned_to && item.assigned_to !== user.id) {
                await supabase.from('notifications').insert({
                    user_id: item.assigned_to,
                    title: `New Message on Order #${orderId}`,
                    message: `${profile?.full_name || 'Design Team'}: ${newMessage.trim()}`,
                    type: 'info',
                    reference_id: orderUUID,
                    reference_type: 'order_chat'
                });
            }

            setNewMessage('');
            await refreshOrders();
        } catch (error) {
            console.error("Error sending message:", error);
            toast({ title: "Error", description: "Could not send message.", variant: "destructive" });
        } finally {
            setIsSending(false);
            if (inputRef.current) inputRef.current.focus();
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden shadow-2xl border-0 bg-background/95 backdrop-blur-xl">

                {/* 1. Header Area */}
                <div className="h-16 border-b bg-muted/40 flex items-center justify-between px-6 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                            <Palette className="w-5 h-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                                Design Collaboration
                                <span className="text-muted-foreground font-normal">/</span>
                                <span className="font-normal text-muted-foreground">{orderId}</span>
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                {item.product_name} • {deptLabel} Phase
                            </DialogDescription>
                        </div>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">

                    {/* 2. LEFT PANEL: Context & Brief (400px fixed or 35%) */}
                    <div className="w-[400px] border-r bg-muted/10 flex flex-col shrink-0">
                        <ScrollArea className="flex-1">
                            <div className="p-5 space-y-6">

                                {/* Latest Note Highlight */}
                                {item.last_workflow_note && (
                                    <div className="animate-in fade-in slide-in-from-left-4 duration-500">
                                        <div className="rounded-xl border border-amber-200/60 bg-amber-50/80 dark:border-amber-900/30 dark:bg-amber-950/20 p-4 shadow-sm">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-semibold text-sm">
                                                    <AlertCircle className="w-4 h-4" />
                                                    Latest Feedback / Note
                                                </div>
                                                <span className="text-[10px] uppercase font-bold text-amber-700/50 dark:text-amber-500/50 tracking-wider">
                                                    Priority
                                                </span>
                                            </div>
                                            <p className="text-sm text-amber-800 dark:text-amber-100/90 leading-relaxed font-medium">
                                                {item.last_workflow_note}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Brief Editor */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                            <FileText className="w-3.5 h-3.5" />
                                            {deptLabel} Working Brief
                                        </label>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleSaveBrief}
                                            disabled={isSaving}
                                            className="h-6 text-[10px] font-semibold text-primary hover:bg-primary/10"
                                        >
                                            {isSaving ? "Saving..." : "Save Changes"}
                                        </Button>
                                    </div>
                                    <Textarea
                                        value={briefText}
                                        onChange={(e) => setBriefText(e.target.value)}
                                        className="min-h-[300px] resize-none p-4 text-sm leading-relaxed bg-background border-border/60 focus:ring-1 focus:ring-primary/20 transition-all font-normal"
                                        placeholder={`Write your internal ${targetDept} notes, requirements, or checklist here...`}
                                    />
                                </div>

                                {/* Original Requirements (Read-only) */}
                                <div className="space-y-2 opacity-80 hover:opacity-100 transition-opacity">
                                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Original Requirement</label>
                                    <div className="p-4 rounded-lg bg-background border border-border/40 text-sm text-muted-foreground leading-relaxed">
                                        {item.specifications?.description || "No description provided."}
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>
                    </div>

                    {/* 3. RIGHT PANEL: Chat & History Tabs */}
                    <div className="flex-1 flex flex-col bg-background relative overflow-hidden">
                        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'chat' | 'history')} className="flex flex-col h-full">

                            {/* Tabs Header */}
                            <div className="h-12 border-b flex items-center justify-between px-4 bg-background/50 backdrop-blur-sm shrink-0">
                                <TabsList className="bg-transparent p-0 gap-6 h-auto">
                                    <TabsTrigger
                                        value="chat"
                                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-2 pb-2 pt-1 font-medium text-xs text-muted-foreground data-[state=active]:text-foreground transition-all"
                                    >
                                        <MessageSquare className="w-3.5 h-3.5 mr-2" />
                                        Discussion ({chatMessages.length})
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="history"
                                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-2 pb-2 pt-1 font-medium text-xs text-muted-foreground data-[state=active]:text-foreground transition-all"
                                    >
                                        <History className="w-3.5 h-3.5 mr-2" />
                                        Activity Log
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            {/* TAB 1: DISCUSSION (Chat) */}
                            <TabsContent value="chat" className="flex-1 flex flex-col mt-0 h-full overflow-hidden">
                                <ScrollArea className="flex-1 p-5 bg-slate-50/50 dark:bg-slate-950/20">
                                    <div className="space-y-6 max-w-3xl mx-auto pb-4">
                                        {chatMessages.length === 0 ? (
                                            <div className="text-center py-20 opacity-40">
                                                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                                                    <MessageSquare className="w-6 h-6 text-muted-foreground" />
                                                </div>
                                                <p className="text-sm font-medium">No messages yet</p>
                                                <p className="text-xs">Start the conversation with Sales.</p>
                                            </div>
                                        ) : (
                                            chatMessages.map((msg) => {
                                                const isMe = msg.performed_by === user?.id;
                                                return (
                                                    <div key={msg.timeline_id} className={cn("flex gap-3 animate-in fade-in slide-in-from-bottom-2", isMe ? "flex-row-reverse" : "flex-row")}>
                                                        <Avatar className="w-8 h-8 mt-1 shadow-sm border border-border/50">
                                                            <AvatarFallback className={cn("text-[10px] font-bold", isMe ? "bg-indigo-100 text-indigo-700" : "bg-white text-zinc-700")}>
                                                                {getInitials(msg.performed_by_name)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className={cn("flex flex-col max-w-[80%]", isMe ? "items-end" : "items-start")}>
                                                            <div className="flex items-baseline gap-2 mb-1 px-1">
                                                                <span className="text-xs font-semibold text-foreground">{msg.performed_by_name}</span>
                                                                <span className="text-[10px] text-muted-foreground/70">{format(new Date(msg.created_at), 'MMM d, h:mm a')}</span>
                                                            </div>
                                                            <div className={cn(
                                                                "px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm relative",
                                                                isMe
                                                                    ? "bg-indigo-600 text-white rounded-tr-sm"
                                                                    : "bg-white dark:bg-zinc-800 border border-border/60 text-foreground rounded-tl-sm"
                                                            )}>
                                                                {msg.notes}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                        <div ref={scrollRef} />
                                    </div>
                                </ScrollArea>

                                {/* Input Area (Only visible in Chat Tab) */}
                                <div className="p-4 bg-background border-t mt-auto shrink-0 z-20">
                                    <div className="bg-muted/40 p-2 rounded-2xl border border-border/50 flex gap-2 items-end focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all">
                                        <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9 rounded-full text-muted-foreground hover:text-foreground">
                                            <Paperclip className="w-4 h-4" />
                                        </Button>
                                        <Textarea
                                            ref={inputRef}
                                            value={newMessage}
                                            onChange={e => setNewMessage(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSendMessage();
                                                }
                                            }}
                                            placeholder="Type a message to Sales..."
                                            className="border-0 bg-transparent focus-visible:ring-0 resize-none min-h-[36px] max-h-[120px] py-2 text-sm"
                                        />
                                        <Button
                                            size="icon"
                                            onClick={handleSendMessage}
                                            disabled={!newMessage.trim() || isSending}
                                            className={cn(
                                                "h-9 w-9 rounded-xl shrink-0 transition-all shadow-sm",
                                                newMessage.trim() ? "bg-indigo-600 hover:bg-indigo-700" : "bg-muted-foreground/30 hover:bg-muted-foreground/40"
                                            )}
                                        >
                                            <Send className="w-4 h-4 text-white" />
                                        </Button>
                                    </div>
                                    <p className="text-[10px] text-center mt-2 text-muted-foreground/60">
                                        Press Enter to send, Shift+Enter for new line
                                    </p>
                                </div>
                            </TabsContent>

                            {/* TAB 2: HISTORY (System Logs) */}
                            <TabsContent value="history" className="flex-1 mt-0 overflow-hidden">
                                <ScrollArea className="h-full p-6">
                                    <div className="relative pl-4 border-l border-border/50 space-y-8 ml-2">
                                        {historyEntries.length === 0 ? (
                                            <div className="text-center py-20 opacity-40">
                                                <p className="text-sm">No activity history yet.</p>
                                            </div>
                                        ) : (
                                            historyEntries.map((log) => (
                                                <div key={log.timeline_id} className="relative">
                                                    {/* Timeline Dot */}
                                                    <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-border ring-4 ring-background" />

                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-semibold text-foreground">{log.performed_by_name}</span>
                                                            <span className="text-[10px] text-muted-foreground">
                                                                {format(new Date(log.created_at), 'MMM d, p')}
                                                            </span>
                                                        </div>
                                                        <div className="text-sm text-foreground/80 font-medium">
                                                            {log.action === 'status_changed' ? 'Changed Status' :
                                                                log.action === 'assigned' ? 'Updated Assignment' : 'Updated Note'}
                                                        </div>
                                                        {log.notes && (
                                                            <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-md border border-border/30 mt-1 italic">
                                                                "{log.notes}"
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </ScrollArea>
                            </TabsContent>

                        </Tabs>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
