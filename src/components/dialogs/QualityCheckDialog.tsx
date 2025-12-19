import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, FileText, Save } from 'lucide-react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface QualityCheckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (result: 'pass' | 'fail', notes: string) => Promise<void>;
  productName: string;
}

export function QualityCheckDialog({
  open,
  onOpenChange,
  onSave,
  productName,
}: QualityCheckDialogProps) {
  const [result, setResult] = useState<'pass' | 'fail' | null>(null);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setResult(null);
      setNotes('');
      setErrors({});
    }
  }, [open]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!result) {
      newErrors.result = 'QC result is required';
    }
    if (!notes.trim()) {
      newErrors.notes = 'QC notes are required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !result) return;

    setIsSaving(true);
    try {
      await onSave(result, notes.trim());
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving QC:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Quality Check
          </DialogTitle>
          <DialogDescription>
            Perform quality check for <span className="font-semibold">{productName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label>QC Result <span className="text-destructive">*</span></Label>
            <RadioGroup value={result || ''} onValueChange={(value) => setResult(value as 'pass' | 'fail')}>
              <div className="flex items-center space-x-2 p-3 rounded-lg border border-border hover:bg-secondary/50">
                <RadioGroupItem value="pass" id="pass" />
                <Label htmlFor="pass" className="flex items-center gap-2 cursor-pointer flex-1">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="font-medium">Pass</span>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 rounded-lg border border-border hover:bg-secondary/50">
                <RadioGroupItem value="fail" id="fail" />
                <Label htmlFor="fail" className="flex items-center gap-2 cursor-pointer flex-1">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="font-medium">Fail</span>
                  <span className="text-xs text-muted-foreground ml-auto">(Will send back to vendor)</span>
                </Label>
              </div>
            </RadioGroup>
            {errors.result && (
              <p className="text-xs text-destructive">{errors.result}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="qc_notes" className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" />
              QC Notes <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="qc_notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter QC notes and observations..."
              rows={4}
              className={errors.notes ? 'border-destructive' : ''}
            />
            {errors.notes && (
              <p className="text-xs text-destructive">{errors.notes}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {result === 'fail' 
                ? 'Item will be sent back to vendor for rework'
                : 'Item will be ready for final decision (Production or Dispatch)'}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving || !result || !notes.trim()}
            className="gap-2"
            variant={result === 'fail' ? 'destructive' : 'default'}
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : result === 'fail' ? 'Mark as Failed' : 'Mark as Passed'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

