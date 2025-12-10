import { format } from 'date-fns';
import { 
  Plus, 
  UserPlus, 
  Upload, 
  CheckCircle, 
  FileCheck, 
  Factory, 
  Play, 
  CheckSquare,
  Package,
  Truck,
  MessageSquare,
} from 'lucide-react';
import { TimelineEntry } from '@/types/order';
import { cn } from '@/lib/utils';

interface OrderTimelineProps {
  entries: TimelineEntry[];
  className?: string;
}

const actionIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  created: Plus,
  assigned: UserPlus,
  uploaded_proof: Upload,
  customer_approved: CheckCircle,
  final_proof_uploaded: FileCheck,
  sent_to_production: Factory,
  substage_started: Play,
  substage_completed: CheckSquare,
  packed: Package,
  dispatched: Truck,
  note_added: MessageSquare,
};

const actionLabels: Record<string, string> = {
  created: 'Order Created',
  assigned: 'Assigned',
  uploaded_proof: 'Proof Uploaded',
  customer_approved: 'Customer Approved',
  final_proof_uploaded: 'Final Proof Uploaded',
  sent_to_production: 'Sent to Production',
  substage_started: 'Stage Started',
  substage_completed: 'Stage Completed',
  packed: 'Packed',
  dispatched: 'Dispatched',
  note_added: 'Note Added',
};

export function OrderTimeline({ entries, className }: OrderTimelineProps) {
  if (entries.length === 0) {
    return (
      <div className={cn("text-center py-8 text-muted-foreground", className)}>
        No timeline entries yet
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
      
      <div className="space-y-6">
        {entries.map((entry, index) => {
          const Icon = actionIcons[entry.action] || MessageSquare;
          
          return (
            <div 
              key={entry.timeline_id} 
              className={cn(
                "relative pl-10 animate-fade-in",
                index === 0 && "animate-slide-in-right"
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Icon */}
              <div className="absolute left-0 top-0 h-8 w-8 rounded-full bg-background border-2 border-border flex items-center justify-center">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              
              {/* Content */}
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h4 className="font-medium text-sm text-foreground">
                    {actionLabels[entry.action] || entry.action}
                    {entry.substage && (
                      <span className="text-muted-foreground font-normal"> - {entry.substage}</span>
                    )}
                  </h4>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(entry.created_at, 'MMM d, h:mm a')}
                  </span>
                </div>
                
                <p className="text-sm text-muted-foreground">
                  by {entry.performed_by_name}
                </p>
                
                {entry.notes && (
                  <p className="mt-2 text-sm text-foreground/80 bg-secondary/50 rounded p-2">
                    {entry.notes}
                  </p>
                )}
                
                {entry.qty_confirmed && (
                  <p className="mt-2 text-sm">
                    <span className="text-muted-foreground">Qty confirmed:</span>{' '}
                    <span className="font-medium">{entry.qty_confirmed}</span>
                  </p>
                )}
                
                {entry.paper_treatment && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Paper:</span>{' '}
                    <span className="font-medium">{entry.paper_treatment}</span>
                  </p>
                )}
                
                {entry.attachments && entry.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {entry.attachments.map((att, i) => (
                      <a
                        key={i}
                        href={att.url}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline bg-primary/10 px-2 py-1 rounded"
                      >
                        <Upload className="h-3 w-3" />
                        {att.type.toUpperCase()}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
