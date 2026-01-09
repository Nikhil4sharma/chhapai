import { useState } from 'react';
import { OrderItem } from '@/types/order';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FileText } from 'lucide-react';

interface ProductSpecificationsProps {
  item: OrderItem;
  compact?: boolean;
}

// Keys to exclude from display (SKU and other internal fields)
const EXCLUDED_KEYS = ['sku', 'SKU', 'notes', '_sku', 'product_sku', 'id', 'workflow_status'];

export function ProductSpecifications({ item, compact = false }: ProductSpecificationsProps) {
  // Collect all specifications from both structured and woo_meta
  const allSpecs: { key: string; value: string }[] = [];

  // Add structured specs first
  if (item.specifications) {
    Object.entries(item.specifications).forEach(([key, value]) => {
      // Skip numeric keys (array indices) and excluded keys
      if (/^\d+$/.test(key) || EXCLUDED_KEYS.includes(key.toLowerCase())) {
        return;
      }

      if (value !== null && value !== undefined) {
        // Ensure value is a string, not an object
        let stringValue = '';
        if (typeof value === 'string') {
          stringValue = value;
        } else if (typeof value === 'object' && value !== null) {
          // If it's an object with display_value, use that
          if ('display_value' in value && typeof value.display_value === 'string') {
            stringValue = value.display_value;
            // Use display_key for the key
            const displayKey = value.display_key || key;
            if (stringValue && stringValue.trim()) {
              allSpecs.push({ key: displayKey, value: stringValue.trim() });
            }
            return; // Already added, skip further processing
          } else if ('value' in value && typeof value.value === 'string') {
            stringValue = value.value;
            const displayKey = value.display_key || value.key || key;
            if (stringValue && stringValue.trim()) {
              allSpecs.push({ key: displayKey, value: stringValue.trim() });
            }
            return; // Already added, skip further processing
          } else {
            // Skip raw objects - don't show them as code
            return;
          }
        } else {
          stringValue = String(value || '');
        }

        if (stringValue && stringValue.trim()) {
          allSpecs.push({ key: key, value: stringValue.trim() });
        }
      }
    });
  }

  // Add WooCommerce meta (if not already in structured specs)
  if (item.woo_meta) {
    // Handle both array and object formats
    const metaArray = Array.isArray(item.woo_meta) ? item.woo_meta :
      typeof item.woo_meta === 'object' ? Object.values(item.woo_meta) : [];

    for (const meta of metaArray) {
      if (!meta || typeof meta !== 'object') continue;

      const metaKey = (meta.key || '').toLowerCase();

      // Skip SKU-related fields and internal keys
      if (EXCLUDED_KEYS.some(k => metaKey.includes(k.toLowerCase())) || metaKey.startsWith('_')) {
        continue;
      }

      const displayKey = meta.display_key || meta.key;
      const displayValue = meta.display_value || meta.value;

      // Only process if we have a valid string value
      if (displayValue && typeof displayValue === 'string' && displayValue.trim()) {
        const stringValue = displayValue.trim();

        // Check if this spec is already added (avoid duplicates)
        if (!allSpecs.find(s => s.key === displayKey && s.value === stringValue)) {
          allSpecs.push({
            key: displayKey || 'Unknown',
            value: stringValue,
          });
        }
      }
    }
  }

  if (allSpecs.length === 0) {
    return compact ? null : (
      <p className="text-sm text-muted-foreground italic">No specifications provided</p>
    );
  }

  if (compact) {
    // Compact view: show first 2-3 specs as badges with "+N more" opening a clean dialog
    const displaySpecs = allSpecs.slice(0, 3);
    const remaining = allSpecs.length - displaySpecs.length;

    return (
      <div className="flex flex-wrap gap-1 items-center">
        {displaySpecs.map((spec, idx) => (
          <Badge key={idx} variant="secondary" className="text-xs font-normal">
            {spec.value}
          </Badge>
        ))}
        {remaining > 0 && (
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="xs"
                className="h-6 px-2 text-[10px] font-normal rounded-full border-dashed"
                onClick={(e) => e.stopPropagation()}
              >
                +{remaining} more
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4" />
                  Full Specifications
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {allSpecs.map((spec, idx) => (
                  <div
                    key={idx}
                    className="text-sm flex flex-col sm:flex-row gap-1 sm:gap-2 border-b border-border/40 pb-1 last:border-b-0"
                  >
                    <span className="text-muted-foreground min-w-[120px] font-medium">
                      {spec.key}:
                    </span>
                    <span className="text-foreground break-words">{spec.value}</span>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  }

  // Full view: show all specs in a readable block
  return (
    <div className="space-y-1.5 mt-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
        <FileText className="h-3.5 w-3.5" />
        <span>Specifications</span>
      </div>
      <div className="bg-secondary/50 rounded-lg p-3 sm:p-4 space-y-2">
        {allSpecs.map((spec, idx) => (
          <div key={idx} className="text-sm flex flex-col sm:flex-row gap-1 sm:gap-2">
            <span className="text-muted-foreground min-w-[100px] sm:min-w-[120px] font-medium">{spec.key}:</span>
            <span className="text-foreground break-words">{spec.value}</span>
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