import { useState } from 'react';
import { Order } from '@/types/order';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Phone, Mail, Truck, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from '@/hooks/use-toast';

interface ShippingDetailsProps {
  order: Order;
}

export function ShippingDetails({ order }: ShippingDetailsProps) {
  const shipping = order.shipping;
  const [shippingOpen, setShippingOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // If no shipping details or same as billing, show message
  if (!shipping || !shipping.address) {
    return (
      <Card>
        <Collapsible open={shippingOpen} onOpenChange={setShippingOpen}>
          <CardHeader className="flex-shrink-0 pb-3">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between cursor-pointer hover:bg-muted/50 -mx-4 -my-2 px-4 py-2 rounded-lg transition-colors">
                <CardTitle className="text-lg font-display flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Shipping Address
                </CardTitle>
                {shippingOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
              </div>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <p className="text-sm text-muted-foreground">Same as billing address</p>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  }

  const handleCopyShippingDetails = async () => {
    const shippingText = [
      shipping.name,
      shipping.phone,
      shipping.email,
      shipping.address,
      [shipping.city, shipping.state, shipping.pincode].filter(Boolean).join(', '),
    ].filter(Boolean).join('\n');

    try {
      await navigator.clipboard.writeText(shippingText);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Shipping details copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy shipping details",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <Collapsible open={shippingOpen} onOpenChange={setShippingOpen}>
        <CardHeader className="flex-shrink-0 pb-3">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer hover:bg-muted/50 -mx-4 -my-2 px-4 py-2 rounded-lg transition-colors">
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Shipping Address
              </CardTitle>
              {shippingOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
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
            
            <Button variant="outline" size="sm" className="w-full" onClick={handleCopyShippingDetails}>
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Details
                </>
              )}
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}