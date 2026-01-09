import React, { createContext, useContext, useState, ReactNode } from 'react';

interface OpenChatOptions {
    orderId?: string;
    orderReadableId?: string;
    targetDepartment?: string; // 'Design', 'Sales', etc.
    targetUserId?: string;
    targetUserName?: string;
}

interface ChatContextType {
    isOpen: boolean;
    openChat: () => void; // Open list view
    openNewChat: (options?: OpenChatOptions) => void; // Open "New Chat" flow, optionally pre-filled
    closeChat: () => void;
    chatState: {
        mode: 'list' | 'new' | 'chat';
        prefill?: OpenChatOptions;
    };
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [chatState, setChatState] = useState<{
        mode: 'list' | 'new' | 'chat';
        prefill?: OpenChatOptions;
    }>({ mode: 'list' });

    const openChat = () => {
        setChatState({ mode: 'list', prefill: undefined });
        setIsOpen(true);
    };

    const openNewChat = (options?: OpenChatOptions) => {
        setChatState({ mode: 'new', prefill: options });
        setIsOpen(true);
    };

    const closeChat = () => setIsOpen(false);

    return (
        <ChatContext.Provider value={{ isOpen, openChat, openNewChat, closeChat, chatState }}>
            {children}
        </ChatContext.Provider>
    );
}

export function useChat() {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
}
