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
const EXCLUDED_KEYS = ['sku', 'SKU', 'notes', '_sku', 'product_sku', 'id', 'workflow_status', 'prepress_brief', 'design_brief', 'production_brief', 'brief'];

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
          const objValue = value as any;
          if ('display_value' in objValue && typeof objValue.display_value === 'string') {
            stringValue = objValue.display_value;
            // Use display_key for the key
            const displayKey = objValue.display_key || key;
            if (stringValue && stringValue.trim()) {
              allSpecs.push({ key: displayKey, value: stringValue.trim() });
            }
            return; // Already added, skip further processing
          } else if ('value' in objValue && typeof objValue.value === 'string') {
            stringValue = objValue.value;
            const displayKey = objValue.display_key || objValue.key || key;
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

      const metaObj = meta as any;
      const metaKey = (metaObj.key || '').toLowerCase();

      // Skip SKU-related fields and internal keys
      if (EXCLUDED_KEYS.some(k => metaKey.includes(k.toLowerCase())) || metaKey.startsWith('_')) {
        continue;
      }

      const displayKey = metaObj.display_key || metaObj.key;
      const displayValue = metaObj.display_value || metaObj.value;

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
                size="sm"
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

  // Always show button only - no specs in card to prevent size increase
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full h-9 text-xs font-medium border-dashed hover:bg-accent"
          onClick={(e) => e.stopPropagation()}
        >
          <FileText className="h-3.5 w-3.5 mr-2" />
          View Specifications {allSpecs.length > 0 && `(${allSpecs.length})`}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            Product Specifications
          </DialogTitle>
        </DialogHeader>

        {/* Quantity Display */}
        <div className="px-1 pb-2 border-b border-border/50">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground font-medium">Quantity:</span>
            <span className="font-semibold text-foreground">{item.quantity}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2">
          <div className="space-y-3">
            {allSpecs.map((spec, idx) => (
              <div
                key={idx}
                className="flex flex-col sm:flex-row gap-2 p-3 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
              >
                <span className="text-muted-foreground font-semibold text-sm uppercase tracking-wide min-w-[140px]">
                  {spec.key}
                </span>
                <span className="text-foreground font-medium text-sm break-words flex-1">
                  {spec.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {item.specifications?.notes && (
          <div className="mt-3 text-sm bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300 p-3 rounded-lg border border-yellow-200 dark:border-yellow-900/50">
            <span className="font-semibold mr-1">Note:</span>
            {item.specifications.notes}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}