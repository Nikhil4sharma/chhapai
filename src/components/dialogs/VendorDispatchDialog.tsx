import { useState, useEffect } from 'react';
import { Truck, Calendar, Save } from 'lucide-react';
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

interface VendorDispatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (courierName: string, trackingNumber: string, dispatchDate: Date) => Promise<void>;
  productName: string;
}

export function VendorDispatchDialog({
  open,
  onOpenChange,
  onSave,
  productName,
}: VendorDispatchDialogProps) {
  const [courierName, setCourierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [dispatchDate, setDispatchDate] = useState<Date>(new Date());
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setCourierName('');
      setTrackingNumber('');
      setDispatchDate(new Date());
      setErrors({});
    }
  }, [open]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!courierName.trim()) {
      newErrors.courierName = 'Courier name is required';
    }
    if (!trackingNumber.trim()) {
      newErrors.trackingNumber = 'Tracking number is required';
    }
    if (!dispatchDate) {
      newErrors.dispatchDate = 'Dispatch date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setIsSaving(true);
    try {
      await onSave(courierName.trim(), trackingNumber.trim(), dispatchDate);
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving dispatch:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Vendor Dispatch
          </DialogTitle>
          <DialogDescription>
            Mark <span className="font-semibold">{productName}</span> as dispatched by vendor
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="courier_name">
              Courier Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="courier_name"
              value={courierName}
              onChange={(e) => setCourierName(e.target.value)}
              placeholder="Enter courier company name"
              className={errors.courierName ? 'border-destructive' : ''}
            />
            {errors.courierName && (
              <p className="text-xs text-destructive">{errors.courierName}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tracking_number">
              Tracking Number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="tracking_number"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="Enter tracking number"
              className={errors.trackingNumber ? 'border-destructive' : ''}
            />
            {errors.trackingNumber && (
              <p className="text-xs text-destructive">{errors.trackingNumber}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="dispatch_date" className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" />
              Dispatch Date <span className="text-destructive">*</span>
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dispatchDate && "text-muted-foreground",
                    errors.dispatchDate && "border-destructive"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {dispatchDate ? format(dispatchDate, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker
                  mode="single"
                  selected={dispatchDate}
                  onSelect={(date) => {
                    if (date) {
                      setDispatchDate(date);
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {errors.dispatchDate && (
              <p className="text-xs text-destructive">{errors.dispatchDate}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Mark Dispatched'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

