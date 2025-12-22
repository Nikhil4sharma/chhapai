import { Badge } from '@/components/ui/badge';
import { Priority } from '@/types/order';
import { cn } from '@/lib/utils';

interface PriorityBadgeProps {
  priority?: Priority | null;
  showLabel?: boolean;
  className?: string;
}

const priorityConfig: Record<Priority, { label: string; variant: 'priority-blue' | 'priority-yellow' | 'priority-red' }> = {
  blue: { label: '> 5 days', variant: 'priority-blue' },
  yellow: { label: '3-5 days', variant: 'priority-yellow' },
  red: { label: 'Urgent', variant: 'priority-red' },
};

// Default priority when none is provided
const defaultPriority: Priority = 'blue';

export function PriorityBadge({ priority, showLabel = false, className }: PriorityBadgeProps) {
  // Handle undefined, null, or invalid priority values
  const safePriority: Priority = (priority && priority in priorityConfig) ? priority : defaultPriority;
  const config = priorityConfig[safePriority];
  
  if (!showLabel) {
    return (
      <span 
        className={cn(
          "inline-block h-3 w-3 rounded-full",
          safePriority === 'blue' && "bg-priority-blue",
          safePriority === 'yellow' && "bg-priority-yellow",
          safePriority === 'red' && "bg-priority-red animate-pulse-soft",
          className
        )}
        title={config?.label || 'Priority'}
      />
    );
  }
  
  return (
    <Badge variant={config?.variant || 'priority-blue'} className={className}>
      {config?.label || '> 5 days'}
    </Badge>
  );
}
