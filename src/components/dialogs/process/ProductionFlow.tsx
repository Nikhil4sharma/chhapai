import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PaperSelector } from '@/features/inventory/components/PaperSelector';
import { PaperInventory } from '@/services/inventory';
import { useWorkflow } from '@/contexts/WorkflowContext';
import { CheckCircle2, Layers, ScrollText, GripVertical, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';

interface ProductionFlowProps {
    initialStages?: string[];
    onStagesChange: (stages: string[]) => void;
    onMaterialChange: (paper: PaperInventory | null, qty: number) => void;
}

export function ProductionFlow({ initialStages = [], onStagesChange, onMaterialChange }: ProductionFlowProps) {
    const { productionStages } = useWorkflow();
    const [selectedStages, setSelectedStages] = useState<string[]>(initialStages);
    const [selectedPaper, setSelectedPaper] = useState<PaperInventory | null>(null);
    const [paperQty, setPaperQty] = useState<number>(0);

    // Sync changes to parent
    useEffect(() => {
        onStagesChange(selectedStages);
    }, [selectedStages, onStagesChange]);

    useEffect(() => {
        onMaterialChange(selectedPaper, paperQty);
    }, [selectedPaper, paperQty, onMaterialChange]);

    // Handle initial paper? (Might need if editing existing allocation, but typically fresh for flow)

    const toggleStage = (stageKey: string) => {
        if (selectedStages.includes(stageKey)) {
            // Remove
            setSelectedStages(prev => prev.filter(k => k !== stageKey));
        } else {
            // Add (append to end by default in this simple view, or strict order?)
            // Strict order from config is better for "Builder"
            const allStageKeys = productionStages.map(s => s.key);
            const newSelection = [...selectedStages, stageKey].sort((a, b) => {
                return allStageKeys.indexOf(a) - allStageKeys.indexOf(b);
            });
            setSelectedStages(newSelection);
        }
    };

    const handleDragEnd = (result: DropResult) => {
        if (!result.destination) return;
        const items = Array.from(selectedStages);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);
        setSelectedStages(items);
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-top-2 duration-300">

            {/* Stage Builder Section */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1 flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5" />
                        Production Stage Builder
                    </Label>
                    <span className="text-[10px] text-muted-foreground">
                        {selectedStages.length} stages selected
                    </span>
                </div>

                {/* Available Stages Pool */}
                <div className="flex flex-wrap gap-2 mb-4">
                    {productionStages.map((stage) => {
                        const isSelected = selectedStages.includes(stage.key);
                        return (
                            <div
                                key={stage.key}
                                onClick={() => toggleStage(stage.key)}
                                className={cn(
                                    "cursor-pointer px-3 py-1.5 rounded-full text-xs font-medium border transition-all select-none flex items-center gap-1.5",
                                    isSelected
                                        ? "bg-primary/10 text-primary border-primary/20 opacity-50" // Dimmed when selected as it moves to list
                                        : "bg-background border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                {stage.label}
                                {isSelected ? <CheckCircle2 className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                            </div>
                        );
                    })}
                </div>

                {/* Reorderable List of Selected Stages */}
                {selectedStages.length > 0 ? (
                    <DragDropContext onDragEnd={handleDragEnd}>
                        <Droppable droppableId="stages">
                            {(provided) => (
                                <div
                                    {...provided.droppableProps}
                                    ref={provided.innerRef}
                                    className="bg-muted/30 rounded-xl border border-border/50 p-2 space-y-2"
                                >
                                    {selectedStages.map((stageKey, index) => {
                                        const stageLabel = productionStages.find(s => s.key === stageKey)?.label || stageKey;
                                        return (
                                            <Draggable key={stageKey} draggableId={stageKey} index={index}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        className={cn(
                                                            "flex items-center justify-between p-3 bg-card rounded-lg border shadow-sm group select-none",
                                                            snapshot.isDragging && "shadow-lg ring-2 ring-primary/20 scale-[1.02]"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div {...provided.dragHandleProps} className="text-muted-foreground/50 hover:text-foreground cursor-grab active:cursor-grabbing">
                                                                <GripVertical className="w-4 h-4" />
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-5 h-5 rounded-full bg-primary/10 text-[10px] font-bold text-primary flex items-center justify-center">
                                                                    {index + 1}
                                                                </div>
                                                                <span className="text-sm font-medium">{stageLabel}</span>
                                                            </div>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                                                            onClick={() => toggleStage(stageKey)}
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </Draggable>
                                        );
                                    })}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>
                ) : (
                    <div className="text-sm text-muted-foreground text-center py-8 bg-muted/20 rounded-xl border border-dashed border-border">
                        Select stages above to build the production workflow.
                    </div>
                )}
            </div>

            {/* Material Allocation Section */}
            <div className="space-y-3 bg-muted/20 p-4 rounded-xl border border-border/50">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1 flex items-center gap-2">
                    <ScrollText className="w-3.5 h-3.5" />
                    Material Allocation
                </Label>
                <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                        <PaperSelector
                            value={selectedPaper ? selectedPaper.id : ''}
                            onSelect={setSelectedPaper}
                        />
                    </div>
                    <div className="col-span-1">
                        <div className="relative">
                            <Input
                                type="number"
                                placeholder="Qty"
                                min={0}
                                value={paperQty || ''}
                                onChange={(e) => setPaperQty(Number(e.target.value))}
                                className="bg-background"
                            />
                            <span className="absolute right-3 top-2.5 text-xs text-muted-foreground pointer-events-none">Sheets</span>
                        </div>
                    </div>
                </div>
                {selectedPaper && (
                    <div className="text-[10px] text-muted-foreground pl-1 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                        Selected: <span className="font-medium text-foreground">{selectedPaper.name}</span> ({selectedPaper.gsm} GSM)
                        <span className="text-muted-foreground/50 mx-1">|</span>
                        {selectedPaper.available_sheets} Available
                    </div>
                )}
            </div>
        </div>
    );
}
