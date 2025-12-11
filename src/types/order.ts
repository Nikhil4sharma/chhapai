export type Priority = 'blue' | 'yellow' | 'red';

export type Stage = 'sales' | 'design' | 'prepress' | 'production' | 'dispatch' | 'completed';

export type SubStage = 'foiling' | 'printing' | 'pasting' | 'cutting' | 'letterpress' | 'embossing' | 'packing' | null;

export type UserRole = 'sales' | 'design' | 'prepress' | 'production' | 'admin';

export interface Customer {
  name: string;
  phone: string;
  email: string;
  address: string;
}

export interface OrderFile {
  file_id: string;
  url: string;
  type: 'proof' | 'final' | 'image' | 'other';
  uploaded_by: string;
  uploaded_at: Date;
  is_public?: boolean;
}

export interface OrderFile {
  file_id: string;
  url: string;
  file_name?: string;
  type: 'proof' | 'final' | 'image' | 'other';
  uploaded_by: string;
  uploaded_at: Date;
  is_public?: boolean;
}

export interface OrderItem {
  item_id: string;
  order_id: string;
  product_name: string;
  sku?: string;
  quantity: number;
  specifications: {
    paper?: string;
    size?: string;
    finishing?: string;
    notes?: string;
  };
  need_design: boolean;
  current_stage: Stage;
  current_substage: SubStage;
  assigned_to?: string;
  assigned_to_name?: string | null;
  assigned_department: UserRole;
  delivery_date: Date;
  priority_computed: Priority;
  files: OrderFile[];
  is_ready_for_production: boolean;
  is_dispatched: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Order {
  id?: string; // UUID from Supabase
  order_id: string;
  source: 'wordpress' | 'manual';
  customer: Customer;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  global_notes?: string;
  is_completed: boolean;
  order_level_delivery_date?: Date;
  priority_computed: Priority;
  items: OrderItem[];
  meta?: {
    wp_order_id?: number;
    imported?: boolean;
  };
}

export interface TimelineEntry {
  timeline_id: string;
  order_id: string;
  item_id?: string;
  stage: Stage;
  substage?: SubStage;
  action: 'created' | 'assigned' | 'uploaded_proof' | 'customer_approved' | 'final_proof_uploaded' | 'sent_to_production' | 'substage_started' | 'substage_completed' | 'packed' | 'dispatched' | 'note_added';
  performed_by: string;
  performed_by_name: string;
  notes?: string;
  attachments?: { url: string; type: string }[];
  qty_confirmed?: number;
  paper_treatment?: string;
  created_at: Date;
  is_public?: boolean;
}

export interface User {
  user_id: string;
  name: string;
  email: string;
  phone?: string;
  roles: UserRole[];
  team: 'Sales' | 'Design' | 'Prepress' | 'Production';
  avatar_url?: string;
}

export const PRODUCTION_STEPS = [
  { key: 'foiling', label: 'Foiling', order: 1 },
  { key: 'printing', label: 'Printing', order: 2 },
  { key: 'pasting', label: 'Pasting', order: 3 },
  { key: 'cutting', label: 'Cutting', order: 4 },
  { key: 'letterpress', label: 'Letterpress', order: 5 },
  { key: 'embossing', label: 'Embossing', order: 6 },
  { key: 'packing', label: 'Packing', order: 7 },
] as const;

export const STAGE_LABELS: Record<Stage, string> = {
  sales: 'Sales',
  design: 'Design',
  prepress: 'Prepress',
  production: 'Production',
  dispatch: 'Dispatch',
  completed: 'Completed',
};
