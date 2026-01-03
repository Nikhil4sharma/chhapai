import { useState, useMemo } from 'react';
import { Order } from '@/types/order';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { IndianRupee, CreditCard, ChevronDown, ChevronUp } from 'lucide-react';
import { useFinancialAccess } from '@/hooks/useFinancialAccess';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface OrderFinancialsProps {
  order: Order;
}

export function OrderFinancials({ order }: OrderFinancialsProps) {
  const { canViewFinancials, isAdmin, role } = useFinancialAccess();
  const [open, setOpen] = useState(true);
  
  const financials = order.financials;
  
  // If no financial data, don't render
  if (!financials) {
    return null;
  }

  // For non-finance roles (design / prepress / production / outsource):
  // only show high-level payment status, no amounts.
  if (!canViewFinancials) {
    const rawStatus = (financials.payment_status || '').toLowerCase();

    let label = 'Payment Pending';
    if (rawStatus.includes('complete') || rawStatus === 'paid') {
      label = 'Full Amount Paid';
    } else if (rawStatus.includes('partial') || rawStatus.includes('partially')) {
      label = 'Partially Paid';
    } else if (rawStatus.includes('processing') || rawStatus.includes('on-hold')) {
      label = 'Payment In Progress';
    }

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-display flex items-center gap-2">
            <IndianRupee className="h-5 w-5" />
            Payment Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Badge variant="outline" className="text-xs px-3 py-1">
            {label}
          </Badge>
        </CardContent>
      </Card>
    );
  }

  const [receivedInput, setReceivedInput] = useState<string>(
    financials.amount_received?.toString() || ''
  );
  const [isSaving, setIsSaving] = useState(false);

  const total = financials.total || 0;
  const received = useMemo(() => {
    const parsed = parseFloat(receivedInput || '0');
    if (Number.isNaN(parsed) || parsed < 0) return 0;
    return Math.min(parsed, total);
  }, [receivedInput, total]);

  const pending = Math.max(total - received, 0);
  const paidPercent = total > 0 ? Math.round((received / total) * 100) : 0;

  const canEdit = isAdmin || role === 'sales';

  const formatCurrency = (amount: number | undefined) => {
    if (!amount) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const handleSave = async () => {
    if (!canEdit) return;
    setIsSaving(true);
    try {
      const parsed = parseFloat(receivedInput || '0');
      const safeAmount = Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;

      const { error } = await supabase
        .from('orders')
        .update({
          amount_received: safeAmount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (error) {
        console.error('Error updating payment:', error);
        toast({
          title: 'Payment update failed',
          description: 'Unable to save payment received amount.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Payment updated',
        description: 'Received amount has been saved.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const statusLabel =
    received >= total
      ? 'Paid'
      : received > 0
      ? 'Partially Paid'
      : financials.payment_status || 'Pending';

  const statusVariant: 'outline' | 'default' | 'secondary' =
    received >= total ? 'default' : received > 0 ? 'secondary' : 'outline';

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between gap-2 text-left">
              <div className="flex items-center gap-2">
                <IndianRupee className="h-5 w-5" />
                <CardTitle className="text-lg font-display">Payment</CardTitle>
                <Badge variant={statusVariant} className="capitalize text-xs">
                  {statusLabel}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                  {formatCurrency(received)} / {formatCurrency(total)} received
                </span>
                {open ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-1">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <CreditCard className="h-4 w-4" />
                  WooCommerce Total
                </span>
                <span className="font-medium">{formatCurrency(total)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Received</span>
                <span className="font-medium text-green-500">
                  {formatCurrency(received)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Pending</span>
                <span className="font-medium text-yellow-500">
                  {formatCurrency(pending)}
                </span>
              </div>
              <Progress value={paidPercent} className="h-2" />
              <p className="text-[11px] text-muted-foreground">
                {paidPercent}% payment received for this customer&apos;s order.
              </p>
            </div>

            {canEdit && (
              <div className="space-y-2 border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Update received amount (Sales / Admin)
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-1.5">
                    <IndianRupee className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={receivedInput}
                      onChange={(e) => setReceivedInput(e.target.value)}
                      className="h-8 text-sm"
                      placeholder="Enter amount received"
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="whitespace-nowrap"
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
