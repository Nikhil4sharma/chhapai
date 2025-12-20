import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface AddDelayReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  stageName: string;
  onSave: (reason: string) => void;
}

export function AddDelayReasonDialog({
  open,
  onOpenChange,
  productName,
  stageName,
  onSave,
}: AddDelayReasonDialogProps) {
  const [reason, setReason] = useState('');

  const handleSave = () => {
    if (reason.trim()) {
      onSave(reason.trim());
      setReason('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Add Delay Reason
          </DialogTitle>
          <DialogDescription>
            Record why <strong>{productName}</strong> is delayed in <strong>{stageName}</strong> stage
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Delay Reason *</Label>
            <Textarea
              id="reason"
              placeholder="e.g., Waiting for material, Machine breakdown, Quality issue..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!reason.trim()}>
            Save Reason
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}





