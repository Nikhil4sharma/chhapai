import { useState } from 'react';
import { Edit } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Order } from '@/types/order';

interface EditOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
  onSave: (updates: Partial<Order>) => void;
}

export function EditOrderDialog({ 
  open, 
  onOpenChange, 
  order,
  onSave 
}: EditOrderDialogProps) {
  const [formData, setFormData] = useState({
    customer_name: order.customer.name,
    customer_phone: order.customer.phone,
    customer_email: order.customer.email,
    customer_address: order.customer.address,
    global_notes: order.global_notes || '',
  });

  const handleSave = () => {
    onSave({
      customer: {
        name: formData.customer_name,
        phone: formData.customer_phone,
        email: formData.customer_email,
        address: formData.customer_address,
      },
      global_notes: formData.global_notes,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Edit Order - {order.order_id}
          </DialogTitle>
          <DialogDescription>
            Update customer details and order notes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customer_name">Customer Name</Label>
              <Input
                id="customer_name"
                value={formData.customer_name}
                onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer_phone">Phone</Label>
              <Input
                id="customer_phone"
                value={formData.customer_phone}
                onChange={(e) => setFormData({...formData, customer_phone: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer_email">Email</Label>
            <Input
              id="customer_email"
              type="email"
              value={formData.customer_email}
              onChange={(e) => setFormData({...formData, customer_email: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer_address">Address</Label>
            <Input
              id="customer_address"
              value={formData.customer_address}
              onChange={(e) => setFormData({...formData, customer_address: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="global_notes">Order Notes</Label>
            <Textarea
              id="global_notes"
              value={formData.global_notes}
              onChange={(e) => setFormData({...formData, global_notes: e.target.value})}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
