import { Order } from '@/types/order';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Phone, Mail, Truck } from 'lucide-react';

interface ShippingDetailsProps {
  order: Order;
}

export function ShippingDetails({ order }: ShippingDetailsProps) {
  const shipping = order.shipping;
  
  // If no shipping details or same as billing, show message
  if (!shipping || !shipping.address) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-display flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Shipping Address
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Same as billing address</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-display flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Shipping Address
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {shipping.name && (
          <p className="font-medium text-foreground">{shipping.name}</p>
        )}
        
        {shipping.phone && (
          <a 
            href={`tel:${shipping.phone}`}
            className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
          >
            <Phone className="h-4 w-4" />
            <span>{shipping.phone}</span>
          </a>
        )}
        
        {shipping.email && (
          <a 
            href={`mailto:${shipping.email}`}
            className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
          >
            <Mail className="h-4 w-4" />
            <span>{shipping.email}</span>
          </a>
        )}
        
        {shipping.address && (
          <div className="flex items-start gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <span>{shipping.address}</span>
              {(shipping.city || shipping.state || shipping.pincode) && (
                <p className="text-sm">
                  {[shipping.city, shipping.state, shipping.pincode].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}