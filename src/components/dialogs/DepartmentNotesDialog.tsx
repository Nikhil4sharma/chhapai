import { useEffect, useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Loader2, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useOrders } from '@/features/orders/context/OrderContext';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface DepartmentNotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  department: string;
}

interface DepartmentNoteRow {
  id: string;
  notes: string;
  performed_by_name: string | null;
  created_at: string;
  stage: string | null;
}

export function DepartmentNotesDialog({
  open,
  onOpenChange,
  orderId,
  department,
}: DepartmentNotesDialogProps) {
  const { user, profile } = useAuth();
  const { addTimelineEntry } = useOrders();
  const [notes, setNotes] = useState<DepartmentNoteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [noteText, setNoteText] = useState('');

  const departmentLabel = useMemo(() => department?.toUpperCase?.() || 'DEPARTMENT', [department]);

  const fetchNotes = async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('timeline')
        .select('id, notes, performed_by_name, created_at, stage')
        .eq('order_id', orderId)
        .eq('action', 'note_added')
        .eq('stage', department)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (err) {
      console.error('Failed to fetch department notes', err);
      toast({
        title: 'Unable to load notes',
        description: 'Could not fetch department notes right now.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    if (!orderId || !department) return;
    setSubmitting(true);
    try {
      await addTimelineEntry({
        order_id: orderId,
        stage: department as any,
        action: 'note_added',
        notes: noteText.trim(),
        performed_by: user?.id || '',
        performed_by_name: profile?.full_name || 'Unknown',
        is_public: false,
      });
      setNoteText('');
      await fetchNotes();
      toast({
        title: 'Note added',
        description: 'Your note has been shared with the department.',
      });
    } catch (err) {
      console.error('Failed to add department note', err);
      toast({
        title: 'Unable to add note',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchNotes();
    }
  }, [open, orderId, department]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {departmentLabel} Notes
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Add a note for {departmentLabel}
            </label>
            <Textarea
              placeholder="Share an update or instruction for the team..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={4}
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={handleAddNote} disabled={submitting || !noteText.trim()}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Add Note
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Recent notes</p>
              {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <ScrollArea className="h-64 pr-2">
              {notes.length === 0 && !loading ? (
                <p className="text-sm text-muted-foreground">No notes for this department yet.</p>
              ) : (
                <div className="space-y-3">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className="p-3 border border-border rounded-lg bg-muted/30 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {note.performed_by_name?.slice(0, 2)?.toUpperCase() || '??'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {note.performed_by_name || 'Unknown'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(note.created_at), 'dd MMM yyyy, hh:mm a')}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-line">{note.notes}</p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Notes are scoped to the {departmentLabel} team and sorted by latest first.
          </p>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

