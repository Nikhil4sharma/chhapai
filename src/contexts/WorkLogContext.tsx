import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { WorkLog, WorkNote, DailyPerformanceReport } from '@/types/worklog';
import { useAuth } from '@/features/auth/context/AuthContext';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
// Firebase removed - using Supabase only
// TODO: Migrate work logs and work notes to Supabase tables

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
    if (!user || !user.id) {
      setIsLoading(false);
      return;
    }

    // TODO: Migrate to Supabase user_work_logs table
    // For now, return empty array to prevent errors
    try {
      setWorkLogs([]);
    } catch (error) {
      console.error('Error fetching work logs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, role]);

  const fetchWorkNotes = useCallback(async () => {
    if (!user || !user.id) return;

    // TODO: Migrate to Supabase work_notes table
    // For now, return empty array to prevent errors
    try {
      setWorkNotes([]);
    } catch (error) {
      console.error('Error fetching work notes:', error);
    }
  }, [user, role]);

  useEffect(() => {
    if (!user || !user.id) return;

    fetchWorkLogs();
    fetchWorkNotes();

    // TODO: Add Supabase realtime subscriptions when tables are migrated
    // No Firebase subscriptions needed - using Supabase only
  }, [user, role, fetchWorkLogs, fetchWorkNotes]);

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

    // TODO: Migrate to Supabase work_notes table
    toast({
      title: "Coming Soon",
      description: "Work notes feature will be available after Supabase migration",
    });
  }, [user, profile, role, fetchWorkNotes]);

  const updateWorkNote = useCallback(async (
    noteId: string,
    noteText: string,
    timeSpent?: number
  ) => {
    if (!user) return;

    // TODO: Migrate to Supabase work_notes table
    toast({
      title: "Coming Soon",
      description: "Work notes update will be available after Supabase migration",
    });
  }, [user, fetchWorkNotes]);

  const addWorkLog = useCallback(async (log: Omit<WorkLog, 'log_id' | 'created_at'>) => {
    // TODO: Migrate to Supabase user_work_logs table
    // Silently skip for now to prevent errors
    try {
      // No-op - will be implemented with Supabase
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
    // TODO: Migrate to Supabase user_work_logs table
    // For now, return null to prevent errors
    try {
      return null;
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



