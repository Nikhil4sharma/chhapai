import { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Clock, MessageSquare } from 'lucide-react';
import { useWorkLogs } from '@/contexts/WorkLogContext';
import { toast } from '@/hooks/use-toast';

interface AddWorkNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  itemId: string | null;
  stage: string;
  productName?: string;
}

export function AddWorkNoteDialog({
  open,
  onOpenChange,
  orderId,
  itemId,
  stage,
  productName,
}: AddWorkNoteDialogProps) {
  const [noteText, setNoteText] = useState('');
  const [timeSpent, setTimeSpent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const { addWorkNote } = useWorkLogs();

  const handleSubmit = async () => {
    if (!noteText.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a note",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const timeSpentMinutes = timeSpent ? parseInt(timeSpent, 10) : undefined;
      if (timeSpentMinutes && (timeSpentMinutes < 0 || isNaN(timeSpentMinutes))) {
        toast({
          title: "Validation Error",
          description: "Time spent must be a valid number",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      await addWorkNote(orderId, itemId, stage, noteText.trim(), timeSpentMinutes);
      setNoteText('');
      setTimeSpent('');
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding work note:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Add Work Note
          </DialogTitle>
          <DialogDescription>
            {productName && (
              <span className="block mb-1">Product: {productName}</span>
            )}
            Add a note about your work on this order at the <strong>{stage}</strong> stage.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="note-text">Work Note *</Label>
            <Textarea
              id="note-text"
              placeholder="Describe the work done, issues faced, or any important details..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={5}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              This note will be visible to your team and will be logged in your performance report.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="time-spent" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Time Spent (minutes) - Optional
            </Label>
            <Input
              id="time-spent"
              type="number"
              placeholder="e.g., 30"
              value={timeSpent}
              onChange={(e) => setTimeSpent(e.target.value)}
              min="0"
            />
            <p className="text-xs text-muted-foreground">
              Track how much time you spent on this task. This helps in performance reporting.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !noteText.trim()}>
            {isLoading ? 'Adding...' : 'Add Note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}









