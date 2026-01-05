
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Loader2, UserPlus, Check, MapPin, Mail, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

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
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [importingId, setImportingId] = useState<number | null>(null);
    const { toast } = useToast();

    const handleSearch = async () => {
        if (!query || query.length < 3) return;
        setSearching(true);
        setResults([]);

        try {
            const { data, error } = await supabase.functions.invoke('woocommerce', {
                body: { action: 'search_customers', query }
            });

            if (error) throw error;
            setResults(data.customers || []);
        } catch (err) {
            console.error(err);
            toast({
                title: "Search failed",
                description: "Could not fetch customers from WooCommerce.",
                variant: "destructive"
            });
        } finally {
            setSearching(false);
        }
    };

    const handleImport = async (customer: SearchResult) => {
        setImportingId(customer.id);

        try {
            const { error } = await supabase.functions.invoke('woocommerce', {
                body: { action: 'import_customer', wc_id: customer.id }
            });

            if (error) throw error;

            toast({
                title: "Customer Imported",
                description: `${customer.name} has been assigned to you.`,
            });
            onImportSuccess();
            // Optional: Close dialog or let user import more?
            // Let's keep open for batch import feel, but user can close.
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] p-0 gap-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                <DialogHeader className="p-6 pb-4 border-b border-slate-100 dark:border-slate-900">
                    <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                        <UserPlus className="h-5 w-5 text-indigo-600" />
                        Import Customer
                    </DialogTitle>
                    <DialogDescription>
                        Search for a customer by name, email, or phone to assign them to your dashboard.
                    </DialogDescription>

                    <div className="flex gap-2 mt-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name, email, phone..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                className="pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                            />
                        </div>
                        <Button
                            onClick={handleSearch}
                            disabled={searching || query.length < 2}
                            className="bg-indigo-600 hover:bg-indigo-700"
                        >
                            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
                        </Button>
                    </div>
                </DialogHeader>

                <ScrollArea className="h-[400px] bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="p-4 space-y-3">
                        {results.length === 0 && !searching && query.length > 2 && (
                            <div className="text-center py-10 text-muted-foreground">
                                <p>No customers found matching "{query}"</p>
                            </div>
                        )}

                        {results.length === 0 && !searching && query.length <= 2 && (
                            <div className="text-center py-10 text-muted-foreground">
                                <Search className="h-10 w-10 mx-auto mb-2 opacity-20" />
                                <p>Enter a search term to find customers</p>
                            </div>
                        )}

                        {results.map((customer) => (
                            <div
                                key={customer.id}
                                className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between group hover:border-indigo-200 dark:hover:border-indigo-900 transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <Avatar className="h-12 w-12 border-2 border-slate-100 dark:border-slate-800">
                                        <AvatarImage src={customer.avatar_url} />
                                        <AvatarFallback className="bg-slate-100 text-slate-500 font-medium">
                                            {customer.name?.substring(0, 2).toUpperCase() || '??'}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h4 className="font-semibold text-slate-900 dark:text-slate-100">{customer.name}</h4>
                                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                            {customer.email && (
                                                <span className="flex items-center gap-1">
                                                    <Mail className="h-3 w-3" /> {customer.email}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                            {customer.location && (
                                                <span className="flex items-center gap-1">
                                                    <MapPin className="h-3 w-3" /> {customer.location}
                                                </span>
                                            )}
                                            {customer.total_spent && (
                                                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                                                    Spent: ₹{customer.total_spent}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    onClick={() => handleImport(customer)}
                                    disabled={importingId === customer.id}
                                    variant={importingId === customer.id ? "ghost" : "outline"}
                                    className="ml-4 shrink-0 border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 dark:border-indigo-900 dark:text-indigo-400 dark:hover:bg-indigo-950/50"
                                >
                                    {importingId === customer.id ? (
                                        <>
                                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                                            Importing...
                                        </>
                                    ) : (
                                        <>
                                            <UserPlus className="h-3.5 w-3.5 mr-2" />
                                            Import
                                        </>
                                    )}
                                </Button>
                            </div>
                        ))}
                    </div>
                </ScrollArea>

                <DialogFooter className="p-4 border-t border-slate-100 dark:border-slate-900 flex justify-between items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                        Importing uses your WooCommerce permissions.
                    </p>
                    <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
