import { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
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
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface UpdateDeliveryDateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentDate: Date;
  productName: string;
  onSave: (date: Date) => Promise<void>;
}

export function UpdateDeliveryDateDialog({ 
  open, 
  onOpenChange, 
  currentDate,
  productName,
  onSave 
}: UpdateDeliveryDateDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(currentDate);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedDate(currentDate);
    }
  }, [open, currentDate]);

  const handleSave = async () => {
    if (!selectedDate) return;
    setIsSaving(true);
    try {
      await onSave(selectedDate);
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating delivery date:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Update Delivery Date
          </DialogTitle>
          <DialogDescription>
            Update delivery date for <span className="font-semibold">{productName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Current Delivery Date</Label>
            <div className="text-sm text-muted-foreground">
              {format(currentDate, 'PPP')}
            </div>
          </div>

          <div className="space-y-2">
            <Label>New Delivery Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !selectedDate}>
            {isSaving ? 'Saving...' : 'Update Date'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}









