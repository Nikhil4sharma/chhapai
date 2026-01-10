import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Package, Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WooCommerceOrderData } from './types';
import { WooCommercePreview } from './WooCommercePreview';

interface OrderInfoSectionProps {
    orderNumber: string;
    setOrderNumber: (val: string) => void;
    handleOrderNumberChange: (val: string) => void;
    orderNumberError: string | null;
    isWooCommerceOrder: boolean;
    isAdmin: boolean;
    role?: string;
    checkWooCommerceOrder: () => void;
    isFetchingWooCommerce: boolean;
    isCheckingDuplicate: boolean;
    wooCommerceCheckStatus: 'idle' | 'checking' | 'found' | 'not_found' | 'error';
    wooCommerceError: string | null;
    showPreviewCard: boolean;
    wooOrderData: WooCommerceOrderData | null;
    setShowPreviewCard: (show: boolean) => void;
    setWooOrderData: (data: WooCommerceOrderData | null) => void;
    setWooCommerceCheckStatus: (status: 'idle' | 'checking' | 'found' | 'not_found' | 'error') => void;
    handleConfirmImport: () => void;
    wooCommerceCached: boolean;
    wooCommerceImportedAt: string | null;
}

export function OrderInfoSection({
    orderNumber,
    handleOrderNumberChange,
    orderNumberError,
    isWooCommerceOrder,
    isAdmin,
    role,
    checkWooCommerceOrder,
    isFetchingWooCommerce,
    isCheckingDuplicate,
    wooCommerceCheckStatus,
    wooCommerceError,
    showPreviewCard,
    wooOrderData,
    setShowPreviewCard,
    setWooOrderData,
    setWooCommerceCheckStatus,
    handleConfirmImport,
    wooCommerceCached,
    wooCommerceImportedAt
}: OrderInfoSectionProps) {
    return (
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
            <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500 shadow-sm">
                        <Package className="h-4 w-4 text-white" />
                    </div>
                    Order Information
                </div>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="order_number" className="text-sm font-medium">Order Number *</Label>
                        <div className="space-y-2">
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Input
                                    id="order_number"
                                    name="order_number"
                                    placeholder="e.g., 53529"
                                    value={orderNumber}
                                    onChange={(e) => handleOrderNumberChange(e.target.value)}
                                    className={cn(
                                        "flex-1 h-11 text-base",
                                        orderNumberError && "border-destructive focus-visible:ring-destructive",
                                        isWooCommerceOrder && "bg-slate-50 dark:bg-slate-900/50"
                                    )}
                                    autoFocus
                                    readOnly={isWooCommerceOrder}
                                />
                                {(isAdmin || role === 'sales') && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="default"
                                        onClick={checkWooCommerceOrder}
                                        disabled={!orderNumber.trim() || isFetchingWooCommerce || isWooCommerceOrder}
                                        className="whitespace-nowrap h-11 px-4 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950 hover:text-blue-700 dark:hover:text-blue-300 hover:border-blue-300 dark:hover:border-blue-700 transition-all"
                                    >
                                        {isFetchingWooCommerce ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Checking...
                                            </>
                                        ) : (
                                            <>
                                                <Search className="h-4 w-4 mr-2" />
                                                Check WooCommerce
                                            </>
                                        )}
                                    </Button>
                                )}
                            </div>
                        </div>
                        {isCheckingDuplicate && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Checking availability...
                            </p>
                        )}
                        {wooCommerceCheckStatus === 'checking' && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Checking WooCommerce...
                            </p>
                        )}

                        {showPreviewCard && wooOrderData && (
                            <WooCommercePreview
                                wooOrderData={wooOrderData}
                                wooCommerceCached={wooCommerceCached}
                                wooCommerceImportedAt={wooCommerceImportedAt}
                                onCancel={() => {
                                    setShowPreviewCard(false);
                                    setWooOrderData(null);
                                    setWooCommerceCheckStatus('idle');
                                }}
                                onConfirm={handleConfirmImport}
                            />
                        )}

                        {wooCommerceCheckStatus === 'not_found' && (
                            <p className="text-xs text-muted-foreground">
                                No WooCommerce order found. You can create a manual order.
                            </p>
                        )}
                        {wooCommerceCheckStatus === 'error' && wooCommerceError && (
                            <p className="text-xs text-destructive">{wooCommerceError}</p>
                        )}
                        {isWooCommerceOrder && (
                            <p className="text-xs text-green-600 flex items-center gap-1">
                                ✓ Order imported from WooCommerce (fields are locked)
                            </p>
                        )}
                        {orderNumberError && (
                            <p className="text-xs text-destructive">{orderNumberError}</p>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
