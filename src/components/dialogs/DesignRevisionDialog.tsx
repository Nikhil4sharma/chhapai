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

interface DesignRevisionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (notes: string) => void;
}

export function DesignRevisionDialog({
    open,
    onOpenChange,
    onConfirm
}: DesignRevisionDialogProps) {
    const [notes, setNotes] = useState('');

    const handleSubmit = () => {
        if (!notes.trim()) return;
        onConfirm(notes);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Request Design Revision</DialogTitle>
                    <DialogDescription>
                        Please provide details about the required changes. This will be sent back to the Design team.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Notes */}
                    <div className="space-y-2">
                        <Label>Revision Notes <span className="text-red-500">*</span></Label>
                        <Textarea
                            placeholder="Describe what needs to be changed..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="min-h-[100px]"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} variant="destructive" disabled={!notes.trim()}>
                        Request Revision
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
