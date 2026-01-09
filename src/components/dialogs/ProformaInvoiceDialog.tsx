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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, FileText, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { generateProformaInvoice, generatePINumber, ProductLine } from '@/utils/generateProformaInvoice';
import { useAuth } from '@/features/auth/context/AuthContext';
import { format } from 'date-fns';

interface ProformaInvoiceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ProformaInvoiceDialog({ open, onOpenChange }: ProformaInvoiceDialogProps) {
    const { user, profile } = useAuth();

    // Form State
    const [purchaserName, setPurchaserName] = useState('');
    const [purchaserAddress, setPurchaserAddress] = useState('');
    const [purchaserGst, setPurchaserGst] = useState('');
    const [products, setProducts] = useState<ProductLine[]>([
        { description: '', quantity: 1, rate: 0 }
    ]);
    const [shippingCharges, setShippingCharges] = useState(0);
    const [includeGst, setIncludeGst] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    // Calculations
    const subtotal = products.reduce((sum, p) => sum + (p.quantity * p.rate), 0);
    const taxableAmount = subtotal + shippingCharges;
    const gstAmount = includeGst ? taxableAmount * 0.18 : 0;
    const totalAmount = taxableAmount + gstAmount;

    const addProduct = () => {
        setProducts([...products, { description: '', quantity: 1, rate: 0 }]);
    };

    const removeProduct = (index: number) => {
        if (products.length > 1) {
            setProducts(products.filter((_, i) => i !== index));
        }
    };

    const updateProduct = (index: number, field: keyof ProductLine, value: string | number) => {
        const updated = [...products];
        updated[index] = { ...updated[index], [field]: value };
        setProducts(updated);
    };

