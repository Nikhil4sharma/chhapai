import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Check, Play, RotateCcw, ChevronRight } from 'lucide-react';
import { PRODUCTION_STEPS } from '@/types/order';

interface ProductionStageControlProps {
    stages: string[];
    currentSubstage: string | null;
    substageStatus: 'pending' | 'in_progress' | 'completed';
    onStateChange: (substage: string, status: 'pending' | 'in_progress' | 'completed') => void;
    disabled?: boolean;
}

export function ProductionStageControl({
    stages,
    currentSubstage,
    substageStatus,
    onStateChange,
    disabled = false
}: ProductionStageControlProps) {

    // Resolve full stage objects
    const stageObjects = useMemo(() => {
        // If no stages defined, use default efficient fallback or show empty
        if (!stages || stages.length === 0) return PRODUCTION_STEPS;

        return stages.map(key => {
            const def = PRODUCTION_STEPS.find(s => s.key === key);
            return { key, label: def?.label || key };
        });
    }, [stages]);

    const currentIndex = useMemo(() => {
        if (!currentSubstage) return -1;
        return stageObjects.findIndex(s => s.key === currentSubstage);
    }, [stageObjects, currentSubstage]);

    const handleStart = (stageKey: string) => {
        onStateChange(stageKey, 'in_progress');
    };

    const handleComplete = (stageKey: string) => {
        onStateChange(stageKey, 'completed');

        // Auto-advance logic could be here or in parent. 
        // For specific granular control, let's keep it explicit for now, 
        // OR parent handles the "move to next" on effect.
        // Actually, "Complete" just marks it done. The NEXT stage start is a separate action?
        // User request: "click on process... option to start stage... complete foiling button"

        // If we complete, we should probably signal to move to next stage PENDING?
        // Let's passed 'completed' and let parent decide if it sets next stage to pending.

        // Wait, if I complete stage 1, stage 2 becomes ready.
        // I will let the parent handle the transition to next stage if this component emits "completed".
    };

    const handleRevert = () => {
        // Go back to previous stage or reset current
        if (substageStatus === 'in_progress' || substageStatus === 'completed') {
            if (currentSubstage) {
                onStateChange(currentSubstage, 'pending');
            }
        }
    };

    return (
        <div className="space-y-6 w-full">
            {/* Progress Visualization */}
            <div className="relative flex items-center justify-between w-full px-2">
                {/* Track Line */}
                <div className="absolute top-1/2 left-0 w-full h-1 bg-muted -z-10 rounded-full" />
                <div
                    className="absolute top-1/2 left-0 h-1 bg-primary transition-all duration-500 rounded-full -z-10"
                    style={{
                        width: `${currentIndex === -1 ? 0 : (currentIndex / (stageObjects.length - 1)) * 100}%`
                    }}
                />

                {stageObjects.map((stage, idx) => {
                    const isCompleted = idx < currentIndex || (idx === currentIndex && substageStatus === 'completed');
                    const isActive = idx === currentIndex && substageStatus === 'in_progress';
                    const isPending = idx > currentIndex || (idx === currentIndex && substageStatus === 'pending');

                    return (
                        <div key={stage.key} className="flex flex-col items-center gap-2 group cursor-default">
                            <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 z-10 bg-background",
                                isCompleted ? "border-primary bg-primary text-primary-foreground" :
                                    isActive ? "border-primary ring-4 ring-primary/20 scale-110" :
                                        "border-muted-foreground/30 text-muted-foreground"
                            )}>
                                {isCompleted ? <Check className="w-4 h-4" /> :
                                    isActive ? <Play className="w-3 h-3 fill-current animate-pulse" /> :
                                        <span className="text-[10px] font-medium">{idx + 1}</span>}
                            </div>
                            <span className={cn(
                                "text-[10px] font-medium uppercase tracking-wider absolute top-10 transition-colors bg-background/80 px-1 rounded-sm backdrop-blur-sm whitespace-nowrap",
                                isActive ? "text-primary font-bold" :
                                    isCompleted ? "text-foreground" :
                                        "text-muted-foreground"
                            )}>
                                {stage.label}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Active Stage Controls (Apple Style Card) */}
            <div className="mt-8 bg-muted/30 border border-border/50 rounded-2xl p-5 flex flex-col items-center justify-center text-center gap-4 transition-all hover:bg-muted/40">

                {currentIndex !== -1 && stageObjects[currentIndex] ? (
                    <>
                        <div className="space-y-1">
                            <h3 className="text-lg font-semibold tracking-tight flex items-center justify-center gap-2">
                                {stageObjects[currentIndex].label}
                                <span className={cn(
                                    "text-xs px-2 py-0.5 rounded-full uppercase font-bold",
                                    substageStatus === 'in_progress' ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                                        substageStatus === 'completed' ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                                            "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                                )}>
                                    {substageStatus.replace('_', ' ')}
                                </span>
                            </h3>
                            <p className="text-sm text-muted-foreground opacity-80 max-w-xs mx-auto">
                                {substageStatus === 'pending' ? "Ready to start processing." :
                                    substageStatus === 'in_progress' ? "Processing currently underway." :
                                        "Stage completed."}
                            </p>
                        </div>

                        <div className="flex items-center gap-3 w-full justify-center">
                            {substageStatus === 'pending' && (
                                <Button
                                    className="w-full max-w-[200px] rounded-full h-12 text-sm font-bold shadow-lg hover:scale-105 transition-transform"
                                    onClick={() => handleStart(stageObjects[currentIndex].key)}
                                >
                                    <Play className="w-4 h-4 mr-2" /> Start Processing
                                </Button>
                            )}

                            {substageStatus === 'in_progress' && (
                                <>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="rounded-full h-12 w-12 border-muted hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                                        onClick={handleRevert}
                                        title="Reset Stage"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        className="w-full max-w-[200px] rounded-full h-12 text-sm font-bold shadow-lg hover:scale-105 transition-transform bg-green-600 hover:bg-green-700 text-white"
                                        onClick={() => handleComplete(stageObjects[currentIndex].key)}
                                    >
                                        <Check className="w-4 h-4 mr-2" /> Complete {stageObjects[currentIndex].label}
                                    </Button>
                                </>
                            )}

                            {substageStatus === 'completed' && (
                                <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300 w-full">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-xs text-muted-foreground hover:text-foreground mb-4 h-6"
                                        onClick={handleRevert}
                                    >
                                        <RotateCcw className="w-3 h-3 mr-1" /> Reopen {stageObjects[currentIndex].label}
                                    </Button>

                                    {/* Explicit NEXT STAGE Action */}
                                    {currentIndex < stageObjects.length - 1 ? (
                                        <div className="w-full flex justify-center">
                                            {stageObjects[currentIndex + 1].key === 'packing' ? (
                                                <Button
                                                    className="w-full max-w-[240px] rounded-full h-14 text-base font-bold shadow-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all hover:scale-105 active:scale-95 animate-pulse"
                                                    onClick={() => handleStart('packing')}
                                                >
                                                    <div className="flex flex-col items-center leading-none">
                                                        <span className="text-[10px] opacity-80 uppercase tracking-widest font-medium mb-1">Final Stage</span>
                                                        <span className="flex items-center gap-2">Start Packing <ChevronRight className="w-4 h-4" /></span>
                                                    </div>
                                                </Button>
                                            ) : (
                                                <Button
                                                    className="w-full max-w-[240px] rounded-full h-12 text-sm font-bold shadow-md hover:scale-105 transition-transform"
                                                    onClick={() => handleStart(stageObjects[currentIndex + 1].key)}
                                                >
                                                    Start {stageObjects[currentIndex + 1].label} <ChevronRight className="w-4 h-4 ml-1" />
                                                </Button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="bg-green-50 dark:bg-green-950/30 border border-green-100 dark:border-green-900/50 px-6 py-4 rounded-xl text-center shadow-sm w-full animate-in slide-in-from-bottom-2">
                                            <p className="text-sm font-bold text-green-700 dark:text-green-400 flex items-center justify-center gap-2 mb-1">
                                                <Check className="w-4 h-4" />
                                                Workflow Complete
                                            </p>
                                            <p className="text-xs text-muted-foreground">Order is ready for dispatch.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="py-4 space-y-4">
                        <p className="text-muted-foreground">No active stage. Please start the first stage.</p>
                        {stageObjects.length > 0 && (
                            <Button
                                className="w-full max-w-[200px] rounded-full h-12 text-sm font-bold shadow-lg hover:scale-105 transition-transform"
                                onClick={() => handleStart(stageObjects[0].key)}
                            >
                                <Play className="w-4 h-4 mr-2" /> Start {stageObjects[0].label}
                            </Button>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
}
