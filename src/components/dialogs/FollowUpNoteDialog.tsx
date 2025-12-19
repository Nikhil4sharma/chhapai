import { useState, useEffect } from 'react';
import { FileText, Save } from 'lucide-react';
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

interface FollowUpNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (note: string) => Promise<void>;
  productName: string;
}

export function FollowUpNoteDialog({
  open,
  onOpenChange,
  onSave,
  productName,
}: FollowUpNoteDialogProps) {
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNote('');
    }
  }, [open]);

  const handleSave = async () => {
    if (!note.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave(note.trim());
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving note:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Add Follow-Up Note
          </DialogTitle>
          <DialogDescription>
            Add a follow-up note for <span className="font-semibold">{productName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="note">Note</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Enter follow-up note (e.g., Vendor said ready by tomorrow 4 PM)..."
              rows={5}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              This note will be visible to Admin, Sales, and Prepress teams
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !note.trim()} className="gap-2">
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

