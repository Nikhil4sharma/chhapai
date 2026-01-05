
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Loader2, UserPlus, MapPin, Mail, Phone, CheckCircle2 } from 'lucide-react';
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
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [importingId, setImportingId] = useState<number | null>(null);
    const { toast } = useToast();

    // Debounce Logic
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(query);
        }, 500); // 500ms delay

        return () => clearTimeout(timer);
    }, [query]);

    // Real-time Search Effect
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
                // Silent error or small toast
            } finally {
                setSearching(false);
            }
        };

        searchCustomers();
    }, [debouncedQuery]);

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
            <DialogContent className="sm:max-w-[600px] p-0 gap-0 overflow-hidden bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-xl border-slate-200 dark:border-slate-800 shadow-2xl">
                <DialogHeader className="p-6 pb-2 border-b border-slate-100 dark:border-slate-900 bg-white/50 dark:bg-slate-900/50">
                    <DialogTitle className="text-xl font-semibold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                        <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-full">
                            <UserPlus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        Import Customer
                    </DialogTitle>
                    <DialogDescription className="text-slate-500">
                        Search by name, email, or phone. We'll fetch results in real-time.
                    </DialogDescription>

                    <div className="relative mt-4">
                        <Search className={`absolute left-3.5 top-3.5 h-4 w-4 transition-colors ${searching ? 'text-blue-500 animate-pulse' : 'text-slate-400'}`} />
                        <Input
                            placeholder="Type to search (e.g. 'John', 'user@email.com')..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="pl-10 h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500/20 focus-visible:border-blue-500 shadow-sm text-base transition-all"
                            autoFocus
                        />
                        {searching && (
                            <div className="absolute right-3.5 top-3.5">
                                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                            </div>
                        )}
                    </div>
                </DialogHeader>

                <ScrollArea className="h-[420px] bg-slate-50/50 dark:bg-slate-900/50 px-2">
                    <div className="p-4 space-y-3">
                        {results.length === 0 && !searching && query.length > 2 && (
                            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                                <Search className="h-12 w-12 opacity-10 mb-2" />
                                <p>No customers found matching "{query}"</p>
                            </div>
                        )}

                        {results.length === 0 && !searching && query.length <= 2 && (
                            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                                <div className="h-16 w-16 bg-blue-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
                                    <Search className="h-6 w-6 text-blue-300 dark:text-blue-700 opacity-50" />
                                </div>
                                <p className="font-medium text-slate-600 dark:text-slate-300">Start typing to search</p>
                                <p className="text-xs text-slate-400 mt-1">Results will appear automatically</p>
                            </div>
                        )}

                        {results.map((customer) => (
                            <div
                                key={customer.id}
                                className="group bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800 transition-all duration-200 flex items-center justify-between"
                            >
                                <div className="flex items-center gap-4 overflow-hidden">
                                    <Avatar className="h-12 w-12 border-2 border-slate-50 dark:border-slate-800 shadow-sm group-hover:scale-105 transition-transform">
                                        <AvatarImage src={customer.avatar_url} />
                                        <AvatarFallback className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900 dark:to-indigo-900 text-blue-600 dark:text-blue-100 font-bold">
                                            {customer.name?.substring(0, 1).toUpperCase() || '?'}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                        <h4 className="font-semibold text-slate-900 dark:text-slate-100 truncate">{customer.name}</h4>
                                        <div className="flex flex-col gap-1 mt-0.5">
                                            {customer.email && (
                                                <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-200 truncate">
                                                    <Mail className="h-3 w-3 shrink-0 opacity-70" /> {customer.email}
                                                </div>
                                            )}
                                            {customer.location && (
                                                <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-200 truncate">
                                                    <MapPin className="h-3 w-3 shrink-0 opacity-70" /> {customer.location}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    onClick={() => handleImport(customer)}
                                    disabled={importingId === customer.id}
                                    className={`ml-3 shrink-0 transition-all ${importingId === customer.id
                                        ? "bg-blue-50 text-blue-700"
                                        : "bg-white border-2 border-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white dark:bg-slate-900 dark:border-blue-900 dark:text-blue-400 dark:hover:bg-blue-600 dark:hover:text-white"
                                        }`}
                                >
                                    {importingId === customer.id ? (
                                        <>
                                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                                            Importing
                                        </>
                                    ) : (
                                        <>
                                            Import <CheckCircle2 className="h-3.5 w-3.5 ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity -mr-1" />
                                        </>
                                    )}
                                </Button>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
