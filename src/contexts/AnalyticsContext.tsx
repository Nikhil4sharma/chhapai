import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { 
  DeliveryPerformanceMetrics, 
  DepartmentEfficiencyMetrics, 
  UserProductivityMetrics,
  OrderHealthScore,
  DelayReason,
  VendorAnalytics,
  ExecutiveKPIs,
  DelayReasonCategory,
  AnalyticsContextType
} from '@/types/analytics';
import { Order, Stage, UserRole } from '@/types/order';
import { WorkLog } from '@/types/worklog';
import { useOrders } from './OrderContext';
import { useWorkLogs } from './WorkLogContext';
import { useAuth } from './AuthContext';
import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  query, 
  where, 
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import {
  calculateDeliveryPerformance,
  calculateDepartmentEfficiency,
  calculateUserProductivity,
  calculateOrderHealthScore,
  calculateOrderHealthScoreEnhanced,
  calculateDeliveryStatus
} from '@/utils/analytics';
import { autoEnhanceAnalytics, loadLearningData } from '@/utils/analyticsLearning';
import { toast } from '@/hooks/use-toast';

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const { orders } = useOrders();
  const { workLogs } = useWorkLogs();
  const { user, profile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [learningData, setLearningData] = useState<any>(null);

  // Auto-enhance analytics periodically
  useEffect(() => {
    if (orders.length > 0 && workLogs.length > 0) {
      // Run learning every 30 minutes or when orders change significantly
      const enhanceTimer = setInterval(async () => {
        try {
          const enhanced = await autoEnhanceAnalytics(orders, workLogs);
          setLearningData(enhanced);
        } catch (error) {
          console.error('Error auto-enhancing analytics:', error);
        }
      }, 30 * 60 * 1000); // 30 minutes

      // Initial enhancement
      autoEnhanceAnalytics(orders, workLogs).then(setLearningData).catch(console.error);

      return () => clearInterval(enhanceTimer);
    }
  }, [orders.length, workLogs.length]);

  // Get Delivery Performance
  const getDeliveryPerformance = useCallback(async (
    startDate: Date,
    endDate: Date
  ): Promise<DeliveryPerformanceMetrics> => {
    setIsLoading(true);
    try {
      return calculateDeliveryPerformance(orders, startDate, endDate);
    } catch (error) {
      console.error('Error calculating delivery performance:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [orders]);

  // Get Department Efficiency
  const getDepartmentEfficiency = useCallback(async (
    department: UserRole,
    startDate: Date,
    endDate: Date
  ): Promise<DepartmentEfficiencyMetrics> => {
    setIsLoading(true);
    try {
      return calculateDepartmentEfficiency(orders, workLogs, department, startDate, endDate);
    } catch (error) {
      console.error('Error calculating department efficiency:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [orders, workLogs]);

  // Get All Departments Efficiency
  const getAllDepartmentsEfficiency = useCallback(async (
    startDate: Date,
    endDate: Date
  ): Promise<Record<UserRole, DepartmentEfficiencyMetrics>> => {
    setIsLoading(true);
    try {
      const departments: UserRole[] = ['sales', 'design', 'prepress', 'production', 'outsource'];
      const results: Record<string, DepartmentEfficiencyMetrics> = {};
      
      for (const dept of departments) {
        results[dept] = await calculateDepartmentEfficiency(orders, workLogs, dept, startDate, endDate);
      }
      
      return results as Record<UserRole, DepartmentEfficiencyMetrics>;
    } catch (error) {
      console.error('Error calculating all departments efficiency:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [orders, workLogs]);

  // Get User Productivity
  const getUserProductivity = useCallback(async (
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<UserProductivityMetrics> => {
    setIsLoading(true);
    try {
      // Get user name from profile or work logs
      const userLog = workLogs.find(log => log.user_id === userId);
      const userName = userLog?.user_name || 'Unknown';
      const department = userLog?.department as UserRole || 'sales';
      
      return calculateUserProductivity(userId, userName, department, workLogs, orders, startDate, endDate);
    } catch (error) {
      console.error('Error calculating user productivity:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [orders, workLogs]);

  // Get All Users Productivity
  const getAllUsersProductivity = useCallback(async (
    startDate: Date,
    endDate: Date
  ): Promise<UserProductivityMetrics[]> => {
    setIsLoading(true);
    try {
      const userIds = new Set(workLogs.map(log => log.user_id));
      const results: UserProductivityMetrics[] = [];
      
      for (const userId of userIds) {
        const metrics = await getUserProductivity(userId, startDate, endDate);
        results.push(metrics);
      }
      
      return results.sort((a, b) => b.productivity_score - a.productivity_score);
    } catch (error) {
      console.error('Error calculating all users productivity:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [workLogs, getUserProductivity]);

  // Get Delay Reasons (moved before getOrderHealthScore to avoid hoisting issue)
  const getDelayReasons = useCallback(async (
    orderId: string,
    itemId?: string
  ): Promise<DelayReason[]> => {
    try {
      let q;
      if (itemId) {
        q = query(
          collection(db, 'delay_reasons'),
          where('order_id', '==', orderId),
          where('item_id', '==', itemId),
          orderBy('reported_at', 'desc')
        );
      } else {
        q = query(
          collection(db, 'delay_reasons'),
          where('order_id', '==', orderId),
          orderBy('reported_at', 'desc')
        );
      }
      
      const snapshot = await getDocs(q);
      const reasons: DelayReason[] = [];
      
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        reasons.push({
          reason_id: docSnap.id,
          order_id: data.order_id,
          item_id: data.item_id,
          category: data.category,
          reason: data.reason,
          description: data.description,
          stage: data.stage,
          reported_by: data.reported_by,
          reported_by_name: data.reported_by_name,
          reported_at: data.reported_at?.toDate() || new Date(),
          resolved_at: data.resolved_at?.toDate(),
          is_resolved: data.is_resolved || false,
        });
      });
      
      return reasons;
    } catch (error: any) {
      // Suppress index errors during initial page load - indexes may still be building
      if (error?.code === 'failed-precondition' && error?.message?.includes('index')) {
        // Index is being created, silently return empty array
        return [];
      }
      console.error('Error fetching delay reasons:', error);
      return [];
    }
  }, []);

  // Get Order Health Score
  const getOrderHealthScore = useCallback(async (
    orderId: string,
    itemId?: string
  ): Promise<OrderHealthScore> => {
    setIsLoading(true);
    try {
      const order = orders.find(o => o.order_id === orderId);
      if (!order) {
        throw new Error('Order not found');
      }
      
      const item = itemId 
        ? order.items.find(i => i.item_id === itemId)
        : order.items[0];
      
      if (!item) {
        throw new Error('Item not found');
      }
      
      // Get user workload (simplified - count of assigned orders)
      const userWorkload = item.assigned_to 
        ? orders.filter(o => o.items.some(i => i.assigned_to === item.assigned_to)).length
        : undefined;
      
      // Get historical delays (simplified - count delay reasons for this order)
      const delayReasons = await getDelayReasons(orderId, itemId);
      const historicalDelays = delayReasons.length;
      
      // Use enhanced calculation with learning data if available
      if (learningData) {
        return await calculateOrderHealthScoreEnhanced(item, order, userWorkload, historicalDelays, learningData);
      }
      
      return calculateOrderHealthScore(item, order, userWorkload, historicalDelays);
    } catch (error) {
      console.error('Error calculating order health score:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [orders, getDelayReasons]);

  // Get All Order Health Scores
  const getAllOrderHealthScores = useCallback(async (): Promise<OrderHealthScore[]> => {
    setIsLoading(true);
    try {
      const scores: OrderHealthScore[] = [];
      
      for (const order of orders) {
        for (const item of order.items) {
          if (!item.is_dispatched && item.current_stage !== 'completed') {
            try {
              const score = await getOrderHealthScore(order.order_id, item.item_id);
              scores.push(score);
            } catch (error) {
              console.error(`Error calculating health score for ${order.order_id}:`, error);
            }
          }
        }
      }
      
      return scores.sort((a, b) => a.score - b.score); // Sort by score ascending (worst first)
    } catch (error) {
      console.error('Error calculating all order health scores:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [orders, getOrderHealthScore]);

  // Add Delay Reason
  const addDelayReason = useCallback(async (
    reason: Omit<DelayReason, 'reason_id' | 'reported_at'>
  ): Promise<void> => {
    if (!user || !profile) {
      throw new Error('User not authenticated');
    }
    
    try {
      const reasonRef = doc(collection(db, 'delay_reasons'));
      await setDoc(reasonRef, {
        order_id: reason.order_id,
        item_id: reason.item_id || null,
        category: reason.category,
        reason: reason.reason,
        description: reason.description || null,
        stage: reason.stage,
        reported_by: reason.reported_by,
        reported_by_name: reason.reported_by_name,
        reported_at: Timestamp.now(),
        resolved_at: null,
        is_resolved: false,
      });
      
      toast({
        title: "Delay Reason Recorded",
        description: "Delay reason has been recorded successfully",
      });
    } catch (error) {
      console.error('Error adding delay reason:', error);
      toast({
        title: "Error",
        description: "Failed to record delay reason",
        variant: "destructive",
      });
      throw error;
    }
  }, [user, profile]);

  // Get Delay Reason Stats
  const getDelayReasonStats = useCallback(async (
    startDate: Date,
    endDate: Date
  ): Promise<{
    by_category: Record<DelayReasonCategory, number>;
    by_stage: Record<Stage, number>;
    most_common: Array<{ category: DelayReasonCategory; count: number }>;
  }> => {
    try {
      const q = query(
        collection(db, 'delay_reasons'),
        where('reported_at', '>=', Timestamp.fromDate(startDate)),
        where('reported_at', '<=', Timestamp.fromDate(endDate))
      );
      
      const snapshot = await getDocs(q);
      const byCategory: Record<string, number> = {};
      const byStage: Record<string, number> = {};
      
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const category = data.category as DelayReasonCategory;
        const stage = data.stage as Stage;
        
        byCategory[category] = (byCategory[category] || 0) + 1;
        byStage[stage] = (byStage[stage] || 0) + 1;
      });
      
      const mostCommon = Object.entries(byCategory)
        .map(([category, count]) => ({ category: category as DelayReasonCategory, count }))
        .sort((a, b) => b.count - a.count);
      
      return {
        by_category: byCategory as Record<DelayReasonCategory, number>,
        by_stage: byStage as Record<Stage, number>,
        most_common: mostCommon,
      };
    } catch (error) {
      // Suppress index errors during initial page load - indexes may still be building
      if (error?.code === 'failed-precondition' && error?.message?.includes('index')) {
        // Index is being created, return empty stats
        return {
          by_category: {} as Record<DelayReasonCategory, number>,
          by_stage: {} as Record<Stage, number>,
          most_common: [],
        };
      }
      console.error('Error fetching delay reason stats:', error);
      return {
        by_category: {} as Record<DelayReasonCategory, number>,
        by_stage: {} as Record<Stage, number>,
        most_common: [],
      };
    }
  }, []);

  // Get Vendor Analytics
  const getVendorAnalytics = useCallback(async (
    vendorName: string,
    startDate: Date,
    endDate: Date
  ): Promise<VendorAnalytics> => {
    setIsLoading(true);
    try {
      const vendorOrders = orders.filter(order =>
        order.items.some(item => 
          item.outsource_info?.vendor.vendor_name === vendorName &&
          order.created_at >= startDate &&
          order.created_at <= endDate
        )
      );
      
      // TODO: Implement full vendor analytics calculation
      return {
        vendor_name: vendorName,
        date_range: { start: startDate, end: endDate },
        total_orders: vendorOrders.length,
        average_turnaround_time_hours: 0,
        delay_percentage: 0,
        quality_issues_count: 0,
        follow_up_effectiveness: 0,
        vs_inhouse_performance: {
          faster_by_percentage: 0,
          slower_by_percentage: 0,
        },
      };
    } catch (error) {
      console.error('Error calculating vendor analytics:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [orders]);

  // Get All Vendors Analytics
  const getAllVendorsAnalytics = useCallback(async (
    startDate: Date,
    endDate: Date
  ): Promise<VendorAnalytics[]> => {
    setIsLoading(true);
    try {
      const vendorNames = new Set<string>();
      orders.forEach(order => {
        order.items.forEach(item => {
          if (item.outsource_info?.vendor.vendor_name) {
            vendorNames.add(item.outsource_info.vendor.vendor_name);
          }
        });
      });
      
      const results: VendorAnalytics[] = [];
      for (const vendorName of vendorNames) {
        const analytics = await getVendorAnalytics(vendorName, startDate, endDate);
        results.push(analytics);
      }
      
      return results;
    } catch (error) {
      console.error('Error calculating all vendors analytics:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [orders, getVendorAnalytics]);

  // Get Executive KPIs
  const getExecutiveKPIs = useCallback(async (
    startDate: Date,
    endDate: Date
  ): Promise<ExecutiveKPIs> => {
    setIsLoading(true);
    try {
      const deliveryMetrics = await getDeliveryPerformance(startDate, endDate);
      const delayStats = await getDelayReasonStats(startDate, endDate);
      const allDeptEfficiency = await getAllDepartmentsEfficiency(startDate, endDate);
      const healthScores = await getAllOrderHealthScores();
      
      const activeOrders = orders.filter(o => !o.is_completed).length;
      const atRiskOrders = healthScores.filter(s => s.status === 'yellow').length;
      const delayedOrders = healthScores.filter(s => s.status === 'red').length;
      
      // Calculate department efficiency scores (0-100)
      const deptScores: Record<UserRole, number> = {} as any;
      Object.keys(allDeptEfficiency).forEach(dept => {
        const metrics = allDeptEfficiency[dept as UserRole];
        const processedRatio = metrics.orders_processed / (metrics.orders_processed + metrics.orders_pending);
        deptScores[dept as UserRole] = Math.round(processedRatio * 100);
      });
      
      // Identify bottlenecks (departments with low efficiency)
      const bottleneckDepartments = Object.keys(deptScores)
        .filter(dept => deptScores[dept as UserRole] < 50)
        .map(dept => dept as UserRole);
      
      // Generate risk alerts
      const riskAlerts: ExecutiveKPIs['risk_alerts'] = [];
      
      if (delayedOrders > 10) {
        riskAlerts.push({
          type: 'delay',
          severity: 'high',
          message: `${delayedOrders} orders are at risk of delay`,
          affected_orders: healthScores.filter(s => s.status === 'red').map(s => s.order_id).slice(0, 10),
        });
      }
      
      if (bottleneckDepartments.length > 0) {
        riskAlerts.push({
          type: 'bottleneck',
          severity: 'medium',
          message: `Bottlenecks detected in: ${bottleneckDepartments.join(', ')}`,
          affected_orders: [],
        });
      }
      
      return {
        date_range: { start: startDate, end: endDate },
        total_orders: deliveryMetrics.total_orders,
        on_time_delivery_rate: deliveryMetrics.on_time_percentage,
        average_order_lifecycle_hours: deliveryMetrics.average_lifecycle_duration_hours,
        active_orders: activeOrders,
        at_risk_orders: atRiskOrders,
        delayed_orders: delayedOrders,
        department_efficiency_scores: deptScores,
        top_delay_causes: delayStats.most_common.slice(0, 5),
        bottleneck_departments: bottleneckDepartments,
        risk_alerts: riskAlerts,
      };
    } catch (error) {
      console.error('Error calculating executive KPIs:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [orders, getDeliveryPerformance, getDelayReasonStats, getAllDepartmentsEfficiency, getAllOrderHealthScores]);

  return (
    <AnalyticsContext.Provider
      value={{
        getDeliveryPerformance,
        getDepartmentEfficiency,
        getAllDepartmentsEfficiency,
        getUserProductivity,
        getAllUsersProductivity,
        getOrderHealthScore,
        getAllOrderHealthScores,
        addDelayReason,
        getDelayReasons,
        getDelayReasonStats,
        getVendorAnalytics,
        getAllVendorsAnalytics,
        getExecutiveKPIs,
        isLoading,
      }}
    >
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics() {
  const context = useContext(AnalyticsContext);
  if (context === undefined) {
    throw new Error('useAnalytics must be used within an AnalyticsProvider');
  }
  return context;
}

