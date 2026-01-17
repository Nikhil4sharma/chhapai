import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, Loader2, FileSpreadsheet, CheckCircle2, UserPlus, Search, Mail, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/features/auth/context/AuthContext';
import Papa from 'papaparse';

interface SearchResult {
    id: number;
    name: string;
    email: string;
    avatar_url: string;
    phone: string;
    total_spent: string;
    orders_count: number;
    location: string;
}

interface CustomerImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImportSuccess: () => void;
}

export function CustomerImportDialog({ open, onOpenChange, onImportSuccess }: CustomerImportDialogProps) {
    const { toast } = useToast();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState("search");

    // --- Search Logic State ---
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [importingId, setImportingId] = useState<number | null>(null);

    // --- CSV Logic State ---
    const [isImportingCSV, setIsImportingCSV] = useState(false);
    const [progress, setProgress] = useState(0);
    const [summary, setSummary] = useState<{ total: number; success: number; failed: number } | null>(null);
    const [manualForm, setManualForm] = useState({
        email: '',
        first_name: '',
        last_name: '',
        phone: ''
    });
    const [isSavingManual, setIsSavingManual] = useState(false);

    // --- Search Effects ---
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(query);
        }, 500);
        return () => clearTimeout(timer);
    }, [query]);

    useEffect(() => {
        const searchCustomers = async () => {
            if (!debouncedQuery || debouncedQuery.length < 3) {
                setResults([]);
                return;
            }

            setSearching(true);
            try {
                const { data, error } = await supabase.functions.invoke('woocommerce', {
                    body: { action: 'search_customers', query: debouncedQuery }
                });

                if (error) throw error;
                setResults(data.customers || []);
            } catch (err) {
                console.error(err);
            } finally {
                setSearching(false);
            }
        };

        searchCustomers();
    }, [debouncedQuery]);

    const handleSingleImport = async (customer: SearchResult) => {
        setImportingId(customer.id);
        try {
            const { error } = await supabase.functions.invoke('woocommerce', {
                body: { action: 'import_customer', wc_id: customer.id }
            });

            if (error) throw error;

            toast({
                title: "Customer Imported",
                description: `${customer.name} has been imported successfully.`,
            });
            onImportSuccess();
        } catch (err) {
            console.error(err);
            toast({
                title: "Import failed",
                description: "Could not import customer.",
                variant: "destructive"
            });
        } finally {
            setImportingId(null);
        }
    };

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualForm.email || !manualForm.first_name) {
            toast({
                title: "Validation Error",
                description: "Email and First Name are required.",
                variant: "destructive"
            });
            return;
        }

        setIsSavingManual(true);
        try {
            // Check if email already exists
            const { data: existing } = await supabase
                .from('wc_customers')
                .select('id')
                .eq('email', manualForm.email)
                .maybeSingle();

            if (existing) {
                toast({
                    title: "Customer Exists",
                    description: "A customer with this email already exists.",
                    variant: "destructive"
                });
                return;
            }

            // Generate a fake WC ID (negative) for manual entries
            const tempWcId = -1 * (Math.floor(Math.random() * 900000) + 100000);

            const { error } = await supabase
                .from('wc_customers')
                .insert({
                    wc_id: tempWcId,
                    email: manualForm.email,
                    first_name: manualForm.first_name,
                    last_name: manualForm.last_name,
                    phone: manualForm.phone,
                    assigned_to: user?.id,
                    source: 'manual_entry',
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;

            toast({
                title: "Customer Created",
                description: `${manualForm.first_name} has been added and assigned to you.`,
            });

            setManualForm({ email: '', first_name: '', last_name: '', phone: '' });
            onImportSuccess();
            onOpenChange(false);
        } catch (err: any) {
            console.error(err);
            toast({
                title: "Error",
                description: err.message || "Failed to create customer.",
                variant: "destructive"
            });
        } finally {
            setIsSavingManual(false);
        }
    };

    // --- CSV Logic ---
    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsImportingCSV(true);
        setSummary(null);
        setProgress(0);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                try {
                    await processCSVImport(results.data);
                } catch (error) {
                    console.error('Import error:', error);
                    toast({
                        title: "Import Failed",
                        description: "An unexpected error occurred during import.",
                        variant: "destructive"
                    });
                    setIsImportingCSV(false);
                }
            },
            error: (error) => {
                console.error('CSV Error:', error);
                toast({
                    title: "CSV Parse Error",
                    description: error.message,
                    variant: "destructive"
                });
                setIsImportingCSV(false);
            }
        });
    };

    const processCSVImport = async (rows: any[]) => {
        let successCount = 0;
        let failCount = 0;
        const total = rows.length;
        const CHUNK_SIZE = 50;
        const timestamp = Date.now();

        for (let i = 0; i < total; i += CHUNK_SIZE) {
            const chunk = rows.slice(i, i + CHUNK_SIZE);
            const upsertData: any[] = [];

            chunk.forEach((row, index) => {
                const email = row['Email']?.trim();
                const name = row['Name']?.trim();

                if (!email || !name) {
                    failCount++;
                    return;
                }

                const nameParts = name.split(' ');
                const firstName = nameParts[0];
                const lastName = nameParts.slice(1).join(' ') || '';
                const tempId = -1 * (timestamp + i + index);

                upsertData.push({
                    wc_id: tempId,
                    email: email,
                    first_name: firstName,
                    last_name: lastName,
                    billing: {
                        first_name: firstName,
                        last_name: lastName,
                        email: email,
                        city: row['City'],
                        state: row['Region'],
                        postcode: row['Postal Code'],
                        country: row['Country / Region']
                    },
                    shipping: {},
                    orders_count: parseInt(row['Orders'] || '0'),
                    total_spent: parseFloat(row['Total Spend'] || '0'),
                    last_order_date: row['Last Active'] ? new Date(row['Last Active']).toISOString() : null,
                    assigned_to: user?.id,
                    source: 'csv_import',
                    updated_at: new Date().toISOString()
                });
            });

            if (upsertData.length > 0) {
                // Check for existing customers by email
                const emails = upsertData.map(c => c.email);
                const { data: existing } = await supabase
                    .from('wc_customers')
                    .select('email, wc_id, assigned_to')
                    .in('email', emails);

                const existingMap = new Map(existing?.map(e => [e.email, e]));

                // Separate into updates and inserts
                const toUpdate: any[] = [];
                const toInsert: any[] = [];

                upsertData.forEach(c => {
                    const match = existingMap.get(c.email) as { wc_id: number; assigned_to?: string } | undefined;
                    if (match) {
                        // Update existing customer - use their wc_id
                        // Only "claim" if it's currently unassigned
                        toUpdate.push({
                            ...c,
                            wc_id: match.wc_id,
                            assigned_to: match.assigned_to || user?.id
                        });
                    } else {
                        // New customer - use temp wc_id
                        toInsert.push(c);
                    }
                });

                // Insert new customers (one by one to handle duplicates)
                if (toInsert.length > 0) {
                    for (const customer of toInsert) {
                        const { error: insertError } = await supabase
                            .from('wc_customers')
                            .insert(customer);

                        if (insertError) {
                            // Check if it's a duplicate constraint error
                            if (insertError.code === '23505') {
                                // Could be duplicate email OR duplicate wc_id
                                // Try to update by email instead
                                const { error: updateError } = await supabase
                                    .from('wc_customers')
                                    .update({
                                        first_name: customer.first_name,
                                        last_name: customer.last_name,
                                        billing: customer.billing,
                                        orders_count: customer.orders_count,
                                        total_spent: customer.total_spent,
                                        last_order_date: customer.last_order_date,
                                        assigned_to: customer.assigned_to, // Will contain current user since it's a new insert attempt
                                        updated_at: customer.updated_at
                                    })
                                    .eq('email', customer.email);

                                if (updateError) {
                                    console.error('Update after duplicate error:', updateError);
                                    failCount++;
                                } else {
                                    successCount++;
                                }
                            } else {
                                console.error('Insert Error:', insertError);
                                failCount++;
                            }
                        } else {
                            successCount++;
                        }
                    }
                }

                // Update existing customers
                if (toUpdate.length > 0) {
                    for (const customer of toUpdate) {
                        const { error: updateError } = await supabase
                            .from('wc_customers')
                            .update({
                                first_name: customer.first_name,
                                last_name: customer.last_name,
                                billing: customer.billing,
                                orders_count: customer.orders_count,
                                total_spent: customer.total_spent,
                                last_order_date: customer.last_order_date,
                                assigned_to: customer.assigned_to,
                                updated_at: customer.updated_at
                            })
                            .eq('wc_id', customer.wc_id);

                        if (updateError) {
                            console.error('Update Error:', updateError);
                            failCount++;
                        } else {
                            successCount++;
                        }
                    }
                }
            }
            setProgress(Math.round(((i + chunk.length) / total) * 100));
        }

        setSummary({ total, success: successCount, failed: failCount });
        setIsImportingCSV(false);
        onImportSuccess();
        toast({
            title: "Import Complete",
            description: `Imported ${successCount} customers. ${failCount} failed/skipped.`,
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] p-0 gap-0 overflow-hidden bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-xl border-slate-200 dark:border-slate-800 shadow-2xl">
                <DialogHeader className="p-6 pb-2 border-b border-slate-100 dark:border-slate-900 bg-white/50 dark:bg-slate-900/50">
                    <DialogTitle className="text-xl font-semibold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                        <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-full">
                            <UserPlus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        Import Customer
                    </DialogTitle>
                    <DialogDescription className="text-slate-500">
                        Search via API or upload a CSV export.
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <div className="px-6 pt-2">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="search">Search API</TabsTrigger>
                            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
                            <TabsTrigger value="csv">Upload CSV</TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="p-6">
                        <TabsContent value="search" className="mt-0 space-y-4">
                            <div className="relative">
                                <Search className={`absolute left-3.5 top-3.5 h-4 w-4 transition-colors ${searching ? 'text-blue-500 animate-pulse' : 'text-slate-400'}`} />
                                <Input
                                    placeholder="Type to search (e.g. 'John', 'user@email.com')..."
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    className="pl-10 h-11 bg-white dark:bg-slate-900"
                                    autoFocus
                                />
                                {searching && (
                                    <div className="absolute right-3.5 top-3.5">
                                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                                    </div>
                                )}
                            </div>

                            <ScrollArea className="h-[300px] border rounded-md bg-slate-50/50 dark:bg-slate-900/50">
                                <div className="p-4 space-y-3">
                                    {results.length === 0 && !searching && query.length > 2 && (
                                        <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
                                            <p>No customers found.</p>
                                        </div>
                                    )}
                                    {results.map((customer) => (
                                        <div key={customer.id} className="group bg-white dark:bg-slate-900 rounded-xl p-3 border shadow-sm flex items-center justify-between">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <Avatar className="h-10 w-10 border shadow-sm">
                                                    <AvatarImage src={customer.avatar_url} />
                                                    <AvatarFallback>{customer.name?.substring(0, 1).toUpperCase() || '?'}</AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0">
                                                    <h4 className="font-semibold text-sm truncate">{customer.name}</h4>
                                                    <div className="text-xs text-slate-500 truncate">{customer.email}</div>
                                                </div>
                                            </div>
                                            <Button
                                                size="sm"
                                                onClick={() => handleSingleImport(customer)}
                                                disabled={importingId === customer.id}
                                                variant={importingId === customer.id ? "secondary" : "outline"}
                                            >
                                                {importingId === customer.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Import"}
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        <TabsContent value="manual" className="mt-0 space-y-4">
                            <form onSubmit={handleManualSubmit} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">First Name</label>
                                        <Input
                                            placeholder="First Name"
                                            value={manualForm.first_name}
                                            onChange={(e) => setManualForm({ ...manualForm, first_name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Last Name</label>
                                        <Input
                                            placeholder="Last Name"
                                            value={manualForm.last_name}
                                            onChange={(e) => setManualForm({ ...manualForm, last_name: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Email Address</label>
                                    <Input
                                        type="email"
                                        placeholder="customer@example.com"
                                        value={manualForm.email}
                                        onChange={(e) => setManualForm({ ...manualForm, email: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Phone Number</label>
                                    <Input
                                        placeholder="+91 9876543210"
                                        value={manualForm.phone}
                                        onChange={(e) => setManualForm({ ...manualForm, phone: e.target.value })}
                                    />
                                </div>
                                <Button type="submit" className="w-full" disabled={isSavingManual}>
                                    {isSavingManual ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                                    Create Customer
                                </Button>
                            </form>
                        </TabsContent>

                        <TabsContent value="csv" className="mt-0">
                            {!isImportingCSV && !summary && (
                                <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer group relative">
                                    <input
                                        type="file"
                                        accept=".csv"
                                        onChange={handleFileUpload}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    <div className="h-12 w-12 bg-white dark:bg-slate-800 rounded-full shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <Upload className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <p className="font-medium text-slate-700 dark:text-slate-200">Click to upload CSV</p>
                                    <p className="text-xs text-slate-500 mt-1">Supports standard WooCommerce Export format</p>
                                </div>
                            )}

                            {isImportingCSV && (
                                <div className="space-y-4 py-8">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-500">Processing...</span>
                                        <span className="font-medium">{progress}%</span>
                                    </div>
                                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${progress}%` }} />
                                    </div>
                                </div>
                            )}

                            {summary && (
                                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                                    <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-xl border border-green-100 dark:border-green-900/50 flex items-start gap-3">
                                        <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                                        <div>
                                            <h4 className="font-semibold text-green-900 dark:text-green-100">Import Successful</h4>
                                            <p className="text-green-700 dark:text-green-300 text-sm mt-1">
                                                Processed {summary.total} rows.<br />
                                                <span className="font-bold">{summary.success}</span> added/updated. <span className="opacity-75">{summary.failed} skipped.</span>
                                            </p>
                                        </div>
                                    </div>
                                    <Button className="w-full" onClick={() => onOpenChange(false)}>Done</Button>
                                </div>
                            )}
                        </TabsContent>
                    </div>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
