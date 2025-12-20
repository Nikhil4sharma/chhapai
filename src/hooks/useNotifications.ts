import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
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

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true); // Default ON
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

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
        .limit(50);
      
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

  // Load user notification settings from Supabase
  const fetchSettings = useCallback(async () => {
    if (!user || !user.id) return;
    
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('sound_enabled, push_enabled')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) {
        // If table doesn't exist or column doesn't exist, use defaults
        if (error.code === 'PGRST116' || error.code === '42703') {
          console.log('User settings not found or column missing, using defaults');
          setSoundEnabled(true);
          setPushEnabled(true);
          return;
        }
        throw error;
      }
      
      if (data) {
        setSoundEnabled(data.sound_enabled ?? true);
        setPushEnabled(data.push_enabled ?? true);
      } else {
        // Defaults if no settings exist
        setSoundEnabled(true);
        setPushEnabled(true);
      }
    } catch (error) {
      console.error('Error loading user settings:', error);
      // Use defaults on error
      setSoundEnabled(true);
      setPushEnabled(true);
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
  // IMPORTANT: This must be called from a user interaction (click, touch, etc.)
  const requestPushPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.log('Browser does not support notifications');
      toast({
        title: "Not Supported",
        description: "Your browser does not support notifications",
        variant: "destructive",
      });
      return false;
    }
    
    if (Notification.permission === 'granted') {
      console.log('Notification permission already granted');
      return true;
    }
    
    if (Notification.permission === 'denied') {
      console.log('Notification permission denied by user');
      toast({
        title: "Permission Denied",
        description: "Please enable notifications in your browser settings (lock icon → Site settings → Notifications)",
        variant: "destructive",
      });
      return false;
    }
    
    // Request permission if not yet decided
    // This will only work if called from a user interaction
    try {
      console.log('Requesting notification permission...');
      const permission = await Notification.requestPermission();
      console.log('Permission result:', permission);
      
      if (permission === 'granted') {
        console.log('Notification permission granted');
        toast({
          title: "Notifications Enabled",
          description: "You'll receive real-time updates about your orders",
        });
        return true;
      } else if (permission === 'denied') {
        console.log('Notification permission denied');
        toast({
          title: "Permission Denied",
          description: "Notifications were blocked. You can enable them later in browser settings.",
          variant: "destructive",
        });
        return false;
      } else {
        console.log('Notification permission dismissed');
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast({
        title: "Error",
        description: "Failed to request notification permission. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  }, []);

  // Show browser push notification
  const showPushNotification = useCallback((title: string, body: string, icon?: string) => {
    if (!('Notification' in window)) {
      console.log('Browser does not support notifications');
      return;
    }
    
    // Check permission first
    if (Notification.permission === 'denied') {
      console.log('Notification permission denied by user');
      return;
    }
    
    // Request permission if not granted
    if (Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          // Retry showing notification after permission granted
          showPushNotification(title, body, icon);
        }
      });
      return;
    }
    
    if (Notification.permission !== 'granted') {
      console.log('Notification permission not granted');
      return;
    }
    
    if (!pushEnabled) {
      console.log('Push notifications disabled in user settings');
      return;
    }
    
    try {
      const notification = new Notification(title, {
        body,
        icon: icon || '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'chhapai-notification',
        requireInteraction: false,
        silent: false,
      });
      
      // Handle notification click
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
      
      // Auto-close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);
      
      console.log('Push notification shown:', title);
    } catch (e) {
      console.error('Push notification failed:', e);
    }
  }, [pushEnabled]);

  // Toggle sound
  const toggleSound = useCallback(async () => {
    if (!user || !user.id) return;
    
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);

    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          sound_enabled: newValue,
          push_enabled: pushEnabled, // Preserve push_enabled value
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });
      
      if (error) {
        // If column doesn't exist, just update local state
        if (error.code === '42703') {
          console.log('push_enabled column not found, skipping save');
          return;
        }
        throw error;
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      // Don't revert on error - keep local state
    }
  }, [user, soundEnabled, pushEnabled]);

  // Mark as read
  const markAsRead = useCallback(async (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);
      
      if (error) throw error;
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!user || !user.id) return;

    setNotifications(prev => prev.map(n => ({ ...n, read: true })));

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);
      
      if (error) throw error;
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }, [user]);

  // Delete notification
  const removeNotification = useCallback(async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, []);

  // Clear all notifications
  const clearAllNotifications = useCallback(async () => {
    if (!user || !user.id) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id);
      
      if (error) throw error;
      setNotifications([]);
    } catch (error) {
      console.error('Error clearing all notifications:', error);
    }
  }, [user]);

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!user || !user.id) return;

    fetchNotifications();
    fetchSettings();

    // Set up realtime subscription for notifications
    const notificationsChannel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[Notifications] Realtime update:', payload.eventType);
          
          if (payload.eventType === 'INSERT') {
            const newNotification = payload.new as any;
            const mappedNotification: AppNotification = {
              id: newNotification.id,
              user_id: newNotification.user_id,
              title: newNotification.title,
              message: newNotification.message,
              type: (newNotification.type as AppNotification['type']) || 'info',
              order_id: newNotification.order_id || undefined,
              item_id: newNotification.item_id || undefined,
              read: newNotification.read || false,
              created_at: new Date(newNotification.created_at),
            };
            
            setNotifications(prev => [mappedNotification, ...prev]);
            
            // Play sound and show push notification for new notifications
            if (!mappedNotification.read) {
              playSound();
              showPushNotification(mappedNotification.title, mappedNotification.message);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedNotification = payload.new as any;
            setNotifications(prev =>
              prev.map(n =>
                n.id === updatedNotification.id
                  ? {
                      ...n,
                      read: updatedNotification.read || false,
                      title: updatedNotification.title,
                      message: updatedNotification.message,
                    }
                  : n
              )
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setNotifications(prev => prev.filter(n => n.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notificationsChannel);
    };
  }, [user, fetchNotifications, fetchSettings, playSound, showPushNotification]);

  // NOTE: Auto-requesting permission is removed because browsers require user interaction
  // Permission must be requested via:
  // 1. Dashboard alert dialog (on first visit)
  // 2. Settings page "Test Push Notification" button
  // 3. Any explicit user action button

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
    clearAllNotifications,
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
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title,
        message,
        type,
        order_id: orderId || null,
        item_id: itemId || null,
        read: false,
      });
    
    if (error) throw error;
    console.log('[Notifications] Created notification:', { userId, title, type });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}
