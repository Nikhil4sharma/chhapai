import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // Priority variants
        "priority-blue": "border-transparent bg-priority-blue text-white shadow-sm",
        "priority-yellow": "border-transparent bg-priority-yellow text-black shadow-sm",
        "priority-red": "border-transparent bg-priority-red text-white shadow-sm animate-pulse",
        // Stage variants
        "stage-sales": "border border-stage-sales/30 bg-stage-sales/10 text-stage-sales",
        "stage-design": "border border-stage-design/30 bg-stage-design/10 text-stage-design",
        "stage-prepress": "border border-stage-prepress/30 bg-stage-prepress/10 text-stage-prepress",
        "stage-production": "border border-stage-production/30 bg-stage-production/10 text-stage-production",
        "stage-outsource": "border border-stage-outsource/30 bg-stage-outsource/10 text-stage-outsource",
        "stage-dispatch": "border border-stage-dispatch/30 bg-stage-dispatch/10 text-stage-dispatch",
        "stage-completed": "border border-stage-completed/30 bg-stage-completed/10 text-stage-completed",
        // Status variants
        success: "border-transparent bg-success text-success-foreground shadow-sm",
        warning: "border-transparent bg-warning text-warning-foreground shadow-sm",
        info: "border-transparent bg-info text-info-foreground shadow-sm",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
