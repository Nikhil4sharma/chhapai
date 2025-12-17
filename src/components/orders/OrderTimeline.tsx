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
  User,
} from 'lucide-react';
import { TimelineEntry } from '@/types/order';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

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

export function OrderTimeline({ entries, className }: OrderTimelineProps) {
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
      {/* Timeline line */}
      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/50 via-border to-transparent" />
      
      <div className="space-y-4">
        {entries.map((entry, index) => {
          const Icon = actionIcons[entry.action] || MessageSquare;
          const colorClass = actionColors[entry.action] || 'bg-muted border-border text-muted-foreground';
          
          return (
            <div 
              key={entry.timeline_id} 
              className={cn(
                "relative pl-14 animate-fade-in",
                index === 0 && "animate-slide-in-right"
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Icon with Avatar */}
              <div className={cn(
                "absolute left-0 top-0 h-10 w-10 rounded-full border-2 flex items-center justify-center shadow-sm",
                colorClass
              )}>
                <Icon className="h-4 w-4" />
              </div>
              
              {/* Content Card */}
              <div className="bg-card border border-border rounded-lg p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200">
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-sm text-foreground">
                      {actionLabels[entry.action] || entry.action}
                    </h4>
                    {entry.substage && (
                      <Badge variant="outline" className="text-xs capitalize">
                        <ArrowRight className="h-3 w-3 mr-1" />
                        {entry.substage}
                      </Badge>
                    )}
                    {entry.stage && (
                      <Badge variant="secondary" className="text-xs capitalize">
                        {entry.stage}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(entry.created_at, 'MMM d, h:mm a')}
                    </span>
                    <span className="text-xs text-muted-foreground/70">
                      {formatDistanceToNow(entry.created_at, { addSuffix: true })}
                    </span>
                  </div>
                </div>
                
                {/* Performer */}
                <div className="flex items-center gap-2 mb-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {getInitials(entry.performed_by_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-muted-foreground">
                    by <span className="font-medium text-foreground">{entry.performed_by_name}</span>
                  </span>
                </div>
                
                {/* Notes */}
                {entry.notes && (
                  <div className="mt-2 text-sm text-foreground/80 bg-secondary/50 rounded-md p-3 border-l-2 border-primary/30">
                    <MessageSquare className="h-3 w-3 inline mr-2 text-muted-foreground" />
                    {entry.notes}
                  </div>
                )}
                
                {/* Additional Details */}
                {(entry.qty_confirmed || entry.paper_treatment) && (
                  <div className="mt-2 flex flex-wrap gap-3 text-sm">
                    {entry.qty_confirmed && (
                      <div className="flex items-center gap-1">
                        <Package className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Qty:</span>
                        <span className="font-medium">{entry.qty_confirmed}</span>
                      </div>
                    )}
                    {entry.paper_treatment && (
                      <div className="flex items-center gap-1">
                        <FileText className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Paper:</span>
                        <span className="font-medium">{entry.paper_treatment}</span>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Attachments with Preview */}
                {entry.attachments && entry.attachments.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {entry.attachments.map((att, i) => {
                      const isImage = att.type?.includes('image');
                      return (
                        <a
                          key={i}
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative inline-flex items-center gap-2 text-xs text-primary hover:underline bg-primary/5 hover:bg-primary/10 px-3 py-2 rounded-md transition-colors border border-primary/20"
                        >
                          {isImage ? (
                            <Eye className="h-3 w-3" />
                          ) : (
                            <FileText className="h-3 w-3" />
                          )}
                          <span>View {att.type?.split('/')[1]?.toUpperCase() || 'FILE'}</span>
                        </a>
                      );
                    })}
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
