import { supabase } from '@/integrations/supabase/client';
import { OrderConversation, OrderMessage, ChatAttachment } from '../types/chat';

export const chatService = {
    // Fetch all conversations for the current user
    async getConversations() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('order_conversations')
            .select(`
        *,
        order:orders(order_id, id),
        p1:profiles!order_conversations_participant_1_fkey(full_name, avatar_url, department),
        p2:profiles!order_conversations_participant_2_fkey(full_name, avatar_url, department)
      `)
            .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
            .order('last_message_at', { ascending: false });

        if (error) {
            console.error('Error fetching conversations:', error);
            return [];
        }
        return data;
    },

    // Start or retrieve an existing conversation (User Pair)
    async startConversation(orderId: string | null, targetUserId: string, targetUserDept: string) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Check for existing conversation between these two users (ignoring order_id)
        const { data: existing, error: fetchError } = await supabase
            .from('order_conversations')
            .select('*')
            .or(`and(participant_1.eq.${user.id},participant_2.eq.${targetUserId}),and(participant_1.eq.${targetUserId},participant_2.eq.${user.id})`)
            .maybeSingle();

        if (existing) return existing;

        // Fetch user dept
        const { data: profile } = await supabase.from('profiles').select('department').eq('user_id', user.id).maybeSingle();
        const myDept = profile?.department || 'Unknown';

        // Create new
        try {
            const { data: newConv, error: createError } = await supabase
                .from('order_conversations')
                .insert({
                    order_id: orderId, // Optional initial context
                    participant_1: user.id,
                    participant_2: targetUserId,
                    dept_1: myDept,
                    dept_2: targetUserDept,
                })
                .select()
                .single();

            if (createError) throw createError;
            return newConv;
        } catch (error: any) {
            // Check for unique violation (race condition)
            if (error?.code === '23505') {
                // Try fetching again
                const { data: retryExisting } = await supabase
                    .from('order_conversations')
                    .select('*')
                    .or(`and(participant_1.eq.${user.id},participant_2.eq.${targetUserId}),and(participant_1.eq.${targetUserId},participant_2.eq.${user.id})`)
                    .single();
                if (retryExisting) return retryExisting;
            }
            throw error;
        }
    },

    async getMessages(conversationId: string) {
        const { data, error } = await supabase
            .from('order_messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data as OrderMessage[];
    },

    async sendMessage(conversationId: string, content: string, attachments: ChatAttachment[] = [], statusTag?: string, orderId?: string) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const messagePayload: any = {
            conversation_id: conversationId,
            sender_id: user.id,
            content,
            attachments: attachments, // JSONB
            status_tag: statusTag
        };

        // Only include order_id if present
        if (orderId) {
            messagePayload.order_id = orderId;
        }

        try {
            const { data, error } = await supabase
                .from('order_messages')
                .insert(messagePayload)
                .select()
                .single();

            if (error) throw error;

            // Update conversation last_message_at
            await supabase
                .from('order_conversations')
                .update({ last_message_at: new Date().toISOString() })
                .eq('id', conversationId);

            return data as OrderMessage;
        } catch (error: any) {
            // Fallback for missing 'order_id' column (Migration not applied)
            // PGRST204 is the code for "column not found", but sometimes message helps too
            const isColumnError = error?.code === 'PGRST204' ||
                (error?.message && error.message.includes('order_id'));

            if (isColumnError && messagePayload.order_id) {
                console.warn("Schema mismatch: 'order_id' column missing. Retrying without it.");
                delete messagePayload.order_id;

                const { data, error: retryError } = await supabase
                    .from('order_messages')
                    .insert(messagePayload)
                    .select()
                    .single();

                if (retryError) throw retryError;

                // Update conversation last_message_at
                await supabase
                    .from('order_conversations')
                    .update({ last_message_at: new Date().toISOString() })
                    .eq('id', conversationId);

                return data as OrderMessage;
            }
            throw error;
        }
    },

    async deleteMessage(messageId: string) {
        // Soft delete
        const { error } = await supabase
            .from('order_messages')
            .update({
                is_deleted: true,
                content: 'This message was deleted' // Optional: clear content for privacy
            })
            .eq('id', messageId);

        if (error) throw error;
    },

    async editMessage(messageId: string, newContent: string) {
        const { data, error } = await supabase
            .from('order_messages')
            .update({
                content: newContent,
                is_edited: true,
                edited_at: new Date().toISOString()
            })
            .eq('id', messageId)
            .select()
            .single();

        if (error) throw error;
        return data as OrderMessage;
    },

    async markAsRead(conversationId: string) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Mark all texts where I am NOT the sender as read
        await supabase
            .from('order_messages')
            .update({ is_read: true })
            .eq('conversation_id', conversationId)
            .neq('sender_id', user.id)
            .eq('is_read', false);
    }
};
