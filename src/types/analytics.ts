import { Order, OrderItem, Stage, UserRole } from './order';
import { WorkLog } from './worklog';

// Delay Reason Categories
export type DelayReasonCategory = 
  | 'design' 
  | 'client' 
  | 'prepress' 
  | 'production' 
  | 'outsource_vendor' 
  | 'material' 
  | 'courier' 
  | 'internal_process';

export interface DelayReason {
  reason_id: string;
  order_id: string;
  item_id?: string;
  category: DelayReasonCategory;
  reason: string;
  description?: string;
  stage: Stage;
  reported_by: string;
  reported_by_name: string;
  reported_at: Date;
  resolved_at?: Date;
  is_resolved: boolean;
}

export type DeliveryStatus = 'on_time' | 'delayed' | 'at_risk' | 'not_started';

export interface OrderHealthScore {
  order_id: string;
  item_id?: string;
  score: number; // 0-100
  status: 'green' | 'yellow' | 'red';
  factors: {
    deadline_proximity: number;
    stage_duration: number;
    user_workload: number;
    historical_delays: number;
  };
  calculated_at: Date;
}

// Delivery Performance Analytics
export interface DeliveryPerformanceMetrics {
  date_range: {
    start: Date;
    end: Date;
  };
  total_orders: number;
  on_time_deliveries: number;
  delayed_deliveries: number;
  at_risk_deliveries: number;
  on_time_percentage: number;
  average_lifecycle_duration_hours: number;
  department_delays: Record<UserRole, {
    count: number;
    percentage: number;
    average_delay_hours: number;
  }>;
  product_delays: Record<string, {
    count: number;
    percentage: number;
    average_delay_hours: number;
  }>;
}

// Department Efficiency Metrics
export interface DepartmentEfficiencyMetrics {
  department: UserRole;
  date_range: {
    start: Date;
    end: Date;
  };
  average_time_per_stage_hours: Record<Stage, number>;
  orders_processed: number;
  orders_pending: number;
  handover_delays_hours: Record<string, number>; // stage -> avg delay
  workload_vs_throughput_ratio: number;
  bottleneck_stages: Stage[];
}

// User Productivity Metrics
export interface UserProductivityMetrics {
  user_id: string;
  user_name: string;
  department: UserRole;
  date_range: {
    start: Date;
    end: Date;
  };
  daily_working_hours: Record<string, number>; // date -> hours
  weekly_working_hours: number;
  orders_handled: number;
  average_time_per_order_minutes: number;
  delay_contributions: number;
  delay_resolutions: number;
  productivity_score: number; // 0-100
  is_overloaded: boolean;
  is_underutilized: boolean;
  performance_trend: 'improving' | 'stable' | 'declining';
}

// Outsource Vendor Analytics
export interface VendorAnalytics {
  vendor_name: string;
  date_range: {
    start: Date;
    end: Date;
  };
  total_orders: number;
  average_turnaround_time_hours: number;
  delay_percentage: number;
  quality_issues_count: number;
  follow_up_effectiveness: number; // 0-100
  vs_inhouse_performance: {
    faster_by_percentage: number;
    slower_by_percentage: number;
  };
}

// Executive Dashboard KPIs
export interface ExecutiveKPIs {
  date_range: {
    start: Date;
    end: Date;
  };
  total_orders: number;
  on_time_delivery_rate: number;
  average_order_lifecycle_hours: number;
  active_orders: number;
  at_risk_orders: number;
  delayed_orders: number;
  department_efficiency_scores: Record<UserRole, number>;
  top_delay_causes: Array<{
    category: DelayReasonCategory;
    count: number;
    percentage: number;
  }>;
  bottleneck_departments: UserRole[];
  risk_alerts: Array<{
    type: 'delay' | 'bottleneck' | 'overload' | 'quality';
    severity: 'high' | 'medium' | 'low';
    message: string;
    affected_orders: string[];
  }>;
}

// Analytics Context Type
export interface AnalyticsContextType {
  // Delivery Performance
  getDeliveryPerformance: (startDate: Date, endDate: Date) => Promise<DeliveryPerformanceMetrics>;
  
  // Department Efficiency
  getDepartmentEfficiency: (department: UserRole, startDate: Date, endDate: Date) => Promise<DepartmentEfficiencyMetrics>;
  getAllDepartmentsEfficiency: (startDate: Date, endDate: Date) => Promise<Record<UserRole, DepartmentEfficiencyMetrics>>;
  
  // User Productivity
  getUserProductivity: (userId: string, startDate: Date, endDate: Date) => Promise<UserProductivityMetrics>;
  getAllUsersProductivity: (startDate: Date, endDate: Date) => Promise<UserProductivityMetrics[]>;
  
  // Order Health
  getOrderHealthScore: (orderId: string, itemId?: string) => Promise<OrderHealthScore>;
  getAllOrderHealthScores: () => Promise<OrderHealthScore[]>;
  
  // Delay Reasons
  addDelayReason: (reason: Omit<DelayReason, 'reason_id' | 'reported_at'>) => Promise<void>;
  getDelayReasons: (orderId: string, itemId?: string) => Promise<DelayReason[]>;
  getDelayReasonStats: (startDate: Date, endDate: Date) => Promise<{
    by_category: Record<DelayReasonCategory, number>;
    by_stage: Record<Stage, number>;
    most_common: Array<{ category: DelayReasonCategory; count: number }>;
  }>;
  
  // Vendor Analytics
  getVendorAnalytics: (vendorName: string, startDate: Date, endDate: Date) => Promise<VendorAnalytics>;
  getAllVendorsAnalytics: (startDate: Date, endDate: Date) => Promise<VendorAnalytics[]>;
  
  // Executive Dashboard
  getExecutiveKPIs: (startDate: Date, endDate: Date) => Promise<ExecutiveKPIs>;
  
  isLoading: boolean;
}



