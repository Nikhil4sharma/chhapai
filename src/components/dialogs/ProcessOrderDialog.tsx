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
    ScrollText
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ProductionFlow } from './process/ProductionFlow';
import { DispatchFlow } from './process/DispatchFlow';
import { OutsourceFlow } from './process/OutsourceFlow';

interface ProcessOrderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    order: Order;
    item: OrderItem;
}

export function ProcessOrderDialog({ open, onOpenChange, order, item }: ProcessOrderDialogProps) {
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
            else if (current === 'production' && status === 'in_production') {
                targetDept = 'production';
                targetStatus = 'ready_for_dispatch';
            }
            // Ready for Dispatch -> Dispatched
            else if (current === 'production' && status === 'ready_for_dispatch') {
                targetDept = 'production';
                targetStatus = 'dispatched'; // This triggers Finalize Mode in DispatchFlow?
                // Actually if it's 'ready_for_dispatch', the next logical step is Dispatched.
            }
            else {
                // Try to find first valid status in current dept
                const deptConf = config[current];
                if (deptConf?.statuses.length) targetStatus = deptConf.statuses[0].value;
            }

            setSelectedDept(targetDept);
            setSelectedStatus(targetStatus);
            setSelectedUser(item.assigned_to || '');
            setNotes('');
            setApprovalAction(null);
            setIsValid(true);

            // Reset Flow Data
            setProductionStages(item.production_stage_sequence || []);

        }
    }, [open, item, config]);

    // -- Computed --
    const currentDept = (item.assigned_department as Department) || 'sales';
    const isApprovalMode = item.status === 'pending_for_customer_approval';

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

                const updateData: any = {
                    status: selectedStatus,
                    current_stage: selectedDept,
                    assigned_department: selectedDept,
                    updated_at: new Date().toISOString(),
                    last_workflow_note: finalNotes
                };

                if (showProductionFlow) {
                    updateData.production_stage_sequence = productionStages;
                }


                // Dispatch Decision (Sales) logic
                if (isReadyToDispatch) { // Waiting for pickup or pending
                    // Mapping local dispatchData status to updateData
                    if (dispatchData?.status) updateData.status = dispatchData.status;
                    if (dispatchData?.status === 'dispatch_pending') {
                        updateData.current_stage = 'production'; // Send back to Prod per specs
                        updateData.assigned_department = 'production';
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


    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] p-0 gap-0 overflow-hidden shadow-2xl bg-background/95 backdrop-blur-xl border-border">

                {/* Header */}
                <div className={cn("relative p-6 pb-6 border-b border-border/40", isApprovalMode ? "bg-amber-50/50" : "bg-muted/20")}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Settings className="w-5 h-5 text-primary" />
                            Process Order <span className="text-muted-foreground">•</span> {item.product_name}
                        </DialogTitle>
                        <DialogDescription>
                            Current: <span className="font-medium text-foreground capitalize">{currentDept}</span> ({item.status?.replace(/_/g, ' ')})
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="flex flex-col gap-6 p-6 overflow-y-auto max-h-[70vh]">

                    {/* 1. APPROVAL MODE */}
                    {isApprovalMode ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <Button
                                    variant="outline"
                                    className={cn("h-20 border-2", approvalAction === 'reject' && "border-red-500 bg-red-50")}
                                    onClick={() => { setApprovalAction('reject'); setSelectedDept('design'); setSelectedStatus('design_in_progress'); }}
                                >
                                    Reject & Revision
                                </Button>
                                <Button
                                    variant="outline"
                                    className={cn("h-20 border-2", approvalAction === 'approve' && "border-green-500 bg-green-50")}
                                    onClick={() => { setApprovalAction('approve'); setSelectedDept('design'); setSelectedStatus('customer_approved'); }}
                                >
                                    Approve Design
                                </Button>
                            </div>
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
                            {/* Department Select */}
                            <div className="space-y-3">
                                <Label className="text-xs uppercase font-semibold text-muted-foreground">Select Destination</Label>
                                <RadioGroup value={selectedDept} onValueChange={(v) => setSelectedDept(v as Department)} className="grid grid-cols-3 gap-3">
                                    {['sales', 'design', 'prepress', 'production', 'outsource'].filter(d => {
                                        // User Request: If currently in Sales, don't show Sales as an option (force move to other dept)
                                        if (currentDept === 'sales' && d === 'sales') return false;
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

                            {/* DYNAMIC SUB-COMPONENTS */}

                            {/* Production Builder */}
                            {showProductionFlow && (
                                <ProductionFlow
                                    initialStages={productionStages}
                                    onStagesChange={setProductionStages}
                                    onMaterialChange={(p, q) => setPaperSelection({ paper: p, qty: q })}
                                />
                            )}

                            {/* Outsource Flow */}
                            {showOutsourceFlow && (
                                <OutsourceFlow
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

                            {/* Status & User (Generic) - Hide if specialized flow handles it entirely (like Outsource) */}
                            {!showOutsourceFlow && !showDispatchFinalize && (
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <Label className="text-xs uppercase font-semibold text-muted-foreground">Status</Label>
                                        <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as ProductStatus)}>
                                            <SelectTrigger><SelectValue placeholder="Select Status" /></SelectTrigger>
                                            <SelectContent>
                                                {config[selectedDept]?.statuses.map(s => (
                                                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
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

                    {/* Common Notes */}
                    <div className="space-y-3">
                        <Label className="text-xs uppercase font-semibold text-muted-foreground">
                            Instructions for {selectedDept.charAt(0).toUpperCase() + selectedDept.slice(1)}
                        </Label>
                        <Textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder={`Add ${selectedDept} requirements & instructions...`}
                        />
                    </div>

                </div>

                <DialogFooter className="p-6 bg-muted/20 border-t">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleProcess} disabled={isSubmitting || !isValid || (!selectedStatus && !showOutsourceFlow && !showDispatchFinalize && !isReadyToDispatch)}>
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                        Confirm Move
                    </Button>
                </DialogFooter>

            </DialogContent>
        </Dialog>
    );
}
