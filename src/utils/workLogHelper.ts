import { doc, collection, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
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
    const logRef = doc(collection(db, 'user_work_logs'));
    
    // Calculate time spent if start and end times are provided
    let calculatedTime = timeSpentMinutes;
    if (startTime && endTime) {
      const diffMs = endTime.getTime() - startTime.getTime();
      calculatedTime = Math.round(diffMs / (1000 * 60)); // Convert to minutes
    }
    
    await setDoc(logRef, {
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
      start_time: startTime ? Timestamp.fromDate(startTime) : null,
      end_time: endTime ? Timestamp.fromDate(endTime) : (calculatedTime > 0 ? Timestamp.fromDate(now) : null),
      work_date: workDate,
      created_at: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error auto-logging work action:', error);
    // Don't throw - we don't want to break the main flow if logging fails
  }
}


