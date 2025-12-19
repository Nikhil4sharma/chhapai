import { createClient } from '@supabase/supabase-js';

// Supabase configuration - environment variables se lelo
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hswgdeldouyclpeqbbgq.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Create a mock client if key is missing (for graceful degradation)
let supabaseClient: any = null;

if (!supabaseAnonKey || supabaseAnonKey.trim() === '') {
  const errorMsg = `❌ VITE_SUPABASE_ANON_KEY is required!

Please create a .env file in project root with:
VITE_SUPABASE_URL=https://hswgdeldouyclpeqbbgq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhzd2dkZWxkb3V5Y2xwZXFiYmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMzU2NjAsImV4cCI6MjA4MTcxMTY2MH0.1Np96vCvDdFy_s2LSneyoorOLUvlpUw2AcAAemX3BnI

Get your anon key from:
https://app.supabase.com/project/hswgdeldouyclpeqbbgq/settings/api
(Copy the "anon public" key)

Then restart the dev server (npm run dev)`;
  console.error(errorMsg);
  // In development, create a mock client to prevent app crash
  if (import.meta.env.DEV) {
    console.warn('⚠️ Running without Supabase key - creating mock client');
    console.warn('⚠️ App will not work properly until key is set!');
    // Create a minimal mock client
    supabaseClient = {
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signInWithPassword: () => Promise.resolve({ error: new Error('Supabase key not set') }),
        signUp: () => Promise.resolve({ error: new Error('Supabase key not set') }),
        signOut: () => Promise.resolve({ error: null }),
        updateUser: () => Promise.resolve({ error: null }),
      },
      from: () => ({
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
        insert: () => Promise.resolve({ error: null }),
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      }),
    };
  } else {
    // In production, throw error
    throw new Error(errorMsg);
  }
}

// Create Supabase client (or use mock if key is missing)
if (!supabaseClient) {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch (error) {
    console.error('Error creating Supabase client:', error);
    // Fallback to mock client
    supabaseClient = {
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signInWithPassword: () => Promise.resolve({ error: new Error('Supabase client error') }),
        signUp: () => Promise.resolve({ error: new Error('Supabase client error') }),
        signOut: () => Promise.resolve({ error: null }),
        updateUser: () => Promise.resolve({ error: null }),
      },
      from: () => ({
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
        insert: () => Promise.resolve({ error: null }),
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      }),
    };
  }
}

// Export the client
export const supabase = supabaseClient;

// Database types (PostgreSQL tables se match karega)
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          full_name: string | null;
          department: string | null;
          phone: string | null;
          avatar_url: string | null;
          production_stage: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          full_name?: string | null;
          department?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          production_stage?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          full_name?: string | null;
          department?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          production_stage?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: 'admin' | 'sales' | 'design' | 'prepress' | 'production';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: 'admin' | 'sales' | 'design' | 'prepress' | 'production';
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: 'admin' | 'sales' | 'design' | 'prepress' | 'production';
          created_at?: string;
        };
      };
      orders: {
        Row: {
          id: string;
          order_id: string;
          source: string;
          customer_name: string;
          customer_phone: string | null;
          customer_email: string | null;
          customer_address: string | null;
          billing_city: string | null;
          billing_state: string | null;
          billing_pincode: string | null;
          shipping_name: string | null;
          shipping_email: string | null;
          shipping_phone: string | null;
          shipping_address: string | null;
          shipping_city: string | null;
          shipping_state: string | null;
          shipping_pincode: string | null;
          order_total: number | null;
          tax_cgst: number | null;
          tax_sgst: number | null;
          payment_status: string | null;
          woo_order_id: number | null;
          order_status: string | null;
          created_by: string | null;
          global_notes: string | null;
          is_completed: boolean;
          delivery_date: string | null;
          priority: string;
          created_at: string;
          updated_at: string;
          archived_from_wc: boolean;
        };
        Insert: any;
        Update: any;
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_name: string;
          sku: string | null;
          quantity: number;
          specifications: any;
          woo_meta: any;
          need_design: boolean;
          current_stage: string;
          current_substage: string | null;
          assigned_to: string | null;
          assigned_department: string;
          delivery_date: string | null;
          priority: string;
          is_ready_for_production: boolean;
          is_dispatched: boolean;
          dispatch_info: any | null;
          production_stage_sequence: any | null;
          outsource_info: any | null;
          created_at: string;
          updated_at: string;
        };
        Insert: any;
        Update: any;
      };
      order_files: {
        Row: {
          id: string;
          order_id: string | null;
          item_id: string | null;
          file_url: string;
          file_name: string;
          file_type: string;
          uploaded_by: string | null;
          is_public: boolean;
          created_at: string;
        };
        Insert: any;
        Update: any;
      };
      timeline: {
        Row: {
          id: string;
          order_id: string;
          item_id: string | null;
          product_name: string | null;
          stage: string;
          substage: string | null;
          action: string;
          performed_by: string | null;
          performed_by_name: string | null;
          notes: string | null;
          attachments: any;
          qty_confirmed: number | null;
          paper_treatment: string | null;
          is_public: boolean;
          created_at: string;
        };
        Insert: any;
        Update: any;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          order_id: string | null;
          item_id: string | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: any;
        Update: any;
      };
      user_settings: {
        Row: {
          id: string;
          user_id: string;
          sound_enabled: boolean;
          push_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: any;
        Update: any;
      };
      user_work_logs: {
        Row: {
          log_id: string;
          user_id: string;
          user_name: string;
          department: string;
          order_id: string;
          order_item_id: string | null;
          order_number: string;
          stage: string;
          action_type: string;
          work_summary: string;
          time_spent_minutes: number;
          work_date: string;
          created_at: string;
          updated_at: string | null;
        };
        Insert: any;
        Update: any;
      };
      work_notes: {
        Row: {
          id: string;
          user_id: string;
          order_id: string;
          order_item_id: string | null;
          note_text: string;
          time_spent_minutes: number | null;
          created_at: string;
          updated_at: string | null;
          is_edited: boolean;
        };
        Insert: any;
        Update: any;
      };
    };
  };
};
