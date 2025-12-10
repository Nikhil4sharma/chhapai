import { Badge } from '@/components/ui/badge';
import { Stage, STAGE_LABELS } from '@/types/order';
import { cn } from '@/lib/utils';

interface StageBadgeProps {
  stage: Stage;
  className?: string;
}

const stageVariants: Record<Stage, 'stage-sales' | 'stage-design' | 'stage-prepress' | 'stage-production' | 'stage-dispatch' | 'stage-completed'> = {
  sales: 'stage-sales',
  design: 'stage-design',
  prepress: 'stage-prepress',
  production: 'stage-production',
  dispatch: 'stage-dispatch',
  completed: 'stage-completed',
};

export function StageBadge({ stage, className }: StageBadgeProps) {
  return (
    <Badge variant={stageVariants[stage]} className={className}>
      {STAGE_LABELS[stage]}
    </Badge>
  );
}
