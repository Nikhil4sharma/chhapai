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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    Send, Paperclip, Clock, Palette, CheckCircle2,
    FileText, User, AlertCircle, ArrowRight, MessageSquare, History, List, X, Trash2, Edit2, Reply, Image as ImageIcon, File
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOrders } from '@/features/orders/context/OrderContext';
import { useAuth } from '@/features/auth/context/AuthContext';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { OrderItem } from '@/types/order';
import { useNotificationContext } from '@/contexts/NotificationContext';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
    const [attachment, setAttachment] = useState<File | null>(null);
    const [replyTo, setReplyTo] = useState<{ id: string, name: string, text: string } | null>(null);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            setBriefText(item.specifications?.[briefKey] || '');
            setNewMessage('');
            setAttachment(null);
            setReplyTo(null);
            setEditingMessageId(null);
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

    // Logic moved lower down to use useNotificationContext


    // Mobile Tab State (Brief vs Chat)
    const [mobileTab, setMobileTab] = useState<'brief' | 'chat'>('chat');

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setAttachment(e.target.files[0]);
        }
    };

    const handleSendMessage = async () => {
        if ((!newMessage.trim() && !attachment) || !user) return;
        if (!orderUUID) {
            toast({ title: "Error", description: "Order ID missing. Cannot send.", variant: "destructive" });
            return;
        }

        setIsSending(true);
        try {
            let uploadedUrl = null;
            let fileType = 'file';

            // 1. Upload File if present
            if (attachment) {
                const fileExt = attachment.name.split('.').pop();
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                const filePath = `${item.item_id}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('order_files')
                    .upload(filePath, attachment);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('order_files')
                    .getPublicUrl(filePath);

                uploadedUrl = publicUrl;
                fileType = attachment.type.startsWith('image/') ? 'image' : 'file';
            }

            // 2. Insert or Update Timeline Message
            if (editingMessageId) {
                const { error } = await supabase.from('timeline')
                    .update({
                        notes: newMessage.trim(),
                        // Append new attachment if any (logic could be refined to replace or add)
                        attachments: uploadedUrl ? [{ url: uploadedUrl, type: fileType }] : undefined
                    })
                    .eq('timeline_id', editingMessageId);

                if (error) throw error;
                toast({ title: "Updated", description: "Message updated." });
            } else {
                const finalMessage = replyTo ? `> Replying to ${replyTo.name}: "${replyTo.text.substring(0, 50)}..."\n\n${newMessage.trim()}` : newMessage.trim();

                const { error } = await supabase.from('timeline').insert({
                    order_id: orderUUID,
                    item_id: item.item_id,
                    product_name: item.product_name,
                    stage: item.current_stage || 'design',
                    action: 'design_chat',
                    performed_by: user.id,
                    performed_by_name: profile?.full_name || 'Design Team',
                    notes: finalMessage,
                    attachments: uploadedUrl ? [{ url: uploadedUrl, type: fileType }] : [],
                    is_public: true,
                });

                if (error) throw error;

                // Notify if not editing
                if (item.assigned_to && item.assigned_to !== user.id) {
                    await supabase.from('notifications').insert({
                        user_id: item.assigned_to,
                        title: `New Message on Order #${orderId}`,
                        message: `${profile?.full_name || 'Design Team'}: ${newMessage.trim()}`,
                        type: 'info',
                        order_id: orderUUID,
                        item_id: item.item_id
                    });
                }
            }

            setNewMessage('');
            setAttachment(null);
            setReplyTo(null);
            setEditingMessageId(null);
            await refreshOrders();
        } catch (error: any) {
            console.error("Error sending message:", error);
            toast({ title: "Error", description: error.message || "Could not send message.", variant: "destructive" });
        } finally {
            setIsSending(false);
            if (inputRef.current) inputRef.current.focus();
        }
    };

    const handleDeleteMessage = async (timelineId: string) => {
        try {
            const { error } = await supabase.from('timeline')
                .update({ deleted_at: new Date().toISOString() } as any) // Cast as any if column not in type def yet
                .eq('timeline_id', timelineId);

            if (error) throw error;
            toast({ title: "Deleted", description: "Message deleted." });
            refreshOrders();
        } catch (error: any) {
            toast({ title: "Error", description: "Failed to delete.", variant: "destructive" });
        }
    };

    const handleEditMessage = (msg: any) => {
        setEditingMessageId(msg.timeline_id);
        setNewMessage(msg.notes);
        if (inputRef.current) inputRef.current.focus();
    };

    const handleReply = (msg: any) => {
        setReplyTo({
            id: msg.timeline_id,
            name: msg.performed_by_name,
            text: msg.notes
        });
        if (inputRef.current) inputRef.current.focus();
    };

    // Mark chat as read when opening (or switching tabs)
    const { markItemAsRead } = useNotificationContext();
    useEffect(() => {
        if (open && item.item_id) {
            markItemAsRead(item.item_id);
        }
    }, [open, item.item_id, markItemAsRead]);

    const handleSaveBrief = async () => {
        setIsSaving(true);
        try {
            await updateItemSpecifications(orderUUID, item.item_id, { [briefKey]: briefText });
            toast({ title: "Saved", description: "Brief updated." });
            // FORCE REFRESH: Since item comes from parent, we need parent to update.
            // Depending on architecture, refreshOrders() call in parent loop might handle this.
            // But for local UI update, we might rely on the fact that we edit local 'briefText' state.
        } catch (error) {
            toast({ title: "Error", description: "Failed to save.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    // ... (rest of implementation)

    // Get consolidated instructions
    const instructions = [
        item.specifications?.design_instructions && { label: "Specific Instructions", text: item.specifications.design_instructions },
        // Add the BRIEF itself if it exists (so the user sees what they typed as 'instructions')
        item.specifications?.[briefKey] && { label: `${deptLabel} Brief`, text: item.specifications[briefKey] },
        item.specifications?.notes && item.specifications.notes !== item.specifications?.design_instructions && { label: "Notes", text: item.specifications.notes },
        item.last_workflow_note && item.last_workflow_note !== item.specifications?.notes && { label: "Latest Update", text: item.last_workflow_note }
    ].filter(Boolean) as { label: string, text: string }[];


    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl w-[95vw] h-[90vh] sm:h-[85vh] flex flex-col p-0 gap-0 overflow-hidden shadow-2xl border-0 bg-background/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl">

                {/* 1. Header Area */}
                <div className="h-16 border-b bg-muted/30 flex items-center justify-between px-4 sm:px-6 shrink-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-indigo-50 dark:bg-indigo-500/10 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20 shadow-sm">
                            <Palette className="w-5 h-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                                Design Collaboration
                                <span className="hidden sm:inline text-muted-foreground/50 font-light">/</span>
                                <span className="hidden sm:inline font-mono text-sm text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">{orderId}</span>
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <span className="font-medium text-foreground/80">{item.product_name}</span>
                                <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                                <span>{deptLabel} Phase</span>
                            </DialogDescription>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Mobile View Toggle */}
                        <div className="lg:hidden flex bg-muted/50 p-1 rounded-lg border border-border/40">
                            <button
                                onClick={() => setMobileTab('brief')}
                                className={cn(
                                    "px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                                    mobileTab === 'brief' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground/80"
                                )}>
                                Brief
                            </button>
                            <button
                                onClick={() => setMobileTab('chat')}
                                className={cn(
                                    "px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                                    mobileTab === 'chat' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground/80"
                                )}>
                                Chat
                            </button>
                        </div>
                        {/* Close Button */}
                        <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                            <X className="h-5 w-5 text-muted-foreground" />
                        </Button>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden relative">

                    {/* 2. LEFT PANEL: Context & Brief */}
                    <div className={cn(
                        "lg:w-[380px] lg:border-r bg-muted/5 flex flex-col shrink-0 transition-all absolute lg:relative inset-0 z-10 lg:z-auto bg-background lg:bg-transparent",
                        mobileTab === 'brief' ? "flex" : "hidden lg:flex"
                    )}>
                        <ScrollArea className="flex-1">
                            <div className="p-4 sm:p-6 space-y-8">

                                {/* Brief Editor */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                            <FileText className="w-3.5 h-3.5" />
                                            {deptLabel} Brief
                                        </label>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleSaveBrief}
                                            disabled={isSaving}
                                            className="h-7 text-xs font-medium text-primary hover:bg-primary/5 rounded-full px-3"
                                        >
                                            {isSaving ? "Saving..." : "Save Changes"}
                                        </Button>
                                    </div>
                                    <div className="relative group">
                                        <Textarea
                                            value={briefText}
                                            onChange={(e) => setBriefText(e.target.value)}
                                            className="min-h-[200px] sm:min-h-[300px] resize-none p-4 sm:p-5 text-sm leading-relaxed bg-white dark:bg-zinc-900 border-border/60 focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500/30 transition-all font-normal rounded-2xl shadow-sm"
                                            placeholder={`Write your internal ${targetDept} notes, requirements, or checklist here...`}
                                        />
                                        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                            <span className="text-[10px] text-muted-foreground bg-background/80 backdrop-blur px-2 py-1 rounded-md border shadow-sm">Markdown supported</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Instructions / Latest Note Highlight */}
                                {instructions.length > 0 && (
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            Instructions / Latest Note
                                        </label>
                                        <div className="rounded-2xl border border-amber-100 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-950/10 p-4 relative overflow-hidden group">
                                            <div className="absolute top-0 left-0 w-1 h-full bg-amber-400/50" />
                                            <div className="space-y-3">
                                                {instructions.map((inst, idx) => (
                                                    <div key={idx} className={cn("text-sm text-amber-900 dark:text-amber-100 leading-relaxed pl-2", idx > 0 && "border-t border-amber-200/30 pt-2")}>
                                                        <span className="font-semibold block text-xs opacity-70 mb-1">{inst.label}:</span>
                                                        <div className="whitespace-pre-wrap">{inst.text}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Original Requirements (Read-only) */}
                                <div className="space-y-3 pt-4 border-t border-dashed">
                                    <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Original Requirement</label>
                                    <div className="p-4 rounded-2xl bg-muted/30 border border-border/40 text-sm text-foreground/80 leading-relaxed font-normal">
                                        {item.specifications?.description || "No description provided."}
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>
                    </div>

                    {/* 3. RIGHT PANEL: Chat & History Tabs */}
                    <div className={cn(
                        "flex-1 flex flex-col bg-background relative overflow-hidden transition-all",
                        mobileTab === 'chat' ? "flex" : "hidden lg:flex"
                    )}>
                        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'chat' | 'history')} className="flex flex-col h-full">

                            {/* Tabs Header */}
                            <div className="h-10 sm:h-12 border-b flex items-center justify-between px-4 bg-background/80 backdrop-blur-md shrink-0 sticky top-0 z-20">
                                <TabsList className="bg-transparent p-0 gap-6 h-full w-full justify-start">
                                    <TabsTrigger
                                        value="chat"
                                        className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-2 font-medium text-xs sm:text-sm text-muted-foreground data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 transition-all flex items-center gap-2"
                                    >
                                        <MessageSquare className="w-4 h-4" />
                                        Discussion <span className="bg-muted px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs">{chatMessages.length}</span>
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="history"
                                        className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-2 font-medium text-xs sm:text-sm text-muted-foreground data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 transition-all flex items-center gap-2"
                                    >
                                        <History className="w-4 h-4" />
                                        Activity Log
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            {/* TAB 1: DISCUSSION (Chat) */}
                            <TabsContent value="chat" className="flex-1 flex flex-col mt-0 h-full overflow-hidden relative">
                                <ScrollArea className="flex-1 p-3 sm:p-5 bg-slate-50/50 dark:bg-slate-950/20">
                                    <div className="space-y-4 sm:space-y-6 max-w-3xl mx-auto pb-4">
                                        {chatMessages.length === 0 ? (
                                            <div className="text-center py-20 opacity-40 select-none">
                                                <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <MessageSquare className="w-8 h-8 text-muted-foreground/60" />
                                                </div>
                                                <p className="text-sm font-medium">No messages yet</p>
                                                <p className="text-xs mt-1">Start the conversation with the team.</p>
                                            </div>
                                        ) : (
                                            chatMessages.map((msg) => {
                                                const isMe = msg.performed_by === user?.id;
                                                return (
                                                    <div key={msg.timeline_id} className={cn("flex gap-3 animate-in fade-in slide-in-from-bottom-2 group", isMe ? "flex-row-reverse" : "flex-row")}>
                                                        <Avatar className="w-8 h-8 mt-0.5 shadow-sm border border-white dark:border-zinc-800">
                                                            <AvatarFallback className={cn("text-[10px] font-bold", isMe ? "bg-indigo-100 text-indigo-700" : "bg-zinc-100 text-zinc-700")}>
                                                                {getInitials(msg.performed_by_name)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className={cn("flex flex-col max-w-[85%] sm:max-w-[75%]", isMe ? "items-end" : "items-start")}>
                                                            <div className="flex items-baseline gap-2 mb-1 px-1">
                                                                <span className="text-[11px] font-semibold text-foreground/80">{msg.performed_by_name}</span>
                                                                <span className="text-[10px] text-muted-foreground/60">{format(new Date(msg.created_at), 'M/d h:mm a')}</span>
                                                            </div>
                                                            <div className="group relative">
                                                                <div className={cn(
                                                                    "px-4 py-2.5 sm:px-5 sm:py-3 text-sm leading-relaxed shadow-sm relative transition-all",
                                                                    isMe
                                                                        ? "bg-indigo-600 text-white rounded-2xl rounded-tr-sm"
                                                                        : "bg-white dark:bg-zinc-800 border border-border/60 text-foreground rounded-2xl rounded-tl-sm group-hover:shadow-md"
                                                                )}>
                                                                    <div className="whitespace-pre-wrap">{msg.notes}</div>
                                                                    {msg.attachments && msg.attachments.length > 0 && (
                                                                        <div className="mt-2 space-y-2">
                                                                            {msg.attachments.map((att: any, i: number) => (
                                                                                <div key={i} className="rounded-lg overflow-hidden border border-white/20 bg-black/10">
                                                                                    {att.type === 'image' ? (
                                                                                        <img src={att.url} alt="attachment" className="max-w-full h-auto max-h-[200px] object-contain" />
                                                                                    ) : (
                                                                                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 text-xs hover:underline">
                                                                                            <Paperclip className="h-3 w-3" /> Attachment
                                                                                        </a>
                                                                                    )}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Message Actions */}
                                                                <div className={cn(
                                                                    "absolute top-0 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 p-0.5 rounded-md bg-background border shadow-sm",
                                                                    isMe ? "right-full mr-2" : "left-full ml-2"
                                                                )}>
                                                                    <Button size="icon" variant="ghost" className="h-6 w-6 rounded-sm" onClick={() => handleReply(msg)}>
                                                                        <Reply className="h-3 w-3" />
                                                                    </Button>
                                                                    {isMe && (
                                                                        <>
                                                                            <Button size="icon" variant="ghost" className="h-6 w-6 rounded-sm" onClick={() => handleEditMessage(msg)}>
                                                                                <Edit2 className="h-3 w-3" />
                                                                            </Button>
                                                                            <Button size="icon" variant="ghost" className="h-6 w-6 rounded-sm hover:text-red-500" onClick={() => handleDeleteMessage(msg.timeline_id)}>
                                                                                <Trash2 className="h-3 w-3" />
                                                                            </Button>
                                                                        </>
                                                                    )}
                                                                </div>
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
                                <div className="p-3 sm:p-4 bg-background border-t mt-auto shrink-0 z-20 shadow-[-10px_0_20px_rgba(0,0,0,0.02)]">
                                    {/* Reply Context */}
                                    {replyTo && (
                                        <div className="mb-2 p-2 bg-muted/40 border-l-2 border-indigo-500 rounded text-xs text-muted-foreground flex items-center justify-between">
                                            <span>Replying to <b>{replyTo.name}</b></span>
                                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setReplyTo(null)}><X className="h-3 w-3" /></Button>
                                        </div>
                                    )}
                                    {/* Attachment Preview */}
                                    {attachment && (
                                        <div className="mb-2 p-2 bg-muted/40 rounded text-xs flex items-center gap-2">
                                            {attachment.type.startsWith('image/') ? <ImageIcon className="h-4 w-4" /> : <File className="h-4 w-4" />}
                                            <span className="truncate max-w-[200px]">{attachment.name}</span>
                                            <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto text-destructive" onClick={() => setAttachment(null)}><X className="h-3 w-3" /></Button>
                                        </div>
                                    )}

                                    <div className="bg-muted/30 p-1.5 rounded-[24px] border border-border/50 flex gap-2 items-end focus-within:ring-2 focus-within:ring-indigo-500/10 focus-within:border-indigo-500/20 transition-all bg-background/50 backdrop-blur-sm">
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            className="hidden"
                                            onChange={handleFileSelect}
                                        />
                                        <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} className="shrink-0 h-9 w-9 rounded-full text-muted-foreground/70 hover:text-foreground hover:bg-muted/50 transition-colors">
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
                                            placeholder={editingMessageId ? "Edit message..." : "Type a message..."}
                                            className="border-0 bg-transparent focus-visible:ring-0 resize-none min-h-[36px] max-h-[120px] py-2 text-sm placeholder:text-muted-foreground/50"
                                        />
                                        <Button
                                            size="icon"
                                            onClick={handleSendMessage}
                                            disabled={(!newMessage.trim() && !attachment) || isSending}
                                            className={cn(
                                                "h-9 w-9 rounded-full shrink-0 transition-all shadow-sm transform active:scale-95",
                                                (newMessage.trim() || attachment) ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "bg-muted text-muted-foreground"
                                            )}
                                        >
                                            <Send className="w-4 h-4 ml-0.5" />
                                        </Button>
                                    </div>
                                    {editingMessageId && <div className="text-[10px] text-muted-foreground mt-1 text-center">Editing message. <button className="hover:underline text-primary" onClick={() => { setEditingMessageId(null); setNewMessage(''); }}>Cancel</button></div>}
                                </div>
                            </TabsContent>

                            {/* TAB 2: HISTORY (System Logs) */}
                            <TabsContent value="history" className="flex-1 mt-0 overflow-hidden">
                                <ScrollArea className="h-full p-4 sm:p-6">
                                    <div className="relative pl-4 border-l-2 border-dashed border-border/40 space-y-8 ml-2">
                                        {historyEntries.length === 0 ? (
                                            <div className="text-center py-20 opacity-40">
                                                <p className="text-sm">No activity history yet.</p>
                                            </div>
                                        ) : (
                                            historyEntries.map((log) => (
                                                <div key={log.timeline_id} className="relative group">
                                                    {/* Timeline Dot */}
                                                    <div className="absolute -left-[23px] top-1.5 h-3 w-3 rounded-full bg-border ring-4 ring-background group-hover:bg-primary transition-colors" />

                                                    <div className="space-y-1.5 px-2 py-1 rounded-lg group-hover:bg-muted/20 transition-colors">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-bold text-foreground">{log.performed_by_name}</span>
                                                            <span className="text-[10px] text-muted-foreground font-mono">
                                                                {format(new Date(log.created_at), 'MMM d, h:mm a')}
                                                            </span>
                                                        </div>
                                                        <div className="text-sm text-foreground/80 font-medium">
                                                            {log.action === 'status_changed' ? 'Changed Status' :
                                                                log.action === 'assigned' ? 'Updated Assignment' : 'Updated Note'}
                                                        </div>
                                                        {log.notes && (
                                                            <div className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border/30 mt-1 italic leading-relaxed">
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
