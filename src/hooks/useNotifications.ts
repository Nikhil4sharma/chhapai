import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load notifications
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setNotifications((data || []).map(n => ({
        ...n,
        created_at: new Date(n.created_at),
        type: n.type as AppNotification['type'],
      })));
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Load user sound settings
  const fetchSettings = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data } = await supabase
        .from('user_settings')
        .select('sound_enabled')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setSoundEnabled(data.sound_enabled);
      }
    } catch (error) {
      // Settings don't exist yet, use defaults
      console.log('User settings not found, using defaults');
    }
  }, [user]);

  // Play notification sound
  const playSound = useCallback(() => {
    if (!soundEnabled) return;
    
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleVs/IpzY7q2SXDUmitrpnXhLIDyj0OqhhUMHIZjZ7rSVXDQli9TpnHlMICCj0OqqikMII5nZ77eZXTYmjNTqnn5OICA=');
      }
      audioRef.current.play().catch(() => {});
    } catch (e) {
      // Audio play failed, ignore
    }
  }, [soundEnabled]);

  // Toggle sound
  const toggleSound = useCallback(async () => {
    if (!user) return;
    
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);

    try {
      await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          sound_enabled: newValue,
          updated_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }, [user, soundEnabled]);

  // Mark as read
  const markAsRead = useCallback(async (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );

    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    setNotifications(prev => prev.map(n => ({ ...n, read: true })));

    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }, [user]);

  // Delete notification
  const removeNotification = useCallback(async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));

    try {
      await supabase
        .from('notifications')
        .delete()
        .eq('id', id);
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, []);

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!user) return;

    fetchNotifications();
    fetchSettings();

    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = {
            ...payload.new,
            created_at: new Date(payload.new.created_at),
            type: payload.new.type as AppNotification['type'],
          } as AppNotification;

          setNotifications(prev => [newNotification, ...prev]);

          // Play sound for urgent/delayed notifications
          if (newNotification.type === 'urgent' || newNotification.type === 'delayed') {
            playSound();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchNotifications, fetchSettings, playSound]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    unreadCount,
    isLoading,
    soundEnabled,
    toggleSound,
    markAsRead,
    markAllAsRead,
    removeNotification,
    refetch: fetchNotifications,
  };
}

// Helper to create notifications (for use in OrderContext)
export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: AppNotification['type'],
  orderId?: string,
  itemId?: string
) {
  try {
    await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title,
        message,
        type,
        order_id: orderId,
        item_id: itemId,
      });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}
