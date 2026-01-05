import { useState, useEffect } from 'react';
import { Building2, User, Phone, Mail, MapPin, Plus, Save, Edit, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

export function VendorManagement() {
    const [vendors, setVendors] = useState<Array<{
        id: string;
        vendor_name: string;
        vendor_company?: string;
        contact_person: string;
        phone: string;
        email?: string;
        city?: string;
        created_at: Date;
        updated_at: Date;
    }>>([]);

    const [newVendor, setNewVendor] = useState({
        vendor_name: '',
        vendor_company: '',
        contact_person: '',
        phone: '',
        email: '',
        city: '',
    });

    const [editingVendorId, setEditingVendorId] = useState<string | null>(null);

    // Load vendors from Supabase
    useEffect(() => {
        const loadVendors = async () => {
            try {
                const { data: vendorsData, error: vendorsError } = await supabase
                    .from('vendors')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (vendorsError) throw vendorsError;

                const mappedVendors = (vendorsData || []).map(v => ({
                    id: v.id,
                    vendor_name: v.vendor_name,
                    vendor_company: v.vendor_company || undefined,
                    contact_person: v.contact_person,
                    phone: v.phone,
                    email: v.email || undefined,
                    city: v.city || undefined,
                    created_at: new Date(v.created_at),
                    updated_at: new Date(v.updated_at),
                }));

                setVendors(mappedVendors);
            } catch (error) {
                console.error('Error loading vendors:', error);
                toast({
                    title: "Error",
                    description: "Failed to load vendors",
                    variant: "destructive"
                });
            }
        };

        loadVendors();
    }, []);

    const handleAddVendor = async () => {
        if (!newVendor.vendor_name.trim() || !newVendor.contact_person.trim() || !newVendor.phone.trim()) {
            toast({
                title: "Validation Error",
                description: "Vendor name, contact person, and phone are required",
                variant: "destructive",
            });
            return;
        }

        try {
            const vendorData = {
                vendor_name: newVendor.vendor_name.trim(),
                vendor_company: newVendor.vendor_company.trim() || null,
                contact_person: newVendor.contact_person.trim(),
                phone: newVendor.phone.trim(),
                email: newVendor.email.trim() || null,
                city: newVendor.city.trim() || null,
            };

            const { data: newVendorData, error: vendorError } = await supabase
                .from('vendors')
                .insert(vendorData)
                .select()
                .single();

            if (vendorError) throw vendorError;
            if (!newVendorData) throw new Error('Vendor creation failed');

            const addedVendorName = vendorData.vendor_name;
            setVendors([...vendors, {
                id: newVendorData.id,
                vendor_name: newVendorData.vendor_name,
                vendor_company: newVendorData.vendor_company || undefined,
                contact_person: newVendorData.contact_person,
                phone: newVendorData.phone,
                email: newVendorData.email || undefined,
                city: newVendorData.city || undefined,
                created_at: new Date(newVendorData.created_at),
                updated_at: new Date(newVendorData.updated_at),
            }]);
            setNewVendor({
                vendor_name: '',
                vendor_company: '',
                contact_person: '',
                phone: '',
                email: '',
                city: '',
            });

            toast({
                title: "Vendor Added",
                description: `${addedVendorName} has been added successfully`,
            });
        } catch (error) {
            console.error('Error adding vendor:', error);
            toast({
                title: "Error",
                description: "Failed to add vendor",
                variant: "destructive",
            });
        }
    };

    const handleUpdateVendor = async (vendorId: string, updatedData: typeof newVendor) => {
        if (!updatedData.vendor_name.trim() || !updatedData.contact_person.trim() || !updatedData.phone.trim()) {
            toast({
                title: "Validation Error",
                description: "Vendor name, contact person, and phone are required",
                variant: "destructive",
            });
            return;
        }

        try {
            const { error: vendorError } = await supabase
                .from('vendors')
                .update({
                    vendor_name: updatedData.vendor_name.trim(),
                    vendor_company: updatedData.vendor_company.trim() || null,
                    contact_person: updatedData.contact_person.trim(),
                    phone: updatedData.phone.trim(),
                    email: updatedData.email.trim() || null,
                    city: updatedData.city.trim() || null,
                })
                .eq('id', vendorId);

            if (vendorError) throw vendorError;

            setVendors(vendors.map(v => v.id === vendorId ? {
                ...v,
                ...updatedData,
                vendor_company: updatedData.vendor_company.trim() || undefined,
                email: updatedData.email.trim() || undefined,
                city: updatedData.city.trim() || undefined,
                updated_at: new Date(),
            } : v));
            setEditingVendorId(null);

            toast({
                title: "Vendor Updated",
                description: "Vendor details have been updated successfully",
            });
        } catch (error) {
            console.error('Error updating vendor:', error);
            toast({
                title: "Error",
                description: "Failed to update vendor",
                variant: "destructive",
            });
        }
    };

    const handleDeleteVendor = async (vendorId: string) => {
        try {
            const { error: vendorError } = await supabase
                .from('vendors')
                .delete()
                .eq('id', vendorId);

            if (vendorError) throw vendorError;

            setVendors(vendors.filter(v => v.id !== vendorId));

            toast({
                title: "Vendor Deleted",
                description: "Vendor has been removed successfully",
            });
        } catch (error) {
            console.error('Error deleting vendor:', error);
            toast({
                title: "Error",
                description: "Failed to delete vendor",
                variant: "destructive",
            });
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Outsource Vendors
                </CardTitle>
                <CardDescription>Manage vendor details for outsource assignments</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6">
                {/* Add New Vendor Form */}
                <div className="bg-secondary/50 rounded-lg p-4 space-y-4">
                    <h4 className="font-medium text-foreground">Add New Vendor</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="new_vendor_name" className="flex items-center gap-2">
                                <Building2 className="h-3.5 w-3.5" />
                                Vendor Name <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="new_vendor_name"
                                placeholder="Enter vendor name"
                                value={newVendor.vendor_name}
                                onChange={(e) => setNewVendor({ ...newVendor, vendor_name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new_vendor_company">Vendor Company</Label>
                            <Input
                                id="new_vendor_company"
                                placeholder="Enter company name (optional)"
                                value={newVendor.vendor_company}
                                onChange={(e) => setNewVendor({ ...newVendor, vendor_company: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new_contact_person" className="flex items-center gap-2">
                                <User className="h-3.5 w-3.5" />
                                Contact Person <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="new_contact_person"
                                placeholder="Enter contact person name"
                                value={newVendor.contact_person}
                                onChange={(e) => setNewVendor({ ...newVendor, contact_person: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new_phone" className="flex items-center gap-2">
                                <Phone className="h-3.5 w-3.5" />
                                Phone <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="new_phone"
                                type="tel"
                                placeholder="Enter phone number"
                                value={newVendor.phone}
                                onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new_email" className="flex items-center gap-2">
                                <Mail className="h-3.5 w-3.5" />
                                Email
                            </Label>
                            <Input
                                id="new_email"
                                type="email"
                                placeholder="Enter email (optional)"
                                value={newVendor.email}
                                onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new_city" className="flex items-center gap-2">
                                <MapPin className="h-3.5 w-3.5" />
                                City / Location
                            </Label>
                            <Input
                                id="new_city"
                                placeholder="Enter city (optional)"
                                value={newVendor.city}
                                onChange={(e) => setNewVendor({ ...newVendor, city: e.target.value })}
                            />
                        </div>
                    </div>
                    <Button onClick={handleAddVendor} className="w-full sm:w-auto">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Vendor
                    </Button>
                </div>

                <Separator />

                {/* Vendors List */}
                <div className="space-y-3">
                    <h4 className="font-medium text-foreground">Saved Vendors ({vendors.length})</h4>
                    {vendors.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>No vendors added yet</p>
                            <p className="text-sm">Add your first vendor using the form above</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {vendors.map((vendor) => (
                                <div
                                    key={vendor.id}
                                    className="p-4 bg-secondary/50 rounded-lg border border-border"
                                >
                                    {editingVendorId === vendor.id ? (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Vendor Name <span className="text-destructive">*</span></Label>
                                                    <Input
                                                        value={newVendor.vendor_name}
                                                        onChange={(e) => setNewVendor({ ...newVendor, vendor_name: e.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Company</Label>
                                                    <Input
                                                        value={newVendor.vendor_company}
                                                        onChange={(e) => setNewVendor({ ...newVendor, vendor_company: e.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Contact Person <span className="text-destructive">*</span></Label>
                                                    <Input
                                                        value={newVendor.contact_person}
                                                        onChange={(e) => setNewVendor({ ...newVendor, contact_person: e.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Phone <span className="text-destructive">*</span></Label>
                                                    <Input
                                                        type="tel"
                                                        value={newVendor.phone}
                                                        onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Email</Label>
                                                    <Input
                                                        type="email"
                                                        value={newVendor.email}
                                                        onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>City</Label>
                                                    <Input
                                                        value={newVendor.city}
                                                        onChange={(e) => setNewVendor({ ...newVendor, city: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    onClick={() => {
                                                        handleUpdateVendor(vendor.id, newVendor);
                                                        setNewVendor({
                                                            vendor_name: '',
                                                            vendor_company: '',
                                                            contact_person: '',
                                                            phone: '',
                                                            email: '',
                                                            city: '',
                                                        });
                                                    }}
                                                >
                                                    <Save className="h-4 w-4 mr-2" />
                                                    Save
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        setEditingVendorId(null);
                                                        setNewVendor({
                                                            vendor_name: '',
                                                            vendor_company: '',
                                                            contact_person: '',
                                                            phone: '',
                                                            email: '',
                                                            city: '',
                                                        });
                                                    }}
                                                >
                                                    Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 space-y-2">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h5 className="font-semibold text-foreground">{vendor.vendor_name}</h5>
                                                    {vendor.vendor_company && (
                                                        <Badge variant="outline" className="text-xs">
                                                            {vendor.vendor_company}
                                                        </Badge>
                                                    )}
                                                    {vendor.city && (
                                                        <Badge variant="outline" className="text-xs">
                                                            <MapPin className="h-3 w-3 mr-1" />
                                                            {vendor.city}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                                                    <div className="flex items-center gap-2">
                                                        <User className="h-3.5 w-3.5" />
                                                        <span>{vendor.contact_person}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Phone className="h-3.5 w-3.5" />
                                                        <span>{vendor.phone}</span>
                                                    </div>
                                                    {vendor.email && (
                                                        <div className="flex items-center gap-2">
                                                            <Mail className="h-3.5 w-3.5" />
                                                            <span>{vendor.email}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon-sm"
                                                                onClick={() => {
                                                                    setEditingVendorId(vendor.id);
                                                                    setNewVendor({
                                                                        vendor_name: vendor.vendor_name,
                                                                        vendor_company: vendor.vendor_company || '',
                                                                        contact_person: vendor.contact_person,
                                                                        phone: vendor.phone,
                                                                        email: vendor.email || '',
                                                                        city: vendor.city || '',
                                                                    });
                                                                }}
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Edit vendor</TooltipContent>
                                                    </Tooltip>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon-sm"
                                                                onClick={() => handleDeleteVendor(vendor.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Delete vendor</TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