    const handleGenerate = () => {
        // Validation
        if (!purchaserName.trim()) {
            toast({
                title: 'Validation Error',
                description: 'Purchaser name is required',
                variant: 'destructive',
            });
            return;
        }

        if (!purchaserAddress.trim()) {
            toast({
                title: 'Validation Error',
                description: 'Purchaser address is required',
                variant: 'destructive',
            });
            return;
        }

        const validProducts = products.filter(p => p.description.trim() && p.quantity > 0 && p.rate > 0);
        if (validProducts.length === 0) {
            toast({
                title: 'Validation Error',
                description: 'At least one valid product is required',
                variant: 'destructive',
            });
            return;
        }

        setIsGenerating(true);

        try {
            const piNumber = generatePINumber();
            const currentDate = format(new Date(), 'dd.MM.yyyy');
            const issuePerson = profile?.full_name || user?.email || 'Sales Team';

            generateProformaInvoice({
                piNumber,
                date: currentDate,
                issuePerson,
                purchaserName,
                purchaserAddress,
                purchaserGst: purchaserGst || undefined,
                products: validProducts,
                shippingCharges,
                includeGst,
            });

            toast({
                title: 'Success',
                description: `Proforma Invoice ${piNumber} generated successfully`,
                className: 'bg-green-500 text-white',
            });

            // Reset form
            setPurchaserName('');
            setPurchaserAddress('');
            setPurchaserGst('');
            setProducts([{ description: '', quantity: 1, rate: 0 }]);
            setShippingCharges(0);
            setIncludeGst(false);

            onOpenChange(false);
        } catch (error) {
            console.error('Error generating PI:', error);
            toast({
                title: 'Error',
                description: 'Failed to generate Proforma Invoice',
                variant: 'destructive',
            });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Generate Proforma Invoice
                    </DialogTitle>
                    <DialogDescription>
                        Create a professional proforma invoice for your customer
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Purchaser Details */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-sm">Purchaser Details</h3>

                        <div className="grid gap-4">
                            <div>
                                <Label htmlFor="purchaser-name">Purchaser Name *</Label>
                                <Input
                                    id="purchaser-name"
                                    value={purchaserName}
                                    onChange={(e) => setPurchaserName(e.target.value)}
                                    placeholder="Enter purchaser/company name"
                                />
                            </div>

                            <div>
                                <Label htmlFor="purchaser-address">Purchaser Address *</Label>
                                <Textarea
                                    id="purchaser-address"
                                    value={purchaserAddress}
                                    onChange={(e) => setPurchaserAddress(e.target.value)}
                                    placeholder="Enter complete address"
                                    rows={3}
                                />
                            </div>

                            <div>
                                <Label htmlFor="purchaser-gst">Purchaser GST Number (Optional)</Label>
                                <Input
                                    id="purchaser-gst"
                                    value={purchaserGst}
                                    onChange={(e) => setPurchaserGst(e.target.value)}
                                    placeholder="e.g., 03AAMCB1040N1ZU"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Products */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-sm">Products *</h3>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={addProduct}
                            >
                                <Plus className="w-4 h-4 mr-1" />
                                Add Product
                            </Button>
                        </div>

                        <div className="space-y-3">
                            {products.map((product, index) => (
                                <div key={index} className="grid grid-cols-12 gap-2 items-end p-3 border rounded-lg">
                                    <div className="col-span-5">
                                        <Label className="text-xs">Description</Label>
                                        <Input
                                            value={product.description}
                                            onChange={(e) => updateProduct(index, 'description', e.target.value)}
                                            placeholder="Product name"
                                            className="h-9"
                                        />
                                    </div>

                                    <div className="col-span-2">
                                        <Label className="text-xs">Quantity</Label>
                                        <Input
                                            type="number"
                                            min="1"
                                            value={product.quantity}
                                            onChange={(e) => updateProduct(index, 'quantity', parseInt(e.target.value) || 0)}
                                            className="h-9"
                                        />
                                    </div>

                                    <div className="col-span-2">
                                        <Label className="text-xs">Rate (₹)</Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={product.rate}
                                            onChange={(e) => updateProduct(index, 'rate', parseFloat(e.target.value) || 0)}
                                            className="h-9"
                                        />
                                    </div>

                                    <div className="col-span-2">
                                        <Label className="text-xs">Amount</Label>
                                        <Input
                                            value={(product.quantity * product.rate).toFixed(2)}
                                            disabled
                                            className="h-9 bg-muted"
                                        />
                                    </div>

                                    <div className="col-span-1">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeProduct(index)}
                                            disabled={products.length === 1}
                                            className="h-9 w-9"
                                        >
                                            <Trash2 className="w-4 h-4 text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Additional Charges */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-sm">Additional Charges</h3>

                        <div className="grid gap-4">
                            <div>
                                <Label htmlFor="shipping">Shipping Charges (₹)</Label>
                                <Input
                                    id="shipping"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={shippingCharges}
                                    onChange={(e) => setShippingCharges(parseFloat(e.target.value) || 0)}
                                    placeholder="0.00"
                                />
                            </div>

                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="include-gst"
                                    checked={includeGst}
                                    onCheckedChange={(checked) => setIncludeGst(checked as boolean)}
                                />
                                <Label htmlFor="include-gst" className="cursor-pointer">
                                    Include GST (18%)
                                </Label>
                            </div>
                        </div>
                    </div>

                    {/* Summary */}
                    <div className="border-t pt-4">
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Subtotal:</span>
                                <span className="font-medium">₹ {subtotal.toFixed(2)}</span>
                            </div>

                            {shippingCharges > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Shipping:</span>
                                    <span className="font-medium">₹ {shippingCharges.toFixed(2)}</span>
                                </div>
                            )}

                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Taxable Amount:</span>
                                <span className="font-medium">₹ {taxableAmount.toFixed(2)}</span>
                            </div>

                            {includeGst && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">GST (18%):</span>
                                    <span className="font-medium">₹ {gstAmount.toFixed(2)}</span>
                                </div>
                            )}

                            <div className="flex justify-between text-base font-bold pt-2 border-t">
                                <span>Total Invoice:</span>
                                <span>₹ {totalAmount.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleGenerate} disabled={isGenerating}>
                        {isGenerating ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <FileText className="w-4 h-4 mr-2" />
                                Generate PDF
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
