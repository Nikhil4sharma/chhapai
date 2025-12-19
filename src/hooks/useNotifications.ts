import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
// Firebase removed - using Supabase only
// TODO: Migrate notifications to Supabase notifications table

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

  // Load notifications
  const fetchNotifications = useCallback(async () => {
    if (!user || !user.id) {
      setIsLoading(false);
      return;
    }
    
    // TODO: Migrate to Supabase notifications table
    // For now, return empty array to prevent errors
    try {
      setNotifications([]);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Load user notification settings
  const fetchSettings = useCallback(async () => {
    if (!user || !user.id) return;
    
    // TODO: Migrate to Supabase user_settings table
    // For now, use defaults
    try {
      setSoundEnabled(true);
      setPushEnabled(true);
    } catch (error) {
      // Settings don't exist yet, use defaults
      console.log('User settings not found, using defaults');
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

    // TODO: Migrate to Supabase user_settings table
    try {
      // No-op for now
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }, [user, soundEnabled]);

  // Mark as read
  const markAsRead = useCallback(async (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );

    // TODO: Migrate to Supabase notifications table
    try {
      // No-op for now
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!user || !user.id) return;

    setNotifications(prev => prev.map(n => ({ ...n, read: true })));

    // TODO: Migrate to Supabase notifications table
    try {
      // No-op for now
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }, [user]);

  // Delete notification
  const removeNotification = useCallback(async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));

    // TODO: Migrate to Supabase notifications table
    try {
      // No-op for now
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, []);

  // Clear all notifications
  const clearAllNotifications = useCallback(async () => {
    if (!user || !user.id) return;

    // TODO: Migrate to Supabase notifications table
    try {
      // Clear local state only
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

    // TODO: Add Supabase realtime subscriptions when notifications table is migrated
    // No Firebase subscriptions needed - using Supabase only
  }, [user, fetchNotifications, fetchSettings, playSound, requestPushPermission, showPushNotification, pushEnabled, soundEnabled]);

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
  // TODO: Migrate to Supabase notifications table
  try {
    // No-op for now - will be implemented with Supabase
    console.log('Notification would be created:', { userId, title, message, type, orderId, itemId });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}
