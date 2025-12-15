import { useState } from 'react';
import { Truck, Package, Calendar } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';

interface DispatchInfo {
  courier_company: string;
  tracking_number: string;
  dispatch_date: string;
}

interface DispatchValidationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  orderId: string;
  onConfirm: (dispatchInfo: DispatchInfo) => void;
}

export function DispatchValidationDialog({
  open,
  onOpenChange,
  productName,
  orderId,
  onConfirm,
}: DispatchValidationDialogProps) {
  const [dispatchInfo, setDispatchInfo] = useState<DispatchInfo>({
    courier_company: '',
    tracking_number: '',
    dispatch_date: new Date().toISOString().split('T')[0],
  });
  const [errors, setErrors] = useState<Partial<DispatchInfo>>({});

  const validate = (): boolean => {
    const newErrors: Partial<DispatchInfo> = {};

    if (!dispatchInfo.courier_company.trim()) {
      newErrors.courier_company = 'Courier company is required';
    }
    if (!dispatchInfo.tracking_number.trim()) {
      newErrors.tracking_number = 'Tracking/AWB number is required';
    }
    if (!dispatchInfo.dispatch_date) {
      newErrors.dispatch_date = 'Dispatch date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required dispatch details",
        variant: "destructive",
      });
      return;
    }

    onConfirm(dispatchInfo);
    setDispatchInfo({
      courier_company: '',
      tracking_number: '',
      dispatch_date: new Date().toISOString().split('T')[0],
    });
    setErrors({});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Dispatch Details Required
          </DialogTitle>
          <DialogDescription>
            Enter dispatch information for <strong>{productName}</strong> ({orderId})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="courier" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Courier Company *
            </Label>
            <Input
              id="courier"
              placeholder="e.g., Blue Dart, DTDC, Delhivery"
              value={dispatchInfo.courier_company}
              onChange={(e) => setDispatchInfo({ ...dispatchInfo, courier_company: e.target.value })}
              className={errors.courier_company ? 'border-destructive' : ''}
            />
            {errors.courier_company && (
              <p className="text-xs text-destructive">{errors.courier_company}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tracking" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Tracking / AWB Number *
            </Label>
            <Input
              id="tracking"
              placeholder="e.g., AWB123456789"
              value={dispatchInfo.tracking_number}
              onChange={(e) => setDispatchInfo({ ...dispatchInfo, tracking_number: e.target.value })}
              className={errors.tracking_number ? 'border-destructive' : ''}
            />
            {errors.tracking_number && (
              <p className="text-xs text-destructive">{errors.tracking_number}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="date" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Dispatch Date *
            </Label>
            <Input
              id="date"
              type="date"
              value={dispatchInfo.dispatch_date}
              onChange={(e) => setDispatchInfo({ ...dispatchInfo, dispatch_date: e.target.value })}
              className={errors.dispatch_date ? 'border-destructive' : ''}
            />
            {errors.dispatch_date && (
              <p className="text-xs text-destructive">{errors.dispatch_date}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="bg-green-600 hover:bg-green-700">
            <Truck className="h-4 w-4 mr-2" />
            Confirm Dispatch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
