import { Order } from '@/types/order';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { IndianRupee, CreditCard } from 'lucide-react';
import { useFinancialAccess } from '@/hooks/useFinancialAccess';

interface OrderFinancialsProps {
  order: Order;
}

export function OrderFinancials({ order }: OrderFinancialsProps) {
  const { canViewFinancials } = useFinancialAccess();
  
  // Only render for admin and sales users
  if (!canViewFinancials) {
    return null;
  }
  
  const financials = order.financials;
  
  // If no financial data, don't render
  if (!financials || !financials.total) {
    return null;
  }

  const formatCurrency = (amount: number | undefined) => {
    if (!amount) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-display flex items-center gap-2">
          <IndianRupee className="h-5 w-5" />
          Order Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {financials.payment_status && (
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Payment:</span>
            <Badge variant="outline" className="capitalize">
              {financials.payment_status}
            </Badge>
          </div>
        )}
        
        <div className="space-y-2 pt-2 border-t">
          {(financials.tax_cgst || financials.tax_sgst) && (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency((financials.total || 0) - (financials.tax_cgst || 0) - (financials.tax_sgst || 0))}</span>
              </div>
              {financials.tax_cgst && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">CGST</span>
                  <span>{formatCurrency(financials.tax_cgst)}</span>
                </div>
              )}
              {financials.tax_sgst && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">SGST</span>
                  <span>{formatCurrency(financials.tax_sgst)}</span>
                </div>
              )}
            </>
          )}
          <div className="flex justify-between font-medium pt-2 border-t">
            <span>Total</span>
            <span className="text-primary">{formatCurrency(financials.total)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
