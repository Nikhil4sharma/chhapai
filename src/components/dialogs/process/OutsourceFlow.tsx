import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Building2, CalendarIcon, User, Phone, MapPin, PlusCircle, Save } from 'lucide-react';
import { VendorDetails, OutsourceJobDetails } from '@/types/order';
import { supabase } from '@/integrations/supabase/client';

interface OutsourceFlowProps {
    onDataChange: (data: { vendor: VendorDetails, job: OutsourceJobDetails, saveVendor: boolean }) => void;
    onValidChange: (isValid: boolean) => void;
}

export function OutsourceFlow({ onDataChange, onValidChange }: OutsourceFlowProps) {
    // Vendor State
    const [vendors, setVendors] = useState<any[]>([]);
    const [loadingVendors, setLoadingVendors] = useState(false);
    const [selectedVendorId, setSelectedVendorId] = useState<string>('_new');

    const [vendorName, setVendorName] = useState('');
    const [contactPerson, setContactPerson] = useState('');
    const [phone, setPhone] = useState('');
    const [saveNewVendor, setSaveNewVendor] = useState(true);

    // Job State
    const [workType, setWorkType] = useState('Printing & Finishing');
    const [expectedDate, setExpectedDate] = useState<Date | undefined>(undefined);
    const [qtySent, setQtySent] = useState<number>(0);

    // Fetch Vendors
    useEffect(() => {
        const fetchVendors = async () => {
            setLoadingVendors(true);
            const { data } = await supabase.from('vendors').select('*').order('vendor_name');
            if (data) setVendors(data);
            setLoadingVendors(false);
        };
        fetchVendors();
    }, []);

    // Handle Vendor Selection
    const handleVendorSelect = (val: string) => {
        setSelectedVendorId(val);
        if (val === '_new') {
            setVendorName('');
            setContactPerson('');
            setPhone('');
            setSaveNewVendor(true);
        } else {
            const v = vendors.find(vendor => vendor.id === val);
            if (v) {
                setVendorName(v.vendor_name);
                setContactPerson(v.contact_person);
                setPhone(v.phone);
                setSaveNewVendor(false); // Don't save existing
            }
        }
    };

    // Validation & Sync
    useEffect(() => {
        const isValid = !!vendorName && !!phone && !!expectedDate && qtySent > 0;

        const data = {
            vendor: {
                vendor_name: vendorName,
                contact_person: contactPerson,
                phone: phone
            },
            job: {
                work_type: workType,
                expected_ready_date: expectedDate || new Date(),
                quantity_sent: qtySent
            },
            saveVendor: selectedVendorId === '_new' && saveNewVendor
        };

        onDataChange(data);
        onValidChange(isValid);
    }, [vendorName, contactPerson, phone, workType, expectedDate, qtySent, selectedVendorId, saveNewVendor, onDataChange, onValidChange]);

    return (
        <div className="space-y-6 animate-in slide-in-from-top-2 duration-300">

            {/* Vendor Details */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1 flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5" />
                        Vendor Information
                    </Label>

                </div>

                {/* Vendor Selector */}
                <Select value={selectedVendorId} onValueChange={handleVendorSelect}>
                    <SelectTrigger className="w-full bg-muted/20 border-border/60">
                        <SelectValue placeholder="Select a vendor..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="_new" className="text-primary font-medium">
                            <PlusCircle className="w-3.5 h-3.5 mr-2 inline-block" />
                            Add New Vendor
                        </SelectItem>
                        {vendors.map(v => (
                            <SelectItem key={v.id} value={v.id}>{v.vendor_name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div className="space-y-2">
                        <Label className="text-xs">Vendor Name <span className="text-red-500">*</span></Label>
                        <Input
                            placeholder="e.g. Royal Printers"
                            value={vendorName}
                            onChange={(e) => {
                                setVendorName(e.target.value);
                                if (selectedVendorId !== '_new') setSelectedVendorId('_new'); // Switch to new if edited
                            }}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs">Phone / Contact <span className="text-red-500">*</span></Label>
                        <div className="relative">
                            <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="98765..."
                                className="pl-9"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <Label className="text-xs">Contact Person (Optional)</Label>
                        <Input
                            placeholder="e.g. Ramesh Ji"
                            value={contactPerson}
                            onChange={(e) => setContactPerson(e.target.value)}
                        />
                    </div>
                </div>

                {/* Save Checkbox - Only show if new vendor */}
                {selectedVendorId === '_new' && vendorName.length > 0 && (
                    <div className="flex items-center space-x-2 pt-1 px-1">
                        <Checkbox
                            id="save-vendor"
                            checked={saveNewVendor}
                            onCheckedChange={(c) => setSaveNewVendor(!!c)}
                        />
                        <Label htmlFor="save-vendor" className="text-xs cursor-pointer flex items-center gap-1.5 font-medium text-muted-foreground">
                            <Save className="w-3 h-3" />
                            Save as new vendor for future use
                        </Label>
                    </div>
                )}
            </div>

            {/* Job Details */}
            <div className="space-y-3 bg-muted/20 p-4 rounded-xl border border-border/50">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1 flex items-center gap-2">
                    <CalendarIcon className="w-3.5 h-3.5" />
                    Job Requirements
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-xs">Work Type</Label>
                        <Input
                            value={workType}
                            onChange={(e) => setWorkType(e.target.value)}
                            placeholder="e.g. Foiling only"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs">Quantity Sent <span className="text-red-500">*</span></Label>
                        <Input
                            type="number"
                            min={1}
                            value={qtySent || ''}
                            onChange={(e) => setQtySent(Number(e.target.value))}
                        />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <Label className="text-xs">Expected Return Date <span className="text-red-500">*</span></Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-full justify-start text-left font-normal bg-background",
                                        !expectedDate && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {expectedDate ? format(expectedDate, "PPP") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={expectedDate}
                                    onSelect={setExpectedDate}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
            </div>
        </div>
    );
}
