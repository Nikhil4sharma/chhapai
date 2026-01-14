import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import {
  Calendar, Image as ImageIcon, Eye, User, Building2,
  Upload, Send, CheckCircle, ArrowRight, Package,
  FileText, ExternalLink, AlertCircle, Truck, Factory,
  Palette, FileCheck, ShoppingCart, X, MoreVertical, Play, Trash2, Clock, RotateCcw
} from 'lucide-react';
import { Order, OrderItem, SubStage, PRODUCTION_STEPS, UserRole } from '@/types/order';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PriorityBadge } from '@/features/orders/components/PriorityBadge';
import { StageBadge } from '@/features/orders/components/StageBadge';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useOrders } from '@/features/orders/context/OrderContext';
import { toast } from '@/hooks/use-toast';
import { AssignUserDialog } from '@/components/dialogs/AssignUserDialog';
import { UploadFileDialog } from '@/components/dialogs/UploadFileDialog';
import { OutsourceAssignmentDialog } from '@/components/dialogs/OutsourceAssignmentDialog';
import { FilePreview } from '@/features/orders/components/FilePreview';
import { DesignBriefDialog } from '@/features/orders/components/DesignBriefDialog';
import { ProductSpecifications } from '@/features/orders/components/ProductSpecifications';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OrderTimeline } from '@/features/orders/components/OrderTimeline';
import { AddNoteDialog } from '@/components/dialogs/AddNoteDialog';
import { workflowService } from '@/services/workflowService';
import { useWorkflow } from '@/contexts/WorkflowContext';
import { ProcessOrderDialog } from '@/components/dialogs/ProcessOrderDialog';
import { ProductionHandoffDialog } from './ProductionHandoffDialog';
import { updateItemSpecifications } from '@/features/orders/services/supabaseOrdersService';

interface ProductCardProps {
  order: Order;
  item: OrderItem;
  className?: string;
  productSuffix?: string;
}

