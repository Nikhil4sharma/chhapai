import { OrderItem } from '@/types/order';
import { Badge } from '@/components/ui/badge';
import { FileText } from 'lucide-react';

interface ProductSpecificationsProps {
  item: OrderItem;
  compact?: boolean;
}

export function ProductSpecifications({ item, compact = false }: ProductSpecificationsProps) {
  // Collect all specifications from both structured and woo_meta
  const allSpecs: { key: string; value: string }[] = [];
  
  // Add structured specs first
  if (item.specifications) {
    Object.entries(item.specifications).forEach(([key, value]) => {
      if (value && key !== 'notes') {
        allSpecs.push({ key, value });
      }
    });
  }
  
  // Add WooCommerce meta (if not already in structured specs)
  if (item.woo_meta && Array.isArray(item.woo_meta)) {
    for (const meta of item.woo_meta) {
      const displayValue = meta.display_value || meta.value;
      if (displayValue && !allSpecs.find(s => s.value === displayValue)) {
        allSpecs.push({
          key: meta.display_key || meta.key,
          value: displayValue,
        });
      }
    }
  }

  if (allSpecs.length === 0) {
    return compact ? null : (
      <p className="text-sm text-muted-foreground italic">No specifications provided</p>
    );
  }

  if (compact) {
    // Compact view: show first 2-3 specs as badges
    const displaySpecs = allSpecs.slice(0, 3);
    const remaining = allSpecs.length - displaySpecs.length;
    
    return (
      <div className="flex flex-wrap gap-1">
        {displaySpecs.map((spec, idx) => (
          <Badge key={idx} variant="secondary" className="text-xs font-normal">
            {spec.value}
          </Badge>
        ))}
        {remaining > 0 && (
          <Badge variant="outline" className="text-xs font-normal">
            +{remaining} more
          </Badge>
        )}
      </div>
    );
  }

  // Full view: show all specs in a readable block
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
        <FileText className="h-3.5 w-3.5" />
        <span>Specifications</span>
      </div>
      <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
        {allSpecs.map((spec, idx) => (
          <div key={idx} className="text-sm">
            <span className="text-foreground">{spec.value}</span>
          </div>
        ))}
      </div>
      {item.specifications?.notes && (
        <p className="text-sm text-muted-foreground italic mt-2">
          Note: {item.specifications.notes}
        </p>
      )}
    </div>
  );
}