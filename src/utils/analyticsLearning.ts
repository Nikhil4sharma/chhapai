import { Order, OrderItem, Stage } from '@/types/order';
// Firebase removed - using local storage for learning data (optional functionality)

/**
 * Self-Learning Analytics System
 * Learns from historical order data to improve predictions and accuracy
 */

export interface LearningData {
  stage_durations: Record<Stage, {
    average: number;
    median: number;
    p95: number;
    sample_count: number;
    last_updated: Date;
  }>;
  delay_patterns: {
    common_causes: Record<string, number>;
    stage_delays: Record<Stage, number>;
    seasonal_factors: Record<string, number>;
  };
  user_performance: Record<string, {
    average_time: number;
    delay_rate: number;
    orders_handled: number;
  }>;
  department_baselines: Record<string, {
    average_throughput: number;
    bottleneck_stages: string[];
  }>;
  prediction_accuracy: {
    health_score_accuracy: number;
    delay_prediction_accuracy: number;
    last_calibrated: Date;
  };
}

const DEFAULT_LEARNING_DATA: LearningData = {
  stage_durations: {
    sales: { average: 24, median: 20, p95: 48, sample_count: 0, last_updated: new Date() },
    design: { average: 48, median: 40, p95: 96, sample_count: 0, last_updated: new Date() },
    prepress: { average: 24, median: 20, p95: 48, sample_count: 0, last_updated: new Date() },
    production: { average: 72, median: 60, p95: 144, sample_count: 0, last_updated: new Date() },
    outsource: { average: 120, median: 96, p95: 240, sample_count: 0, last_updated: new Date() },
    dispatch: { average: 12, median: 8, p95: 24, sample_count: 0, last_updated: new Date() },
    completed: { average: 0, median: 0, p95: 0, sample_count: 0, last_updated: new Date() },
  },
  delay_patterns: {
    common_causes: {},
    stage_delays: {
      sales: 0,
      design: 0,
      prepress: 0,
      production: 0,
      outsource: 0,
      dispatch: 0,
      completed: 0,
    },
    seasonal_factors: {},
  },
  user_performance: {},
  department_baselines: {},
  prediction_accuracy: {
    health_score_accuracy: 0.7,
    delay_prediction_accuracy: 0.6,
    last_calibrated: new Date(),
  },
};

/**
 * Load learning data from local storage (Firebase removed)
 */
export async function loadLearningData(): Promise<LearningData> {
  try {
    const stored = localStorage.getItem('analytics_learning');
    if (stored) {
      const data = JSON.parse(stored);
      return {
        ...DEFAULT_LEARNING_DATA,
        ...data,
        stage_durations: {
          ...DEFAULT_LEARNING_DATA.stage_durations,
          ...data.stage_durations,
        },
        prediction_accuracy: {
          ...DEFAULT_LEARNING_DATA.prediction_accuracy,
          ...data.prediction_accuracy,
          last_calibrated: data.prediction_accuracy?.last_calibrated ? new Date(data.prediction_accuracy.last_calibrated) : new Date(),
        },
      } as LearningData;
    }
    
    return DEFAULT_LEARNING_DATA;
  } catch (error) {
    console.error('Error loading learning data:', error);
    return DEFAULT_LEARNING_DATA;
  }
}

/**
 * Save learning data to local storage (Firebase removed)
 */
export async function saveLearningData(data: LearningData): Promise<void> {
  try {
    const dataToSave = {
      ...data,
      last_updated: new Date().toISOString(),
    };
    localStorage.setItem('analytics_learning', JSON.stringify(dataToSave));
  } catch (error: any) {
    console.error('Error saving learning data:', error);
  }
}

/**
 * Learn from completed orders - update stage duration baselines
 */
export function learnFromCompletedOrders(
  orders: Order[],
  currentLearning: LearningData
): LearningData {
  const updated = { ...currentLearning };
  const stageDurations: Record<Stage, number[]> = {
    sales: [],
    design: [],
    prepress: [],
    production: [],
    outsource: [],
    dispatch: [],
    completed: [],
  };

  // Collect actual stage durations from completed orders
  orders.forEach(order => {
    if (order.is_completed) {
      order.items.forEach(item => {
        if (item.stage_durations_hours) {
          Object.entries(item.stage_durations_hours).forEach(([stage, duration]) => {
            if (stageDurations[stage as Stage]) {
              stageDurations[stage as Stage].push(duration);
            }
          });
        }
      });
    }
  });

  // Update stage duration statistics
  Object.entries(stageDurations).forEach(([stage, durations]) => {
    if (durations.length > 0) {
      const sorted = [...durations].sort((a, b) => a - b);
      const average = durations.reduce((a, b) => a + b, 0) / durations.length;
      const median = sorted[Math.floor(sorted.length / 2)];
      const p95Index = Math.floor(sorted.length * 0.95);
      const p95 = sorted[p95Index] || sorted[sorted.length - 1];

      updated.stage_durations[stage as Stage] = {
        average: Math.round(average),
        median: Math.round(median),
        p95: Math.round(p95),
        sample_count: durations.length,
        last_updated: new Date(),
      };
    }
  });

  return updated;
}

