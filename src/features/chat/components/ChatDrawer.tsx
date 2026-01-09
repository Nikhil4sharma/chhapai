import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { MessageSquare, Plus, Search } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { formatDistanceToNow } from 'date-fns';
import { chatService } from '../services/chatService';
import { OrderConversation } from '../types/chat';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useChat } from '../context/ChatContext';
import { ChatWindow } from './ChatWindow';
import { ChatSelectionFlow } from './ChatSelectionFlow';

export function ChatDrawer() {
    const { user } = useAuth();
    const { isOpen, closeChat, openChat, chatState, openNewChat } = useChat(); // Use global context
    const [conversations, setConversations] = useState<any[]>([]);
    const [activeConversation, setActiveConversation] = useState<OrderConversation | null>(null);
    const [loading, setLoading] = useState(false);

    // Derived mode from context state if applicable, but we might want local UI state for "active conversation"
    const [view, setView] = useState<'list' | 'new' | 'chat'>('list');

    // Sync context state to local view
    useEffect(() => {
        if (isOpen) {
            if (chatState.mode === 'new') {
                setView('new');
            } else {
                if (chatState.mode === 'list' && view !== 'chat') {
                    setView('list');
                }
            }
        }
    }, [isOpen, chatState.mode]);

    const loadConversations = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const data = await chatService.getConversations();
            setConversations(data);
        } catch (error) {
            console.error("Error loading chats", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && view === 'list') {
            loadConversations();
        }
    }, [isOpen, view, user]);

    const handleSelectConversation = (conv: any) => {
        setActiveConversation(conv);
        setView('chat');
    };

    const handleBackToList = () => {
        setView('list');
        setActiveConversation(null);
        loadConversations();
    };

    const handleSheetOpenChange = (open: boolean) => {
        if (!open) {
            closeChat();
        } else {
            openChat();
        }
    };

    return (
        <Sheet open={isOpen} onOpenChange={handleSheetOpenChange}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
                    <MessageSquare className="h-5 w-5" />
                    {/* Todo: Unread badge count global */}
                </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:w-[400px] p-0 border-l border-border bg-background sm:max-w-[400px]">
                <div className="sr-only">
                    <SheetTitle>Chat</SheetTitle>
                </div>
                {view === 'list' && (
                    <div className="flex flex-col h-full">
                        {/* Header */}
                        <div className="p-4 border-b flex items-center justify-between">
                            <h2 className="font-display font-semibold text-lg">Messages</h2>
                            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => openNewChat()}>
                                <Plus className="h-3.5 w-3.5" />
                                New Chat
                            </Button>
                        </div>

                        {/* Search */}
                        <div className="p-3 border-b bg-slate-50/50">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Search conversations..." className="pl-9 bg-white border-slate-200" />
                            </div>
                        </div>

                        {/* List */}
                        <ScrollArea className="flex-1">
                            {conversations.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                                    <MessageSquare className="h-10 w-10 opacity-20 mb-3" />
                                    <p className="text-sm">No conversations yet</p>
                                    <Button variant="link" onClick={() => openNewChat()}>Start a new chat</Button>
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {conversations.map(conv => {
                                        const partner = conv.participant_1 === user?.id ? conv.p2 : conv.p1;
                                        return (
                                            <button
                                                key={conv.id}
                                                onClick={() => handleSelectConversation(conv)}
                                                className="w-full p-4 flex gap-3 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors text-left"
                                            >
                                                <Avatar>
                                                    <AvatarFallback className="bg-indigo-100 text-indigo-700 font-medium">
                                                        {partner?.full_name?.substring(0, 2).toUpperCase() || '??'}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start mb-0.5">
                                                        <span className="font-semibold text-sm truncate">{partner?.full_name || 'User'}</span>
                                                        <span className="text-[10px] text-muted-foreground shrink-0">
                                                            {conv.last_message_at ? formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true }) : ''}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 font-normal text-muted-foreground">
                                                            #{conv.order?.order_id || '...'}
                                                        </Badge>
                                                        <span className="text-[10px] text-muted-foreground">{partner?.department}</span>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </ScrollArea>
                    </div>
                )}

                {view === 'new' && (
                    <ChatSelectionFlow
                        onCancel={() => setView('list')}
                        onConversationSelected={(conv) => {
                            setActiveConversation(conv);
                            setView('chat');
                        }}
                        preselectedDepartment={chatState.prefill?.targetDepartment}
                        preselectedOrder={chatState.prefill?.orderId ? {
                            id: chatState.prefill.orderId,
                            order_id: chatState.prefill.orderReadableId || 'UNKNOWN'
                        } : undefined}
                    />
                )}

                {view === 'chat' && activeConversation && user && (
                    <ChatWindow
                        conversation={activeConversation}
                        currentUserId={user.id}
                        onBack={handleBackToList}
                    />
                )}
            </SheetContent>
        </Sheet>
    );
}
