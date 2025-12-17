import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { WorkLog, WorkNote, DailyPerformanceReport } from '@/types/worklog';
import { useAuth } from './AuthContext';
import { toast } from '@/hooks/use-toast';
import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc,
  query, 
  where, 
  orderBy,
  onSnapshot,
  Timestamp,
  limit
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { format } from 'date-fns';

interface WorkLogContextType {
  workLogs: WorkLog[];
  workNotes: WorkNote[];
  isLoading: boolean;
  addWorkNote: (orderId: string, itemId: string | null, stage: string, noteText: string, timeSpent?: number) => Promise<void>;
  updateWorkNote: (noteId: string, noteText: string, timeSpent?: number) => Promise<void>;
  addWorkLog: (log: Omit<WorkLog, 'log_id' | 'created_at'>) => Promise<void>;
  getWorkLogsByUser: (userId?: string, date?: string) => WorkLog[];
  getWorkLogsByOrder: (orderId: string) => WorkLog[];
  getDailyPerformanceReport: (userId: string, date: string) => Promise<DailyPerformanceReport | null>;
  getWorkNotesByOrder: (orderId: string, itemId?: string) => WorkNote[];
  refreshWorkLogs: () => Promise<void>;
  refreshWorkNotes: () => Promise<void>;
}

const WorkLogContext = createContext<WorkLogContextType | undefined>(undefined);

