export interface OrderConversation {
    id: string;
    order_id?: string; // Made optional/legacy
    participant_1: string;
    participant_2: string;
    dept_1?: string;
    dept_2?: string;
    last_message_at: string;
    created_at: string;
    order?: { order_id: string, id: string }; // Expanded from service
    p1?: { full_name: string, department: string };
    p2?: { full_name: string, department: string };
}

export interface ChatAttachment {
    type: 'image' | 'file';
    url: string;
    name: string;
    size?: number;
}

export interface OrderMessage {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    attachments: ChatAttachment[];
    is_read: boolean;
    created_at: string;
    status_tag?: string;
    order_id?: string; // New field
    order?: { order_id: string }; // Expanded info
    is_deleted?: boolean;
    is_edited?: boolean;
    edited_at?: string;
}

export interface ChatParticipant {
    user_id: string;
    full_name: string;
    department: string;
    avatar_url?: string;
    is_online?: boolean; // Optional future feature
}
