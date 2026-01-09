import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Paperclip, Loader2, User, MessageSquare, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ChatBubble } from './ChatBubble';
import { chatService } from '../services/chatService';
import { OrderConversation, OrderMessage } from '../types/chat';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/context/AuthContext';
import { format } from 'date-fns';

interface ChatWindowProps {
    conversation: OrderConversation;
    onBack: () => void;
    currentUserId: string;
    initialOrderId?: string; // Optional context
}

export function ChatWindow({ conversation, onBack, currentUserId, initialOrderId }: ChatWindowProps) {
    const [messages, setMessages] = useState<OrderMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const { user } = useAuth();

    // Search State
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Map of UUID -> Display Order ID
    const [orderIdMap, setOrderIdMap] = useState<Record<string, string>>({});

    // Active order context (for sending new messages)
    const activeOrderId = initialOrderId || conversation.order_id;

    const [orderInfo, setOrderInfo] = useState<{ order_id: string; product: string; customer: string } | null>(null);

    // Fetch order info specific to active context
    useEffect(() => {
        if (!activeOrderId) return;
        const fetchOrderInfo = async () => {
            // First fetch the order (using simplified query first to be safe, then items)
            const { data } = await supabase
                .from('orders')
                .select('id, order_id, customer_name')
                .eq('id', activeOrderId)
                .single();

            if (data) {
                // Fetch product names separately to avoid 400 depth error if relations issues exist
                const { data: items } = await supabase
                    .from('order_items')
                    .select('product_name')
                    .eq('order_id', activeOrderId);

                const products = items?.map(i => i.product_name).join(', ') || 'Order';

                setOrderInfo({
                    order_id: data.order_id,
                    customer: data.customer_name || 'Unknown Client',
                    product: products
                });
            }
        };
        fetchOrderInfo();
    }, [activeOrderId]);

    // Fetch messages and resolve Order IDs
    useEffect(() => {
        const loadMessages = async () => {
            setLoading(true);
            try {
                const data = await chatService.getMessages(conversation.id);
                setMessages(data);

                // Extract unique order UUIDs that we don't know yet
                const unknownOrderIds = [...new Set(data.map(m => m.order_id).filter(id => id && !orderIdMap[id]))] as string[];

                if (unknownOrderIds.length > 0) {
                    const { data: orders } = await supabase
                        .from('orders')
                        .select('id, order_id')
                        .in('id', unknownOrderIds);

                    if (orders) {
                        setOrderIdMap(prev => {
                            const newMap = { ...prev };
                            orders.forEach(o => newMap[o.id] = o.order_id);
                            return newMap;
                        });
                    }
                }

                // Mark as read
                await chatService.markAsRead(conversation.id);
            } catch (err) {
                console.error("Failed to load messages", err);
            } finally {
                setLoading(false);
            }
        };

        loadMessages();

        // Realtime subscription
        const channel = supabase
            .channel(`chat:${conversation.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to ALL events (INSERT, UPDATE)
                    schema: 'public',
                    table: 'order_messages',
                    filter: `conversation_id=eq.${conversation.id}`
                },
                async (payload) => {
                    console.log('Realtime update:', payload);

                    if (payload.eventType === 'INSERT') {
                        const newMsg = payload.new as OrderMessage;

                        // Fetch order ID if present and unknown
                        if (newMsg.order_id && !orderIdMap[newMsg.order_id]) {
                            const { data: oData } = await supabase.from('orders').select('id, order_id').eq('id', newMsg.order_id).single();
                            if (oData) {
                                setOrderIdMap(prev => ({ ...prev, [oData.id]: oData.order_id }));
                            }
                        }

                        setMessages(prev => {
                            if (prev.some(m => m.id === newMsg.id)) return prev;
                            return [...prev, newMsg];
                        });

                        if (newMsg.sender_id !== currentUserId) {
                            chatService.markAsRead(conversation.id);
                        }
                    } else if (payload.eventType === 'UPDATE') {
                        const updatedMsg = payload.new as OrderMessage;
                        setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
                    }
                }
            )
            .subscribe((status) => {
                console.log(`Subscription status for ${conversation.id}:`, status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [conversation.id, currentUserId]);

    // Filter messages based on search
    const filteredMessages = messages.filter(msg =>
        msg.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Auto-scroll (only if not searching)
    useEffect(() => {
        if (scrollRef.current && !showSearch) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, showSearch]);

    const handleSend = async () => {
        if (!newMessage.trim()) return;

        const content = newMessage;
        setNewMessage(''); // Clear input immediately

        // Optimistic UI: Add temporary message
        const tempId = `temp-${Date.now()}`;
        const tempMsg: OrderMessage = {
            id: tempId,
            conversation_id: conversation.id,
            sender_id: currentUserId,
            content: content,
            attachments: [],
            is_read: false,
            created_at: new Date().toISOString(),
            order_id: activeOrderId,
            status_tag: 'sent' // client-side tag
        };

        setMessages(prev => [...prev, tempMsg]);

        try {
            const sentMsg = await chatService.sendMessage(conversation.id, content, [], undefined, activeOrderId ?? undefined);

            // Replace temp message with real one
            setMessages(prev => prev.map(m => m.id === tempId ? { ...sentMsg, order: tempMsg.order } : m));
        } catch (error) {
            console.error("Failed to send", error);
            // Mark as failed or remove? For now, remove to keep it simple
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }
    };

    const handleEditMessage = async (messageId: string, newContent: string) => {
        try {
            // Optimistic update
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: newContent, is_edited: true } : m));
            await chatService.editMessage(messageId, newContent);
        } catch (error) {
            console.error("Failed to edit", error);
            // Revert on failure (requires refetching or keeping old state, strictly speaking. Simplified here)
        }
    };

    const handleDeleteMessage = async (messageId: string) => {
        try {
            // Optimistic update
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_deleted: true, content: 'This message was deleted' } : m));
            await chatService.deleteMessage(messageId);
        } catch (error) {
            console.error("Failed to delete", error);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
            {/* Chat Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-white dark:bg-slate-900 shadow-sm relative">
                <div className="flex items-center gap-3 overflow-hidden">
                    <Button variant="ghost" size="icon" className="h-8 w-8 -ml-1" onClick={onBack}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>

                    {orderInfo ? (
                        <div className="flex flex-col overflow-hidden">
                            <h3 className="font-semibold text-sm truncate flex items-center gap-2">
                                Order #{orderInfo.order_id}
                                {activeOrderId && <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal">Specific</Badge>}
                            </h3>
                            {/* Product Summary */}
                            <p className="text-xs text-foreground/80 truncate font-medium" title={orderInfo.product}>
                                {orderInfo.product}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate opacity-80 flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {orderInfo.customer}
                            </p>
                        </div>
                    ) : conversation.p1 || conversation.p2 ? (
                        <div className="flex flex-col">
                            <h3 className="font-semibold text-sm">
                                {conversation.participant_1 === currentUserId ? conversation.dept_2 : conversation.dept_1} Chat
                            </h3>
                            <p className="text-[10px] text-muted-foreground">
                                {conversation.dept_1} ↔ {conversation.dept_2}
                            </p>
                        </div>
                    ) : (
                        <h3 className="font-semibold text-sm">Order Chat</h3>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                    {showSearch ? (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-5 duration-200 absolute inset-0 bg-white dark:bg-slate-900 px-4 z-10 items-center justify-between">
                            <Search className="h-4 w-4 text-muted-foreground absolute left-7 top-4" />
                            <Input
                                autoFocus
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search messages..."
                                className="h-9 flex-1 ml-8 mr-2 text-sm bg-slate-100 dark:bg-slate-800 border-none text-slate-900 dark:text-slate-100 focus-visible:ring-1 focus-visible:ring-primary pl-8"
                            />
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setShowSearch(false); setSearchQuery(''); }}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ) : (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setShowSearch(true)}>
                            <Search className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4">
                {loading ? (
                    <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" /></div>
                ) : (
                    <div className="flex flex-col pb-4">
                        {filteredMessages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground opacity-50">
                                <MessageSquare className="h-10 w-10 mb-2" />
                                <p className="text-xs">{messages.length === 0 ? "Start the conversation..." : "No matches found"}</p>
                            </div>
                        ) : (
                            filteredMessages.map((msg, index) => {
                                // Show date header if different day
                                const showDate = index === 0 || new Date(msg.created_at).toDateString() !== new Date(filteredMessages[index - 1].created_at).toDateString();
                                return (
                                    <div key={msg.id}>
                                        {showDate && (
                                            <div className="flex justify-center my-4">
                                                <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-muted-foreground px-2 py-1 rounded-full">
                                                    {format(new Date(msg.created_at), 'MMMM d, yyyy')}
                                                </span>
                                            </div>
                                        )}
                                        <ChatBubble
                                            key={msg.id}
                                            message={{
                                                ...msg,
                                                order: msg.order_id && orderIdMap[msg.order_id] ? { order_id: orderIdMap[msg.order_id] } : undefined
                                            }}
                                            isMe={msg.sender_id === currentUserId}
                                            senderName={msg.sender_id === currentUserId ? 'Me' : 'Partner'}
                                            onEdit={handleEditMessage}
                                            onDelete={handleDeleteMessage}
                                        />
                                    </div>
                                )
                            })
                        )}
                        <div ref={scrollRef} />
                    </div>
                )}
            </ScrollArea>

            {/* Input Area */}
            <div className="p-3 bg-white dark:bg-slate-900 border-t">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground">
                        <Paperclip className="h-4 w-4" />
                    </Button>
                    <Input
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                        className="flex-1 bg-slate-50 dark:bg-slate-800 border-none focus-visible:ring-1"
                    />
                    <Button
                        size="icon"
                        onClick={handleSend}
                        disabled={sending || !newMessage.trim()}
                        className={cn("h-9 w-9 transition-all", newMessage.trim() ? "bg-blue-600 hover:bg-blue-700" : "bg-slate-200 text-slate-400")}
                    >
                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                </div>
            </div>
        </div>
    );
}
