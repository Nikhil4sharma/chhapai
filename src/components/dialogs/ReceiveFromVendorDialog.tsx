import { useState, useEffect } from 'react';
import { Package, Calendar, User, Save } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ReceiveFromVendorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (receiverName: string, receivedDate: Date) => Promise<void>;
  productName: string;
}

export function ReceiveFromVendorDialog({
  open,
  onOpenChange,
  onSave,
  productName,
}: ReceiveFromVendorDialogProps) {
  const [receiverName, setReceiverName] = useState('');
  const [receivedDate, setReceivedDate] = useState<Date>(new Date());
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setReceiverName('');
      setReceivedDate(new Date());
      setErrors({});
    }
  }, [open]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!receiverName.trim()) {
      newErrors.receiverName = 'Receiver name is required';
    }
    if (!receivedDate) {
      newErrors.receivedDate = 'Received date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setIsSaving(true);
    try {
      await onSave(receiverName.trim(), receivedDate);
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving receive:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Receive from Vendor
          </DialogTitle>
          <DialogDescription>
            Mark <span className="font-semibold">{productName}</span> as received from vendor
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="receiver_name" className="flex items-center gap-2">
              <User className="h-3.5 w-3.5" />
              Receiver Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="receiver_name"
              value={receiverName}
              onChange={(e) => setReceiverName(e.target.value)}
              placeholder="Enter receiver name"
              className={errors.receiverName ? 'border-destructive' : ''}
            />
            {errors.receiverName && (
              <p className="text-xs text-destructive">{errors.receiverName}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="received_date" className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" />
              Received Date <span className="text-destructive">*</span>
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !receivedDate && "text-muted-foreground",
                    errors.receivedDate && "border-destructive"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {receivedDate ? format(receivedDate, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker
                  mode="single"
                  selected={receivedDate}
                  onSelect={(date) => {
                    if (date) {
                      setReceivedDate(date);
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {errors.receivedDate && (
              <p className="text-xs text-destructive">{errors.receivedDate}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Mark Received'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

