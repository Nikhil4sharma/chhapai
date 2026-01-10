import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { User, Search, Loader2, Lock, Mail, Phone, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CustomerData } from './types';

interface CustomerSectionProps {
    customerData: CustomerData;
    setCustomerData: (val: any) => void;
    isWooCommerceOrder: boolean;
    customerSearchOpen: boolean;
    setCustomerSearchOpen: (val: boolean) => void;
    customerSearchQuery: string;
    setCustomerSearchQuery: (val: string) => void;
    customerSearchResults: any[];
    isSearchingCustomers: boolean;
    handleCustomerSearch: () => void;
    selectCustomer: (c: any) => void;
}

export function CustomerSection({
    customerData,
    setCustomerData,
    isWooCommerceOrder,
    customerSearchOpen,
    setCustomerSearchOpen,
    customerSearchQuery,
    setCustomerSearchQuery,
    customerSearchResults,
    isSearchingCustomers,
    handleCustomerSearch,
    selectCustomer
}: CustomerSectionProps) {

    const updateField = (field: keyof CustomerData, value: string) => {
        setCustomerData((prev: CustomerData) => ({ ...prev, [field]: value }));
    };

    return (
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="bg-emerald-50/50 dark:bg-emerald-950/20 px-4 sm:px-6 py-3 border-b border-emerald-100 dark:border-emerald-900/50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 shadow-sm">
                        <User className="h-4 w-4 text-white" />
                    </div>
                    Customer Details
                </div>
                {isWooCommerceOrder && (
                    <Badge variant="secondary" className="bg-emerald-100/50 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 border-none">
                        <Lock className="h-3 w-3 mr-1" />
                        Locked
                    </Badge>
                )}
            </div>
            <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                    {/* Name & Search */}
                    <div className="grid gap-2">
                        <Label htmlFor="customer_name" className="after:content-['*'] after:ml-0.5 after:text-red-500">
                            Customer Name
                        </Label>
                        <div className="flex gap-2">
                            <div className="relative flex-1 group">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                                <Input
                                    id="customer_name"
                                    placeholder="Enter customer name"
                                    value={customerData.name}
                                    onChange={(e) => updateField('name', e.target.value)}
                                    disabled={isWooCommerceOrder}
                                    className={cn(
                                        "pl-10 h-11 border-slate-200 dark:border-slate-800 focus:ring-emerald-500 focus:border-emerald-500 transition-all",
                                        !customerData.name && "text-muted-foreground"
                                    )}
                                />
                            </div>
                            <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        disabled={isWooCommerceOrder}
                                        title="Search WooCommerce Customer"
                                        className="h-11 w-11 shrink-0 border-slate-200 dark:border-slate-800 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-all shadow-sm"
                                    >
                                        <Search className="h-4 w-4" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[380px] p-0 overflow-hidden shadow-xl border-slate-200 dark:border-slate-800" align="end">
                                    <div className="p-3 border-b bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
                                        <div className="flex items-center gap-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-3 h-10 shadow-sm focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
                                            <Search className="h-4 w-4 text-slate-400" />
                                            <Input
                                                placeholder="Search by name, email, or phone..."
                                                className="h-full border-none focus-visible:ring-0 px-0 shadow-none bg-transparent text-sm placeholder:text-slate-400"
                                                value={customerSearchQuery}
                                                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleCustomerSearch()}
                                                autoFocus
                                            />
                                            {isSearchingCustomers && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />}
                                        </div>
                                    </div>
                                    <ScrollArea className="h-[280px] bg-slate-50/30 dark:bg-slate-950/30">
                                        {customerSearchResults.length > 0 ? (
                                            <div className="p-1.5 space-y-1">
                                                {customerSearchResults.map(c => (
                                                    <div
                                                        key={c.id}
                                                        className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-colors group border border-transparent hover:border-blue-100 dark:hover:border-blue-800/50"
                                                        onClick={() => selectCustomer(c)}
                                                    >
                                                        <Avatar className="h-9 w-9 border border-slate-200 dark:border-slate-700 bg-white">
                                                            <AvatarImage src={c.avatar_url} />
                                                            <AvatarFallback className="bg-blue-50 text-blue-600 text-xs font-bold dark:bg-blue-900/50 dark:text-blue-300">
                                                                {(c.name?.[0] || '?').toUpperCase()}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between">
                                                                <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                                                                    {c.name}
                                                                </span>
                                                                <Badge variant="outline" className="text-[10px] h-4 bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 ml-2 shrink-0">
                                                                    #{c.id}
                                                                </Badge>
                                                            </div>
                                                            <div className="flex flex-col gap-0.5 mt-0.5">
                                                                {c.email && (
                                                                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                                                                        <Mail className="h-3 w-3 opacity-70" /> {c.email}
                                                                    </div>
                                                                )}
                                                                {c.location && (
                                                                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                                                                        <MapPin className="h-3 w-3 opacity-70" /> {c.location}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-[200px] text-center px-6">
                                                {isSearchingCustomers ? (
                                                    <div className="flex flex-col items-center gap-2">
                                                        <Loader2 className="h-8 w-8 animate-spin text-blue-500 opacity-50" />
                                                        <p className="text-xs text-slate-500 font-medium">Searching...</p>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="h-12 w-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
                                                            <Search className="h-5 w-5 text-slate-400" />
                                                        </div>
                                                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                                            {customerSearchQuery.length < 3 ? "Start typing to search" : "No customers found"}
                                                        </p>
                                                        <p className="text-xs text-slate-500 mt-1 max-w-[180px]">
                                                            {customerSearchQuery.length < 3
                                                                ? "Enter at least 3 characters to search by name or email."
                                                                : `We couldn't find any customers matching "${customerSearchQuery}".`}
                                                        </p>
                                                        {customerSearchQuery.length >= 3 && (
                                                            <Button variant="link" size="sm" onClick={handleCustomerSearch} className="mt-2 text-blue-600 h-auto p-0">
                                                                Try searching again
                                                            </Button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </ScrollArea>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="customer_phone" className="text-sm font-medium">Phone Number</Label>
                        <div className="relative group">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                            <Input
                                id="customer_phone"
                                placeholder="+91 00000 00000"
                                value={customerData.phone}
                                onChange={(e) => updateField('phone', e.target.value)}
                                disabled={isWooCommerceOrder}
                                className="pl-10 h-11 border-slate-200 dark:border-slate-800 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono"
                            />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="customer_email" className="text-sm font-medium">Email Address</Label>
                        <div className="relative group">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                            <Input
                                id="customer_email"
                                type="email"
                                placeholder="customer@example.com"
                                value={customerData.email}
                                onChange={(e) => updateField('email', e.target.value)}
                                disabled={isWooCommerceOrder}
                                className="pl-10 h-11 border-slate-200 dark:border-slate-800 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                            />
                        </div>
                    </div>

                    <div className="grid gap-2 sm:col-span-2">
                        <Label htmlFor="customer_address" className="text-sm font-medium">Address</Label>
                        <div className="relative group">
                            <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                            <Textarea
                                id="customer_address"
                                placeholder="Street, Locality..."
                                value={customerData.address}
                                onChange={(e) => updateField('address', e.target.value)}
                                disabled={isWooCommerceOrder}
                                className="pl-10 min-h-[44px] h-11 max-h-32 py-2.5 border-slate-200 dark:border-slate-800 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                                rows={1}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:col-span-2">
                        <div className="grid gap-2">
                            <Label htmlFor="city" className="text-xs font-medium text-slate-500">City</Label>
                            <Input
                                id="city"
                                placeholder="City"
                                value={customerData.city}
                                onChange={(e) => updateField('city', e.target.value)}
                                disabled={isWooCommerceOrder}
                                className="h-10 border-slate-200 dark:border-slate-800 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="state" className="text-xs font-medium text-slate-500">State</Label>
                            <Input
                                id="state"
                                placeholder="State"
                                value={customerData.state}
                                onChange={(e) => updateField('state', e.target.value)}
                                disabled={isWooCommerceOrder}
                                className="h-10 border-slate-200 dark:border-slate-800 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="pincode" className="text-xs font-medium text-slate-500">Pincode</Label>
                            <Input
                                id="pincode"
                                placeholder="Pincode"
                                value={customerData.pincode}
                                onChange={(e) => updateField('pincode', e.target.value)}
                                disabled={isWooCommerceOrder}
                                className="h-10 border-slate-200 dark:border-slate-800 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono"
                            />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
