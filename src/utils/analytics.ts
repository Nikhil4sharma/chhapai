import { Order, OrderItem, Stage, UserRole } from '@/types/order';
import { WorkLog } from '@/types/worklog';
import { 
  DeliveryPerformanceMetrics, 
  DepartmentEfficiencyMetrics, 
  UserProductivityMetrics,
  OrderHealthScore,
  DeliveryStatus,
  DelayReasonCategory
} from '@/types/analytics';
import { getLearnedExpectedDuration, predictDelayProbability, loadLearningData, type LearningData } from './analyticsLearning';

/**
 * Calculate delivery status for an order item
 */
export function calculateDeliveryStatus(
  deliveryDate: Date,
  actualDispatchDate?: Date,
  currentStage: Stage = 'sales'
): DeliveryStatus {
  const now = new Date();
  const daysUntilDelivery = Math.ceil((deliveryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (currentStage === 'completed' || currentStage === 'dispatch') {
    if (actualDispatchDate) {
      const dispatchDelay = Math.ceil((actualDispatchDate.getTime() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24));
      return dispatchDelay > 0 ? 'delayed' : 'on_time';
    }
    return 'on_time';
  }
  
  if (daysUntilDelivery < 0) {
    return 'delayed';
  }
  
  if (daysUntilDelivery <= 2) {
    return 'at_risk';
  }
  
  return 'on_time';
}

/**
 * Calculate order health score
 */
export function calculateOrderHealthScore(
  item: OrderItem,
  order: Order,
  userWorkload?: number,
  historicalDelays?: number
): OrderHealthScore {
  const now = new Date();
  const deliveryDate = item.delivery_date;
  const daysUntilDelivery = Math.ceil((deliveryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  // Factor 1: Deadline Proximity (0-40 points)
  let deadlineScore = 40;
  if (daysUntilDelivery < 0) {
    deadlineScore = 0; // Already delayed
  } else if (daysUntilDelivery <= 1) {
    deadlineScore = 10; // Critical
  } else if (daysUntilDelivery <= 3) {
    deadlineScore = 20; // At risk
  } else if (daysUntilDelivery <= 7) {
    deadlineScore = 30; // Approaching
  }
  
  // Factor 2: Stage Duration (0-30 points)
  let stageDurationScore = 30;
  const stageDurations = item.stage_durations_hours || {};
  const currentStageDuration = stageDurations[item.current_stage] || 0;
  
  // Expected durations per stage (in hours)
  const expectedDurations: Record<Stage, number> = {
    sales: 24,
    design: 48,
    prepress: 24,
    production: 72,
    outsource: 120,
    dispatch: 12,
    completed: 0,
  };
  
  const expectedDuration = expectedDurations[item.current_stage] || 48;
  if (currentStageDuration > expectedDuration * 1.5) {
    stageDurationScore = 0; // Significantly over expected
  } else if (currentStageDuration > expectedDuration) {
    stageDurationScore = 15; // Over expected
  }
  
  // Factor 3: User Workload (0-20 points)
  let workloadScore = 20;
  if (userWorkload !== undefined) {
    if (userWorkload > 10) {
      workloadScore = 5; // Overloaded
    } else if (userWorkload > 5) {
      workloadScore = 10; // High workload
    }
  }
  
  // Factor 4: Historical Delays (0-10 points)
  let historicalScore = 10;
  if (historicalDelays !== undefined && historicalDelays > 0) {
    historicalScore = Math.max(0, 10 - (historicalDelays * 2));
  }
  
  const totalScore = deadlineScore + stageDurationScore + workloadScore + historicalScore;
  
  let status: 'green' | 'yellow' | 'red';
  if (totalScore >= 80) {
    status = 'green';
  } else if (totalScore >= 50) {
    status = 'yellow';
  } else {
    status = 'red';
  }
  
  return {
    order_id: order.order_id,
    item_id: item.item_id,
    score: Math.round(totalScore),
    status,
    factors: {
      deadline_proximity: deadlineScore,
      stage_duration: stageDurationScore,
      user_workload: workloadScore,
      historical_delays: historicalScore,
    },
    calculated_at: new Date(),
  };
}

/**
 * Enhanced order health score with self-learning
 */
export async function calculateOrderHealthScoreEnhanced(
  item: OrderItem,
  order: Order,
  userWorkload?: number,
  historicalDelays?: number,
  learningData?: any
): Promise<OrderHealthScore> {
  const { loadLearningData, getLearnedExpectedDuration, predictDelayProbability } = await import('./analyticsLearning');
  
  // Load learning data if not provided
  if (!learningData) {
    learningData = await loadLearningData();
  }

  const now = new Date();
  const deliveryDate = item.delivery_date;
  const daysUntilDelivery = Math.ceil((deliveryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  // Factor 1: Deadline Proximity (0-40 points)
  let deadlineScore = 40;
  if (daysUntilDelivery < 0) {
    deadlineScore = 0;
  } else if (daysUntilDelivery <= 1) {
    deadlineScore = 10;
  } else if (daysUntilDelivery <= 3) {
    deadlineScore = 20;
  } else if (daysUntilDelivery <= 7) {
    deadlineScore = 30;
  }
  
  // Factor 2: Stage Duration (0-30 points) - Uses learned baselines
  let stageDurationScore = 30;
  const stageDurations = item.stage_durations_hours || {};
  const currentStageDuration = stageDurations[item.current_stage] || 0;
  const expectedDuration = getLearnedExpectedDuration(item.current_stage, learningData);
  
  if (currentStageDuration > expectedDuration * 1.5) {
    stageDurationScore = 0;
  } else if (currentStageDuration > expectedDuration) {
    stageDurationScore = 15;
  }
  
  // Factor 3: User Workload (0-20 points)
  let workloadScore = 20;
  if (userWorkload !== undefined) {
    if (userWorkload > 10) {
      workloadScore = 5;
    } else if (userWorkload > 5) {
      workloadScore = 10;
    }
  }
  
  // Factor 4: Historical Delays (0-10 points)
  let historicalScore = 10;
  if (historicalDelays !== undefined && historicalDelays > 0) {
    historicalScore = Math.max(0, 10 - (historicalDelays * 2));
  }

  // Factor 5: Learned Delay Prediction (0-10 points) - NEW
  let predictionScore = 10;
  const delayProbability = predictDelayProbability(item, order, learningData);
  if (delayProbability > 0.7) {
    predictionScore = 0;
  } else if (delayProbability > 0.5) {
    predictionScore = 5;
  }
  
  const totalScore = Math.min(deadlineScore + stageDurationScore + workloadScore + historicalScore + predictionScore, 100);
  
  // Enhanced thresholds based on learned accuracy
  const learnedThreshold = learningData.prediction_accuracy?.health_score_accuracy || 0.7;
  const greenThreshold = learnedThreshold > 0.8 ? 80 : 75;
  const yellowThreshold = learnedThreshold > 0.8 ? 50 : 45;
  
  let status: 'green' | 'yellow' | 'red';
  if (totalScore >= greenThreshold) {
    status = 'green';
  } else if (totalScore >= yellowThreshold) {
    status = 'yellow';
  } else {
    status = 'red';
  }
  
  return {
    order_id: order.order_id,
    item_id: item.item_id,
    score: Math.round(totalScore),
    status,
    factors: {
      deadline_proximity: deadlineScore,
      stage_duration: stageDurationScore,
      user_workload: workloadScore,
      historical_delays: historicalScore,
      learned_prediction: predictionScore,
    },
    calculated_at: new Date(),
  };
}

/**
 * Calculate delivery performance metrics
 */
export function calculateDeliveryPerformance(
  orders: Order[],
  startDate: Date,
  endDate: Date
): DeliveryPerformanceMetrics {
  const filteredOrders = orders.filter(order => {
    const orderDate = order.created_at;
    return orderDate >= startDate && orderDate <= endDate;
  });
  
  let totalOrders = 0;
  let onTimeDeliveries = 0;
  let delayedDeliveries = 0;
  let atRiskDeliveries = 0;
  let totalLifecycleHours = 0;
  
  const departmentDelays: Record<UserRole, { count: number; totalDelayHours: number }> = {
    sales: { count: 0, totalDelayHours: 0 },
    design: { count: 0, totalDelayHours: 0 },
    prepress: { count: 0, totalDelayHours: 0 },
    production: { count: 0, totalDelayHours: 0 },
    outsource: { count: 0, totalDelayHours: 0 },
    admin: { count: 0, totalDelayHours: 0 },
  };
  
  const productDelays: Record<string, { count: number; totalDelayHours: number }> = {};
  
  filteredOrders.forEach(order => {
    order.items.forEach(item => {
      if (item.is_completed || item.current_stage === 'completed') {
        totalOrders++;
        
        const status = calculateDeliveryStatus(
          item.delivery_date,
          item.actual_dispatch_date,
          item.current_stage
        );
        
        if (status === 'on_time') {
          onTimeDeliveries++;
        } else if (status === 'delayed') {
          delayedDeliveries++;
          
          // Track department delays
          const delayHours = item.stage_durations_hours?.[item.assigned_department] || 0;
          departmentDelays[item.assigned_department].count++;
          departmentDelays[item.assigned_department].totalDelayHours += delayHours;
          
          // Track product delays
          if (!productDelays[item.product_name]) {
            productDelays[item.product_name] = { count: 0, totalDelayHours: 0 };
          }
          productDelays[item.product_name].count++;
          productDelays[item.product_name].totalDelayHours += delayHours;
        } else if (status === 'at_risk') {
          atRiskDeliveries++;
        }
        
        // Calculate lifecycle duration
        if (item.actual_dispatch_date) {
          const lifecycleMs = item.actual_dispatch_date.getTime() - order.created_at.getTime();
          totalLifecycleHours += lifecycleMs / (1000 * 60 * 60);
        }
      }
    });
  });
  
  const departmentDelaysFormatted: Record<UserRole, {
    count: number;
    percentage: number;
    average_delay_hours: number;
  }> = {} as any;
  
  Object.keys(departmentDelays).forEach(dept => {
    const deptData = departmentDelays[dept as UserRole];
    departmentDelaysFormatted[dept as UserRole] = {
      count: deptData.count,
      percentage: totalOrders > 0 ? (deptData.count / totalOrders) * 100 : 0,
      average_delay_hours: deptData.count > 0 ? deptData.totalDelayHours / deptData.count : 0,
    };
  });
  
  const productDelaysFormatted: Record<string, {
    count: number;
    percentage: number;
    average_delay_hours: number;
  }> = {};
  
  Object.keys(productDelays).forEach(product => {
    const productData = productDelays[product];
    productDelaysFormatted[product] = {
      count: productData.count,
      percentage: totalOrders > 0 ? (productData.count / totalOrders) * 100 : 0,
      average_delay_hours: productData.count > 0 ? productData.totalDelayHours / productData.count : 0,
    };
  });
  
  return {
    date_range: { start: startDate, end: endDate },
    total_orders: totalOrders,
    on_time_deliveries: onTimeDeliveries,
    delayed_deliveries: delayedDeliveries,
    at_risk_deliveries: atRiskDeliveries,
    on_time_percentage: totalOrders > 0 ? (onTimeDeliveries / totalOrders) * 100 : 0,
    average_lifecycle_duration_hours: totalOrders > 0 ? totalLifecycleHours / totalOrders : 0,
    department_delays: departmentDelaysFormatted,
    product_delays: productDelaysFormatted,
  };
}

/**
 * Calculate department efficiency metrics
 */
export function calculateDepartmentEfficiency(
  orders: Order[],
  workLogs: WorkLog[],
  department: UserRole,
  startDate: Date,
  endDate: Date
): DepartmentEfficiencyMetrics {
  const filteredOrders = orders.filter(order => {
    const orderDate = order.created_at;
    return orderDate >= startDate && orderDate <= endDate;
  });
  
  const departmentItems = filteredOrders.flatMap(order =>
    order.items.filter(item => item.assigned_department === department)
  );
  
  const stageTimes: Record<Stage, number[]> = {
    sales: [],
    design: [],
    prepress: [],
    production: [],
    outsource: [],
    dispatch: [],
    completed: [],
  };
  
  const handoverDelays: Record<string, number[]> = {};
  
  let processedCount = 0;
  let pendingCount = 0;
  
  departmentItems.forEach(item => {
    if (item.is_dispatched || item.current_stage === 'completed') {
      processedCount++;
    } else {
      pendingCount++;
    }
    
    // Calculate stage durations
    const durations = item.stage_durations_hours || {};
    Object.keys(durations).forEach(stage => {
      if (stageTimes[stage as Stage]) {
        stageTimes[stage as Stage].push(durations[stage as Stage]);
      }
    });
  });
  
  // Calculate average time per stage
  const averageTimePerStage: Record<Stage, number> = {} as any;
  Object.keys(stageTimes).forEach(stage => {
    const times = stageTimes[stage as Stage];
    averageTimePerStage[stage as Stage] = times.length > 0
      ? times.reduce((a, b) => a + b, 0) / times.length
      : 0;
  });
  
  // Calculate workload vs throughput
  const departmentWorkLogs = workLogs.filter(log => log.department === department);
  const totalWorkMinutes = departmentWorkLogs.reduce((sum, log) => sum + log.time_spent_minutes, 0);
  const workloadVsThroughput = processedCount > 0 ? totalWorkMinutes / processedCount : 0;
  
  // Identify bottlenecks (stages with above-average duration)
  const avgDuration = Object.values(averageTimePerStage).reduce((a, b) => a + b, 0) / Object.keys(averageTimePerStage).length;
  const bottleneckStages = Object.keys(averageTimePerStage).filter(
    stage => averageTimePerStage[stage as Stage] > avgDuration * 1.5
  ) as Stage[];
  
  return {
    department,
    date_range: { start: startDate, end: endDate },
    average_time_per_stage_hours: averageTimePerStage,
    orders_processed: processedCount,
    orders_pending: pendingCount,
    handover_delays_hours: {}, // TODO: Calculate from timeline
    workload_vs_throughput_ratio: workloadVsThroughput,
    bottleneck_stages: bottleneckStages,
  };
}

/**
 * Calculate user productivity metrics
 */
export function calculateUserProductivity(
  userId: string,
  userName: string,
  department: UserRole,
  workLogs: WorkLog[],
  orders: Order[],
  startDate: Date,
  endDate: Date
): UserProductivityMetrics {
  const userLogs = workLogs.filter(
    log => log.user_id === userId && 
    new Date(log.work_date) >= startDate && 
    new Date(log.work_date) <= endDate
  );
  
  // Daily working hours
  const dailyHours: Record<string, number> = {};
  userLogs.forEach(log => {
    const date = log.work_date;
    if (!dailyHours[date]) {
      dailyHours[date] = 0;
    }
    dailyHours[date] += log.time_spent_minutes / 60;
  });
  
  // Weekly working hours
  const weeklyHours = Object.values(dailyHours).reduce((a, b) => a + b, 0);
  
  // Orders handled
  const userOrders = orders.filter(order =>
    order.items.some(item => item.assigned_to === userId)
  );
  const ordersHandled = userOrders.length;
  
  // Average time per order
  const totalTimeMinutes = userLogs.reduce((sum, log) => sum + log.time_spent_minutes, 0);
  const averageTimePerOrder = ordersHandled > 0 ? totalTimeMinutes / ordersHandled : 0;
  
  // Productivity score (0-100)
  // Based on: output (orders handled) vs time spent
  const expectedTimePerOrder = 120; // 2 hours per order baseline
  const expectedTime = ordersHandled * expectedTimePerOrder;
  const productivityScore = expectedTime > 0
    ? Math.min(100, (expectedTime / totalTimeMinutes) * 100)
    : 0;
  
  // Overload/underutilization
  const avgDailyHours = weeklyHours / 7;
  const isOverloaded = avgDailyHours > 8;
  const isUnderutilized = avgDailyHours < 4 && ordersHandled > 0;
  
  // Performance trend (simplified - would need historical data)
  const performanceTrend: 'improving' | 'stable' | 'declining' = 'stable';
  
  return {
    user_id: userId,
    user_name: userName,
    department,
    date_range: { start: startDate, end: endDate },
    daily_working_hours: dailyHours,
    weekly_working_hours: weeklyHours,
    orders_handled: ordersHandled,
    average_time_per_order_minutes: averageTimePerOrder,
    delay_contributions: 0, // TODO: Calculate from delay reasons
    delay_resolutions: 0, // TODO: Calculate from resolved delays
    productivity_score: Math.round(productivityScore),
    is_overloaded: isOverloaded,
    is_underutilized: isUnderutilized,
    performance_trend: performanceTrend,
  };
}

