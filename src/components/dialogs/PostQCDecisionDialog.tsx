import { useState, useEffect } from 'react';
import { Factory, Truck, ArrowRight, Save } from 'lucide-react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface PostQCDecisionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (decision: 'production' | 'dispatch') => Promise<void>;
  productName: string;
}

export function PostQCDecisionDialog({
  open,
  onOpenChange,
  onSave,
  productName,
}: PostQCDecisionDialogProps) {
  const [decision, setDecision] = useState<'production' | 'dispatch' | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDecision(null);
    }
  }, [open]);

  const handleSave = async () => {
    if (!decision) return;

    setIsSaving(true);
    try {
      await onSave(decision);
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving decision:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Post-QC Decision
          </DialogTitle>
          <DialogDescription>
            Choose next step for <span className="font-semibold">{productName}</span> after QC Pass
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label>Select Action <span className="text-destructive">*</span></Label>
            <RadioGroup value={decision || ''} onValueChange={(value) => setDecision(value as 'production' | 'dispatch')}>
              <div className="flex items-start space-x-3 p-4 rounded-lg border border-border hover:bg-secondary/50 cursor-pointer">
                <RadioGroupItem value="production" id="production" className="mt-1" />
                <Label htmlFor="production" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 mb-1">
                    <Factory className="h-4 w-4 text-primary" />
                    <span className="font-medium">Send to Production</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Item will be sent to Production department for further processing
                  </p>
                </Label>
              </div>
              <div className="flex items-start space-x-3 p-4 rounded-lg border border-border hover:bg-secondary/50 cursor-pointer">
                <RadioGroupItem value="dispatch" id="dispatch" className="mt-1" />
                <Label htmlFor="dispatch" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 mb-1">
                    <Truck className="h-4 w-4 text-primary" />
                    <span className="font-medium">Mark as Ready for Dispatch</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Item is ready to be dispatched directly to customer
                  </p>
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving || !decision}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Processing...' : 'Apply Decision'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

