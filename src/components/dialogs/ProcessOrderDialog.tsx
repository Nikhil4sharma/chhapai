import { useState, useMemo, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useWorkflow } from '@/contexts/WorkflowContext';
import { useOrders } from '@/features/orders/context/OrderContext';
import { useAuth } from '@/features/auth/context/AuthContext';
import { Order, OrderItem } from '@/types/order';
import { Department, ProductStatus } from '@/types/workflow';
import { supabase } from '@/integrations/supabase/client';
import {
    Loader2,
    ArrowRight,
    CheckCircle2,
    Palette,
    Users,
    Truck,
    Factory,
    ShoppingBag,
    Settings,
    Briefcase,
    Layers,
    ScrollText,
    XCircle
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { PaperSelector } from '@/features/inventory/components/PaperSelector';
import { PaperInventory } from '@/services/inventory';
import { Input } from '@/components/ui/input';

interface ProcessOrderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    order: Order;
    item: OrderItem;
}

export function ProcessOrderDialog({ open, onOpenChange, order, item }: ProcessOrderDialogProps) {
    const { config, productionStages } = useWorkflow();
    const { user } = useAuth();
    const { assignToUser, refreshOrders } = useOrders();

    const [selectedDept, setSelectedDept] = useState<Department>(
        (item.assigned_department as Department) || (item.current_stage as Department) || 'sales'
    );
    const [selectedStatus, setSelectedStatus] = useState<ProductStatus | ''>('');
    const [selectedUser, setSelectedUser] = useState<string>('');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [availableUsers, setAvailableUsers] = useState<{ id: string, name: string }[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);

    // Production Specific State
    const [selectedProductionStages, setSelectedProductionStages] = useState<string[]>([]);
    const [selectedPaper, setSelectedPaper] = useState<PaperInventory | null>(null);
    const [paperQty, setPaperQty] = useState<number>(0);
    const [activeBrief, setActiveBrief] = useState('');

    const [approvalAction, setApprovalAction] = useState<'approve' | 'reject' | null>(null);

    // Initial state setup & Smart Defaults Logic
    useEffect(() => {
        if (open) {
            const currentDept = (item.assigned_department as Department) || (item.current_stage as Department) || 'sales';
            const currentStatus = item.status as ProductStatus;

            // SMART DEFAULTS LOGIC
            let defaultTargetDept = currentDept;
            let defaultTargetStatus: ProductStatus | '' = '';

            // Logic: Sales (New Order) -> Design
            if (currentDept === 'sales' && currentStatus === 'new_order') {
                defaultTargetDept = 'design';
                defaultTargetStatus = 'design_in_progress';
            }
            // Logic: Design (In Progress) -> Sales (Pending Approval)
            else if (currentDept === 'design' && currentStatus === 'design_in_progress') {
                defaultTargetDept = 'sales';
                defaultTargetStatus = 'pending_for_customer_approval';
            }
            // Logic: Prepress (In Progress) -> Sales (Pending Approval)
            else if (currentDept === 'prepress' && currentStatus === 'prepress_in_progress') {
                defaultTargetDept = 'sales';
                defaultTargetStatus = 'pending_for_customer_approval';
            }
            // Logic: Production -> Ready for Dispatch
            else if (currentDept === 'production' && currentStatus === 'in_production') {
                defaultTargetDept = 'production';
                defaultTargetStatus = 'ready_for_dispatch';
            }

            // Apply defaults if available, otherwise fallback to current
            setSelectedDept(defaultTargetDept);

            // Validate status exists in target dept
            const targetDeptConfig = config[defaultTargetDept];
            const statusExists = targetDeptConfig?.statuses.some(s => s.value === defaultTargetStatus);

            if (statusExists && defaultTargetStatus) {
                setSelectedStatus(defaultTargetStatus);
            } else {
                if (targetDeptConfig?.statuses.length > 0) {
                    setSelectedStatus(targetDeptConfig.statuses[0].value);
                } else {
                    setSelectedStatus('');
                }
            }

            setSelectedUser(item.assigned_to || '');
            setNotes('');

            // Production Defaults
            setSelectedProductionStages(item.production_stage_sequence || []);
            setSelectedPaper(null);
            setPaperQty(0);
            setActiveBrief(item.specifications?.design_brief || '');
            setApprovalAction(null);
        }
    }, [open, item, config]);

    const deptConfig = config[selectedDept];

    // Helper: When manually changing department, auto-select first logical status
    useEffect(() => {
        if (!open) return;

        // Approval Mode Override: If rejecting/approving, status is fixed
        if (approvalAction === 'reject') {
            setSelectedStatus('design_in_progress'); // Return to work
            return;
        }
        if (approvalAction === 'approve') {
            setSelectedStatus('customer_approved'); // Or generic approved
            return;
        }

        const isValid = deptConfig?.statuses.some(s => s.value === selectedStatus);
        if (!isValid && deptConfig?.statuses.length > 0) {
            setSelectedStatus(deptConfig.statuses[0].value);
        }

        if (selectedDept === 'production') {
            setSelectedStatus('in_production');
        }
    }, [selectedDept, deptConfig, selectedStatus, open, approvalAction]);

    // ... (Keep existing fetchUsers useEffect) ...

    const toggleProductionStage = (stageKey: string) => {
        if (selectedProductionStages.includes(stageKey)) {
            setSelectedProductionStages(prev => prev.filter(k => k !== stageKey));
        } else {
            // Find index to insert correctly based on config order unique to stages
            const allStageKeys = productionStages.map(s => s.key);
            const newSelection = [...selectedProductionStages, stageKey].sort((a, b) => {
                return allStageKeys.indexOf(a) - allStageKeys.indexOf(b);
            });
            setSelectedProductionStages(newSelection);
        }
    };

    const handleProcess = async () => {
        if (!user?.id || !order.id || !selectedStatus) return;

        // Validation for Approval Mode
        if (item.status === 'pending_for_customer_approval' && !approvalAction) {
            // Should not happen if UI is correct
            return;
        }
        if (approvalAction && !notes) {
            toast({ title: "Note Required", description: "Please add a note explaining the decision.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        try {
            const paperNote = selectedPaper && paperQty > 0
                ? `\n\n[Material Allocated]\nPaper: ${selectedPaper.name} (${selectedPaper.gsm} GSM)\nQty: ${paperQty} Sheets`
                : '';

            // If approval action, prepend decision to note
            const decisionNote = approvalAction
                ? `[${approvalAction.toUpperCase()}] ${notes}`
                : notes;

            const finalNotes = decisionNote + paperNote;

            const updateData: any = {
                status: selectedStatus,
                current_stage: selectedDept,
                assigned_department: selectedDept,
                updated_at: new Date().toISOString(),
                // Update the persisted last note if explicitly processing (especially approval)
                last_workflow_note: finalNotes
            };

            // ... (Keep existing production/specs update logic) ...
            if (selectedDept === 'production') {
                updateData.production_stage_sequence = selectedProductionStages;
            }
            if (activeBrief) {
                const newSpecs = { ...item.specifications, design_brief: activeBrief };
                updateData.specifications = newSpecs;
            }

            const { error: moveError } = await supabase
                .from('order_items')
                .update(updateData)
                .eq('id', item.item_id);

            if (moveError) throw moveError;

            // ... (Keep existing user assignment logic) ...
            if (selectedUser === '_unassign') {
                await supabase.from('order_items').update({ assigned_to: null }).eq('id', item.item_id);
            } else if (selectedUser && selectedUser !== item.assigned_to) {
                await assignToUser(order.order_id, item.item_id, selectedUser, availableUsers.find(u => u.id === selectedUser)?.name || 'User');
            }

            // 3. Log to Timeline
            await supabase.from('timeline').insert({
                order_id: order.id,
                item_id: item.item_id,
                product_name: item.product_name,
                stage: selectedDept,
                action: approvalAction ? (approvalAction === 'approve' ? 'customer_approved' : 'status_changed') : 'process_order_manual',
                performed_by: user.id,
                performed_by_name: 'User',
                notes: `Processed to ${selectedDept} (${selectedStatus}). ${finalNotes}`
            });

            toast({ title: "Order Processed", description: `Moved to ${selectedDept}`, className: "bg-green-500 text-white" });
            await refreshOrders();
            onOpenChange(false);

        } catch (error: any) {
            console.error("Process failed", error);
            toast({ title: "Error", description: error.message || "Failed to process order", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const departmentIcons: Record<string, any> = {
        sales: ShoppingBag,
        design: Palette,
        prepress: CheckCircle2,
        production: Factory,
        outsource: Briefcase,
        dispatch: Truck
    };

    const currentConfig = Object.values(config);
    const isProduction = selectedDept === 'production';

    // Strict Navigation Paths (State Machine Enforcement)
    const allowedTransitions: Record<string, string[]> = {
        sales: ['design', 'prepress', 'outsource', 'production', 'sales'], // Sales can correct itself or move anywhere
        design: ['sales', 'prepress'], // Approval or Next Stage
        prepress: ['sales', 'production', 'outsource'], // Proof, Next Stage, or Overflow
        outsource: ['sales', 'prepress', 'production'], // Approval, QC, or Next
        production: ['production', 'sales'], // Internal steps or Dispatch
    };

    const currentStage = (item.assigned_department as Department) || (item.current_stage as Department) || 'sales';
    const visibleDepartments = useMemo(() => {
        const allowed = allowedTransitions[currentStage] || Object.keys(departmentIcons);
        // Always include current dept to allow status updates within same dept
        const set = new Set([...allowed, currentStage]);
        return Object.values(config).filter(d => set.has(d.id));
    }, [config, currentStage]);

    // Filter Statuses: Remove 'new_order' from target options
    const visibleStatuses = useMemo(() => {
        if (!deptConfig) return [];
        return deptConfig.statuses.filter(s => s.value !== 'new_order');
    }, [deptConfig]);

    const isApprovalMode = item.status === 'pending_for_customer_approval';

    // Handle Approval Actions
    const handleApprovalAction = (action: 'approve' | 'reject') => {
        setApprovalAction(action);
        if (action === 'reject') {
            setSelectedDept('design'); // Back to design
            setSelectedStatus('design_in_progress'); // Rejected, so rework
        } else {
            setSelectedDept('design'); // Back to design
            setSelectedStatus('customer_approved'); // Approved
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[650px] p-0 gap-0 overflow-hidden shadow-2xl bg-background/95 backdrop-blur-xl border-border">

                {/* Header */}
                <div className={cn(
                    "relative p-6 pb-6 border-b border-border/40",
                    isApprovalMode ? "bg-amber-50/50 dark:bg-amber-950/20" : "bg-muted/20"
                )}>
                    <DialogHeader className="gap-2">
                        <div className="flex items-center justify-between">
                            <DialogTitle className="text-xl font-medium tracking-tight text-foreground flex items-center gap-2">
                                <div className={cn(
                                    "p-2 rounded-lg border",
                                    isApprovalMode
                                        ? "bg-amber-100 border-amber-200 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                                        : "bg-primary/10 border-primary/20 text-primary"
                                )}>
                                    {isApprovalMode ? <ScrollText className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
                                </div>
                                {isApprovalMode ? "Customer Approval" : "Process Order"}
                                <span className="text-muted-foreground mx-2">•</span>
                                <span className="text-base text-muted-foreground font-normal">{item.product_name}</span>
                            </DialogTitle>
                        </div>
                        <DialogDescription className="text-muted-foreground ml-1">
                            {isApprovalMode
                                ? "Review the design and either Approve or Reject with feedback."
                                : "Move this item to the next workflow stage and assign team members."
                            }
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="flex flex-col gap-6 p-6 overflow-y-auto max-h-[70vh]">

                    {/* APPROVAL MODE UI */}
                    {isApprovalMode ? (
                        <div className="space-y-6">
                            {/* Decision Buttons */}
                            <div className="grid grid-cols-2 gap-4">
                                <Button
                                    size="lg"
                                    variant="outline"
                                    onClick={() => handleApprovalAction('reject')}
                                    className={cn(
                                        "h-20 border-2 flex flex-col gap-1 items-center justify-center hover:bg-destructive/5 hover:text-destructive hover:border-destructive/50 transition-all",
                                        approvalAction === 'reject' ? "border-destructive bg-destructive/10 text-destructive ring-1 ring-destructive" : ""
                                    )}
                                >
                                    <div className="p-2 rounded-full bg-destructive/10"><Truck className="w-5 h-5" /></div> {/* Reuse icon or generic X */}
                                    <span className="font-bold">Reject & Revision</span>
                                </Button>
                                <Button
                                    size="lg"
                                    variant="outline"
                                    onClick={() => handleApprovalAction('approve')}
                                    className={cn(
                                        "h-20 border-2 flex flex-col gap-1 items-center justify-center hover:bg-green-50 hover:text-green-600 hover:border-green-500/50 dark:hover:bg-green-950/20 transition-all",
                                        approvalAction === 'approve' ? "border-green-500 bg-green-50 text-green-700 ring-1 ring-green-500" : ""
                                    )}
                                >
                                    <div className="p-2 rounded-full bg-green-100 text-green-700"><CheckCircle2 className="w-5 h-5" /></div>
                                    <span className="font-bold">Approve Design</span>
                                </Button>
                            </div>

                            {/* Context Info */}
                            {approvalAction && (
                                <div className={cn(
                                    "p-4 rounded-lg border text-sm",
                                    approvalAction === 'reject' ? "bg-destructive/5 border-destructive/20 text-destructive" : "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/10 dark:text-green-400"
                                )}>
                                    <strong>{approvalAction === 'reject' ? "Sending back to Design for revisions." : "Design marked as Approved. Returning to Design for next steps."}</strong>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* STANDARD MODE UI */
                        <>
                            {/* Department Selection Grid */}
                            <div className="space-y-3">
                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Select Destination</Label>
                                <RadioGroup value={selectedDept} onValueChange={(v) => { setSelectedDept(v as Department); }} className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {visibleDepartments.map((dept) => {
                                        const Icon = departmentIcons[dept.id] || Settings;
                                        const isSelected = selectedDept === dept.id;

                                        // Semantic colors for states
                                        const activeColorClass = isSelected
                                            ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                                            : "border-border bg-card hover:bg-muted/50 text-muted-foreground";

                                        return (
                                            <div key={dept.id}> {/* Unique key wrapper */}
                                                <Label
                                                    htmlFor={dept.id}
                                                    className={cn(
                                                        "relative flex flex-col gap-3 p-4 rounded-xl border cursor-pointer transition-all duration-200 group h-full",
                                                        activeColorClass
                                                    )}
                                                >
                                                    <RadioGroupItem value={dept.id} id={dept.id} className="sr-only" />

                                                    <div className="flex items-start justify-between">
                                                        <div className={cn(
                                                            "p-2 rounded-full transition-all duration-300",
                                                            isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground group-hover:bg-muted/80"
                                                        )}>
                                                            <Icon className="w-5 h-5" />
                                                        </div>
                                                        {isSelected && <div className="w-2 h-2 rounded-full bg-primary shadow-sm" />}
                                                    </div>

                                                    <div>
                                                        <p className={cn("font-medium text-sm transition-colors", isSelected ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")}>
                                                            {dept.label}
                                                        </p>
                                                    </div>
                                                </Label>
                                            </div>
                                        );
                                    })}
                                </RadioGroup>
                            </div>
                        </>
                    )}


                    {/* PRODUCTION SPECIFIC UI (Hide in Approval Mode) */}
                    {isProduction && !isApprovalMode && (
                        <div className="space-y-6 animate-in slide-in-from-top-2 duration-300">
                            {/* Production Stages Multi-Select */}
                            <div className="space-y-3">
                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1 flex items-center gap-2">
                                    <Layers className="w-3.5 h-3.5" />
                                    Production Operations
                                </Label>
                                <div className="flex flex-wrap gap-2">
                                    {productionStages.map((stage) => {
                                        const isSelected = selectedProductionStages.includes(stage.key);
                                        return (
                                            <div
                                                key={stage.key}
                                                onClick={() => toggleProductionStage(stage.key)}
                                                className={cn(
                                                    "cursor-pointer px-3 py-1.5 rounded-full text-sm font-medium border transition-all select-none flex items-center gap-1.5",
                                                    isSelected
                                                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                                        : "bg-background border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                                                )}
                                            >
                                                {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                                                {stage.label}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Paper Selection */}
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
                                                value={paperQty || ''}
                                                onChange={(e) => setPaperQty(Number(e.target.value))}
                                                className="bg-background"
                                            />
                                            <span className="absolute right-3 top-2.5 text-xs text-muted-foreground pointer-events-none">Sheets</span>
                                        </div>
                                    </div>
                                </div>
                                {selectedPaper && (
                                    <div className="text-[10px] text-muted-foreground pl-1">
                                        Selected: <span className="font-medium text-foreground">{selectedPaper.name}</span> ({selectedPaper.gsm} GSM) — {selectedPaper.available_sheets} Available
                                    </div>
                                )}
                            </div>
                        </div>
                    )}


                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Status Selection - Hide in Approval Mode */}
                        {!isProduction && !isApprovalMode && (
                            <div className="space-y-3">
                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Set Status</Label>
                                <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as ProductStatus)}>
                                    <SelectTrigger className="h-11 bg-background border-input focus:ring-primary/20 transition-all hover:bg-muted/50">
                                        <SelectValue placeholder="Select Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {visibleStatuses.map((s) => (
                                            <SelectItem key={s.value} value={s.value}>
                                                <div className="flex items-center gap-2">
                                                    <div className={cn("w-1.5 h-1.5 rounded-full", s.color?.includes('red') ? 'bg-destructive' : s.color?.includes('green') ? 'bg-green-500' : 'bg-blue-500')} />
                                                    {s.label}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Assign User - Hide in Approval Mode (Auto-assign typically) */}
                        {!isApprovalMode && (
                            <div className="space-y-3">
                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Assign User</Label>
                                <Select value={selectedUser} onValueChange={setSelectedUser}>
                                    <SelectTrigger disabled={isLoadingUsers} className="h-11 bg-background border-input focus:ring-primary/20 transition-all hover:bg-muted/50">
                                        <div className="flex items-center gap-2">
                                            <Users className="w-4 h-4 text-muted-foreground" />
                                            <SelectValue placeholder={isLoadingUsers ? "Loading..." : "Unassign"} />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="_unassign" className="text-muted-foreground">-- Unassign --</SelectItem>
                                        {availableUsers.map((u) => (
                                            <SelectItem key={u.id} value={u.id}>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-primary/10 text-[10px] flex items-center justify-center text-primary font-bold">
                                                        {u.name.charAt(0)}
                                                    </div>
                                                    {u.name}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    {/* Design Brief Input - Only for Sales/Design transitions or if target is Design */}
                    {!isApprovalMode && (selectedDept === 'design' || (selectedDept === 'sales' && order.items.some(i => i.current_stage === 'design'))) && (
                        <div className="space-y-3">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">
                                Design Brief & Requirements
                            </Label>
                            <Textarea
                                placeholder="Enter initial design requirements, color preferences, etc..."
                                value={activeBrief}
                                onChange={(e) => setActiveBrief(e.target.value)}
                                className="min-h-[100px] bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/50 focus:ring-indigo-500/20"
                            />
                        </div>
                    )}

                    {/* Notes */}
                    <div className="space-y-3">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">
                            {isApprovalMode ? "Decision Notes (Sent to Design Team)" : "Instructions / Notes"}
                        </Label>
                        <div className="relative">
                            <Textarea
                                placeholder={isApprovalMode
                                    ? (approvalAction === 'reject' ? "Reason for rejection (Required)..." : "Approval notes (Optional but recommended)...")
                                    : `Start typing instructions for ${deptConfig?.label || 'team'}...`
                                }
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className={cn(
                                    "min-h-[80px] bg-background border-input placeholder:text-muted-foreground/40 resize-none focus:ring-primary/20 focus:border-primary transition-all pl-9 py-3",
                                    (isApprovalMode && approvalAction === 'reject' && !notes) ? "border-red-200 focus:border-red-500" : ""
                                )}
                            />
                            <div className="absolute top-3 left-3 text-muted-foreground/40">
                                {isApprovalMode
                                    ? (approvalAction === 'reject' ? <XCircle className="w-4 h-4 text-destructive" /> : <CheckCircle2 className="w-4 h-4 text-green-600" />)
                                    : <CheckCircle2 className="w-4 h-4" />
                                }
                            </div>
                        </div>
                    </div>

                </div>

                <DialogFooter className="p-6 pt-4 bg-muted/20 border-t border-border/50">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button
                        onClick={handleProcess}
                        disabled={isSubmitting || !selectedStatus}
                        className="h-10 px-8 shadow-lg transition-all duration-300 font-medium"
                    >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                        Confirm Move
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
