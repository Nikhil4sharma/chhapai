import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PaperSelector } from '@/features/inventory/components/PaperSelector';
import { ProductionStageList } from './ProductionStageList';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Check, ArrowRight, ScrollText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRODUCTION_STEPS } from '@/types/order';
import { useWorkflow } from '@/contexts/WorkflowContext';
import { PaperInventory } from '@/services/inventory';

interface ProductionHandoffDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    productName: string;
    orderId: string;
    onConfirm: (data: { paper: PaperInventory | null; stages: string[]; sheets: number }) => void;
}

export function ProductionHandoffDialog({
    open,
    onOpenChange,
    productName,
    orderId,
    onConfirm
}: ProductionHandoffDialogProps) {
    const { productionStages } = useWorkflow();
    const [step, setStep] = useState<1 | 2>(1);
    const [selectedPaper, setSelectedPaper] = useState<PaperInventory | null>(null);
    const [sheets, setSheets] = useState<number>(0);

    // Default stages from context or static list
    const defaultStages = productionStages.length > 0
        ? productionStages.map(s => s.key)
        : PRODUCTION_STEPS.map(s => s.key);

    const [selectedStages, setSelectedStages] = useState<string[]>(defaultStages);

    const handleNext = () => {
        if (step === 1) setStep(2);
        else handleFinish();
    };

    const handleFinish = () => {
        onConfirm({ paper: selectedPaper, stages: selectedStages, sheets });
        // Keep open until processing done by parent? 
        // Usually parent closes. But here we assume local close or parent callback closes.
        // Prop says onOpenChange.

        // We expect parent to close, but for UI responsiveness we can reset step here.
        setStep(1);
    };

    const handleOpenChangeInternal = (newOpen: boolean) => {
        if (!newOpen) {
            setStep(1);
            setSheets(0); // Reset sheets on close
        }
        onOpenChange(newOpen);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChangeInternal}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Production Setup - Step {step} of 2</DialogTitle>
                    <DialogDescription>
                        {step === 1
                            ? "Select Paper Material for this Job"
                            : `Configure Production Stages for ${productName}`}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-2">
                    {step === 1 && (
                        <div className="space-y-4">
                            <div className="space-y-3">
                                <Label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    <ScrollText className="w-3.5 h-3.5" />
                                    Select Paper (Optional)
                                </Label>
                                <PaperSelector
                                    value={selectedPaper?.id}
                                    onSelect={setSelectedPaper}
                                />
                            </div>

                            <div className="space-y-3">
                                <Label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    <Check className="w-3.5 h-3.5" />
                                    Sheets Needed (Optional)
                                </Label>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        placeholder="Enter sheets count..."
                                        value={sheets || ''}
                                        onChange={(e) => setSheets(Number(e.target.value))}
                                        className="h-10 pl-3 pr-16"
                                    />
                                    <span className="absolute right-3 top-2.5 text-xs text-muted-foreground pointer-events-none font-medium">
                                        Sheets
                                    </span>
                                </div>
                                <p className="text-[10px] text-muted-foreground/70 px-1 italic">
                                    * If left 0, item quantity will be used for allocation.
                                </p>
                            </div>

                            {selectedPaper && (
                                <div className="text-sm bg-muted/40 p-3 rounded-lg border border-border/50 animate-in fade-in slide-in-from-top-1">
                                    <div className="font-bold text-foreground flex items-center justify-between">
                                        <span>{selectedPaper.name}</span>
                                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">{selectedPaper.available_sheets} in stock</span>
                                    </div>
                                    <div className="text-muted-foreground flex gap-2 mt-1 text-xs">
                                        <span>{selectedPaper.gsm} GSM</span>
                                        <span>•</span>
                                        <span>{selectedPaper.brand || 'No Brand'}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 2 && (
                        <ProductionStageList selectedStages={selectedStages} onChange={setSelectedStages} />
                    )}
                </div>

                <DialogFooter className="flex justify-between sm:justify-between items-center gap-2 pt-4">
                    {step === 2 ? (
                        <Button variant="outline" onClick={() => setStep(1)} className="rounded-full px-6">Back</Button>
                    ) : (
                        <div /> /* Spacer */
                    )}

                    <Button onClick={handleNext} className={cn("rounded-full px-8 font-bold shadow-lg transition-all", step === 2 ? "bg-green-600 hover:bg-green-700 text-white" : "bg-primary")}>
                        {step === 1 ? <>Next <ArrowRight className="ml-2 h-4 w-4" /></> : <>Confirm Setup <Check className="ml-2 h-4 w-4" /></>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
