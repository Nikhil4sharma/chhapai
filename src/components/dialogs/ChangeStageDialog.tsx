import { useState, useEffect } from 'react';
import { ArrowRight, CheckCircle, Factory, Truck, Send } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ChangeStageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChangeStage: (stage: Stage, substage?: SubStage) => void;
  currentStage: Stage;
  currentSubstage?: SubStage | null;
}

const stages: Stage[] = ['sales', 'design', 'prepress', 'production', 'dispatch', 'completed'];

const stageIcons: Record<Stage, React.ReactNode> = {
  sales: null,
  design: null,
  prepress: null,
  production: <Factory className="h-4 w-4" />,
  dispatch: <Truck className="h-4 w-4" />,
  completed: <CheckCircle className="h-4 w-4" />,
};

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
  const [activeTab, setActiveTab] = useState<'stages' | 'quick'>('quick');

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedStage(currentStage);
      setSelectedSubstage(currentStage === 'production' ? (currentSubstage || 'foiling') : null);
    }
  }, [open, currentStage, currentSubstage]);

  const handleChange = () => {
    onChangeStage(
      selectedStage, 
      selectedStage === 'production' ? selectedSubstage : undefined
    );
    onOpenChange(false);
  };

  const handleQuickAction = (stage: Stage, substage?: SubStage) => {
    onChangeStage(stage, substage);
    onOpenChange(false);
  };

  // Determine next logical stage
  const getNextStage = (): { stage: Stage; substage?: SubStage } | null => {
    if (currentStage === 'sales') return { stage: 'design' };
    if (currentStage === 'design') return { stage: 'prepress' };
    if (currentStage === 'prepress') return { stage: 'production', substage: 'foiling' };
    if (currentStage === 'production') {
      if (!currentSubstage || currentSubstage === 'packing') {
        return { stage: 'dispatch' };
      }
      const currentIndex = PRODUCTION_STEPS.findIndex(s => s.key === currentSubstage);
      if (currentIndex < PRODUCTION_STEPS.length - 1) {
        return { stage: 'production', substage: PRODUCTION_STEPS[currentIndex + 1].key as SubStage };
      }
      return { stage: 'dispatch' };
    }
    if (currentStage === 'dispatch') return { stage: 'completed' };
    return null;
  };

  const nextStage = getNextStage();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Change Stage
          </DialogTitle>
          <DialogDescription>
            Current: {STAGE_LABELS[currentStage]}
            {currentSubstage && ` - ${currentSubstage}`}
          </DialogDescription>
        </DialogHeader>

        <TooltipProvider>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'stages' | 'quick')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="quick">Quick Actions</TabsTrigger>
              <TabsTrigger value="stages">All Stages</TabsTrigger>
            </TabsList>

            {/* Quick Actions Tab */}
            <TabsContent value="quick" className="space-y-4 mt-4">
              {/* Next Stage */}
              {nextStage && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      className="w-full justify-start h-auto py-3"
                      onClick={() => handleQuickAction(nextStage.stage, nextStage.substage)}
                    >
                      <ArrowRight className="h-4 w-4 mr-3" />
                      <div className="text-left">
                        <div className="font-medium">
                          Move to {STAGE_LABELS[nextStage.stage]}
                          {nextStage.substage && ` - ${nextStage.substage}`}
                        </div>
                        <div className="text-xs opacity-70">Next stage in workflow</div>
                      </div>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Advance to the next workflow stage</TooltipContent>
                </Tooltip>
              )}

              {/* Send to Production */}
              {currentStage !== 'production' && currentStage !== 'dispatch' && currentStage !== 'completed' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline"
                      className="w-full justify-start h-auto py-3"
                      onClick={() => handleQuickAction('production', 'foiling')}
                    >
                      <Factory className="h-4 w-4 mr-3" />
                      <div className="text-left">
                        <div className="font-medium">Send to Production</div>
                        <div className="text-xs text-muted-foreground">Start production workflow</div>
                      </div>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Skip to production stage</TooltipContent>
                </Tooltip>
              )}

              {/* Send to Dispatch */}
              {currentStage !== 'dispatch' && currentStage !== 'completed' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline"
                      className="w-full justify-start h-auto py-3"
                      onClick={() => handleQuickAction('dispatch')}
                    >
                      <Truck className="h-4 w-4 mr-3" />
                      <div className="text-left">
                        <div className="font-medium">Send to Dispatch</div>
                        <div className="text-xs text-muted-foreground">Ready for delivery</div>
                      </div>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Move directly to dispatch</TooltipContent>
                </Tooltip>
              )}

              {/* Mark Complete */}
              {currentStage !== 'completed' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline"
                      className="w-full justify-start h-auto py-3 border-green-500/50 hover:bg-green-500/10"
                      onClick={() => handleQuickAction('completed')}
                    >
                      <CheckCircle className="h-4 w-4 mr-3 text-green-500" />
                      <div className="text-left">
                        <div className="font-medium text-green-600 dark:text-green-400">Mark Complete</div>
                        <div className="text-xs text-muted-foreground">Order item completed</div>
                      </div>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Mark this item as completed</TooltipContent>
                </Tooltip>
              )}
            </TabsContent>

            {/* All Stages Tab */}
            <TabsContent value="stages" className="space-y-6 mt-4">
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
                            {stageIcons[stage]}
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

              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={handleChange}>
                  Update Stage
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
}
