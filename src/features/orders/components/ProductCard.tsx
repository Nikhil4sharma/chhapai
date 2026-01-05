import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import {
  Calendar, Image as ImageIcon, Eye, User, Building2,
  Upload, Send, CheckCircle, ArrowRight, Package,
  FileText, ExternalLink, AlertCircle, Truck, Factory,
  Palette, FileCheck, ShoppingCart, X, MoreVertical, Play, Trash2, Clock, RotateCcw
} from 'lucide-react';
import { Order, OrderItem, SubStage, PRODUCTION_STEPS } from '@/types/order';
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
import { AssignDepartmentDialog } from '@/components/dialogs/AssignDepartmentDialog';
import { UploadFileDialog } from '@/components/dialogs/UploadFileDialog';
import { ChangeStageDialog } from '@/components/dialogs/ChangeStageDialog';
import { OutsourceAssignmentDialog } from '@/components/dialogs/OutsourceAssignmentDialog';
import { FilePreview } from '@/features/orders/components/FilePreview';
import { ProductionStageSequenceDialog } from '@/components/dialogs/ProductionStageSequenceDialog';
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
import { DesignProcessDialog } from '@/components/dialogs/DesignProcessDialog';
import { DesignRevisionDialog } from '@/components/dialogs/DesignRevisionDialog';

interface ProductCardProps {
  order: Order;
  item: OrderItem;
  className?: string;
  productSuffix?: string; // Letter suffix for multiple products in same order (A, B, C, etc.)
}