/**
 * Learn delay patterns from orders
 */
export function learnDelayPatterns(
  orders: Order[],
  currentLearning: LearningData
): LearningData {
  const updated = { ...currentLearning };
  const delayCauses: Record<string, number> = {};
  const stageDelays: Record<Stage, number> = {
    sales: 0,
    design: 0,
    prepress: 0,
    production: 0,
    outsource: 0,
    dispatch: 0,
    completed: 0,
  };

  // Analyze delayed orders
  orders.forEach(order => {
    order.items.forEach(item => {
      if (item.delivery_status === 'delayed' && item.delay_reasons) {
        item.delay_reasons.forEach(reason => {
          const key = `${reason.category}_${reason.reason}`;
          delayCauses[key] = (delayCauses[key] || 0) + 1;
        });
        
        // Track which stage had the delay
        if (item.current_stage) {
          stageDelays[item.current_stage] = (stageDelays[item.current_stage] || 0) + 1;
        }
      }
    });
  });

  updated.delay_patterns = {
    common_causes: delayCauses,
    stage_delays: stageDelays,
    seasonal_factors: updated.delay_patterns.seasonal_factors,
  };

  return updated;
}

/**
 * Learn user performance patterns
 */
export function learnUserPerformance(
  orders: Order[],
  workLogs: any[],
  currentLearning: LearningData
): LearningData {
  const updated = { ...currentLearning };
  const userStats: Record<string, { times: number[]; delays: number; total: number }> = {};

  // Collect user performance data
  orders.forEach(order => {
    order.items.forEach(item => {
      if (item.assigned_to) {
        if (!userStats[item.assigned_to]) {
          userStats[item.assigned_to] = { times: [], delays: 0, total: 0 };
        }
        
        userStats[item.assigned_to].total++;
        
        if (item.stage_durations_hours) {
          const totalTime = Object.values(item.stage_durations_hours).reduce((a, b) => a + b, 0);
          userStats[item.assigned_to].times.push(totalTime);
        }
        
        if (item.delivery_status === 'delayed') {
          userStats[item.assigned_to].delays++;
        }
      }
    });
  });

  // Update user performance metrics
  Object.entries(userStats).forEach(([userId, stats]) => {
    const averageTime = stats.times.length > 0
      ? stats.times.reduce((a, b) => a + b, 0) / stats.times.length
      : 0;
    const delayRate = stats.total > 0 ? stats.delays / stats.total : 0;

    updated.user_performance[userId] = {
      average_time: Math.round(averageTime),
      delay_rate: delayRate,
      orders_handled: stats.total,
    };
  });

  return updated;
}

/**
 * Get learned expected duration for a stage
 */
export function getLearnedExpectedDuration(
  stage: Stage,
  learningData: LearningData
): number {
  const learned = learningData.stage_durations[stage];
  if (learned && learned.sample_count > 10) {
    // Use learned p95 if we have enough samples
    return learned.p95;
  }
  // Fallback to default
  return DEFAULT_LEARNING_DATA.stage_durations[stage].p95;
}

/**
 * Predict delay probability based on learned patterns
 */
export function predictDelayProbability(
  item: OrderItem,
  order: Order,
  learningData: LearningData
): number {
  let probability = 0;

  // Factor 1: Stage delay history
  const stageDelayRate = learningData.delay_patterns.stage_delays[item.current_stage] || 0;
  if (stageDelayRate > 0) {
    probability += Math.min(stageDelayRate / 100, 0.3);
  }

  // Factor 2: User performance
  if (item.assigned_to && learningData.user_performance[item.assigned_to]) {
    const userDelayRate = learningData.user_performance[item.assigned_to].delay_rate;
    probability += userDelayRate * 0.3;
  }

  // Factor 3: Stage duration vs learned baseline
  const stageDurations = item.stage_durations_hours || {};
  const currentDuration = stageDurations[item.current_stage] || 0;
  const expectedDuration = getLearnedExpectedDuration(item.current_stage, learningData);
  
  if (currentDuration > expectedDuration) {
    const overage = (currentDuration - expectedDuration) / expectedDuration;
    probability += Math.min(overage * 0.2, 0.3);
  }

  // Factor 4: Deadline proximity
  const deliveryDate = item.delivery_date;
  const now = new Date();
  const daysUntilDelivery = Math.ceil((deliveryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntilDelivery < 0) {
    probability = 1.0; // Already delayed
  } else if (daysUntilDelivery <= 1) {
    probability += 0.2;
  } else if (daysUntilDelivery <= 3) {
    probability += 0.1;
  }

  return Math.min(probability, 1.0);
}

/**
 * Auto-enhance analytics by learning from data
 */
export async function autoEnhanceAnalytics(
  orders: Order[],
  workLogs: any[]
): Promise<LearningData> {
  let learningData = await loadLearningData();
  
  // Learn from completed orders
  learningData = learnFromCompletedOrders(orders, learningData);
  
  // Learn delay patterns
  learningData = learnDelayPatterns(orders, learningData);
  
  // Learn user performance
  learningData = learnUserPerformance(orders, workLogs, learningData);
  
  // Save updated learning data
  await saveLearningData(learningData);
  
  return learningData;
}



