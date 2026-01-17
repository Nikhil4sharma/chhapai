import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, Calendar, User, Phone, Mail, MapPin, Package } from 'lucide-react';
import { format } from 'date-fns';
import { WooCommerceOrderData } from './types';

interface WooCommercePreviewProps {
    wooOrderData: WooCommerceOrderData;
    wooCommerceCached: boolean;
    wooCommerceImportedAt: string | null;
    onCancel: () => void;
    onConfirm: () => void;
}

export function WooCommercePreview({
    wooOrderData,
    wooCommerceCached,
    wooCommerceImportedAt,
    onCancel,
    onConfirm
}: WooCommercePreviewProps) {
    return (
        <div className="mt-4 space-y-3">
            <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertTitle className="text-yellow-800 dark:text-yellow-200">Please verify this order carefully before importing</AlertTitle>
                <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                    Review all details below to ensure this is the correct order.
                </AlertDescription>
            </Alert>

            {wooCommerceCached && wooCommerceImportedAt && (
                <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950">
                    <AlertDescription className="text-blue-700 dark:text-blue-300">
                        Previously imported on {format(new Date(wooCommerceImportedAt), 'PPpp')}
                    </AlertDescription>
                </Alert>
            )}

            <Card className="border-2">
                <CardHeader className="pb-3 px-4 sm:px-6">
                    <CardTitle className="text-base sm:text-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                        <span>Order Preview</span>
                        <Badge variant="outline" className="text-green-600 border-green-600 text-xs sm:text-sm">
                            <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />
                            Verified
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4 px-4 sm:px-6 pb-4 sm:pb-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">Order Number</p>
                            <p className="font-semibold text-sm sm:text-base break-all">{wooOrderData.order_number}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">Order Date</p>
                            <p className="font-semibold text-sm sm:text-base flex items-center gap-1.5">
                                <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                                <span className="break-words">
                                    {wooOrderData.order_date ? format(new Date(wooOrderData.order_date), 'PP') : 'N/A'}
                                </span>
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-3 pt-3 border-t border-dashed">
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">Sales Agent</p>
                            <p className="font-semibold text-sm sm:text-base flex items-center gap-1.5 break-all">
                                <User className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                                <span>
                                    {(() => {
                                        const metaData = wooOrderData.meta_data || [];
                                        const agentMeta = metaData.find((m: any) => {
                                            const key = m.key?.toLowerCase() || '';
                                            if (!key) return false;
                                            if (key.includes('total_sales')) return false;
                                            if (key.includes('tax') || key.includes('date')) return false;

                                            return (
                                                ['sales_agent', 'agent', 'ordered_by', '_sales_agent', 'salesking_assigned_agent'].includes(key) ||
                                                key.includes('agent') ||
                                                key.includes('sales')
                                            );
                                        });

                                        if (!agentMeta) return 'Unassigned';

                                        // Friendly name mapping (no keys shown)
                                        const val = agentMeta.value?.toString().trim();
                                        if (val === '6125') return 'Nikhil Sharma';
                                        if (val === '1491' || val?.toLowerCase() === 'work') return 'Jaskaran';
                                        if (val === '3688') return 'Rohini';

                                        // If not mapped, show Unassigned
                                        return 'Unassigned';
                                    })()}
                                </span>
                            </p>
                        </div>
                    </div>

                    <Separator />
                    <div>
                        <p className="text-xs text-muted-foreground mb-2">Customer Details</p>
                        <div className="space-y-1.5 sm:space-y-2">
                            <p className="font-medium text-sm sm:text-base flex items-start sm:items-center gap-2 break-words">
                                <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 mt-0.5 sm:mt-0 flex-shrink-0" />
                                <span className="break-words">{wooOrderData.customer_name || 'N/A'}</span>
                            </p>
                            {wooOrderData.customer_phone && (
                                <p className="text-xs sm:text-sm flex items-center gap-2 text-muted-foreground break-all">
                                    <Phone className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                                    <a href={`tel:${wooOrderData.customer_phone}`} className="hover:underline break-all">
                                        {wooOrderData.customer_phone}
                                    </a>
                                </p>
                            )}
                            {wooOrderData.customer_email && (
                                <p className="text-xs sm:text-sm flex items-center gap-2 text-muted-foreground break-all">
                                    <Mail className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                                    <a href={`mailto:${wooOrderData.customer_email}`} className="hover:underline break-all">
                                        {wooOrderData.customer_email}
                                    </a>
                                </p>
                            )}
                            {wooOrderData.billing_address && (
                                <p className="text-xs sm:text-sm flex items-start gap-2 text-muted-foreground">
                                    <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 mt-0.5 flex-shrink-0" />
                                    <span className="line-clamp-3 sm:line-clamp-2 break-words">{wooOrderData.billing_address}</span>
                                </p>
                            )}
                        </div>
                    </div>
                    <Separator />
                    <div>
                        <p className="text-xs text-muted-foreground mb-2">Products</p>
                        <div className="space-y-2">
                            {wooOrderData.line_items && wooOrderData.line_items.length > 0 ? (
                                wooOrderData.line_items.map((item: any, idx: number) => (
                                    <div key={idx} className="flex items-start gap-2 p-2 sm:p-2.5 bg-muted rounded-md">
                                        <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4 mt-0.5 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs sm:text-sm font-medium line-clamp-2 break-words">{item.name || 'Unnamed Product'}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">Quantity: {item.quantity || 1}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-xs sm:text-sm text-muted-foreground">No products found</p>
                            )}
                        </div>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between pt-1">
                        <p className="text-xs sm:text-sm text-muted-foreground font-medium">Order Total</p>
                        <p className="font-semibold text-base sm:text-lg flex items-center gap-1">
                            <span className="text-lg sm:text-xl">₹</span>
                            <span>{wooOrderData.order_total?.toFixed(2) || '0.00'}</span>
                        </p>
                    </div>
                </CardContent>
            </Card>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 pt-2">
                <Button type="button" variant="outline" onClick={onCancel} className="flex-1 w-full sm:w-auto">
                    Cancel
                </Button>
                <Button type="button" variant="default" onClick={onConfirm} className="flex-1 w-full sm:w-auto">
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Confirm & Import</span>
                    <span className="sm:hidden">Import</span>
                </Button>
            </div>
        </div>
    );
}
