import { Badge } from '@/components/ui/badge';
import { Priority } from '@/types/order';
import { cn } from '@/lib/utils';

interface PriorityBadgeProps {
  priority: Priority;
  showLabel?: boolean;
  className?: string;
}

const priorityConfig: Record<Priority, { label: string; variant: 'priority-blue' | 'priority-yellow' | 'priority-red' }> = {
  blue: { label: '> 5 days', variant: 'priority-blue' },
  yellow: { label: '3-5 days', variant: 'priority-yellow' },
  red: { label: 'Urgent', variant: 'priority-red' },
};

export function PriorityBadge({ priority, showLabel = false, className }: PriorityBadgeProps) {
  const config = priorityConfig[priority];
  
  if (!showLabel) {
    return (
      <span 
        className={cn(
          "inline-block h-3 w-3 rounded-full",
          priority === 'blue' && "bg-priority-blue",
          priority === 'yellow' && "bg-priority-yellow",
          priority === 'red' && "bg-priority-red animate-pulse-soft",
          className
        )}
        title={config.label}
      />
    );
  }
  
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
