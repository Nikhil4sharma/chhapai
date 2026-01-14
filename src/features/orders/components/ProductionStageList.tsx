import { useState, useEffect } from 'react';
import { GripVertical, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { PRODUCTION_STEPS } from '@/types/order';
import { cn } from '@/lib/utils';
import { useWorkflow } from '@/contexts/WorkflowContext';

interface ProductionStageListProps {
    selectedStages: string[];
    onChange: (stages: string[]) => void;
}

export function ProductionStageList({
    selectedStages,
    onChange,
}: ProductionStageListProps) {
    const { productionStages } = useWorkflow();
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    // Use effective available stages (prefer context, fallback to static)
    const availableStages = productionStages.length > 0 ? productionStages : PRODUCTION_STEPS.map(s => ({ key: s.key, label: s.label, order: s.order }));

    // Initialize if empty? No, parent controls state.

    const handleToggleStage = (stageKey: string) => {
        let newStages;
        if (selectedStages.includes(stageKey)) {
            newStages = selectedStages.filter(s => s !== stageKey);
        } else {
            newStages = [...selectedStages, stageKey];
        }
        onChange(newStages);
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

        onChange(newSequence);
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
        onChange(newSequence);
    };

    const getStageLabel = (key: string) => {
        return availableStages.find(s => s.key === key)?.label || PRODUCTION_STEPS.find(s => s.key === key)?.label || key;
    };

    return (
        <div className="space-y-4 py-2">
            <div className="text-sm text-muted-foreground mb-2">
                Drag to reorder or use arrows. Uncheck stages not needed.
            </div>

            {/* Available stages to add */}
            <div className="space-y-2 mb-4">
                <Label className="text-xs font-medium text-muted-foreground">Available Stages:</Label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-border rounded-lg bg-card">
                    {availableStages.map(stage => (
                        <div key={stage.key} className="flex items-center gap-2">
                            <Checkbox
                                id={`stage-${stage.key}`}
                                checked={selectedStages.includes(stage.key)}
                                onCheckedChange={() => handleToggleStage(stage.key)}
                            />
                            <Label
                                htmlFor={`stage-${stage.key}`}
                                className="text-sm cursor-pointer select-none"
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
                    <div className="text-sm text-muted-foreground p-4 bg-secondary/50 rounded-lg text-center border border-dashed border-border">
                        Select at least one production stage
                    </div>
                ) : (
                    <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                        {selectedStages.map((stageKey, index) => (
                            <div
                                key={stageKey}
                                draggable
                                onDragStart={() => handleDragStart(index)}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDragEnd={handleDragEnd}
                                className={cn(
                                    "flex items-center gap-2 p-3 bg-secondary/50 rounded-lg border border-border cursor-move transition-colors group hover:border-primary/50",
                                    draggedIndex === index && "bg-primary/10 border-primary"
                                )}
                            >
                                <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 opacity-50 group-hover:opacity-100" />
                                <Badge variant="outline" className="text-xs w-6 h-6 flex items-center justify-center p-0 rounded-full">
                                    {index + 1}
                                </Badge>
                                <span className="flex-1 font-medium text-foreground text-sm">
                                    {getStageLabel(stageKey)}
                                </span>
                                <div className="flex gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => moveStage(index, 'up')}
                                        disabled={index === 0}
                                    >
                                        <ArrowRight className="h-3 w-3 rotate-[-90deg]" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => moveStage(index, 'down')}
                                        disabled={index === selectedStages.length - 1}
                                    >
                                        <ArrowRight className="h-3 w-3 rotate-90" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => handleToggleStage(stageKey)}
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Preview */}
            {selectedStages.length > 0 && (
                <div className="bg-primary/5 rounded-lg p-3 border border-primary/10">
                    <Label className="text-xs font-medium text-muted-foreground">Sequence Preview:</Label>
                    <p className="text-xs text-foreground mt-1 leading-relaxed">
                        {selectedStages.map(s => getStageLabel(s)).join(' → ')}
                    </p>
                </div>
            )}
        </div>
    );
}
