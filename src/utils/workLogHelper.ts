import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { WorkLog } from '@/types/worklog';

/**
 * Helper function to auto-log work actions
 * This can be called from anywhere without requiring WorkLogContext
 * Now tracks start/end times and calculates duration automatically
 */
export async function autoLogWorkAction(
  userId: string,
  userName: string,
  department: string,
  orderId: string,
  orderNumber: string,
  itemId: string | null,
  stage: string,
  actionType: 'note_added' | 'stage_updated' | 'file_uploaded' | 'issue_reported' | 'task_completed' | 'assigned' | 'substage_started' | 'substage_completed' | 'delivery_date_updated' | 'order_created',
  workSummary: string,
  timeSpentMinutes: number = 0,
  productName?: string,
  startTime?: Date,
  endTime?: Date
): Promise<void> {
  try {
    const workDate = format(new Date(), 'yyyy-MM-dd');
    const now = new Date();
    
    // Calculate time spent if start and end times are provided
    let calculatedTime = timeSpentMinutes;
    if (startTime && endTime) {
      const diffMs = endTime.getTime() - startTime.getTime();
      calculatedTime = Math.max(1, Math.round(diffMs / (1000 * 60))); // Convert to minutes, minimum 1 minute
    } else if (startTime) {
      // If only start time is provided, calculate from start to now
      const diffMs = now.getTime() - startTime.getTime();
      calculatedTime = Math.max(1, Math.round(diffMs / (1000 * 60))); // Minimum 1 minute
    } else if (timeSpentMinutes === 0) {
      // Default to 1 minute if no time specified (for tracking purposes)
      calculatedTime = 1;
    }
    
    const { error } = await supabase
      .from('user_work_logs')
      .insert({
        user_id: userId,
        user_name: userName,
        department: department,
        order_id: orderId,
        order_item_id: itemId,
        order_number: orderNumber,
        product_name: productName || null,
        stage: stage,
        action_type: actionType,
        work_summary: workSummary.substring(0, 200), // First 200 chars
        time_spent_minutes: calculatedTime,
        work_date: workDate,
      });

    if (error) {
      console.error('Error auto-logging work action:', error);
      // Don't throw - we don't want to break the main flow if logging fails
    }
  } catch (error) {
    console.error('Error auto-logging work action:', error);
    // Don't throw - we don't want to break the main flow if logging fails
  }
}


