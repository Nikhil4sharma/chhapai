import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PaperSelector } from '@/features/inventory/components/PaperSelector';
import { ProductionStageList } from './ProductionStageList';
import { Label } from '@/components/ui/label';
import { Check, ArrowRight } from 'lucide-react';
import { PRODUCTION_STEPS } from '@/types/order';
import { useWorkflow } from '@/contexts/WorkflowContext';
import { PaperInventory } from '@/services/inventory';

interface ProductionHandoffDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    productName: string;
    orderId: string;
    onConfirm: (data: { paper: PaperInventory | null; stages: string[] }) => void;
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
        onConfirm({ paper: selectedPaper, stages: selectedStages });
        // Keep open until processing done by parent? 
        // Usually parent closes. But here we assume local close or parent callback closes.
        // Prop says onOpenChange.

        // We expect parent to close, but for UI responsiveness we can reset step here.
        setStep(1);
    };

    const handleOpenChangeInternal = (newOpen: boolean) => {
        if (!newOpen) setStep(1); // Reset on close
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

                <div className="py-4">
                    {step === 1 && (
                        <div className="space-y-4">
                            <div>
                                <Label className="mb-2 block">Select Paper (Optional)</Label>
                                <PaperSelector
                                    value={selectedPaper?.id}
                                    onSelect={setSelectedPaper}
                                />
                            </div>

                            {selectedPaper ? (
                                <div className="text-sm bg-muted/60 p-3 rounded-md border border-border/50">
                                    <div className="font-semibold text-foreground">{selectedPaper.name}</div>
                                    <div className="text-muted-foreground flex gap-2 mt-1">
                                        <span>{selectedPaper.gsm} GSM</span>
                                        <span>•</span>
                                        <span>{selectedPaper.brand || 'No Brand'}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-sm text-muted-foreground italic p-2">
                                    No paper selected. You can proceed without selecting paper.
                                </div>
                            )}
                        </div>
                    )}

                    {step === 2 && (
                        <ProductionStageList selectedStages={selectedStages} onChange={setSelectedStages} />
                    )}
                </div>

                <DialogFooter className="flex justify-between sm:justify-between items-center gap-2">
                    {step === 2 ? (
                        <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                    ) : (
                        <div /> /* Spacer */
                    )}

                    <Button onClick={handleNext} className={step === 2 ? "bg-green-600 hover:bg-green-700" : ""}>
                        {step === 1 ? <>Next <ArrowRight className="ml-2 h-4 w-4" /></> : <>Confirm <Check className="ml-2 h-4 w-4" /></>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
