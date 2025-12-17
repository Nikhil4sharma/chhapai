export interface WorkLog {
  log_id: string;
  user_id: string;
  user_name: string;
  department: string;
  order_id: string;
  order_item_id: string | null;
  order_number: string;
  product_name?: string; // Product name for better reporting
  stage: string;
  action_type: 'note_added' | 'stage_updated' | 'file_uploaded' | 'issue_reported' | 'task_completed' | 'assigned' | 'substage_started' | 'substage_completed' | 'delivery_date_updated' | 'order_created';
  work_summary: string;
  time_spent_minutes: number;
  start_time?: Date; // When the action started
  end_time?: Date; // When the action ended
  work_date: string; // YYYY-MM-DD
  created_at: Date;
  updated_at?: Date;
}

export interface WorkNote {
  note_id: string;
  order_id: string;
  order_item_id: string | null;
  user_id: string;
  user_name: string;
  department: string;
  stage: string;
  note_text: string;
  time_spent_minutes?: number;
  created_at: Date;
  updated_at?: Date;
  is_edited?: boolean;
}

export interface DailyPerformanceReport {
  user_id: string;
  user_name: string;
  department: string;
  work_date: string;
  total_time_minutes: number;
  total_orders: number;
  order_breakdown: {
    order_id: string;
    order_number: string;
    order_item_id: string | null;
    product_name: string;
    stage: string;
    notes_count: number;
    time_spent_minutes: number;
    actions: string[];
  }[];
}


