import { useState, useEffect } from 'react';
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
import { Plus, Trash2, FileText, Loader2, History, Download, Search } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { generateProformaInvoice, generatePINumber, ProductLine } from '@/utils/generateProformaInvoice';
import { useAuth } from '@/features/auth/context/AuthContext';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ProformaInvoiceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface SavedInvoice {
    id: string;
    pi_number: string;
    created_at: string;
    purchaser_details: {
        name: string;
        address: string;
        gst?: string;
    };
    items: ProductLine[];
    financials: {
        shipping: number;
        gst_rate: number;
        total: number;
    };
}

export function ProformaInvoiceDialog({ open, onOpenChange }: ProformaInvoiceDialogProps) {
    const { user, profile } = useAuth();
    const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate');

    // Form State
    const [purchaserName, setPurchaserName] = useState('');
    const [purchaserAddress, setPurchaserAddress] = useState('');
    const [purchaserGst, setPurchaserGst] = useState('');
    const [products, setProducts] = useState<ProductLine[]>([
        { description: '', quantity: 1, rate: 0 }
    ]);
    const [shippingCharges, setShippingCharges] = useState(0);
    const [gstRate, setGstRate] = useState<number>(0);
    const [isGenerating, setIsGenerating] = useState(false);

    // Auto-save State
    const [recentPurchasers, setRecentPurchasers] = useState<{ name: string, address: string, gst: string }[]>([]);

    // History State
    const [history, setHistory] = useState<SavedInvoice[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Load recent purchasers on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem('pi_recent_purchasers');
            if (saved) {
                setRecentPurchasers(JSON.parse(saved));
            }
        } catch (e) {
            console.error('Failed to load recent purchasers', e);
        }
    }, []);

    // Load history when tab changes
    useEffect(() => {
        if (activeTab === 'history' && open) {
            fetchHistory();
        }
    }, [activeTab, open]);

    const fetchHistory = async () => {
        setIsLoadingHistory(true);
        try {
            const { data, error } = await supabase
                .from('proforma_invoices')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setHistory(data || []);
        } catch (error) {
            console.error('Error fetching PI history:', error);
            toast({
                title: 'Error',
                description: 'Failed to load invoice history',
                variant: 'destructive',
            });
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const handlePurchaserNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setPurchaserName(val);

        // Auto-fill if match found
        const match = recentPurchasers.find(p => p.name.toLowerCase() === val.toLowerCase());
        if (match) {
            setPurchaserAddress(match.address);
            setPurchaserGst(match.gst);
        }
    };

    // Calculations
    const subtotal = products.reduce((sum, p) => sum + (p.quantity * p.rate), 0);
    const taxableAmount = subtotal + shippingCharges;
    const gstAmount = taxableAmount * (gstRate / 100);
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

    const handleGenerate = async () => {
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

        if (!purchaserGst.trim()) {
            toast({
                title: 'Validation Error',
                description: 'Purchaser GST Number is required',
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
            // Save to recent purchasers (Local Storage)
            const newPurchaser = {
                name: purchaserName.trim(),
                address: purchaserAddress.trim(),
                gst: purchaserGst.trim()
            };

            const updatedRecent = [
                newPurchaser,
                ...recentPurchasers.filter(p => p.name.toLowerCase() !== newPurchaser.name.toLowerCase())
            ].slice(0, 50); // Keep last 50

            setRecentPurchasers(updatedRecent);
            localStorage.setItem('pi_recent_purchasers', JSON.stringify(updatedRecent));

            const piNumber = generatePINumber();
            const currentDate = format(new Date(), 'dd.MM.yyyy');
            const issuePerson = profile?.full_name || user?.email || 'Sales Team';

            // 1. Generate PDF
            generateProformaInvoice({
                piNumber,
                date: currentDate,
                issuePerson,
                purchaserName,
                purchaserAddress,
                purchaserGst: purchaserGst || undefined,
                products: validProducts,
                shippingCharges,
                gstRate: gstRate,
            });

            // 2. Save log to Supabase
            const { error: dbError } = await supabase.from('proforma_invoices').insert({
                pi_number: piNumber,
                created_by: user?.id,
                purchaser_details: {
                    name: purchaserName,
                    address: purchaserAddress,
                    gst: purchaserGst
                },
                items: validProducts,
                financials: {
                    shipping: shippingCharges,
                    gst_rate: gstRate,
                    total: totalAmount
                }
            });

            if (dbError) {
                console.error('Failed to log PI to database', dbError);
                toast({
                    title: 'Warning',
                    description: 'PDF generated but failed to save to history log',
                    variant: 'destructive',
                });
            } else {
                toast({
                    title: 'Success',
                    description: `Proforma Invoice ${piNumber} generated & saved`,
                    className: 'bg-green-500 text-white',
                });
            }

            // Reset form
            setPurchaserName('');
            setPurchaserAddress('');
            setPurchaserGst('');
            setProducts([{ description: '', quantity: 1, rate: 0 }]);
            setShippingCharges(0);
            setGstRate(0);

            if (activeTab === 'history') fetchHistory();

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

    const handleRedownload = (invoice: SavedInvoice) => {
        try {
            const currentDate = format(new Date(invoice.created_at), 'dd.MM.yyyy');
            const issuePerson = profile?.full_name || user?.email || 'Sales Team';

            generateProformaInvoice({
                piNumber: invoice.pi_number,
                date: currentDate,
                issuePerson,
                purchaserName: invoice.purchaser_details.name,
                purchaserAddress: invoice.purchaser_details.address,
                purchaserGst: invoice.purchaser_details.gst,
                products: invoice.items,
                shippingCharges: invoice.financials.shipping,
                gstRate: invoice.financials.gst_rate,
            });

            toast({
                title: 'Downloaded',
                description: `Re-downloaded PI ${invoice.pi_number}`,
            });
        } catch (e) {
            console.error('Redownload failed', e);
            toast({
                title: 'Error',
                description: 'Failed to regenerate PDF',
                variant: 'destructive'
            });
        }
    };

    const filteredHistory = history.filter(h =>
        h.pi_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.purchaser_details.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
                <DialogHeader className="p-6 pb-2 shrink-0">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <FileText className="w-5 h-5 text-indigo-500" />
                                <DialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">
                                    Proforma Invoice
                                </DialogTitle>
                            </div>
                            <DialogDescription className="text-slate-500 dark:text-slate-400">
                                Generate and manage proforma invoices
                            </DialogDescription>
                        </div>
                        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full sm:w-[300px]">
                            <TabsList className="grid w-full grid-cols-2 bg-slate-100 dark:bg-slate-900">
                                <TabsTrigger
                                    value="generate"
                                    className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 font-medium"
                                >
                                    Generate New
                                </TabsTrigger>
                                <TabsTrigger
                                    value="history"
                                    className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 font-medium"
                                >
                                    History & Logs
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-hidden relative min-h-0 bg-white dark:bg-slate-950">
                    {activeTab === 'generate' ? (
                        <div className="h-full flex flex-col">
                            <div className="flex-1 overflow-y-auto w-full min-h-0">
                                <div className="p-6 space-y-8 pb-6">
                                    {/* Purchaser Details Section */}
                                    <div className="space-y-4">
                                        <h3 className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            <span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>
                                            Client Details
                                        </h3>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="purchaser-gst" className="text-slate-600 dark:text-slate-300 font-medium">GST Number <span className="text-red-500">*</span></Label>
                                                    <Input
                                                        id="purchaser-gst"
                                                        value={purchaserGst}
                                                        onChange={(e) => setPurchaserGst(e.target.value)}
                                                        placeholder="e.g. 03AAMCB1040N1ZU"
                                                        className="h-11 border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500/20 rounded-xl bg-white dark:bg-slate-950 dark:text-slate-100 transition-all shadow-sm"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="purchaser-name" className="text-slate-600 dark:text-slate-300 font-medium">Client Name <span className="text-red-500">*</span></Label>
                                                    <Input
                                                        id="purchaser-name"
                                                        value={purchaserName}
                                                        onChange={handlePurchaserNameChange}
                                                        placeholder="Company or person name"
                                                        list="purchaser-suggestions"
                                                        autoComplete="off"
                                                        className="h-11 border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500/20 rounded-xl bg-white dark:bg-slate-950 dark:text-slate-100 transition-all shadow-sm"
                                                    />
                                                    <datalist id="purchaser-suggestions">
                                                        {recentPurchasers.map((p, i) => (
                                                            <option key={i} value={p.name} />
                                                        ))}
                                                    </datalist>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="purchaser-address" className="text-slate-600 dark:text-slate-300 font-medium">Billing Address <span className="text-red-500">*</span></Label>
                                                <Textarea
                                                    id="purchaser-address"
                                                    value={purchaserAddress}
                                                    onChange={(e) => setPurchaserAddress(e.target.value)}
                                                    placeholder="Enter complete billing address..."
                                                    className="min-h-[140px] border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500/20 rounded-xl bg-white dark:bg-slate-950 dark:text-slate-100 resize-none transition-all shadow-sm p-3"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Products Section */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h3 className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                <span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span>
                                                Product Items
                                            </h3>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={addProduct}
                                                className="h-9 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg text-slate-600 dark:text-slate-400 transition-all gap-1.5"
                                            >
                                                <Plus className="w-4 h-4" />
                                                Add Item
                                            </Button>
                                        </div>

                                        <div className="space-y-3">
                                            {products.map((product, index) => (
                                                <div key={index} className="group relative grid grid-cols-1 md:grid-cols-12 gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all duration-200">
                                                    <div className="md:col-span-5 space-y-1.5">
                                                        <Label className="text-xs text-slate-500 dark:text-slate-400 font-medium ml-1">Description</Label>
                                                        <Input
                                                            value={product.description}
                                                            onChange={(e) => updateProduct(index, 'description', e.target.value)}
                                                            placeholder="Item description"
                                                            className="h-10 border-slate-200 dark:border-slate-700 focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-emerald-500/20 rounded-lg bg-slate-50/50 dark:bg-slate-900/50 focus:bg-white dark:focus:bg-slate-950 dark:text-slate-100"
                                                        />
                                                    </div>

                                                    <div className="grid grid-cols-2 md:grid-cols-4 md:col-span-6 gap-4">
                                                        <div className="space-y-1.5">
                                                            <Label className="text-xs text-slate-500 dark:text-slate-400 font-medium ml-1">Qty</Label>
                                                            <Input
                                                                type="number"
                                                                min="1"
                                                                value={product.quantity}
                                                                onChange={(e) => updateProduct(index, 'quantity', parseInt(e.target.value) || 0)}
                                                                className="h-10 border-slate-200 dark:border-slate-700 focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-emerald-500/20 rounded-lg bg-slate-50/50 dark:bg-slate-900/50 focus:bg-white dark:focus:bg-slate-950 text-center dark:text-slate-100"
                                                            />
                                                        </div>

                                                        <div className="space-y-1.5">
                                                            <Label className="text-xs text-slate-500 dark:text-slate-400 font-medium ml-1">Rate (₹)</Label>
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                value={product.rate}
                                                                onChange={(e) => updateProduct(index, 'rate', parseFloat(e.target.value) || 0)}
                                                                className="h-10 border-slate-200 dark:border-slate-700 focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-emerald-500/20 rounded-lg bg-slate-50/50 dark:bg-slate-900/50 focus:bg-white dark:focus:bg-slate-950 text-right dark:text-slate-100"
                                                            />
                                                        </div>

                                                        <div className="col-span-2 md:col-span-2 space-y-1.5">
                                                            <Label className="text-xs text-slate-500 dark:text-slate-400 font-medium ml-1">Amount</Label>
                                                            <div className="h-10 px-3 flex items-center justify-end font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                                                                ₹ {(product.quantity * product.rate).toFixed(2)}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="absolute -top-2 -right-2 md:static md:col-span-1 flex items-end justify-center pb-1">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => removeProduct(index)}
                                                            disabled={products.length === 1}
                                                            className="h-8 w-8 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100 shadow-sm md:shadow-none bg-white dark:bg-slate-900 md:bg-transparent border md:border-none dark:border-slate-800"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Additional Charges Section */}
                                    <div className="space-y-4">
                                        <h3 className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            <span className="w-1.5 h-4 bg-amber-500 rounded-full"></span>
                                            Taxes & Charges
                                        </h3>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                                            <div className="space-y-2">
                                                <Label htmlFor="shipping" className="text-slate-600 dark:text-slate-300 font-medium">Shipping Charges</Label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₹</span>
                                                    <Input
                                                        id="shipping"
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={shippingCharges}
                                                        onChange={(e) => setShippingCharges(parseFloat(e.target.value) || 0)}
                                                        placeholder="0.00"
                                                        className="pl-8 h-11 border-slate-200 dark:border-slate-700 focus:border-amber-500 focus:ring-amber-500/20 rounded-xl bg-white dark:bg-slate-950 dark:text-slate-100"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <Label className="text-slate-600 dark:text-slate-300 font-medium">GST Configuration</Label>
                                                <div className="flex flex-wrap gap-3">
                                                    {[0, 5, 12, 18].map((rate) => (
                                                        <label
                                                            key={rate}
                                                            className={`
                                                            cursor-pointer flex items-center justify-center px-4 py-2.5 rounded-xl border transition-all duration-200 flex-1 min-w-[80px]
                                                            ${gstRate === rate
                                                                    ? 'bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100 text-white dark:text-slate-950 shadow-md shadow-slate-900/10'
                                                                    : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-900'
                                                                }
                                                        `}
                                                        >
                                                            <input
                                                                type="radio"
                                                                name="gst-rate"
                                                                value={rate}
                                                                checked={gstRate === rate}
                                                                onChange={() => setGstRate(rate)}
                                                                className="hidden"
                                                            />
                                                            <span className="font-medium text-sm">
                                                                {rate === 0 ? 'None' : `${rate}%`}
                                                            </span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Summary Section */}
                                    <div className="bg-slate-900 dark:bg-slate-950 text-white rounded-2xl p-6 shadow-xl shadow-slate-200/50 dark:shadow-slate-950/50 overflow-hidden relative">
                                        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl"></div>
                                        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl"></div>

                                        <div className="relative space-y-3">
                                            <div className="flex justify-between items-center text-slate-300 text-sm">
                                                <span>Subtotal</span>
                                                <span>₹ {subtotal.toFixed(2)}</span>
                                            </div>

                                            {shippingCharges > 0 && (
                                                <div className="flex justify-between items-center text-slate-300 text-sm">
                                                    <span>Shipping</span>
                                                    <span>+ ₹ {shippingCharges.toFixed(2)}</span>
                                                </div>
                                            )}

                                            {gstRate > 0 && (
                                                <div className="flex justify-between items-center text-slate-300 text-sm">
                                                    <span>GST ({gstRate}%)</span>
                                                    <span>+ ₹ {gstAmount.toFixed(2)}</span>
                                                </div>
                                            )}

                                            <div className="h-px bg-slate-700/50 my-4"></div>

                                            <div className="flex justify-between items-end">
                                                <span className="text-slate-300 font-medium mb-1">Total Amount</span>
                                                <span className="text-3xl font-bold tracking-tight">
                                                    ₹ {totalAmount.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 z-10">
                                <DialogFooter>
                                    <Button
                                        variant="outline"
                                        onClick={() => onOpenChange(false)}
                                        className="border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleGenerate}
                                        disabled={isGenerating}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-lg shadow-indigo-500/20"
                                    >
                                        {isGenerating ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Generating...
                                            </>
                                        ) : (
                                            <>
                                                <Download className="w-4 h-4" />
                                                Generate PDF
                                            </>
                                        )}
                                    </Button>
                                </DialogFooter>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col">
                            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        placeholder="Search by PI Number or Client Name..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9 h-10 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 dark:text-slate-100"
                                    />
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto w-full min-h-0">
                                <div className="p-6">
                                    {isLoadingHistory ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
                                            <Loader2 className="w-8 h-8 animate-spin mb-2" />
                                            <p>Loading history...</p>
                                        </div>
                                    ) : filteredHistory.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
                                            <History className="w-12 h-12 mb-3 opacity-20" />
                                            <p>No Invoice History Found</p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-4 pb-6">
                                            {filteredHistory.map((invoice) => (
                                                <div key={invoice.id} className="group flex items-center justify-between p-4 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800 hover:shadow-md transition-all">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{invoice.pi_number}</span>
                                                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                                                {format(new Date(invoice.created_at), 'dd MMM yyyy')}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{invoice.purchaser_details.name}</p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-500 truncate max-w-[300px]">{invoice.items.map(i => i.description).join(', ')}</p>
                                                    </div>

                                                    <div className="flex items-center gap-4">
                                                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">₹ {invoice.financials.total.toFixed(2)}</span>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => handleRedownload(invoice)}
                                                            className="h-9 w-9 p-0 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-950 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                                                        >
                                                            <Download className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

