import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';

interface AddNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (note: string, isPublic: boolean) => void;
}

export function AddNoteDialog({ 
  open, 
  onOpenChange, 
  onAdd 
}: AddNoteDialogProps) {
  const [note, setNote] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  const handleAdd = () => {
    if (!note.trim()) return;
    onAdd(note.trim(), isPublic);
    setNote('');
    setIsPublic(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Add Note
          </DialogTitle>
          <DialogDescription>
            Add a note or comment to this order
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="note">Note</Label>
            <Textarea
              id="note"
              placeholder="Enter your note here..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Visible to Customer</Label>
              <p className="text-sm text-muted-foreground">
                Show this note in customer timeline
              </p>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!note.trim()}>
            Add Note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
