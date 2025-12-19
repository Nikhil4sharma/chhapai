import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DelayReasonCategory, Stage } from '@/types/analytics';
import { useAnalytics } from '@/contexts/AnalyticsContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface DelayReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  itemId?: string;
  currentStage: Stage;
  productName?: string;
  onDelayReasonAdded?: () => void;
}

const DELAY_REASON_CATEGORIES: Record<DelayReasonCategory, string> = {
  design: 'Design Issues',
  client: 'Client Related',
  prepress: 'Prepress Issues',
  production: 'Production Issues',
  outsource_vendor: 'Outsource Vendor',
  material: 'Material Issues',
  courier: 'Courier/Delivery',
  internal_process: 'Internal Process',
};

const DELAY_REASON_OPTIONS: Record<DelayReasonCategory, string[]> = {
  design: [
    'Design approval pending',
    'Design revisions required',
    'Design complexity',
    'Designer unavailable',
  ],
  client: [
    'Client approval pending',
    'Client requested changes',
    'Client unresponsive',
    'Client payment delay',
  ],
  prepress: [
    'Prepress setup delay',
    'File preparation issues',
    'Proof approval delay',
    'Technical issues',
  ],
  production: [
    'Machine breakdown',
    'Production capacity full',
    'Quality issues',
    'Material shortage',
  ],
  outsource_vendor: [
    'Vendor delay',
    'Vendor quality issues',
    'Vendor communication gap',
    'Vendor capacity issues',
  ],
  material: [
    'Material not available',
    'Material quality issues',
    'Material delivery delay',
    'Material cost issues',
  ],
  courier: [
    'Courier delay',
    'Tracking issues',
    'Delivery address issues',
    'Courier service unavailable',
  ],
  internal_process: [
    'Workflow bottleneck',
    'Resource allocation',
    'Process inefficiency',
    'System issues',
  ],
};

export function DelayReasonDialog({
  open,
  onOpenChange,
  orderId,
  itemId,
  currentStage,
  productName,
  onDelayReasonAdded,
}: DelayReasonDialogProps) {
  const { addDelayReason } = useAnalytics();
  const { user, profile } = useAuth();
  const [category, setCategory] = useState<DelayReasonCategory | ''>('');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!category || !reason) {
      toast({
        title: "Required Fields",
        description: "Please select a category and reason",
        variant: "destructive",
      });
      return;
    }

    if (!user || !profile) {
      toast({
        title: "Authentication Error",
        description: "Please log in to record delay reason",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await addDelayReason({
        order_id: orderId,
        item_id: itemId,
        category: category as DelayReasonCategory,
        reason,
        description: description || undefined,
        stage: currentStage,
        reported_by: user.uid,
        reported_by_name: profile.full_name || 'Unknown',
        is_resolved: false,
      });

      toast({
        title: "Delay Reason Recorded",
        description: "Delay reason has been recorded successfully",
      });

      // Reset form
      setCategory('');
      setReason('');
      setDescription('');
      onOpenChange(false);
      onDelayReasonAdded?.();
    } catch (error) {
      console.error('Error adding delay reason:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableReasons = category ? DELAY_REASON_OPTIONS[category as DelayReasonCategory] : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Record Delay Reason
          </DialogTitle>
          <DialogDescription>
            {productName && (
              <span className="font-semibold">{productName}</span>
            )}
            {productName && ' - '}
            Order #{orderId}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Note:</strong> Recording delay reasons helps identify bottlenecks and improve processes.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Delay Category *</Label>
            <Select value={category} onValueChange={(value) => {
              setCategory(value as DelayReasonCategory);
              setReason(''); // Reset reason when category changes
            }}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Select delay category" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DELAY_REASON_CATEGORIES).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {category && (
            <div className="space-y-2">
              <Label htmlFor="reason">Delay Reason *</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger id="reason">
                  <SelectValue placeholder="Select specific reason" />
                </SelectTrigger>
                <SelectContent>
                  {availableReasons.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                  <SelectItem value="other">Other (specify in description)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Additional Details (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide additional context about the delay..."
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !category || !reason}>
            {isSubmitting ? 'Recording...' : 'Record Delay Reason'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



