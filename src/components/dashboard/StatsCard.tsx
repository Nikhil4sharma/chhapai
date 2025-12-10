import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'warning' | 'danger';
  className?: string;
}

export function StatsCard({ title, value, icon: Icon, trend, variant = 'default', className }: StatsCardProps) {
  return (
    <Card className={cn("card-hover", className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className={cn(
              "text-3xl font-bold mt-1 font-display",
              variant === 'primary' && "text-primary",
              variant === 'warning' && "text-warning",
              variant === 'danger' && "text-priority-red",
            )}>
              {value}
            </p>
            {trend && (
              <p className={cn(
                "text-xs mt-1",
                trend.isPositive ? "text-success" : "text-destructive"
              )}>
                {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}% from yesterday
              </p>
            )}
          </div>
          <div className={cn(
            "h-12 w-12 rounded-lg flex items-center justify-center",
            variant === 'default' && "bg-secondary text-secondary-foreground",
            variant === 'primary' && "bg-primary/10 text-primary",
            variant === 'warning' && "bg-warning/10 text-warning",
            variant === 'danger' && "bg-priority-red/10 text-priority-red",
          )}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
