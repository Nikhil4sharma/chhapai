import { useState } from 'react';
import { ArrowRight, CheckCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Stage, SubStage, PRODUCTION_STEPS, STAGE_LABELS } from '@/types/order';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ChangeStageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChangeStage: (stage: Stage, substage?: SubStage) => void;
  currentStage: Stage;
  currentSubstage?: SubStage | null;
}

const stages: Stage[] = ['sales', 'design', 'prepress', 'production', 'dispatch', 'completed'];

export function ChangeStageDialog({ 
  open, 
  onOpenChange, 
  onChangeStage,
  currentStage,
  currentSubstage
}: ChangeStageDialogProps) {
  const [selectedStage, setSelectedStage] = useState<Stage>(currentStage);
  const [selectedSubstage, setSelectedSubstage] = useState<SubStage | null>(
    currentStage === 'production' ? (currentSubstage || 'foiling') : null
  );

  const handleChange = () => {
    onChangeStage(
      selectedStage, 
      selectedStage === 'production' ? selectedSubstage : undefined
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Change Stage
          </DialogTitle>
          <DialogDescription>
            Move this item to a different stage in the workflow
          </DialogDescription>
        </DialogHeader>

        <TooltipProvider>
          <div className="space-y-6">
            {/* Main Stage Selection */}
            <div className="space-y-3">
              <Label>Select Stage</Label>
              <RadioGroup 
                value={selectedStage} 
                onValueChange={(v) => {
                  setSelectedStage(v as Stage);
                  if (v === 'production') {
                    setSelectedSubstage('foiling');
                  } else {
                    setSelectedSubstage(null);
                  }
                }}
                className="grid grid-cols-2 gap-2"
              >
                {stages.map((stage) => (
                  <Tooltip key={stage}>
                    <TooltipTrigger asChild>
                      <div className="relative">
                        <RadioGroupItem
                          value={stage}
                          id={`stage-${stage}`}
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor={`stage-${stage}`}
                          className={cn(
                            "flex items-center justify-center gap-2 p-3 rounded-lg border border-border cursor-pointer transition-all hover:bg-secondary/50",
                            "peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5",
                            currentStage === stage && "ring-2 ring-primary/20"
                          )}
                        >
                          {currentStage === stage && (
                            <CheckCircle className="h-4 w-4 text-primary" />
                          )}
                          <span className="font-medium text-foreground">{STAGE_LABELS[stage]}</span>
                        </Label>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Move to {STAGE_LABELS[stage]}</TooltipContent>
                  </Tooltip>
                ))}
              </RadioGroup>
            </div>

            {/* Production Substages */}
            {selectedStage === 'production' && (
              <div className="space-y-3">
                <Label>Production Substage</Label>
                <RadioGroup 
                  value={selectedSubstage || 'foiling'} 
                  onValueChange={(v) => setSelectedSubstage(v as SubStage)}
                  className="grid grid-cols-3 sm:grid-cols-4 gap-2"
                >
                  {PRODUCTION_STEPS.map((step) => (
                    <Tooltip key={step.key}>
                      <TooltipTrigger asChild>
                        <div className="relative">
                          <RadioGroupItem
                            value={step.key}
                            id={`substage-${step.key}`}
                            className="peer sr-only"
                          />
                          <Label
                            htmlFor={`substage-${step.key}`}
                            className={cn(
                              "flex items-center justify-center p-2 rounded-lg border border-border cursor-pointer transition-all hover:bg-secondary/50 text-sm",
                              "peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5",
                              currentSubstage === step.key && "ring-2 ring-primary/20"
                            )}
                          >
                            {step.label}
                          </Label>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>Start {step.label} process</TooltipContent>
                    </Tooltip>
                  ))}
                </RadioGroup>
              </div>
            )}
          </div>
        </TooltipProvider>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleChange}>
            Update Stage
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