export function ProductCard({ order, item, className, productSuffix }: ProductCardProps) {
  const { user, isAdmin, role, profile } = useAuth();
  const navigate = useNavigate();
  const {
    updateItemStage,
    assignToDepartment,
    assignToUser,
    uploadFile,
    updateItemSubstage,
    sendToProduction,
    assignToOutsource,
    refreshOrders,
    completeSubstage,
    startSubstage,
    deleteOrder,
    getTimelineForOrder,
    addNote,
    updateItemSpecifications
  } = useOrders();
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);

  // Dialog states
  const [assignUserDialogOpen, setAssignUserDialogOpen] = useState(false);
  const [assignDeptDialogOpen, setAssignDeptDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [changeStageDialogOpen, setChangeStageDialogOpen] = useState(false);
  const [outsourceDialogOpen, setOutsourceDialogOpen] = useState(false);
  const [productionStageDialogOpen, setProductionStageDialogOpen] = useState(false);

  // New Workflow Dialogs
  const [designProcessOpen, setDesignProcessOpen] = useState(false);
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);

  // Check design status
  const designStatus = item.specifications?.design_status;
  const isDesignPendingApproval = designStatus === 'design_pending_approval';

  // Get previous stage - check if item was recently in sales (for approval status)
  const previousStage = useMemo(() => {
    if (item.current_stage === 'sales' && item.need_design) {
      const hasDesignFiles = item.files?.some(f => f.file_type === 'image' || f.file_type === 'design');
      if (hasDesignFiles) {
        return 'design';
      }
    }
    return null;
  }, [item.current_stage, item.need_design, item.files]);

  // Compute status based on stage and transitions
  const itemStatus = useMemo(() => {
    // Rely on explicit design status if available, fallback to legacy inference
    if (designStatus === 'design_pending_approval') return 'Waiting for Customer Approval';
    if (designStatus === 'design_approved') return 'Approved';
    if (designStatus === 'design_revision_requested') return 'Revision Requested';

    if (item.current_stage === 'sales' && previousStage === 'design') {
      return 'Waiting for Customer Approval';
    }
    if ((item.current_stage === 'design' || item.current_stage === 'prepress' || item.current_stage === 'production') && previousStage === 'sales') {
      return 'Approved';
    }
    return null;
  }, [item.current_stage, previousStage, designStatus]);

  // Handlers for New Workflow
  const handleDesignProcess = async (targetDept: string, userId: string | null | undefined, status: string | undefined, notes: string | undefined) => {
    try {
      if (status) {
        // Use order.id (UUID) for database operations on order_items
        await updateItemSpecifications(order.id, item.item_id, { design_status: status });
      }
      if (notes) {
        // Use order.order_id (string) for notes as per legacy pattern
        await addNote(order.order_id, `[Design Process] ${notes}`);
      }
      if (targetDept) {
        // Use order.id (UUID) for department assignment
        await assignToDepartment(order.id, item.item_id, targetDept);

        if (userId && userId !== 'none') {
          // assignToUser also expects order.id (UUID) usually, checking usage...
          // Legacy: await assignToUser(order.id, item.item_id, userId, userName);
          await assignToUser(order.id, item.item_id, userId, 'Assigned User');
        }
      }
      await refreshOrders();
      toast({ title: 'Process Updated', description: 'Design process updated successfully.' });
    } catch (error) {
      console.error('Error processing design:', error);
      toast({ title: 'Error', description: 'Failed to process design', variant: 'destructive' });
    }
  };

  const handleApproveDesign = async () => {
    try {
      await updateItemSpecifications(order.id, item.item_id, { design_status: 'design_approved' });
      await assignToDepartment(order.id, item.item_id, 'design');
      await addNote(order.order_id, `[Sales Approval] Design approved by Sales. Returned to Design team.`);
      await refreshOrders();
      toast({ title: 'Approved', description: 'Design approved and returned to Design team.' });
    } catch (error) {
      console.error('Error approving design:', error);
      toast({ title: 'Error', description: 'Failed to approve design', variant: 'destructive' });
    }
  };

  const handleRequestRevision = async (notes: string) => {
    try {
      await updateItemSpecifications(order.id, item.item_id, { design_status: 'design_revision_requested' });
      await addNote(order.order_id, `[Revision Requested] ${notes}`);
      await assignToDepartment(order.id, item.item_id, 'design');
      await refreshOrders();
      toast({ title: 'Revision Requested', description: 'Returned to Design for revision.' });
    } catch (error) {
      console.error('Error requesting revision:', error);
      toast({ title: 'Error', description: 'Failed to request revision', variant: 'destructive' });
    }
  };

  // Determine available actions based on department and stage
  const availableActions = useMemo(() => {
    const actions: Array<{
      label: string;
      icon: React.ReactNode;
      onClick: () => void;
      variant?: 'default' | 'secondary' | 'outline' | 'destructive';
      show: boolean;
    }> = [];

    const isSales = role === 'sales' || isAdmin;
    const isDesign = role === 'design' || isAdmin;
    const isPrepress = role === 'prepress' || isAdmin;
    const isProduction = role === 'production' || isAdmin;
    const currentDept = item.assigned_department?.toLowerCase() || item.current_stage;

    // SALES VIEW ACTIONS
    if (isSales && (currentDept === 'sales' || item.current_stage === 'sales')) {
      if (isDesignPendingApproval || itemStatus === 'Waiting for Customer Approval') {
        actions.push({
          label: 'Approve',
          icon: <CheckCircle className="h-4 w-4" />,
          onClick: handleApproveDesign,
          variant: 'default',
          show: true,
        });
        actions.push({
          label: 'Request Revision',
          icon: <RotateCcw className="h-4 w-4" />, // Icon changed to RotateCcw
          onClick: () => setRevisionDialogOpen(true),
          variant: 'destructive',
          show: true,
        });
      } else {
        // Normal sales actions (Legacy logic mostly, but check if we need to keep 'Assign to Design'?)
        if (item.need_design) {
          // Keep legacy "Assign to Design" as fallback if not using new flow? 
          // Or just leave it.
          actions.push({
            label: 'Assign to Design',
            icon: <Palette className="h-4 w-4" />,
            onClick: () => setAssignDeptDialogOpen(true),
            variant: 'default',
            show: true,
          });
        }
        actions.push({
          label: 'Mark Design Not Required',
          icon: <X className="h-4 w-4" />,
          onClick: async () => {
            try {
              if (!order.id) return;
              await assignToDepartment(order.id, item.item_id, 'prepress');
              await refreshOrders();
              toast({ title: 'Design skipped', description: 'Product moved to Prepress' });
            } catch (error) {
              toast({ title: 'Error', description: 'Failed to skip design', variant: 'destructive' });
            }
          },
          variant: 'outline',
          show: item.need_design,
        });
      }
      actions.push({
        label: 'View Customer',
        icon: <User className="h-4 w-4" />,
        onClick: () => window.open(`/orders/${order.order_id}`, '_blank'),
        variant: 'outline',
        show: true,
      });
    }

    // DESIGN VIEW ACTIONS - REPLACED WITH SINGLE PROCESS BUTTON
    if (isDesign && (currentDept === 'design' || item.current_stage === 'design')) {
      // Replaces: Upload, Send for Approval, Assign to Prepress, Send to Production, Mark Complete
      actions.push({
        label: 'Process Design',
        icon: <Play className="h-4 w-4" />,
        onClick: () => setDesignProcessOpen(true),
        variant: 'default',
        show: true,
      });

      // Note: Using "Process Design" dialog implies we don't need the individual buttons anymore.
      // The dialog handles: Sales (Approval), Prepress, Production, Outsource.
    }

    // PREPRESS VIEW ACTIONS (Legacy Preserved)
    if (isPrepress && (currentDept === 'prepress' || item.current_stage === 'prepress')) {
      actions.push({
        label: 'Send for Revision',
        icon: <ArrowRight className="h-4 w-4 rotate-180" />,
        onClick: async () => {
          try {
            await assignToDepartment(order.id, item.item_id, 'design');
            await refreshOrders();
            toast({ title: 'Sent for Revision', description: 'Product sent back to Design' });
          } catch (error) {
            toast({ title: 'Error', description: 'Failed to send for revision', variant: 'destructive' });
          }
        },
        variant: 'outline',
        show: true,
      });
      actions.push({
        label: 'Send to Production',
        icon: <Factory className="h-4 w-4" />,
        onClick: () => setProductionStageDialogOpen(true),
        variant: 'default',
        show: true,
      });
      actions.push({
        label: 'Upload Files',
        icon: <Upload className="h-4 w-4" />,
        onClick: () => setUploadDialogOpen(true),
        variant: 'secondary',
        show: true,
      });
    }

    // PRODUCTION VIEW ACTIONS (Legacy Preserved)
    if (isProduction && (currentDept === 'production' || item.current_stage === 'production')) {
      if (item.current_substage) {
        const sequence = (item as any).production_stage_sequence || PRODUCTION_STEPS.map(s => s.key);
        const substageLabel = PRODUCTION_STEPS.find(s => s.key === item.current_substage)?.label || item.current_substage;

        actions.push({
          label: `Start ${substageLabel}`,
          icon: <Play className="h-4 w-4" />,
          onClick: async () => {
            try {
              await startSubstage(order.id, item.item_id, item.current_substage as SubStage);
              await refreshOrders();
              toast({ title: 'Stage Started', description: `${substageLabel} process started` });
            } catch (error) {
              toast({ title: 'Error', description: 'Failed to start stage', variant: 'destructive' });
            }
          },
          variant: 'default',
          show: true,
        });

        actions.push({
          label: `Complete ${substageLabel}`,
          icon: <CheckCircle className="h-4 w-4" />,
          onClick: async () => {
            try {
              await completeSubstage(order.id, item.item_id);
              await refreshOrders();
              toast({ title: 'Stage Completed', description: `${substageLabel} completed` });
            } catch (error) {
              toast({ title: 'Error', description: 'Failed to complete stage', variant: 'destructive' });
            }
          },
          variant: 'default',
          show: true,
        });
      } else {
        actions.push({
          label: 'Mark Completed',
          icon: <CheckCircle className="h-4 w-4" />,
          onClick: async () => {
            try {
              await updateItemStage(order.id, item.item_id, 'dispatch');
              await refreshOrders();
              toast({ title: 'Production Complete', description: 'Product ready for dispatch' });
            } catch (error) {
              toast({ title: 'Error', description: 'Failed to mark complete', variant: 'destructive' });
            }
          },
          variant: 'default',
          show: true,
        });
      }
      actions.push({
        label: 'Upload Photo',
        icon: <Upload className="h-4 w-4" />,
        onClick: () => setUploadDialogOpen(true),
        variant: 'secondary',
        show: true,
      });
      actions.push({
        label: 'Outsource',
        icon: <Building2 className="h-4 w-4" />,
        onClick: () => setOutsourceDialogOpen(true),
        variant: 'outline',
        show: true,
      });
    }

    // OUTSOURCE INFO
    if (item.outsource_info) {
      actions.push({
        label: 'View Outsource',
        icon: <Building2 className="h-4 w-4" />,
        onClick: () => window.open(`/outsource`, '_blank'),
        variant: 'outline',
        show: isAdmin || isProduction,
      });
    }

    // ASSIGN USER
    if ((isAdmin || currentDept === role) && !item.assigned_to) {
      actions.push({
        label: 'Assign User',
        icon: <User className="h-4 w-4" />,
        onClick: () => setAssignUserDialogOpen(true),
        variant: 'outline',
        show: true,
      });
    }

    const duplicateLabels = ['View Customer', 'Upload Photo', 'Assign User'];
    return actions.filter(a => a.show && !duplicateLabels.includes(a.label));
  }, [order, item, role, isAdmin, previousStage, itemStatus, assignToDepartment, updateItemStage, assignToUser, startSubstage, completeSubstage, refreshOrders, item.assigned_department, item.current_stage, isDesignPendingApproval, designStatus]);

  // Current production substage label
  const currentSubstageLabel = useMemo(() => {
    if (!item.current_substage) return null;
    const substage = PRODUCTION_STEPS.find(s => s.key === item.current_substage);
    return substage?.label || item.current_substage;
  }, [item.current_substage]);

  const allActions = availableActions;

  const handleOrderClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/orders/${order.order_id}`);
  };

  const shouldShowDeptBadge = item.assigned_department && item.assigned_department !== item.current_stage;
  const stageStatus =
    item.current_stage === 'sales'
      ? (!item.assigned_to ? 'Ready to assign' : 'In Sales')
      : item.current_stage === 'design'
        ? (designStatus === 'design_pending_approval' ? 'Pending Approval' : 'In Design')
        : item.current_stage === 'production' && currentSubstageLabel
          ? currentSubstageLabel
          : item.current_stage;

  const stageStatusClass: Record<string, string> = {
    sales: 'bg-blue-100 text-blue-800',
    design: 'bg-purple-100 text-purple-800',
    prepress: 'bg-amber-100 text-amber-800',
    production: 'bg-emerald-100 text-emerald-800',
    dispatch: 'bg-slate-100 text-slate-800',
  };

  return (
    <TooltipProvider>
      <Card className={cn("hover:shadow-lg transition-all overflow-hidden border border-border/70 bg-card", className)}>
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
                <StageBadge stage={item.current_stage} />
                {shouldShowDeptBadge && (
                  <Badge variant="outline" className="uppercase tracking-wide text-[10px] px-2 py-1">
                    {item.assigned_department}
                  </Badge>
                )}
                {stageStatus && (
                  <Badge className={`text-[11px] px-2 py-1 ${stageStatusClass[item.current_stage] || 'bg-muted text-foreground'}`}>
                    {stageStatus}
                  </Badge>
                )}
              </div>
            </div>

            {/* Title */}
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-lg text-foreground leading-tight">
                {item.product_name}
              </h3>
              <Badge variant="secondary" className="text-[11px] px-2 py-0.5">
                Priority: {item.priority_computed === 'red' ? 'Urgent' : item.priority_computed === 'yellow' ? 'High' : 'Normal'}
              </Badge>
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
            <div className="flex items-center gap-3 flex-wrap text-xs">
              {item.assigned_to_name && (
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Assigned to</span>
                  <span className="font-medium">{item.assigned_to_name}</span>
                </div>
              )}
            </div>

            {/* Outsource Info */}
            {item.outsource_info && (
              <div className="p-2 bg-secondary/50 rounded text-xs border border-border/60">
                <div className="flex items-center gap-1 mb-1">
                  <Building2 className="h-3 w-3 text-primary" />
                  <span className="font-medium">Outsourced to {item.outsource_info.vendor.vendor_name}</span>
                </div>
                {item.outsource_info.vendor.contact_person && (
                  <p className="text-muted-foreground">
                    Contact: {item.outsource_info.vendor.contact_person}
                  </p>
                )}
              </div>
            )}

            {/* File Thumbnails */}
            <div className="pt-2 border-t border-border/40">
              {item.files && item.files.length > 0 ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Files ({item.files.length}):</p>
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                    <FilePreview
                      files={item.files}
                      compact
                      orderId={order.order_id}
                      itemId={item.item_id}
                      productName={item.product_name}
                      department={item.assigned_department || item.current_stage}
                      canDelete={isAdmin || role === item.assigned_department || role === item.current_stage}
                      onFileDeleted={async () => {
                        await refreshOrders();
                      }}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  No files uploaded yet
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 pt-2 border-t border-border/40">
              {allActions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {allActions.slice(0, 4).map((action, idx) => (
                    <Tooltip key={idx}>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant={action.variant || 'default'}
                          onClick={(e) => {
                            e.stopPropagation();
                            action.onClick();
                          }}
                          className="text-xs flex-shrink-0 justify-start group"
                        >
                          {action.icon}
                          <span className="ml-2 whitespace-nowrap">{action.label}</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="font-medium">{action.label}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {action.label} for this product
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                  {/* ... Rest of legacy rendering omitted as slice(0,4) covers our single button ... */}
                </div>
              )}

              {/* Bottom Standard Toolbar (Preserved) */}
              <div className="flex items-center justify-start flex-wrap gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={handleOrderClick} className="h-8 px-3 hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-1.5">
                      <Eye className="h-4 w-4" />
                      <span className="text-[11px]">View</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top"><p>View Full Details</p></TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setUploadDialogOpen(true); }} className="h-8 px-3 hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-1.5">
                      <Upload className="h-4 w-4" />
                      <span className="text-[11px]">Upload</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top"><p>Upload Photo / File</p></TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setNoteDialogOpen(true); }} className="h-8 px-3 hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-1.5">
                      <FileText className="h-4 w-4" />
                      <span className="text-[11px]">Note</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top"><p>Add note to order</p></TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setTimelineOpen(true); }} className="h-8 px-3 hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-1.5">
                      <Clock className="h-4 w-4" />
                      <span className="text-[11px]">Timeline</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top"><p>View Timeline</p></TooltipContent>
                </Tooltip>

                {/* Department/User assignment only if sales? Or keep legacy logic */}
                {item.assigned_department === 'sales' && (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setAssignDeptDialogOpen(true); }} className="h-8 px-3 hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-1.5">
                          <Building2 className="h-4 w-4" />
                          <span className="text-[11px]">Dept</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top"><p>Assign Department</p></TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setAssignUserDialogOpen(true); }} className="h-8 px-3 hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-1.5">
                          <User className="h-4 w-4" />
                          <span className="text-[11px]">User</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top"><p>Assign User</p></TooltipContent>
                    </Tooltip>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <AssignUserDialog open={assignUserDialogOpen} onOpenChange={setAssignUserDialogOpen} department={item.assigned_department || item.current_stage} currentUserId={item.assigned_to} onAssign={async (userId, userName) => { if (!order.id) return; await assignToUser(order.id, item.item_id, userId, userName); await refreshOrders(); }} />
      <AssignDepartmentDialog open={assignDeptDialogOpen} onOpenChange={setAssignDeptDialogOpen} currentDepartment={item.assigned_department} onAssign={async (department) => { if (!order.id) return; await assignToDepartment(order.id, item.item_id, department); await refreshOrders(); }} />
      <UploadFileDialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen} orderId={order.order_id} itemId={item.item_id} onUpload={async (file) => { await uploadFile(order.order_id, item.item_id, file); await refreshOrders(); }} />
      <ChangeStageDialog open={changeStageDialogOpen} onOpenChange={setChangeStageDialogOpen} currentStage={item.current_stage} currentSubstage={item.current_substage} onChangeStage={async (newStage, substage) => { if (!order.id) return; await updateItemStage(order.id, item.item_id, newStage, substage); await refreshOrders(); }} />
      {outsourceDialogOpen && <OutsourceAssignmentDialog open={outsourceDialogOpen} onOpenChange={setOutsourceDialogOpen} productName={item.product_name} quantity={item.quantity} onAssign={async (vendor, job) => { if (!order.id) return; await assignToOutsource(order.id, item.item_id, vendor, job); await refreshOrders(); setOutsourceDialogOpen(false); }} />}
      <ProductionStageSequenceDialog open={productionStageDialogOpen} onOpenChange={setProductionStageDialogOpen} productName={item.product_name} orderId={order.id || order.order_id} currentSequence={(item as any).production_stage_sequence} onConfirm={async (seq) => { if (!order.id) return; await sendToProduction(order.id, item.item_id, seq); await refreshOrders(); setProductionStageDialogOpen(false); }} />

      {/* Timeline Dialog */}
      <Dialog open={timelineOpen} onOpenChange={setTimelineOpen}>
        <DialogContent className="max-w-3xl h-[70vh] flex flex-col">
          <DialogHeader><DialogTitle>Timeline - {order.order_id}</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto"><OrderTimeline entries={getTimelineForOrder(order.order_id)?.filter(e => !e.item_id || e.item_id === item.item_id) || []} /></div>
        </DialogContent>
      </Dialog>

      <AddNoteDialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen} onAdd={async (note) => { await addNote(order.order_id, note); await refreshOrders(); }} />

      {/* New Workflow Dialogs */}
      <DesignProcessDialog
        open={designProcessOpen}
        onOpenChange={setDesignProcessOpen}
        onConfirm={handleDesignProcess}
        currentDepartment={item.assigned_department}
        orderId={order.order_id}
      />

      <DesignRevisionDialog
        open={revisionDialogOpen}
        onOpenChange={setRevisionDialogOpen}
        onConfirm={handleRequestRevision}
      />
    </TooltipProvider>
  );
}
