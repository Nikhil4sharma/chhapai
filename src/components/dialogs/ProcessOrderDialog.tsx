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
    XCircle,
    ScrollText,
    RotateCcw
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ProductionFlow } from './process/ProductionFlow';
import { DispatchFlow } from './process/DispatchFlow';
import { OutsourceFlow } from './process/OutsourceFlow';
import { ProductionStageControl } from '@/features/orders/components/ProductionStageControl';
import { PRODUCTION_STEPS, SubStage } from '@/types/order';
import { WORKFLOW_CONFIG } from '@/types/workflow';
import { MaterialManagement } from '@/features/orders/components/MaterialManagement';

interface ProcessOrderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    order: Order;
    item: OrderItem;
    actionType?: 'process' | 'approve' | 'reject';
}

export function ProcessOrderDialog({ open, onOpenChange, order, item, actionType = 'process' }: ProcessOrderDialogProps) {
    const { config } = useWorkflow();
    const { user } = useAuth();
    const { assignToUser, refreshOrders, assignToOutsource, markAsDispatched } = useOrders();

    // -- State --
    const [selectedDept, setSelectedDept] = useState<Department>('sales');
    const [selectedStatus, setSelectedStatus] = useState<ProductStatus | ''>('');
    const [selectedUser, setSelectedUser] = useState<string>('');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // -- Data Collection State --

    const [productionStages, setProductionStages] = useState<string[]>([]);
    const [currentSubstage, setCurrentSubstage] = useState<string | null>(null);
    const [substageStatus, setSubstageStatus] = useState<'pending' | 'in_progress' | 'completed'>('pending');

    const [paperSelection, setPaperSelection] = useState<{ paper: any, qty: number } | null>(null);
    const [dispatchData, setDispatchData] = useState<any>(null);
    const [outsourceData, setOutsourceData] = useState<any>(null);

    // -- Validation State --
    const [isValid, setIsValid] = useState(true);

    // -- Approval Mode State --
    const [approvalAction, setApprovalAction] = useState<'approve' | 'reject' | null>(null);

    // -- Initialization --
    useEffect(() => {
        if (open) {
            const current = (item.assigned_department as Department) || (item.current_stage as Department) || 'sales';
            const status = item.status as ProductStatus;

            // Default Transition Logic
            let targetDept = current;
            let targetStatus: ProductStatus | '' = '';

            // Logic: Sales (New) -> Design
            if (current === 'sales' && status === 'new_order') {
                targetDept = 'design';
                targetStatus = 'design_in_progress';
            }
            // Logic: Production (In Prod) -> Ready for Dispatch
            else if (current === 'production' && status === 'production_in_progress') {
                targetDept = 'production';
                targetStatus = 'ready_for_dispatch';
            }
            // Ready for Dispatch -> Dispatched
            else if (current === 'production' && status === 'ready_for_dispatch') {
                targetDept = 'production';
                targetStatus = 'dispatched'; // This triggers Finalize Mode in DispatchFlow?
                // Actually if it's 'ready_for_dispatch', the next logical step is Dispatched.
            }
            // SMART SELECTION: Default Statuses based on Destination
            if (targetDept === 'sales') {
                targetStatus = 'pending_for_customer_approval';
            } else if (targetDept === 'prepress') {
                targetStatus = 'prepress_in_progress';
            } else if (targetDept === 'production') {
                targetStatus = 'production_in_progress';
            } else {
                // Try to find first valid status in current dept
                const deptConf = config[targetDept];
                if (deptConf?.statuses.length) targetStatus = deptConf.statuses[0].value;
            }

            setSelectedDept(targetDept);
            setSelectedStatus(targetStatus);
            setSelectedUser(item.assigned_to || '');
            setNotes('');
            setApprovalAction(null);
            setIsValid(true);

            // Reset Flow Data
            // FIX: Default to all PRODUCTION_STEPS if sequence is empty, ensuring 'Packing' and others are present by default
            const initialStages = (item.production_stage_sequence && item.production_stage_sequence.length > 0)
                ? item.production_stage_sequence
                : PRODUCTION_STEPS.map(s => s.key);

            setProductionStages(initialStages);
            setCurrentSubstage(item.current_substage || null);
            setSubstageStatus(item.substage_status || 'pending'); // Ensure substage_status is available in types/item

            // AUTO-FILL PREVIOUS SENDER (Smart Redirection)
            if (actionType === 'approve' || actionType === 'reject' || item.status === 'pending_for_customer_approval' || item.status === 'pending_client_approval') {
                if (item.previous_department && item.previous_department !== 'sales') {
                    // TRUSTED PREVIOUS DEPARTMENT (Only if not Sales itself)
                    console.log("Reverting to previous dept:", item.previous_department);
                    setSelectedDept(item.previous_department);

                    // Specific Status based on Action
                    if (actionType === 'approve') {
                        setSelectedStatus('approved');
                    } else if (actionType === 'reject') {
                        if (item.previous_department === 'design') setSelectedStatus('rejected');
                        else if (item.previous_department === 'prepress') setSelectedStatus('prepress_in_progress');
                    }
                } else {
                    // FALLBACK INTUITIVE LOGIC (If previous is missing or is sales)
                    console.log("No valid previous dept, inferring...");
                    // Default to Design if needed, otherwise Prepress
                    const inferDept = item.need_design ? 'design' : 'prepress';

                    setSelectedDept(inferDept);

                    if (actionType === 'approve') setSelectedStatus(inferDept === 'design' ? 'approved' : 'prepress_in_progress');
                    else if (actionType === 'reject') setSelectedStatus(inferDept === 'design' ? 'rejected' : 'prepress_in_progress');

                    // CRITICAL: Unassign user so it goes to "Unassigned" pool of target dept
                    setSelectedUser('_unassign');
                }

                if (item.previous_assigned_to) {
                    setSelectedUser(item.previous_assigned_to);
                }
            }

            // REMOVE OLD FALLBACK BLOCK (It is now integrated above)

            // (Previous fallback block removed as it is handled in the main block now)

            // DIRECT ACTION LOGIC: If triggered from specific dashboard button, set approvalAction immediately
            if (actionType === 'approve') {
                setApprovalAction('approve');
            } else if (actionType === 'reject') {
                setApprovalAction('reject');
            }

        }
    }, [open, item, config, actionType]);

    // -- Computed --
    const currentDept = (item.assigned_department as Department) || 'sales';
    const isApprovalState = item.status === 'pending_for_customer_approval' || item.status === 'pending_client_approval';
    const isApprovalMode = actionType === 'approve' || actionType === 'reject' || isApprovalState;

    // Determine which specialized flow to show
    const showProductionFlow = selectedDept === 'production' && !isApprovalMode && selectedStatus !== 'dispatched' && selectedStatus !== 'delivered';
    const showDispatchDecision = selectedDept === 'sales' && selectedStatus === 'ready_for_dispatch'; // Legacy flow or Sales Dispatch?
    // Actually, user said: Sales clicks Process on Ready to Dispatch -> Show Dispatch Mode
    // So if item is Sales + Ready to Dispatch, we show DispatchFlow.
    const isReadyToDispatch = item.department === 'sales' && item.status === 'ready_for_dispatch';
    const showDispatchFinalize = selectedDept === 'production' && selectedStatus === 'dispatched';
    const showOutsourceFlow = selectedDept === 'outsource';

    // -- Handlers --

    const handleProcess = async () => {
        if (!user?.id || !order.id) return;

        // 0. MANDATORY NOTES CHECK (Every action needs a note now for traceability)
        if (!notes.trim()) {
            toast({
                title: "Note Required",
                description: "Please provide a note or instruction for this transition.",
                variant: "destructive"
            });
            return;
        }

        setIsSubmitting(true);
        try {
            // 1. Handle Outsource
            // 1. Handle Outsource
            if (showOutsourceFlow) {
                if (!outsourceData) throw new Error("Missing outsource details");

                // Save New Vendor Logic
                if (outsourceData.saveVendor) {
                    const { error: vendorErr } = await supabase.from('vendors').insert({
                        vendor_name: outsourceData.vendor.vendor_name,
                        contact_person: outsourceData.vendor.contact_person,
                        phone: outsourceData.vendor.phone,
                        // Add defaults for required fields if any, schema check suggests others are optional
                    });

                    if (vendorErr) {
                        console.error("Failed to save new vendor:", vendorErr);
                        toast({ title: "Warning", description: "Failed to save new vendor to list, but proceeding with order.", variant: "destructive" });
                    } else {
                        toast({ title: "Vendor Saved", description: "New vendor added for future use." });
                    }
                }

                await assignToOutsource(order.id, item.item_id, outsourceData.vendor, outsourceData.job);
                // Assign Outsource sets department internally usually, but we might want to ensure notes
            }
            // 2. Handle Dispatch Finalize (Production -> Dispatched)
            else if (showDispatchFinalize) {
                if (!dispatchData) throw new Error("Missing dispatch details");
                await markAsDispatched(order.id, item.item_id, {
                    courier_company: dispatchData.courier_company,
                    tracking_number: dispatchData.tracking_number,
                    dispatch_date: dispatchData.dispatch_date
                });
            }
            // 3. General Move
            else {
                // Build Final Notes
                let finalNotes = notes;
                if (paperSelection && paperSelection.qty > 0) {
                    finalNotes += `\n\n[Material Allocated]\nPaper: ${paperSelection.paper.name}\nQty: ${paperSelection.qty}`;
                }
                if (approvalAction) {
                    finalNotes = `[${approvalAction.toUpperCase()}] ${finalNotes}`;
                }

                // WARNING: Do NOT override statusToApply here with hardcoded values. 
                // Rely on selectedStatus which is correctly set by useEffect logic above.
                let statusToApply = selectedStatus;

                // Only override if absolutely necessary and not already set.
                if (actionType === 'approve' && isApprovalState && !statusToApply) statusToApply = 'approved';

                // For reject, selectedStatus should already be 'rejected' or 'prepress_in_progress' via useEffect.
                // We keep it as is.

                const updateData: any = {
                    status: statusToApply,
                    current_stage: selectedDept,
                    assigned_department: selectedDept,
                    // FIX: Convert '_unassign' sentinel to null for DB UUID field
                    assigned_to: (selectedUser && selectedUser !== '_unassign') ? selectedUser : null,
                    updated_at: new Date().toISOString(),
                    last_workflow_note: finalNotes
                };

                if (showProductionFlow) {
                    updateData.production_stage_sequence = productionStages;

                    // Auto-init first stage if not set (Setup Mode)
                    if (productionStages.length > 0) {
                        if (!currentSubstage || !productionStages.includes(currentSubstage)) {
                            updateData.current_substage = productionStages[0];
                            updateData.substage_status = 'pending';
                        } else {
                            if (currentSubstage) updateData.current_substage = currentSubstage;
                            if (substageStatus) updateData.substage_status = substageStatus;
                        }
                    } else {
                        // Clear if empty
                        updateData.current_substage = null;
                        updateData.substage_status = null;
                    }
                }

                // CRITICAL: Save History when sending to Sales for Approval
                // This ensures we know who to return it to (Smart Redirection)
                if (selectedDept === 'sales' || statusToApply === 'pending_for_customer_approval' || statusToApply === 'pending_client_approval') {
                    // Only save if we are moving FROM a different dept
                    if (currentDept !== 'sales') {
                        updateData.previous_department = currentDept;
                        updateData.previous_assigned_to = item.assigned_to;
                    }
                }


                // Dispatch Decision (Sales) logic
                if (isReadyToDispatch) { // Waiting for pickup or pending
                    // Mapping local dispatchData status to updateData
                    if (dispatchData?.status) updateData.status = dispatchData.status;
                    if (dispatchData?.status === 'dispatch_pending') {
                        updateData.current_stage = 'production'; // Send back to Prod per specs
                        updateData.assigned_department = 'production';
                    }

                    // SAVE Dispatch Info to ORDERS table (Order Level)
                    if (dispatchData) {
                        const dispatchUpdate: any = {};
                        if (dispatchData.courier_company) {
                            dispatchUpdate.dispatch_info = {
                                ...order.dispatch_info,
                                courier_company: dispatchData.courier_company,
                                is_express: dispatchData.is_express
                            };
                            dispatchUpdate.shipping_method = 'courier';
                        } else if (dispatchData.mode === 'pickup') {
                            dispatchUpdate.shipping_method = 'pickup';
                        }

                        if (Object.keys(dispatchUpdate).length > 0) {
                            await supabase.from('orders').update(dispatchUpdate).eq('id', order.id);
                        }
                    }
                }

                // Update Item
                const { error: moveError } = await supabase
                    .from('order_items')
                    .update(updateData)
                    .eq('id', item.item_id);

                if (moveError) throw moveError;

                // Log Timeline
                await supabase.from('timeline').insert({
                    order_id: order.id,
                    item_id: item.item_id,
                    product_name: item.product_name,
                    stage: selectedDept,
                    action: approvalAction ? (approvalAction === 'approve' ? 'customer_approved' : 'status_changed') : 'status_changed',
                    performed_by: user.id,
                    performed_by_name: 'User', // TODO check context/profile
                    notes: `Moved to ${selectedDept}. ${finalNotes}`
                });
            }

            toast({ title: "Updated", description: "Workflow updated successfully", className: "bg-green-500 text-white" });
            await refreshOrders();
            onOpenChange(false);

        } catch (error: any) {
            console.error("Process error:", error);
            toast({ title: "Error", description: error.message || "Failed", variant: "destructive" });
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

    // Define config for current selected department
    const workflowConfigForDept = WORKFLOW_CONFIG[selectedDept as keyof typeof WORKFLOW_CONFIG] || WORKFLOW_CONFIG.sales;

    // AVAILABLE USER FETCHING
    const [availableUsers, setAvailableUsers] = useState<{ id: string, name: string }[]>([]);
    useEffect(() => {
        const fetchUsers = async () => {
            // Only fetch if not approval mode or specific strict flows
            if (isApprovalMode) return;

            // FETCHING FIX: Query profiles directly like useCreateOrder
            // This avoids the complex join and seems more reliable in this codebase
            const { data } = await supabase
                .from('profiles')
                .select('user_id, full_name, department')
                .eq('department', selectedDept); // Assuming 'department' column exists in profiles and matches selectedDept values

            if (data) {
                const users = data.map(p => ({
                    id: p.user_id, // Note: profiles uses user_id
                    name: p.full_name || 'Unknown'
                }));
                setAvailableUsers(users);
            } else {
                setAvailableUsers([]);
            }
        };
        fetchUsers();
    }, [selectedDept, isApprovalMode]);

    // Auto-advance to "Ready for Dispatch" if last stage completed
    useEffect(() => {
        if (substageStatus === 'completed' && currentSubstage && productionStages.length > 0) {
            const currentIndex = productionStages.indexOf(currentSubstage);
            if (currentIndex === productionStages.length - 1) {
                // Last stage completed
                if (workflowConfigForDept) {
                    const readyStatus = workflowConfigForDept.statuses.find(s => s.value === 'ready_for_dispatch');
                    if (readyStatus) {
                        setSelectedStatus('ready_for_dispatch');
                    }
                }
            } else {
                // Optional: Auto-move to next stage? 
                // User might want manual control. Staying on "completed" allows them to review before moving.
                // But we could set the "Next" stage as active if we wanted.
            }
        }
    }, [substageStatus, currentSubstage, productionStages, workflowConfigForDept]);


    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] p-0 gap-0 overflow-hidden shadow-2xl bg-background/95 backdrop-blur-xl border-border">

                {/* Header */}
                <div className={cn(
                    "relative p-6 pb-6 border-b border-border/40 transition-colors duration-300",
                    actionType === 'approve' ? "bg-green-50/50 dark:bg-green-950/20" :
                        actionType === 'reject' ? "bg-red-50/50 dark:bg-red-950/20" :
                            isApprovalMode ? "bg-amber-50/50" : "bg-muted/20"
                )}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl tracking-tight">
                            {actionType === 'approve' ? <CheckCircle2 className="w-5 h-5 text-green-600" /> :
                                actionType === 'reject' ? <XCircle className="w-5 h-5 text-red-600" /> :
                                    <Settings className="w-5 h-5 text-primary" />}
                            {actionType === 'approve' ? "Approve Design" :
                                actionType === 'reject' ? "Reject & Revision" : "Process Order"}
                            <span className="text-muted-foreground/40 font-light mx-1">/</span>
                            <span className="text-foreground/90 font-medium">{item.product_name}</span>
                        </DialogTitle>
                        <DialogDescription className="text-sm font-medium opacity-80">
                            Current: <span className="text-foreground capitalize">{currentDept}</span> • {item.status?.replace(/_/g, ' ')}
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="flex flex-col gap-6 p-6 overflow-y-auto max-h-[70vh]">

                    {/* REVISION FEEDBACK (If rejected) */}
                    {item.status === 'rejected' && item.last_workflow_note && (
                        <div className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 p-4 rounded-xl flex gap-3 animate-in fade-in slide-in-from-top-1 duration-300">
                            <RotateCcw className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <h4 className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">Revision Feedback</h4>
                                <p className="text-sm text-red-800 dark:text-red-300 leading-relaxed italic">
                                    "{item.last_workflow_note}"
                                </p>
                            </div>
                        </div>
                    )}

                    {/* 1. APPROVAL MODE */}
                    {isApprovalMode ? (
                        <div className="space-y-4">
                            {/* IF ACTION TYPE IS 'PROCESS' OR generic, SHOW TOGGLES */}
                            {actionType === 'process' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "h-24 border-2 flex flex-col gap-2 transition-all hover:scale-[1.02] active:scale-95",
                                            approvalAction === 'reject'
                                                ? "border-red-500 bg-red-50 text-red-700 shadow-sm"
                                                : "border-muted hover:border-red-200"
                                        )}
                                        onClick={() => { setApprovalAction('reject'); setSelectedDept('design'); setSelectedStatus('design_in_progress'); }}
                                    >
                                        <XCircle className={cn("w-6 h-6", approvalAction === 'reject' ? "text-red-600" : "text-muted-foreground")} />
                                        <span className="font-semibold">Reject & Revision</span>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "h-24 border-2 flex flex-col gap-2 transition-all hover:scale-[1.02] active:scale-95",
                                            approvalAction === 'approve'
                                                ? "border-green-500 bg-green-50 text-green-700 shadow-sm"
                                                : "border-muted hover:border-green-200"
                                        )}
                                        onClick={() => { setApprovalAction('approve'); setSelectedDept('design'); setSelectedStatus('customer_approved'); }}
                                    >
                                        <CheckCircle2 className={cn("w-6 h-6", approvalAction === 'approve' ? "text-green-600" : "text-muted-foreground")} />
                                        <span className="font-semibold">Approve Design</span>
                                    </Button>
                                </div>
                            )}

                            {/* FEEDBACK STATE (Confirming specific action) */}
                            {actionType !== 'process' && (
                                <div className={cn(
                                    "p-6 rounded-2xl border flex items-center gap-4 transition-all animate-in fade-in zoom-in duration-300",
                                    actionType === 'approve' ? "bg-green-50 border-green-100 text-green-800" : "bg-red-50 border-red-100 text-red-800"
                                )}>
                                    <div className={cn(
                                        "w-12 h-12 rounded-full flex items-center justify-center shadow-sm",
                                        actionType === 'approve' ? "bg-green-600 text-white" : "bg-red-600 text-white"
                                    )}>
                                        {actionType === 'approve' ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-lg">
                                            {actionType === 'approve' ? "Confirming Approval" : "Confirming Rejection"}
                                        </h4>
                                        <p className="text-sm opacity-80 leading-snug">
                                            {actionType === 'approve'
                                                ? "The client has approved this design. Moving forward."
                                                : "Design needs changes. Sending back to Design team."}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : isReadyToDispatch ? (
                        /* 2. DISPATCH DECISION (Sales View) */
                        <DispatchFlow
                            mode="decision"
                            onDataChange={(d) => setDispatchData(d)} // Store decision
                            onValidChange={setIsValid}
                        />
                    ) : (
                        /* 3. STANDARD FLOW */
                        <>
                            {/* Department Select - HIDE for Production Flow */}
                            {!showProductionFlow && (
                                <div className="space-y-3">
                                    <Label className="text-xs uppercase font-semibold text-muted-foreground">Select Destination</Label>
                                    <RadioGroup value={selectedDept} onValueChange={(v) => setSelectedDept(v as Department)} className="grid grid-cols-3 gap-3">
                                        {['sales', 'design', 'prepress', 'production', 'outsource'].filter(d => {
                                            // Exclude current department - users can't assign to their own department
                                            if (currentDept === d) return false;
                                            // Fix: Design team cannot assign to Outsource
                                            if (currentDept === 'design' && d === 'outsource') return false;
                                            return true;
                                        }).map(d => (
                                            <div key={d}>
                                                <RadioGroupItem value={d} id={d} className="peer sr-only" />
                                                <Label htmlFor={d} className={cn(
                                                    "flex flex-col items-center p-3 rounded-lg border-2 border-muted hover:bg-muted/50 cursor-pointer peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 peer-data-[state=checked]:text-primary transition-all",
                                                    selectedDept === d && "ring-1 ring-primary"
                                                )}>
                                                    <span className="capitalize font-medium">{d}</span>
                                                </Label>
                                            </div>
                                        ))}
                                    </RadioGroup>
                                </div>
                            )}



                            {/* DYNAMIC SUB-COMPONENTS */}

                            {/* Production Builder & Execution */}
                            {showProductionFlow && (
                                <>
                                    {/* Material Management Section - Visible to both */}
                                    <div className="mb-6">
                                        <MaterialManagement
                                            orderId={order.id}
                                            userId={user?.id || ''}
                                        />
                                    </div>

                                    {/* 
                                      LOGIC SPLIT:
                                      1. Setup Mode (Assigning TO Production): Show Builder
                                      2. Execution Mode (Working IN Production): Show Control
                                    */}
                                    {(currentDept !== 'production') ? (
                                        <ProductionFlow
                                            initialStages={productionStages}
                                            onStagesChange={setProductionStages}
                                            onMaterialChange={(p, q) => setPaperSelection({ paper: p, qty: q })}
                                        />
                                    ) : (
                                        <ProductionStageControl
                                            stages={productionStages}
                                            currentSubstage={currentSubstage}
                                            substageStatus={substageStatus}
                                            onStateChange={(substage, status) => {
                                                // 1. Update Current State
                                                setCurrentSubstage(substage);
                                                setSubstageStatus(status);

                                                // 2. Auto-Advance Logic
                                                if (status === 'completed') {
                                                    const idx = productionStages.indexOf(substage);

                                                    // If last stage (e.g., Packing), set status to ready_for_dispatch
                                                    if (idx === productionStages.length - 1) {
                                                        setSelectedStatus('ready_for_dispatch');
                                                        // Explicitly set for UI feedback
                                                        toast({ title: "Production Complete", description: "All stages finished. Status set to Ready for Dispatch.", className: "bg-green-500 text-white" });
                                                    }
                                                    // If there is a next stage, advance to it after a short delay
                                                    else if (idx !== -1 && idx < productionStages.length - 1) {
                                                        const nextStage = productionStages[idx + 1];
                                                        setTimeout(() => {
                                                            setCurrentSubstage(nextStage);
                                                            setSubstageStatus('pending');
                                                        }, 600); // Short delay for user to see the "Check" animation
                                                    }
                                                }
                                            }}
                                        />
                                    )}
                                </>
                            )}

                            {/* Outsource Flow */}
                            {/* Outsource Flow */}
                            {showOutsourceFlow && (
                                <OutsourceFlow
                                    initialQty={item.quantity}
                                    initialWorkType={item.product_name} // Good default? Or generic?
                                    onDataChange={setOutsourceData}
                                    onValidChange={setIsValid}
                                />
                            )}

                            {/* Dispatch Finalize (If in Production) */}
                            {showDispatchFinalize && (
                                <DispatchFlow
                                    mode="finalize"
                                    onDataChange={setDispatchData}
                                    onValidChange={setIsValid}
                                />
                            )}

                            {/* Status & User (Generic) */}
                            {/* Hide ONLY if we are in Execution Mode (Production doing work) OR Outsource/Dispatch Flow */}
                            {/* But SHOW if we represent Prepress assigning TO Production (Setup Mode) */}
                            {(!showOutsourceFlow && !showDispatchFinalize && !(showProductionFlow && currentDept === 'production')) && (
                                <div className="grid grid-cols-2 gap-6">
                                    {/* Status Select - Hide if in Production Flow Setup (Auto-managed) */}
                                    {!showProductionFlow ? (
                                        <div className="space-y-3">
                                            <Label className="text-xs uppercase font-semibold text-muted-foreground">Status</Label>
                                            <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as ProductStatus)}>
                                                <SelectTrigger><SelectValue placeholder="Select Status" /></SelectTrigger>
                                                <SelectContent>
                                                    {config[selectedDept]?.statuses
                                                        .filter(s => {
                                                            // Filter logic based on user request:
                                                            // Design -> Sales: only show pending_for_customer_approval AND pending_client_approval
                                                            if (currentDept === 'design' && selectedDept === 'sales') {
                                                                return s.value === 'pending_for_customer_approval' || s.value === 'pending_client_approval';
                                                            }
                                                            // Design -> Prepress: only show prepress_in_progress
                                                            if (currentDept === 'design' && selectedDept === 'prepress') {
                                                                return s.value === 'prepress_in_progress';
                                                            }
                                                            return true;
                                                        })
                                                        .map(s => (
                                                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                                        ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    ) : (
                                        // Hidden spacer to keep grid alignment if needed, or just null
                                        <div className="hidden" />
                                    )}
                                    <div className="space-y-3">
                                        <Label className="text-xs uppercase font-semibold text-muted-foreground">Assign User</Label>
                                        <Select value={selectedUser} onValueChange={setSelectedUser}>
                                            <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="_unassign">-- Unassign --</SelectItem>
                                                {availableUsers.map(u => (
                                                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}


                        </>
                    )}

                    {/* Common Notes / Instructions */}
                    <div className="space-y-3">
                        <Label className="text-xs uppercase font-bold tracking-widest text-muted-foreground/80 flex items-center gap-1.5">
                            <ScrollText className="w-3.5 h-3.5" />
                            {actionType === 'reject' ? "Requirements for Revision" :
                                actionType === 'approve' ? "Approval Note / Feedback" :
                                    `Instructions for ${selectedDept}`}
                        </Label>
                        <Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder={actionType === 'reject' ? "Explain what needs to be changed..." : "Add details or feedback..."}
                            className="min-h-[140px] text-base resize-none bg-background/50 border-muted placeholder:text-muted-foreground/40 focus:ring-2 focus:ring-primary/20 transition-all rounded-xl"
                        />
                    </div>

                </div>

                <DialogFooter className="p-6 bg-muted/30 border-t border-border/40 flex items-center justify-between sm:justify-between">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="px-6 rounded-full hover:bg-background/80 transition-all">
                        Cancel
                    </Button>
                    <Button
                        disabled={isSubmitting || (isApprovalMode && !approvalAction)}
                        onClick={handleProcess}
                        className={cn(
                            "px-8 py-6 rounded-full font-bold shadow-xl transition-all hover:scale-[1.02] active:scale-95",
                            actionType === 'approve' ? "bg-green-600 hover:bg-green-700 text-white" :
                                actionType === 'reject' ? "bg-red-600 hover:bg-red-700 text-white" :
                                    "bg-primary hover:bg-primary/90"
                        )}
                    >
                        {isSubmitting ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <>
                                <ArrowRight className="w-4 h-4 mr-2" />
                                {actionType === 'approve' ? "Confirm Approval" :
                                    actionType === 'reject' ? "Confirm Rejection" : "Confirm Move"}
                            </>
                        )}
                    </Button>
                </DialogFooter>

            </DialogContent>
        </Dialog>
    );
}
