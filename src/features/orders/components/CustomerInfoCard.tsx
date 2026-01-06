import { useState } from 'react';
import { ChevronDown, ChevronUp, User, MapPin, Mail, Phone, Copy, Check } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Order } from '@/types/order';
import { toast } from '@/hooks/use-toast';

interface CustomerInfoCardProps {
    order: Order;
}

export function CustomerInfoCard({ order }: CustomerInfoCardProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const { customer, shipping } = order;

    const copyAllDetails = async () => {
        const details = `
Customer Details:
Name: ${customer.name}
Email: ${customer.email || 'N/A'}
Phone: ${customer.phone || 'N/A'}
Address: ${customer.address || 'N/A'}
${customer.city ? `City: ${customer.city}` : ''}
${customer.state ? `State: ${customer.state}` : ''}
${customer.pincode ? `Pincode: ${customer.pincode}` : ''}

${shipping ? `
Shipping Address:
${shipping.name ? `Name: ${shipping.name}` : ''}
${shipping.address ? `Address: ${shipping.address}` : ''}
${shipping.city ? `City: ${shipping.city}` : ''}
${shipping.state ? `State: ${shipping.state}` : ''}
${shipping.pincode ? `Pincode: ${shipping.pincode}` : ''}
` : ''}
    `.trim();

        try {
            await navigator.clipboard.writeText(details);
            setCopied(true);
            toast({
                title: 'Copied!',
                description: 'All customer details copied to clipboard',
            });
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            toast({
                title: 'Failed to copy',
                description: 'Please try again',
                variant: 'destructive',
            });
        }
    };

    return (
        <Card>
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CollapsibleTrigger asChild>
                            <Button
                                variant="ghost"
                                className="flex-1 justify-between p-0 h-auto hover:bg-transparent"
                            >
                                <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-muted-foreground" />
                                    <h3 className="font-semibold text-sm">Customer Details</h3>
                                </div>
                                {isOpen ? (
                                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                            </Button>
                        </CollapsibleTrigger>

                        {/* Copy All Button */}
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 ml-2"
                            onClick={copyAllDetails}
                        >
                            {copied ? (
                                <Check className="h-4 w-4 text-green-600" />
                            ) : (
                                <Copy className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </CardHeader>

                <CollapsibleContent>
                    <CardContent className="space-y-6 pt-0">
                        {/* Customer Info */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Customer Information
                            </h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex items-start gap-2">
                                    <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                    <div className="flex-1">
                                        <p className="font-medium">{customer.name}</p>
                                    </div>
                                </div>

                                {customer.email && (
                                    <div className="flex items-start gap-2">
                                        <Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                        <a
                                            href={`mailto:${customer.email}`}
                                            className="text-primary hover:underline flex-1"
                                        >
                                            {customer.email}
                                        </a>
                                    </div>
                                )}

                                {customer.phone && (
                                    <div className="flex items-start gap-2">
                                        <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                        <a
                                            href={`tel:${customer.phone}`}
                                            className="text-primary hover:underline flex-1"
                                        >
                                            {customer.phone}
                                        </a>
                                    </div>
                                )}

                                {customer.address && (
                                    <div className="flex items-start gap-2">
                                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                        <div className="text-muted-foreground flex-1">
                                            <p>{customer.address}</p>
                                            {(customer.city || customer.state || customer.pincode) && (
                                                <p>
                                                    {[customer.city, customer.state, customer.pincode]
                                                        .filter(Boolean)
                                                        .join(', ')}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Shipping Info */}
                        {shipping && (
                            <div className="space-y-3 pt-3 border-t">
                                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    Shipping Address
                                </h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-start gap-2">
                                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                        <div className="text-muted-foreground flex-1">
                                            {shipping.name && <p className="font-medium text-foreground">{shipping.name}</p>}
                                            {shipping.address && <p>{shipping.address}</p>}
                                            {(shipping.city || shipping.state || shipping.pincode) && (
                                                <p>
                                                    {[shipping.city, shipping.state, shipping.pincode]
                                                        .filter(Boolean)
                                                        .join(', ')}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </CollapsibleContent>
            </Collapsible>
        </Card>
    );
}
