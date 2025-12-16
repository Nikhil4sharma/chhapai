import { useState, useEffect, useCallback } from 'react';
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
      // Create a more audible notification sound
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 880; // A5 note
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
      
      // Play second beep
      setTimeout(() => {
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        osc2.connect(gain2);
        gain2.connect(audioContext.destination);
        osc2.frequency.value = 1100;
        osc2.type = 'sine';
        gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        osc2.start(audioContext.currentTime);
        osc2.stop(audioContext.currentTime + 0.3);
      }, 150);
    } catch (e) {
      console.log('Audio play failed:', e);
    }
  }, [soundEnabled]);

  // Request browser push notification permission
  const requestPushPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.log('Browser does not support notifications');
      return false;
    }
    
    if (Notification.permission === 'granted') {
      return true;
    }
    
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    
    return false;
  }, []);

  // Show browser push notification
  const showPushNotification = useCallback((title: string, body: string, icon?: string) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }
    
    try {
      new Notification(title, {
        body,
        icon: icon || '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'chhapai-notification',
        requireInteraction: false,
      });
    } catch (e) {
      console.log('Push notification failed:', e);
    }
  }, []);

  // Toggle sound
  const toggleSound = useCallback(async () => {
    if (!user) return;
    
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);

    try {
      // First check if settings exist
      const { data: existing } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (existing) {
        // Update existing
        await supabase
          .from('user_settings')
          .update({
            sound_enabled: newValue,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);
      } else {
        // Insert new
        await supabase
          .from('user_settings')
          .insert({
            user_id: user.id,
            sound_enabled: newValue,
          });
      }
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
    
    // Request push notification permission on load
    requestPushPermission();

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

          // Show browser push notification
          if (Notification.permission === 'granted') {
            showPushNotification(
              newNotification.title,
              newNotification.message
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchNotifications, fetchSettings, playSound, requestPushPermission, showPushNotification]);

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
    requestPushPermission,
    showPushNotification,
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
