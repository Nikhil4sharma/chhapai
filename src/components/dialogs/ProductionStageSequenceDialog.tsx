import { useState } from 'react';
import { GripVertical, Check, X, ArrowRight, Settings } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { PRODUCTION_STEPS } from '@/types/order';
import { cn } from '@/lib/utils';

interface ProductionStageSequenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  orderId: string;
  currentSequence?: string[] | null;
  onConfirm: (sequence: string[]) => void;
}

export function ProductionStageSequenceDialog({
  open,
  onOpenChange,
  productName,
  orderId,
  currentSequence,
  onConfirm,
}: ProductionStageSequenceDialogProps) {
  const [selectedStages, setSelectedStages] = useState<string[]>(
    currentSequence || PRODUCTION_STEPS.map(s => s.key)
  );
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleToggleStage = (stageKey: string) => {
    setSelectedStages(prev => {
      if (prev.includes(stageKey)) {
        return prev.filter(s => s !== stageKey);
      } else {
        return [...prev, stageKey];
      }
    });
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newSequence = [...selectedStages];
    const draggedItem = newSequence[draggedIndex];
    newSequence.splice(draggedIndex, 1);
    newSequence.splice(index, 0, draggedItem);
    setSelectedStages(newSequence);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const moveStage = (fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= selectedStages.length) return;

    const newSequence = [...selectedStages];
    [newSequence[fromIndex], newSequence[toIndex]] = [newSequence[toIndex], newSequence[fromIndex]];
    setSelectedStages(newSequence);
  };

  const handleConfirm = () => {
    if (selectedStages.length === 0) return;
    onConfirm(selectedStages);
    onOpenChange(false);
  };

  const getStageLabel = (key: string) => {
    return PRODUCTION_STEPS.find(s => s.key === key)?.label || key;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Define Production Stages
          </DialogTitle>
          <DialogDescription>
            Select and order production stages for <strong>{productName}</strong> ({orderId})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="text-sm text-muted-foreground mb-2">
            Drag to reorder or use arrows. Uncheck stages not needed.
          </div>

          {/* Available stages to add */}
          <div className="space-y-2 mb-4">
            <Label className="text-xs font-medium text-muted-foreground">Available Stages:</Label>
            <div className="flex flex-wrap gap-2">
              {PRODUCTION_STEPS.map(stage => (
                <div key={stage.key} className="flex items-center gap-2">
                  <Checkbox
                    id={`stage-${stage.key}`}
                    checked={selectedStages.includes(stage.key)}
                    onCheckedChange={() => handleToggleStage(stage.key)}
                  />
                  <Label 
                    htmlFor={`stage-${stage.key}`}
                    className="text-sm cursor-pointer"
                  >
                    {stage.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Selected sequence */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Production Sequence ({selectedStages.length} stages):
            </Label>
            
            {selectedStages.length === 0 ? (
              <div className="text-sm text-muted-foreground p-4 bg-secondary/50 rounded-lg text-center">
                Select at least one production stage
              </div>
            ) : (
              <div className="space-y-2">
                {selectedStages.map((stageKey, index) => (
                  <div
                    key={stageKey}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "flex items-center gap-2 p-3 bg-secondary/50 rounded-lg border border-border cursor-move transition-colors",
                      draggedIndex === index && "bg-primary/10 border-primary"
                    )}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <Badge variant="outline" className="text-xs">
                      {index + 1}
                    </Badge>
                    <span className="flex-1 font-medium text-foreground">
                      {getStageLabel(stageKey)}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => moveStage(index, 'up')}
                        disabled={index === 0}
                      >
                        <ArrowRight className="h-3 w-3 rotate-[-90deg]" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => moveStage(index, 'down')}
                        disabled={index === selectedStages.length - 1}
                      >
                        <ArrowRight className="h-3 w-3 rotate-90" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleToggleStage(stageKey)}
                      >
                        <X className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Preview */}
          {selectedStages.length > 0 && (
            <div className="bg-primary/5 rounded-lg p-3">
              <Label className="text-xs font-medium text-muted-foreground">Preview:</Label>
              <p className="text-sm text-foreground mt-1">
                {selectedStages.map(s => getStageLabel(s)).join(' → ')}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={selectedStages.length === 0}
            className="bg-green-600 hover:bg-green-700"
          >
            <Check className="h-4 w-4 mr-2" />
            Confirm & Send to Production
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
