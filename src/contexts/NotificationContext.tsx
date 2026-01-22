import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export interface AppNotification {
    id: string;
    user_id: string;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'success' | 'urgent' | 'delayed';
    order_id?: string;
    item_id?: string;
    read: boolean;
    created_at: Date;
}

interface NotificationContextType {
    notifications: AppNotification[];
    unreadCount: number;
    isLoading: boolean;
    fetchNotifications: () => Promise<void>;
    markAsRead: (id: string) => Promise<void>;
    markItemAsRead: (itemId: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    clearAllNotifications: () => Promise<void>;
    getUnreadCount: (itemId: string) => number;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { user } = useAuth();
    const [soundEnabled, setSoundEnabled] = useState(true); // Keeping local state for now, can be moved to settings

    // Load notifications from Supabase
    const fetchNotifications = useCallback(async () => {
        if (!user || !user.id) {
            setIsLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(100); // Increased limit to ensure we catch recent chats

            if (error) throw error;

            const mappedNotifications: AppNotification[] = (data || []).map(n => ({
                id: n.id,
                user_id: n.user_id,
                title: n.title,
                message: n.message,
                type: (n.type as AppNotification['type']) || 'info',
                order_id: n.order_id || undefined,
                item_id: n.item_id || undefined,
                read: n.read || false,
                created_at: new Date(n.created_at),
            }));

            setNotifications(mappedNotifications);
        } catch (error) {
            console.error('Error fetching notifications:', error);
            setNotifications([]);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    // Real-time subscription
    useEffect(() => {
        if (!user || !user.id) return;

        fetchNotifications();

        const channel = supabase
            .channel('notifications-context-realtime')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`,
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const newNotification = payload.new as any;
                        const mapped: AppNotification = {
                            id: newNotification.id,
                            user_id: newNotification.user_id,
                            title: newNotification.title,
                            message: newNotification.message,
                            type: newNotification.type || 'info',
                            order_id: newNotification.order_id || undefined,
                            item_id: newNotification.item_id || undefined,
                            read: newNotification.read || false,
                            created_at: new Date(newNotification.created_at),
                        };
                        setNotifications(prev => [mapped, ...prev]);

                        // Play sound/toast here if needed
                        if (!mapped.read) {
                            // Simplified sound logic or trigger usage of existing sound util
                        }
                    } else if (payload.eventType === 'UPDATE') {
                        const updated = payload.new as any;
                        setNotifications(prev =>
                            prev.map(n => n.id === updated.id ? { ...n, read: updated.read } : n)
                        );
                    } else if (payload.eventType === 'DELETE') {
                        setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, fetchNotifications]);

    // Actions
    const markAsRead = useCallback(async (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        try {
            await supabase.from('notifications').update({ read: true }).eq('id', id);
        } catch (error) {
            console.error("Error marking read", error);
        }
    }, []);

    const markItemAsRead = useCallback(async (itemId: string) => {
        // Optimistic update
        setNotifications(prev => prev.map(n => n.item_id === itemId ? { ...n, read: true } : n));
        try {
            if (!user?.id) return;
            await supabase.from('notifications')
                .update({ read: true })
                .eq('item_id', itemId)
                .eq('user_id', user.id); // Ensure strictly for this user
        } catch (error) {
            console.error("Error marking item read", error);
        }
    }, [user]);

    const markAllAsRead = useCallback(async () => {
        if (!user?.id) return;
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        try {
            await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
        } catch (error) {
            console.error("Error marking all read", error);
        }
    }, [user]);

    const clearAllNotifications = useCallback(async () => {
        if (!user?.id) return;
        setNotifications([]);
        await supabase.from('notifications').delete().eq('user_id', user.id);
    }, [user]);

    const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

    const getUnreadCount = useCallback((itemId: string) => {
        return notifications.filter(n => n.item_id === itemId && !n.read).length;
    }, [notifications]);

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            isLoading,
            fetchNotifications,
            markAsRead,
            markItemAsRead,
            markAllAsRead,
            clearAllNotifications,
            getUnreadCount
        }}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotificationContext() {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotificationContext must be used within a NotificationProvider');
    }
    return context;
}
