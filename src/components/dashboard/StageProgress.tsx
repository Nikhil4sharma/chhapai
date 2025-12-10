import { Stage, STAGE_LABELS } from '@/types/order';
import { cn } from '@/lib/utils';

interface StageProgressProps {
  data: Record<Stage, number>;
  className?: string;
}

const stageColors: Record<Stage, string> = {
  sales: 'bg-stage-sales',
  design: 'bg-stage-design',
  prepress: 'bg-stage-prepress',
  production: 'bg-stage-production',
  dispatch: 'bg-stage-dispatch',
  completed: 'bg-stage-completed',
};

export function StageProgress({ data, className }: StageProgressProps) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  const stages: Stage[] = ['sales', 'design', 'prepress', 'production', 'dispatch', 'completed'];

  return (
    <div className={cn("space-y-4", className)}>
      {/* Progress bar */}
      <div className="h-3 rounded-full bg-secondary overflow-hidden flex">
        {stages.map((stage) => {
          const percentage = total > 0 ? (data[stage] / total) * 100 : 0;
          if (percentage === 0) return null;
          return (
            <div
              key={stage}
              className={cn("h-full transition-all duration-500", stageColors[stage])}
              style={{ width: `${percentage}%` }}
              title={`${STAGE_LABELS[stage]}: ${data[stage]}`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {stages.map((stage) => (
          <div key={stage} className="flex items-center gap-2">
            <span className={cn("h-3 w-3 rounded-full", stageColors[stage])} />
            <div className="text-sm">
              <span className="text-muted-foreground">{STAGE_LABELS[stage]}</span>
              <span className="font-semibold ml-1">{data[stage]}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
