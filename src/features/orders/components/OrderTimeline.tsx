import { format, formatDistanceToNow } from 'date-fns';
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
  FileText,
  Eye,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { TimelineEntry } from '@/types/order';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface OrderTimelineProps {
  entries: TimelineEntry[];
  className?: string;
  onEntryClick?: (entryId: string) => void;
  highlightedId?: string | null;
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

const actionColors: Record<string, string> = {
  created: 'bg-primary/10 border-primary/30 text-primary',
  assigned: 'bg-blue-500/10 border-blue-500/30 text-blue-500',
  uploaded_proof: 'bg-purple-500/10 border-purple-500/30 text-purple-500',
  customer_approved: 'bg-green-500/10 border-green-500/30 text-green-500',
  final_proof_uploaded: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-500',
  sent_to_production: 'bg-orange-500/10 border-orange-500/30 text-orange-500',
  substage_started: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500',
  substage_completed: 'bg-green-500/10 border-green-500/30 text-green-500',
  packed: 'bg-teal-500/10 border-teal-500/30 text-teal-500',
  dispatched: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500',
  note_added: 'bg-muted border-border text-muted-foreground',
};

export function OrderTimeline({ entries, className, onEntryClick, highlightedId }: OrderTimelineProps) {
  if (entries.length === 0) {
    return (
      <div className={cn("text-center py-8 text-muted-foreground", className)}>
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No timeline entries yet</p>
      </div>
    );
  }

  const getInitials = (name: string) => {
    if (!name || name === 'Unknown') return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className={cn("relative", className)}>
      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/50 via-border to-transparent" />
      <div className="space-y-4">
        {entries.map((entry, index) => {
          const Icon = actionIcons[entry.action] || MessageSquare;
          const colorClass = actionColors[entry.action] || 'bg-muted border-border text-muted-foreground';
          const isHighlighted = highlightedId === entry.timeline_id;

          return (
            <div key={entry.timeline_id} className={cn("relative pl-14", index === 0 && "animate-fade-in")}>
              <div className={cn("absolute left-0 top-0 h-10 w-10 rounded-full border-2 flex items-center justify-center shadow-sm z-10", colorClass, isHighlighted && "ring-4 ring-primary/50 ring-offset-2")}>
                <Icon className="h-4 w-4" />
              </div>
              <div
                className={cn("bg-card border rounded-lg p-4 sm:p-5 shadow-sm hover:shadow-md transition-all", isHighlighted && "border-primary bg-primary/5")}
                onClick={() => onEntryClick?.(entry.timeline_id)}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-sm">{actionLabels[entry.action] || entry.action}</h4>
                    {entry.product_name && <Badge variant="outline" className="text-xs">{entry.product_name}</Badge>}
                    {entry.stage && <Badge variant="secondary" className="text-xs uppercase">{entry.stage}</Badge>}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(entry.created_at), 'MMM d, h:mm a')}</span>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[10px]">{getInitials(entry.performed_by_name)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-muted-foreground mr-1">
                    by <span className="font-medium text-foreground">{entry.performed_by_name}</span>
                  </span>
                  {entry.stage && <Badge variant="outline" className="text-[10px] h-5 py-0 px-1.5 capitalize bg-muted/50 font-normal">{entry.stage}</Badge>}
                </div>

                {entry.notes && (
                  <div className="mt-2 text-sm text-foreground/80 bg-secondary/50 rounded-md p-3 border-l-2 border-primary/30">
                    <MessageSquare className="h-3 w-3 inline mr-2 text-muted-foreground" />
                    {entry.notes}
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
