import { useState, useMemo } from 'react';
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

interface ProductCardProps {
  order: Order;
  item: OrderItem;
  className?: string;
  productSuffix?: string;
}

/* New import */
import { useWorkflow } from '@/contexts/WorkflowContext';

import { ProcessOrderDialog } from '@/components/dialogs/ProcessOrderDialog';

export function ProductCard({ order, item, className, productSuffix }: ProductCardProps) {
  const { user, isAdmin, role } = useAuth(); // profile not used
  const navigate = useNavigate();
  const {
    assignToUser,
    uploadFile,
    updateItemStage, // Conserved for legacy or specific overrides
    assignToOutsource,
    refreshOrders,
    deleteOrder,
    getTimelineForOrder,
    addNote,
    startSubstage,
    completeSubstage,
    sendToProduction
  } = useOrders();

  const [timelineOpen, setTimelineOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);

  // Dialog states
  const [assignUserDialogOpen, setAssignUserDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [designBriefOpen, setDesignBriefOpen] = useState(false);
  const [outsourceDialogOpen, setOutsourceDialogOpen] = useState(false);
  const [processDialogOpen, setProcessDialogOpen] = useState(false);
  const [dialogActionType, setDialogActionType] = useState<'process' | 'approve' | 'reject'>('process');

  // Workflow: Get Status Config & Available Actions
  const currentDept = item.department || item.current_stage || 'sales';
  const { config, productionStages } = useWorkflow(); // Get dynamic config and stages

  // PASS CONFIG HERE
  const statusConfig = workflowService.getStatusConfig(item, config);
  const actions = useMemo(() => {
    return workflowService.getAvailableActions(item, role as UserRole, config);
  }, [item, role, config]);

  const handleWorkflowAction = async (actionId: string) => {
    if (!order.id || !user?.id) return;
    try {
      // Handle actions that require specific Dialogs
      if (actionId === 'assign_design' || actionId === 'assign_prepress' || actionId === 'assign_production') {
        // If the action implies a department move, we can just move it. 
        // But if we want to assign a USER, we might show a dialog.
        // For now, let's just move the product using the Service.
        // The Service will handle the Department change.
      }

      // Some actions might need data input (like Assign Outsource)
      if (actionId === 'assign_outsource') {
        setOutsourceDialogOpen(true);
        return;
      }

      if (actionId === 'process_order' || actionId === 'assign_design') {
        // Open the comprehensive Process Dialog for these major moves
        setProcessDialogOpen(true);
        return;
      }

      if (actionId === 'assign_user') { // Hypothetical action if we added it to workflow
        setAssignUserDialogOpen(true);
        return;
      }

      // Default: Execute Move
      await workflowService.moveProduct(
        order.id,
        item.item_id,
        actionId,
        user.id,
        'Current User', // TODO: Get name
        config, // Pass config
        ''
      );

      await refreshOrders();
      toast({ title: 'Success', description: 'Product status updated' });

    } catch (error) {
      console.error('Workflow Action Failed:', error);
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    }
  };


  const handleOrderClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/orders/${order.order_id}`);
  };

  // Status Badge Logic
  // Status Badge Logic
  // Status Badge Logic
  let statusLabel = statusConfig?.label || item.status?.replace(/_/g, ' ') || 'Unknown';

  // OVERRIDE: If in Production, show the current Sub-stage Name as status
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
    // Default / In Progress (Blue)
    statusColor = 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
  }

  // Current production substage label (Dynamic support)
  const currentSubstageLabel = useMemo(() => {
    if (!item.current_substage) return null;
    // Try to find in dynamic productionStages first
    const dynamicStage = productionStages.find(s => s.key === item.current_substage);
    if (dynamicStage) return dynamicStage.label;

    // Fallback to static list
    const staticStage = PRODUCTION_STEPS.find(s => s.key === item.current_substage);
    return staticStage?.label || item.current_substage;
  }, [item.current_substage, productionStages]);

  return (
    <TooltipProvider>
      <Card className={cn("transition-all overflow-hidden border border-border/70 bg-card", className)}>
        {/* Priority bar */}
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
            {/* Header */}
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

                {/* Visual Department Badge */}
                <Badge variant="outline" className="uppercase tracking-wide text-[10px] px-2 py-1 flex items-center gap-1">
                  {/* Add Icons based on Department? */}
                  {item.department || item.current_stage}
                </Badge>

                {/* Status Badge */}
                <Badge className={cn("text-[11px] px-2 py-1", statusColor)}>
                  {statusLabel}
                </Badge>
              </div>
            </div>

            {/* Title */}
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-lg text-foreground leading-tight">
                {item.product_name}
              </h3>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Quantity</p>
                <p className="font-medium text-base">{item.quantity}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Delivery</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium text-base">
                    {item.delivery_date ? format(new Date(item.delivery_date), 'MMM d, yyyy') : 'No date'}
                  </p>
                </div>
              </div>
            </div>

            {/* Specifications */}
            <div className="bg-muted/40 border border-border/60 rounded-md p-3">
              <ProductSpecifications item={item} compact />
            </div>

            {/* Assigned user info */}
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

            {/* Outsource Info */}
            {item.outsource_info && (
              <div className="p-2 bg-secondary/50 rounded text-xs border border-border/60">
                <div className="flex items-center gap-1 mb-1">
                  <Building2 className="h-3 w-3 text-primary" />
                  <span className="font-medium">Outsourced to {item.outsource_info.vendor.vendor_name}</span>
                </div>
              </div>
            )}

            {/* File Thumbnails */}
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

            {/* Workflow Actions */}
            <div className="flex flex-col gap-3 pt-2 border-t border-border/40">

              {/* Primary Workflow Actions */}
              <div className="flex flex-wrap gap-2">
                {/* Manual Process Button - Always visible for authorized users? Or only if allowed actions exist? */}
                {/* User asked for "Process Button". Let's verify permission first. Sales/Admin usually. */}
                {/* Approve/Reject Buttons for Sales (when pending approval) */}
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

                {(role === 'sales' || isAdmin || role === item.assigned_department || role === item.current_stage || actions.length > 0) && item.status !== 'completed' && item.current_stage !== 'completed' && !isPendingApproval && (
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
                      // Dynamic Production Label
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
                )}

                {/* Other Actions - Keep them or hide? User implies Process button handles everything. 
                      Partial Hiding: If we have Process Button, maybe we don't need "Assign to Design".
                      But "Assign to Outsource" is specific.
                      Let's keeping them for now but give visual priority to Process.
                   */}
                {/* 
                  {actions.map((action, idx) => ( ... ))}
                   */}
              </div>

              {/* Utility Toolbar */}
              <div className="flex items-center justify-start flex-wrap gap-2 relative z-20 pointer-events-auto">
                {/* Dynamic Brief Button based on Department */}
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

                <Button variant="ghost" size="sm" onClick={handleOrderClick} className="h-8 px-3 text-xs">
                  <Eye className="h-3 w-3 mr-1" /> View
                </Button>

                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setUploadDialogOpen(true); }} className="h-8 px-3 text-xs">
                  <Upload className="h-3 w-3 mr-1" /> Upload
                </Button>

                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setNoteDialogOpen(true); }} className="h-8 px-3 text-xs">
                  <FileText className="h-3 w-3 mr-1" /> Note
                </Button>

                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setTimelineOpen(true); }} className="h-8 px-3 text-xs">
                  <Clock className="h-3 w-3 mr-1" /> Timeline
                </Button>

                {/* Explicit Assign User Button for Admin/Sales */}
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

      {/* Keep Dialogs for Utilities */}
      <AssignUserDialog open={assignUserDialogOpen} onOpenChange={setAssignUserDialogOpen} department={item.department || item.current_stage} currentUserId={item.assigned_to} onAssign={async (userId, userName) => { if (!order.id) return; await assignToUser(order.id, item.item_id, userId, userName); await refreshOrders(); }} />
      <UploadFileDialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen} orderId={order.order_id} itemId={item.item_id} onUpload={async (file) => { await uploadFile(order.order_id, item.item_id, file); await refreshOrders(); }} />
      <Dialog open={timelineOpen} onOpenChange={setTimelineOpen}>
        <DialogContent className="max-w-3xl h-[70vh] flex flex-col">
          <DialogHeader><DialogTitle>Timeline - {order.order_id}</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto"><OrderTimeline entries={getTimelineForOrder(order.order_id)?.filter(e => !e.item_id || e.item_id === item.item_id) || []} /></div>
        </DialogContent>
      </Dialog>
      <AddNoteDialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen} onAdd={async (note) => { await addNote(order.order_id, note); await refreshOrders(); }} />
      {outsourceDialogOpen && <OutsourceAssignmentDialog open={outsourceDialogOpen} onOpenChange={setOutsourceDialogOpen} productName={item.product_name} quantity={item.quantity} onAssign={async (vendor, job) => { if (!order.id) return; await assignToOutsource(order.id, item.item_id, vendor, job); await refreshOrders(); setOutsourceDialogOpen(false); }} />}

      {/* Process Dialog */}
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
