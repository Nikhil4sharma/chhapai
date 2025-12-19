import { useState, useEffect } from 'react';
import { Building2, Calendar, Package, FileText, Save } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { VendorDetails, OutsourceJobDetails } from '@/types/order';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';

interface OutsourceAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssign: (vendor: VendorDetails, jobDetails: OutsourceJobDetails) => void;
  productName: string;
  quantity: number;
}

const WORK_TYPES = [
  'Foiling',
  'UV',
  'Die Cut',
  'Lamination',
  'Special Print',
  'Embossing',
  'Letterpress',
  'Other',
];

export function OutsourceAssignmentDialog({
  open,
  onOpenChange,
  onAssign,
  productName,
  quantity,
}: OutsourceAssignmentDialogProps) {
  const [vendor, setVendor] = useState<VendorDetails>({
    vendor_name: '',
    vendor_company: '',
    contact_person: '',
    phone: '',
    email: '',
    city: '',
  });

  const [jobDetails, setJobDetails] = useState<OutsourceJobDetails>({
    work_type: '',
    expected_ready_date: new Date(),
    quantity_sent: quantity,
    special_instructions: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [vendors, setVendors] = useState<Array<{
    id: string;
    vendor_name: string;
    vendor_company?: string;
    contact_person: string;
    phone: string;
    email?: string;
    city?: string;
  }>>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>('new');
  const [loadingVendors, setLoadingVendors] = useState(false);

  // Load vendors from Firebase
  useEffect(() => {
    const loadVendors = async () => {
      if (!open) return;
      
      setLoadingVendors(true);
      try {
        const vendorsRef = collection(db, 'vendors');
        const vendorsSnap = await getDocs(vendorsRef);
        const vendorsData = vendorsSnap.docs.map(d => ({
          id: d.id,
          vendor_name: d.data().vendor_name || '',
          vendor_company: d.data().vendor_company,
          contact_person: d.data().contact_person || '',
          phone: d.data().phone || '',
          email: d.data().email,
          city: d.data().city,
        }));
        setVendors(vendorsData);
      } catch (error) {
        console.error('Error loading vendors:', error);
      } finally {
        setLoadingVendors(false);
      }
    };

    loadVendors();
  }, [open]);

  // Handle vendor selection from dropdown
  const handleVendorSelect = (vendorId: string) => {
    setSelectedVendorId(vendorId);
    // Auto-fill vendor details
    const selectedVendor = vendors.find(v => v.id === vendorId);
    if (selectedVendor) {
      setVendor({
        vendor_name: selectedVendor.vendor_name,
        vendor_company: selectedVendor.vendor_company || '',
        contact_person: selectedVendor.contact_person,
        phone: selectedVendor.phone,
        email: selectedVendor.email || '',
        city: selectedVendor.city || '',
      });
    }
  };

  useEffect(() => {
    if (open) {
      // Reset form when dialog opens
      setSelectedVendorId('');
      setVendor({
        vendor_name: '',
        vendor_company: '',
        contact_person: '',
        phone: '',
        email: '',
        city: '',
      });
      setJobDetails({
        work_type: '',
        expected_ready_date: new Date(),
        quantity_sent: quantity,
        special_instructions: '',
      });
      setErrors({});
    }
  }, [open, quantity]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!selectedVendorId || !vendor.vendor_name.trim()) {
      newErrors.vendor_name = 'Please select a vendor';
    }
    if (!vendor.contact_person.trim()) {
      newErrors.contact_person = 'Contact person name is required';
    }
    if (!vendor.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    }
    if (!jobDetails.work_type) {
      newErrors.work_type = 'Work type is required';
    }
    if (!jobDetails.expected_ready_date) {
      newErrors.expected_ready_date = 'Expected ready date is required';
    }
    if (jobDetails.quantity_sent <= 0) {
      newErrors.quantity_sent = 'Quantity must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onAssign(vendor, jobDetails);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Assign to Outsource
          </DialogTitle>
          <DialogDescription>
            Assign <span className="font-semibold">{productName}</span> to an external vendor. All details are required for traceability.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Vendor Selection - Only dropdown, no details shown */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">Vendor Selection</h3>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor_select">
                Select Vendor <span className="text-destructive">*</span>
              </Label>
              {loadingVendors ? (
                <div className="text-sm text-muted-foreground py-2">Loading vendors...</div>
              ) : vendors.length === 0 ? (
                <div className="text-sm text-muted-foreground py-2 border border-dashed rounded-md p-4 text-center">
                  <p className="mb-2">No vendors available.</p>
                  <p className="text-xs">Please contact admin to add vendors from Settings page.</p>
                </div>
              ) : (
                <Select
                  value={selectedVendorId}
                  onValueChange={handleVendorSelect}
                >
                  <SelectTrigger id="vendor_select" className={errors.vendor_name ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{v.vendor_name}</span>
                          {v.vendor_company && (
                            <span className="text-xs text-muted-foreground">{v.vendor_company}</span>
                          )}
                          {v.city && (
                            <span className="text-xs text-muted-foreground">📍 {v.city}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {!selectedVendorId && vendors.length > 0 && (
                <p className="text-xs text-destructive">Please select a vendor</p>
              )}
            </div>
          </div>

          {/* Outsource Job Details Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Package className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">Outsource Job Details</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="work_type">
                  Work Type <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={jobDetails.work_type}
                  onValueChange={(value) => setJobDetails({ ...jobDetails, work_type: value })}
                >
                  <SelectTrigger className={errors.work_type ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select work type" />
                  </SelectTrigger>
                  <SelectContent>
                    {WORK_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.work_type && (
                  <p className="text-xs text-destructive">{errors.work_type}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="expected_ready_date" className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5" />
                  Expected Ready Date <span className="text-destructive">*</span>
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !jobDetails.expected_ready_date && "text-muted-foreground",
                        errors.expected_ready_date && "border-destructive"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {jobDetails.expected_ready_date
                        ? format(jobDetails.expected_ready_date, "PPP")
                        : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarPicker
                      mode="single"
                      selected={jobDetails.expected_ready_date}
                      onSelect={(date) => {
                        if (date) {
                          setJobDetails({ ...jobDetails, expected_ready_date: date });
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {errors.expected_ready_date && (
                  <p className="text-xs text-destructive">{errors.expected_ready_date}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity_sent" className="flex items-center gap-2">
                  <Package className="h-3.5 w-3.5" />
                  Quantity Sent <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="quantity_sent"
                  type="number"
                  min="1"
                  value={jobDetails.quantity_sent}
                  onChange={(e) => setJobDetails({
                    ...jobDetails,
                    quantity_sent: parseInt(e.target.value) || 0
                  })}
                  className={errors.quantity_sent ? 'border-destructive' : ''}
                />
                {errors.quantity_sent && (
                  <p className="text-xs text-destructive">{errors.quantity_sent}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="special_instructions" className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5" />
                Special Instructions
              </Label>
              <Textarea
                id="special_instructions"
                value={jobDetails.special_instructions}
                onChange={(e) => setJobDetails({ ...jobDetails, special_instructions: e.target.value })}
                placeholder="Enter any special instructions for the vendor..."
                rows={3}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="gap-2">
            <Save className="h-4 w-4" />
            Assign to Outsource
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