export function WorkLogProvider({ children }: { children: React.ReactNode }) {
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [workNotes, setWorkNotes] = useState<WorkNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, role, profile } = useAuth();

  const fetchWorkLogs = useCallback(async () => {
    if (!user) return;

    try {
      let q;
      if (role === 'admin') {
        // Admin can see all logs
        q = query(collection(db, 'user_work_logs'), orderBy('created_at', 'desc'), limit(1000));
      } else {
        // Users can only see their own logs
        q = query(
          collection(db, 'user_work_logs'),
          where('user_id', '==', user.uid),
          orderBy('created_at', 'desc'),
          limit(500)
        );
      }

      const snapshot = await getDocs(q);
      const logs: WorkLog[] = [];
      
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        logs.push({
          log_id: docSnap.id,
          user_id: data.user_id,
          user_name: data.user_name,
          department: data.department,
          order_id: data.order_id,
          order_item_id: data.order_item_id || null,
          order_number: data.order_number,
          stage: data.stage,
          action_type: data.action_type,
          work_summary: data.work_summary,
          time_spent_minutes: data.time_spent_minutes || 0,
          work_date: data.work_date,
          created_at: data.created_at?.toDate() || new Date(),
          updated_at: data.updated_at?.toDate(),
        });
      });

      setWorkLogs(logs);
    } catch (error) {
      console.error('Error fetching work logs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, role]);

  const fetchWorkNotes = useCallback(async () => {
    if (!user) return;

    try {
      let q;
      if (role === 'admin' || role === 'sales') {
        // Admin and Sales can see all notes
        q = query(collection(db, 'work_notes'), orderBy('created_at', 'desc'), limit(1000));
      } else {
        // Other users can see notes for their assigned orders
        q = query(
          collection(db, 'work_notes'),
          where('user_id', '==', user.uid),
          orderBy('created_at', 'desc'),
          limit(500)
        );
      }

      const snapshot = await getDocs(q);
      const notes: WorkNote[] = [];
      
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        notes.push({
          note_id: docSnap.id,
          order_id: data.order_id,
          order_item_id: data.order_item_id || null,
          user_id: data.user_id,
          user_name: data.user_name,
          department: data.department,
          stage: data.stage,
          note_text: data.note_text,
          time_spent_minutes: data.time_spent_minutes,
          created_at: data.created_at?.toDate() || new Date(),
          updated_at: data.updated_at?.toDate(),
          is_edited: data.is_edited || false,
        });
      });

      setWorkNotes(notes);
    } catch (error) {
      console.error('Error fetching work notes:', error);
    }
  }, [user, role]);

  useEffect(() => {
    if (user) {
      fetchWorkLogs();
      fetchWorkNotes();

      // Real-time subscriptions
      const unsubscribeLogs = onSnapshot(
        query(collection(db, 'user_work_logs'), orderBy('created_at', 'desc'), limit(1000)),
        () => {
          fetchWorkLogs();
        }
      );

      const unsubscribeNotes = onSnapshot(
        query(collection(db, 'work_notes'), orderBy('created_at', 'desc'), limit(1000)),
        () => {
          fetchWorkNotes();
        }
      );

      return () => {
        unsubscribeLogs();
        unsubscribeNotes();
      };
    }
  }, [user, fetchWorkLogs, fetchWorkNotes]);

  const addWorkNote = useCallback(async (
    orderId: string,
    itemId: string | null,
    stage: string,
    noteText: string,
    timeSpent?: number
  ) => {
    if (!user || !profile) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive",
      });
      return;
    }

    try {
      const noteRef = doc(collection(db, 'work_notes'));
      const workDate = format(new Date(), 'yyyy-MM-dd');
      
      await setDoc(noteRef, {
        order_id: orderId,
        order_item_id: itemId,
        user_id: user.uid,
        user_name: profile.full_name || 'Unknown',
        department: role || 'unknown',
        stage: stage,
        note_text: noteText,
        time_spent_minutes: timeSpent || 0,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
        is_edited: false,
      });

      // Auto-create work log entry
      await addWorkLog({
        user_id: user.uid,
        user_name: profile.full_name || 'Unknown',
        department: role || 'unknown',
        order_id: orderId,
        order_item_id: itemId,
        order_number: orderId,
        stage: stage,
        action_type: 'note_added',
        work_summary: noteText.substring(0, 200), // First 200 chars
        time_spent_minutes: timeSpent || 0,
        work_date: workDate,
      });

      await fetchWorkNotes();
      toast({
        title: "Note Added",
        description: "Work note has been added successfully",
      });
    } catch (error: any) {
      console.error('Error adding work note:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add work note",
        variant: "destructive",
      });
    }
  }, [user, profile, role, fetchWorkNotes]);

  const updateWorkNote = useCallback(async (
    noteId: string,
    noteText: string,
    timeSpent?: number
  ) => {
    if (!user) return;

    try {
      const noteRef = doc(db, 'work_notes', noteId);
      await updateDoc(noteRef, {
        note_text: noteText,
        time_spent_minutes: timeSpent,
        updated_at: Timestamp.now(),
        is_edited: true,
      });

      await fetchWorkNotes();
      toast({
        title: "Note Updated",
        description: "Work note has been updated successfully",
      });
    } catch (error: any) {
      console.error('Error updating work note:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update work note",
        variant: "destructive",
      });
    }
  }, [user, fetchWorkNotes]);

  const addWorkLog = useCallback(async (log: Omit<WorkLog, 'log_id' | 'created_at'>) => {
    try {
      const logRef = doc(collection(db, 'user_work_logs'));
      await setDoc(logRef, {
        ...log,
        created_at: Timestamp.now(),
      });

      await fetchWorkLogs();
    } catch (error) {
      console.error('Error adding work log:', error);
    }
  }, [fetchWorkLogs]);

  const getWorkLogsByUser = useCallback((userId?: string, date?: string) => {
    let filtered = workLogs;
    
    if (userId) {
      filtered = filtered.filter(log => log.user_id === userId);
    }
    
    if (date) {
      filtered = filtered.filter(log => log.work_date === date);
    }
    
    return filtered;
  }, [workLogs]);

  const getWorkLogsByOrder = useCallback((orderId: string) => {
    return workLogs.filter(log => log.order_id === orderId);
  }, [workLogs]);

  const getWorkNotesByOrder = useCallback((orderId: string, itemId?: string) => {
    let filtered = workNotes.filter(note => note.order_id === orderId);
    
    if (itemId) {
      filtered = filtered.filter(note => note.order_item_id === itemId);
    }
    
    return filtered.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [workNotes]);

  const getDailyPerformanceReport = useCallback(async (
    userId: string,
    date: string
  ): Promise<DailyPerformanceReport | null> => {
    try {
      // Query without orderBy first to avoid index issues, then sort in memory
      const q = query(
        collection(db, 'user_work_logs'),
        where('user_id', '==', userId),
        where('work_date', '==', date)
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;

      const logs: WorkLog[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        logs.push({
          log_id: docSnap.id,
          user_id: data.user_id,
          user_name: data.user_name,
          department: data.department,
          order_id: data.order_id,
          order_item_id: data.order_item_id || null,
          order_number: data.order_number,
          product_name: data.product_name || undefined,
          stage: data.stage,
          action_type: data.action_type,
          work_summary: data.work_summary,
          time_spent_minutes: data.time_spent_minutes || 0,
          work_date: data.work_date,
          created_at: data.created_at?.toDate() || new Date(),
        });
      });

      // Sort by created_at in memory
      logs.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());

      // Group by order
      const orderMap = new Map<string, {
        order_id: string;
        order_number: string;
        order_item_id: string | null;
        product_name: string;
        stage: string;
        notes_count: number;
        time_spent_minutes: number;
        actions: string[];
      }>();

      logs.forEach(log => {
        const key = `${log.order_id}_${log.order_item_id || 'null'}`;
        if (!orderMap.has(key)) {
          orderMap.set(key, {
            order_id: log.order_id,
            order_number: log.order_number,
            order_item_id: log.order_item_id,
            product_name: log.product_name || 'Unknown Product', // Use product_name from log
            stage: log.stage,
            notes_count: 0,
            time_spent_minutes: 0,
            actions: [],
          });
        }
        
        const entry = orderMap.get(key)!;
        entry.time_spent_minutes += log.time_spent_minutes;
        entry.actions.push(log.action_type);
        if (log.action_type === 'note_added') {
          entry.notes_count++;
        }
        // Update product name if available
        if (log.product_name && !entry.product_name) {
          entry.product_name = log.product_name;
        }
      });

      const totalTime = logs.reduce((sum, log) => sum + log.time_spent_minutes, 0);
      const uniqueOrders = new Set(logs.map(log => log.order_id)).size;

      return {
        user_id: userId,
        user_name: logs[0]?.user_name || 'Unknown',
        department: logs[0]?.department || 'unknown',
        work_date: date,
        total_time_minutes: totalTime,
        total_orders: uniqueOrders,
        order_breakdown: Array.from(orderMap.values()),
      };
    } catch (error) {
      console.error('Error generating performance report:', error);
      return null;
    }
  }, []);

  const refreshWorkLogs = useCallback(async () => {
    await fetchWorkLogs();
  }, [fetchWorkLogs]);

  const refreshWorkNotes = useCallback(async () => {
    await fetchWorkNotes();
  }, [fetchWorkNotes]);

  return (
    <WorkLogContext.Provider
      value={{
        workLogs,
        workNotes,
        isLoading,
        addWorkNote,
        updateWorkNote,
        addWorkLog,
        getWorkLogsByUser,
        getWorkLogsByOrder,
        getDailyPerformanceReport,
        getWorkNotesByOrder,
        refreshWorkLogs,
        refreshWorkNotes,
      }}
    >
      {children}
    </WorkLogContext.Provider>
  );
}

export function useWorkLogs() {
  const context = useContext(WorkLogContext);
  if (context === undefined) {
    throw new Error('useWorkLogs must be used within a WorkLogProvider');
  }
  return context;
}



