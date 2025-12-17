import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
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
  const [pushEnabled, setPushEnabled] = useState(true); // Default ON
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  // Load notifications
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    
    try {
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('user_id', '==', user.uid),
        orderBy('created_at', 'desc'),
        limit(50)
      );
      const snapshot = await getDocs(notificationsQuery);

      setNotifications(snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          created_at: data.created_at?.toDate() || new Date(),
          type: data.type as AppNotification['type'],
        } as AppNotification;
      }));
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Load user notification settings
  const fetchSettings = useCallback(async () => {
    if (!user) return;
    
    try {
      const settingsQuery = query(
        collection(db, 'user_settings'),
        where('user_id', '==', user.uid)
      );
      const snapshot = await getDocs(settingsQuery);

      if (!snapshot.empty) {
        const settings = snapshot.docs[0].data();
        setSoundEnabled(settings.sound_enabled ?? true);
        // Push notifications default to true if not set
        setPushEnabled(settings.push_notifications !== undefined ? settings.push_notifications : true);
      } else {
        // No settings exist - use defaults (both ON)
        setSoundEnabled(true);
        setPushEnabled(true);
      }
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
  const requestPushPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.log('Browser does not support notifications');
      return false;
    }
    
    if (Notification.permission === 'granted') {
      return true;
    }
    
    if (Notification.permission === 'denied') {
      console.log('Notification permission denied by user');
      return false;
    }
    
    // Request permission if not yet decided
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('Notification permission granted');
        return true;
      } else {
        console.log('Notification permission denied');
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, []);

  // Show browser push notification
  const showPushNotification = useCallback((title: string, body: string, icon?: string) => {
    if (!('Notification' in window)) {
      console.log('Browser does not support notifications');
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
      
      // Auto-close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);
    } catch (e) {
      console.error('Push notification failed:', e);
    }
  }, [pushEnabled]);

  // Toggle sound
  const toggleSound = useCallback(async () => {
    if (!user) return;
    
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);

    try {
      // First check if settings exist
      const settingsQuery = query(
        collection(db, 'user_settings'),
        where('user_id', '==', user.uid)
      );
      const snapshot = await getDocs(settingsQuery);
      
      if (!snapshot.empty) {
        // Update existing
        const settingsRef = doc(db, 'user_settings', snapshot.docs[0].id);
        await updateDoc(settingsRef, {
          sound_enabled: newValue,
          updated_at: Timestamp.now(),
        });
      } else {
        // Insert new
        await setDoc(doc(collection(db, 'user_settings')), {
          user_id: user.uid,
          sound_enabled: newValue,
          created_at: Timestamp.now(),
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
      const notificationRef = doc(db, 'notifications', id);
      await updateDoc(notificationRef, { read: true });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    setNotifications(prev => prev.map(n => ({ ...n, read: true })));

    try {
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('user_id', '==', user.uid),
        where('read', '==', false)
      );
      const snapshot = await getDocs(notificationsQuery);
      
      const batch = snapshot.docs.map(doc => 
        updateDoc(doc.ref, { read: true })
      );
      await Promise.all(batch);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }, [user]);

  // Delete notification
  const removeNotification = useCallback(async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));

    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, []);

  // Clear all notifications
  const clearAllNotifications = useCallback(async () => {
    if (!user) return;

    try {
      // Get all user notifications
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('user_id', '==', user.uid)
      );
      const snapshot = await getDocs(notificationsQuery);
      
      // Delete all notifications
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      // Clear local state
      setNotifications([]);
    } catch (error) {
      console.error('Error clearing all notifications:', error);
    }
  }, [user]);

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!user) return;

    fetchNotifications();
    fetchSettings();

    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('user_id', '==', user.uid),
      orderBy('created_at', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      // Handle all changes, not just 'added'
      const allNotifications: AppNotification[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          created_at: data.created_at?.toDate() || new Date(),
          type: data.type as AppNotification['type'],
        } as AppNotification;
      });

      // Update notifications list
      setNotifications(allNotifications);

      // Check for new notifications
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const newNotification = {
            id: change.doc.id,
            ...change.doc.data(),
            created_at: change.doc.data().created_at?.toDate() || new Date(),
            type: change.doc.data().type as AppNotification['type'],
          } as AppNotification;

          // Play sound for urgent/delayed/info notifications
          if (newNotification.type === 'urgent' || newNotification.type === 'delayed' || newNotification.type === 'info') {
            playSound();
          }

          // Show browser push notification only if enabled in settings
          if (pushEnabled) {
            if (Notification.permission === 'granted') {
              showPushNotification(
                newNotification.title,
                newNotification.message
              );
            } else if (Notification.permission === 'default') {
              // Re-request permission if not yet decided
              requestPushPermission().then((granted) => {
                if (granted) {
                  showPushNotification(
                    newNotification.title,
                    newNotification.message
                  );
                }
              });
            }
          }
        }
      });
    });

    return () => unsubscribe();
  }, [user, fetchNotifications, fetchSettings, playSound, requestPushPermission, showPushNotification, pushEnabled]);

  // Request push notification permission when push is enabled and settings are loaded
  useEffect(() => {
    if (!user || !pushEnabled) return;
    
    // Request permission after a short delay to ensure settings are loaded
    const timer = setTimeout(() => {
      requestPushPermission();
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [user, pushEnabled, requestPushPermission]);

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
    await setDoc(doc(collection(db, 'notifications')), {
      user_id: userId,
      title,
      message,
      type,
      order_id: orderId || null,
      item_id: itemId || null,
      read: false,
      created_at: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}