export function ProductCard({ order, item, className, productSuffix }: ProductCardProps) {
  const { user, isAdmin, role } = useAuth();
  const navigate = useNavigate();
  const {
    assignToUser,
    uploadFile,
    assignToOutsource,
    refreshOrders,
    getTimelineForOrder,
    addNote
  } = useOrders();

  const [timelineOpen, setTimelineOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [assignUserDialogOpen, setAssignUserDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [designBriefOpen, setDesignBriefOpen] = useState(false);
  const [outsourceDialogOpen, setOutsourceDialogOpen] = useState(false);
  const [processDialogOpen, setProcessDialogOpen] = useState(false);
  const [productionHandoffOpen, setProductionHandoffOpen] = useState(false);
  const [dialogActionType, setDialogActionType] = useState<'process' | 'approve' | 'reject' | 'send_for_approval'>('process');

  // State to control which department users to show in Assign Dialog
  const [targetAssignDept, setTargetAssignDept] = useState<string | null>(null);

  const { config, productionStages } = useWorkflow();
  const statusConfig = workflowService.getStatusConfig(item, config);
  const actions = useMemo(() => {
    return workflowService.getAvailableActions(item, role as UserRole, config);
  }, [item, role, config]);

  const handleWorkflowAction = async (actionId: string) => {
    if (!order.id || !user?.id) return;
    try {
      if (actionId === 'assign_outsource') {
        setOutsourceDialogOpen(true);
        return;
      }
      if (actionId === 'process_order' || actionId === 'assign_design') {
        setProcessDialogOpen(true);
        return;
      }
      if (actionId === 'assign_user') {
        setAssignUserDialogOpen(true);
        return;
      }

      await workflowService.moveProduct(
        order.id,
        item.item_id,
        actionId,
        user.id,
        'Current User',
        config,
        ''
      );

      await refreshOrders();
      toast({ title: 'Success', description: 'Product status updated' });
    } catch (error) {
      console.error('Workflow Action Failed:', error);
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    }
  };

  const handleQuickSendForApproval = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!order.id || !item.item_id) return;

    try {
      const notes = "Sent for client approval";
      const targetDept = 'sales';
      const targetStatus = 'pending_for_customer_approval'; // Or 'pending_client_approval' based on config?
      const assignedUser = order.assigned_user;

      const { error: updateError } = await supabase
        .from('order_items')
        .update({
          status: targetStatus,
          current_stage: targetDept,
          assigned_department: targetDept,
          assigned_to: assignedUser,
          previous_department: item.assigned_department || 'design',
          previous_assigned_to: user?.id || null,
          updated_at: new Date().toISOString(),
          last_workflow_note: notes
        })
        .eq('id', item.item_id);

      if (updateError) throw updateError;

      await supabase.from('timeline').insert({
        order_id: order.id,
        item_id: item.item_id,
        product_name: item.product_name,
        stage: targetDept,
        action: 'status_changed',
        performed_by: user?.id,
        performed_by_name: 'Current User',
        notes: `[Auto-Forward] ${notes}\nAssigned to Manager: ${order.assigned_user_name || 'Sales Team'}`
      });

      await refreshOrders();
      toast({
        title: 'Sent for Approval',
        description: `Item sent to Sales${order.assigned_user_name ? ` (${order.assigned_user_name})` : ''} for approval.`
      });

    } catch (error) {
      console.error('Quick Approval Failed:', error);
      toast({ title: 'Error', description: 'Failed to send for approval', variant: 'destructive' });
    }
  };

  const handleHandoffToPrepress = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTargetAssignDept('prepress');
    setAssignUserDialogOpen(true);
  };

  const handleDesignComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await handleWorkflowAction('design_complete');
  };


  const handleHandoffToProduction = (e: React.MouseEvent) => {
    e.stopPropagation();
    setProductionHandoffOpen(true);
  };

  const handleOutsourceClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOutsourceDialogOpen(true);
  };

  const handleOrderClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/orders/${order.order_id}`);
  };

  let statusLabel = statusConfig?.label || item.status?.replace(/_/g, ' ') || 'Unknown';
  const isProduction = item.department === 'production' || item.current_stage === 'production';
  if (isProduction && item.current_substage) {
    const stageLabel = productionStages.find(s => s.key === item.current_substage)?.label || item.current_substage;
    statusLabel = stageLabel;
  }
  const isPendingApproval = item.status === 'pending_for_customer_approval' || item.status === 'pending_client_approval';

  let statusColor = statusConfig?.color || 'bg-slate-100 text-slate-800 border-slate-200';
  if (item.status === 'completed' || item.current_stage === 'completed' || item.status === 'delivered' || item.status === 'dispatched') {
    statusColor = 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800';
  } else if (item.status === 'new_order' || isPendingApproval) {
    statusColor = 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800';
  } else {
    statusColor = 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
  }

  return (
    <TooltipProvider>
      <Card className={cn("transition-all overflow-hidden border border-border/70 bg-card", className)}>
        <div
          className={cn(
            "h-1 w-full",
            item.priority_computed === 'blue' && "bg-priority-blue",
            item.priority_computed === 'yellow' && "bg-priority-yellow",
            item.priority_computed === 'red' && "bg-priority-red",
          )}
        />

        <CardContent className="p-3">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleOrderClick}
                  className="text-sm font-semibold text-primary hover:underline cursor-pointer flex items-center gap-2"
                >
                  {order.order_id}{productSuffix ? ` ${productSuffix}` : ''}
                  <PriorityBadge priority={item.priority_computed} />
                </button>

                {order.assigned_user_name && (
                  <Badge variant="secondary" className="text-[10px] font-normal px-2 py-0.5 bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800">
                    <User className="w-3 h-3 mr-1" />
                    Manager: {order.assigned_user_name}
                  </Badge>
                )}

                <Badge variant="outline" className="uppercase tracking-wide text-[10px] px-2 py-1 flex items-center gap-1">
                  {item.department || item.current_stage}
                </Badge>

                <Badge className={cn("text-[11px] px-2 py-1", statusColor)}>
                  {statusLabel}
                </Badge>

                {/* Delivery Date Moved to Header */}
                <div className="flex items-center gap-1.5 ml-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-xs border border-slate-200 dark:border-slate-700">
                  <Calendar className="h-3 w-3 text-slate-500" />
                  <span className={cn(
                    "font-medium",
                    item.delivery_date && new Date(item.delivery_date) < new Date() ? "text-red-600" : "text-slate-700 dark:text-slate-300"
                  )}>
                    {item.delivery_date ? format(new Date(item.delivery_date), 'MMM d') : 'No Date'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-lg text-foreground leading-tight">
                {item.product_name}
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Quantity</p>
                <p className="font-medium text-base">{item.quantity}</p>
              </div>

              {/* Delivery Date Removed from here (Moved to Header) */}
            </div>

            {/* Design Specific: Last Workflow Note (Apple Style) */}
            {role === 'design' && item.last_workflow_note && (
              <div className="mt-4 group relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-50/80 to-amber-50/50 dark:from-orange-950/20 dark:to-amber-950/10 border border-orange-100/60 dark:border-orange-900/30 p-4 transition-all hover:shadow-md">
                <div className="flex gap-3.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/80 dark:bg-white/5 shadow-sm ring-1 ring-orange-200/50 dark:ring-orange-800/30 backdrop-blur-md">
                    <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="space-y-1.5 pt-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-orange-800/70 dark:text-orange-200/70">
                        Design Instruction
                      </span>
                      <span className="h-1 w-1 rounded-full bg-orange-400/50" />
                      <span className="text-[10px] text-orange-700/50 dark:text-orange-300/50">
                        From Sales
                      </span>
                    </div>
                    <p className="text-[13px] leading-relaxed font-medium text-orange-950 dark:text-orange-50/90">
                      {item.last_workflow_note}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Specifications - Visible for ALL roles */}
            <div className="bg-muted/40 border border-border/60 rounded-md p-3">
              <ProductSpecifications item={item} compact />
            </div>

            <div className="flex items-center gap-3 flex-wrap text-xs pt-1">
              <div className="flex items-center gap-1.5 py-1 px-2 bg-muted/30 rounded-full border border-border/40">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground whitespace-nowrap font-medium">Assignee:</span>
                <span className="font-semibold text-foreground">
                  {item.assigned_to_name || "Unassigned"}
                </span>
                <span className="text-muted-foreground/60 text-[10px] uppercase font-bold tracking-tighter ml-0.5">
                  ({item.department || item.current_stage})
                </span>
              </div>
            </div>

            {item.outsource_info && (
              <div className="p-2 bg-secondary/50 rounded text-xs border border-border/60">
                <div className="flex items-center gap-1 mb-1">
                  <Building2 className="h-3 w-3 text-primary" />
                  <span className="font-medium">Outsourced to {item.outsource_info.vendor.vendor_name}</span>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-border/40">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                <FilePreview
                  files={item.files || []}
                  compact
                  orderId={order.order_id}
                  itemId={item.item_id}
                  productName={item.product_name}
                  department={item.department || item.current_stage || 'sales'}
                  canDelete={isAdmin || role === item.assigned_department}
                  onFileDeleted={refreshOrders}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2 border-t border-border/40">

              <div className="flex flex-wrap gap-2">
                {isPendingApproval && (isAdmin || role === 'sales') && (
                  <div className="flex gap-2.5 w-full pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDialogActionType('approve');
                        setProcessDialogOpen(true);
                      }}
                      className="flex-1 rounded-full h-10 text-xs font-bold bg-green-500/10 hover:bg-green-500 text-green-700 hover:text-white border-none shadow-sm transition-all"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" /> Approve
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDialogActionType('reject');
                        setProcessDialogOpen(true);
                      }}
                      className="flex-1 rounded-full h-10 text-xs font-bold bg-red-500/10 hover:bg-red-500 text-red-700 hover:text-white border-none shadow-sm transition-all"
                    >
                      <X className="w-4 h-4 mr-2" /> Reject
                    </Button>
                  </div>
                )}

                {(() => {
                  const canShowAction = (role === 'sales' || isAdmin || role === item.assigned_department || role === item.current_stage || actions.length > 0) && item.status !== 'completed' && item.current_stage !== 'completed' && !isPendingApproval;

                  if (!canShowAction) return null;

                  const isSendForApproval = (role === 'design' || role === 'prepress') && item.status !== 'approved' && item.status !== 'rejected';

                  // Default Send for Approval button
                  if (isSendForApproval) {
                    return (
                      <Button
                        size="sm"
                        onClick={handleQuickSendForApproval}
                        className="text-xs flex-shrink-0 justify-start font-bold shadow-sm border-0 transition-all active:scale-95 rounded-full px-4 h-9 bg-amber-600 hover:bg-amber-700 text-white"
                      >
                        <Send className="w-3 h-3 mr-1.5" /> Send for Approval
                      </Button>
                    );
                  }

                  // Design & Prepress - Rejected State (Revision)
                  if ((role === 'design' || role === 'prepress') && item.status === 'rejected') {
                    return (
                      <Button
                        size="sm"
                        onClick={handleQuickSendForApproval}
                        className="text-xs flex-shrink-0 justify-start font-bold shadow-sm border-0 transition-all active:scale-95 rounded-full px-4 h-9 bg-red-600 hover:bg-red-700 text-white"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" /> Revision
                      </Button>
                    );
                  }

                  // Design Role - Specific Buttons logic (Approved/Handoff)
                  if (role === 'design') {
                    if (item.status === 'approved') {
                      return (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleHandoffToPrepress}
                            className="text-xs flex-shrink-0 justify-start font-bold shadow-sm border-0 transition-all active:scale-95 rounded-full px-4 h-9 bg-indigo-600 hover:bg-indigo-700 text-white"
                          >
                            <ArrowRight className="w-4 h-4 mr-2" /> Handoff to Prepress
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={handleDesignComplete}
                            className="text-xs flex-shrink-0 justify-start font-bold shadow-sm border border-border transition-all active:scale-95 rounded-full px-4 h-9"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" /> Design Complete
                          </Button>
                        </div>
                      );
                    }
                  }

                  // Prepress Role - Specific Buttons logic (Approved)
                  if (role === 'prepress' && item.status === 'approved') {
                    return (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleHandoffToProduction}
                          className="text-xs flex-shrink-0 justify-start font-bold shadow-sm border-0 transition-all active:scale-95 rounded-full px-4 h-9 bg-orange-600 hover:bg-orange-700 text-white"
                        >
                          <ArrowRight className="w-4 h-4 mr-2" /> Send for Production
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleOutsourceClick}
                          className="text-xs flex-shrink-0 justify-start font-bold shadow-sm border-0 transition-all active:scale-95 rounded-full px-4 h-9 bg-pink-600 hover:bg-pink-700 text-white"
                        >
                          <Building2 className="w-4 h-4 mr-2" /> Send to Outsource
                        </Button>
                      </div>
                    );
                  }

                  return (
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDialogActionType('process');
                        setProcessDialogOpen(true);
                      }}
                      className={cn(
                        "text-xs flex-shrink-0 justify-start font-bold shadow-sm border-0 transition-all active:scale-95 rounded-full px-4 h-9",
                        item.status === 'rejected' && role === 'design'
                          ? "bg-red-600 hover:bg-red-700 text-white"
                          : item.status === 'approved' && role === 'design'
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                            : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                      )}
                    >
                      {item.status === 'rejected' && role === 'design' ? (
                        <><RotateCcw className="w-4 h-4 mr-2" /> Revision</>
                      ) : item.status === 'approved' && role === 'design' ? (
                        <><ArrowRight className="w-4 h-4 mr-2" /> Handoff to Prepress</>
                      ) : (
                        isProduction && item.current_substage && item.substage_status ? (
                          <>
                            {item.substage_status === 'in_progress' ? <CheckCircle className="w-3 h-3 mr-1.5" /> : <Play className="w-3 h-3 mr-1.5" />}
                            {item.substage_status === 'in_progress' ? `Complete ${statusLabel}` : `Start ${statusLabel}`}
                          </>
                        ) : (
                          <><Play className="w-3 h-3 mr-1.5" /> Process</>
                        )
                      )}
                    </Button>
                  );
                })()}

              </div>

              {/* Utility Toolbar */}
              <div className="flex items-center justify-start flex-wrap gap-2 relative z-20 pointer-events-auto">
                {/* Brief - Visible for relevant stages (Design/Prepress/Production) */}
                {['design', 'prepress', 'production'].includes(item.current_stage) && (
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDesignBriefOpen(true); }} className="h-8 px-3 text-xs">
                    <Palette className={cn(
                      "h-3 w-3 mr-1",
                      item.current_stage === 'design' && "text-indigo-600 dark:text-indigo-400 font-bold",
                      item.current_stage === 'prepress' && "text-pink-600 dark:text-pink-400 font-bold",
                      item.current_stage === 'production' && "text-orange-600 dark:text-orange-400 font-bold"
                    )} />
                    <span className="capitalize">{item.current_stage} Brief</span>
                  </Button>
                )}

                {/* View - Hidden for Design */}
                {role !== 'design' && (
                  <Button variant="ghost" size="sm" onClick={handleOrderClick} className="h-8 px-3 text-xs">
                    <Eye className="h-3 w-3 mr-1" /> View
                  </Button>
                )}

                {/* Upload - Visible for Everyone (including Design) */}
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setUploadDialogOpen(true); }} className="h-8 px-3 text-xs">
                  <Upload className="h-3 w-3 mr-1" /> Upload
                </Button>

                {/* Note - Hidden for Design */}
                {role !== 'design' && (
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setNoteDialogOpen(true); }} className="h-8 px-3 text-xs">
                    <FileText className="h-3 w-3 mr-1" /> Note
                  </Button>
                )}

                {/* Timeline - Hidden for Design */}
                {role !== 'design' && (
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setTimelineOpen(true); }} className="h-8 px-3 text-xs">
                    <Clock className="h-3 w-3 mr-1" /> Timeline
                  </Button>
                )}

                {(isAdmin || role === 'sales') && (
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setAssignUserDialogOpen(true); }} className="h-8 px-3 text-xs">
                    <User className="h-3 w-3 mr-1" /> Users
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <ProductionHandoffDialog
        open={productionHandoffOpen}
        onOpenChange={setProductionHandoffOpen}
        productName={item.product_name}
        orderId={order.order_id} // Display ID
        onConfirm={async (data) => {
          // 1. Save Paper if selected
          if (data.paper) {
            try {
              await supabase.from('job_materials').insert({
                job_id: order.id, // Use UUID
                paper_id: data.paper.id,
                sheets_allocated: item.quantity, // Default allocation
                status: 'reserved',
              });
              toast({ title: 'Paper Allocated', description: `${data.paper.name} reserved.` });
            } catch (err) {
              console.error("Error allocating paper", err);
              toast({ title: "Allocation Failed", variant: "destructive", description: "Could not reserve paper." });
            }
          }

          // 2. Save Stages
          if (data.stages.length > 0) {
            try {
              await updateItemSpecifications(order.id, item.item_id, { production_stages: data.stages });
            } catch (err) {
              console.error("Error saving stages", err);
            }
          }

          // 3. Proceed to Assignment
          setTargetAssignDept('production');
          setAssignUserDialogOpen(true);
        }}
      />
      <AssignUserDialog
        open={assignUserDialogOpen}
        onOpenChange={setAssignUserDialogOpen}
        department={targetAssignDept || item.department || item.current_stage}
        currentUserId={item.assigned_to}
        onAssign={async (userId, userName) => {
          if (!order.id) return;

          const finish = async () => {
            await refreshOrders();
            setAssignUserDialogOpen(false);
            setTargetAssignDept(null);
            toast({ title: 'Assigned', description: `Assigned to ${userName}` });
          };

          if (!targetAssignDept) {
            await assignToUser(order.id, item.item_id, userId, userName);
            await finish();
            return;
          }

          if (targetAssignDept === 'prepress') {
            try {
              await workflowService.moveProduct(
                order.id,
                item.item_id,
                'assign_prepress',
                user?.id || '',
                'Current User',
                config,
                `Handoff to Prepress (Assigned to ${userName})`
              );

              await assignToUser(order.id, item.item_id, userId, userName);

              toast({ title: 'Handoff Successful', description: `Moved to Prepress and assigned to ${userName}` });
              await finish();
            } catch (e) {
              console.error("Handoff failed", e);
              toast({ title: 'Handoff Failed', variant: 'destructive' });
            }
          } else if (targetAssignDept === 'production') {
            try {
              await workflowService.moveProduct(
                order.id,
                item.item_id,
                'assign_production',
                user?.id || '',
                'Current User',
                config,
                `Handoff to Production (Assigned to ${userName})`
              );

              await assignToUser(order.id, item.item_id, userId, userName);

              toast({ title: 'Handoff Successful', description: `Moved to Production and assigned to ${userName}` });
              await finish();
            } catch (e) {
              console.error("Handoff to Production failed", e);
              toast({ title: 'Handoff Failed', variant: 'destructive' });
            }
          }
        }}
      />
      <UploadFileDialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen} orderId={order.order_id} itemId={item.item_id} onUpload={async (file) => { await uploadFile(order.order_id, item.item_id, file); await refreshOrders(); }} />
      <Dialog open={timelineOpen} onOpenChange={setTimelineOpen}>
        <DialogContent className="max-w-3xl h-[70vh] flex flex-col">
          <DialogHeader><DialogTitle>Timeline - {order.order_id}</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto"><OrderTimeline entries={getTimelineForOrder(order.order_id)?.filter(e => !e.item_id || e.item_id === item.item_id) || []} /></div>
        </DialogContent>
      </Dialog>
      <AddNoteDialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen} onAdd={async (note) => { await addNote(order.order_id, note); await refreshOrders(); }} />
      {outsourceDialogOpen && <OutsourceAssignmentDialog open={outsourceDialogOpen} onOpenChange={setOutsourceDialogOpen} productName={item.product_name} quantity={item.quantity} onAssign={async (vendor, job) => { if (!order.id) return; await assignToOutsource(order.id, item.item_id, vendor, job); await refreshOrders(); setOutsourceDialogOpen(false); }} />}

      <ProcessOrderDialog open={processDialogOpen} onOpenChange={setProcessDialogOpen} order={order} item={item} actionType={dialogActionType} />

      <DesignBriefDialog
        open={designBriefOpen}
        onOpenChange={setDesignBriefOpen}
        orderId={order.order_id}
        orderUUID={order.id || ''}
        item={item}
        department={item.current_stage}
      />

    </TooltipProvider>
  );
}
