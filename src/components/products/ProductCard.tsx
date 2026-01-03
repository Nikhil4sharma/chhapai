import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { 
  Calendar, Image as ImageIcon, Eye, User, Building2, 
  Upload, Send, CheckCircle, ArrowRight, Package, 
  FileText, ExternalLink, AlertCircle, Truck, Factory,
  Palette, FileCheck, ShoppingCart, X, MoreVertical, Play, Trash2, Clock
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OrderTimeline } from '@/features/orders/components/OrderTimeline';
import { AddNoteDialog } from '@/components/dialogs/AddNoteDialog';

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

  // Get previous stage - check if item was recently in sales (for approval status)
  // We check if current stage is sales and item has design history
  const previousStage = useMemo(() => {
    // If currently in sales and need_design is true, likely came from design
    if (item.current_stage === 'sales' && item.need_design) {
      // Check if there are design files which indicates it came from design
      const hasDesignFiles = item.files?.some(f => f.file_type === 'image' || f.file_type === 'design');
      if (hasDesignFiles) {
        return 'design';
      }
    }
    // If in design/prepress/production and need_design is true, could have come from sales
    if ((item.current_stage === 'design' || item.current_stage === 'prepress' || item.current_stage === 'production') && item.need_design) {
      // This is a best guess - if item has files, it might have been sent from sales for approval
      return 'sales';
    }
    return null;
  }, [item.current_stage, item.need_design, item.files]);

  // Compute status based on stage and transitions
  const itemStatus = useMemo(() => {
    // If item is in sales stage after being sent from design, it's waiting for approval
    if (item.current_stage === 'sales' && previousStage === 'design') {
      return 'Waiting for Customer Approval';
    }
    // If item was in sales (waiting for approval) and now in design/prepress/production, it's approved
    if ((item.current_stage === 'design' || item.current_stage === 'prepress' || item.current_stage === 'production') && previousStage === 'sales') {
      return 'Approved';
    }
    return null;
  }, [item.current_stage, previousStage]);

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
      // If waiting for approval, show approve/reject actions
      if (itemStatus === 'Waiting for Customer Approval') {
        actions.push({
          label: 'Approve',
          icon: <CheckCircle className="h-4 w-4" />,
          onClick: async () => {
            // Approve and send to next stage (design/prepress)
            try {
              if (!order.id) {
                toast({ title: 'Error', description: 'Order ID not found', variant: 'destructive' });
                return;
              }
              // If need_design is true, send to design, else to prepress
              const nextDept = item.need_design ? 'design' : 'prepress';
              await assignToDepartment(order.id, item.item_id, nextDept);
              await refreshOrders();
              toast({ 
                title: 'Approved', 
                description: `Product approved and sent to ${nextDept}. Status: Approved` 
              });
            } catch (error) {
              console.error('Error approving:', error);
              toast({ title: 'Error', description: 'Failed to approve', variant: 'destructive' });
            }
          },
          variant: 'default',
          show: true,
        });
        actions.push({
          label: 'Request Revision',
          icon: <ArrowRight className="h-4 w-4 rotate-180" />,
          onClick: async () => {
            // Request revision - send back to design
            try {
              if (!order.id) {
                toast({ title: 'Error', description: 'Order ID not found', variant: 'destructive' });
                return;
              }
              await assignToDepartment(order.id, item.item_id, 'design');
              await refreshOrders();
              toast({ 
                title: 'Revision Requested', 
                description: 'Product sent back to Design for revisions' 
              });
            } catch (error) {
              console.error('Error requesting revision:', error);
              toast({ title: 'Error', description: 'Failed to request revision', variant: 'destructive' });
            }
          },
          variant: 'secondary',
          show: true,
        });
      } else {
        // Normal sales actions
        if (item.need_design) {
          actions.push({
            label: 'Assign to Design',
            icon: <Palette className="h-4 w-4" />,
            onClick: () => {
              setAssignDeptDialogOpen(true);
            },
            variant: 'default',
            show: true,
          });
        }
        actions.push({
          label: 'Mark Design Not Required',
          icon: <X className="h-4 w-4" />,
          onClick: async () => {
            // Skip design, go to prepress or production
            try {
              if (!order.id) {
                toast({ title: 'Error', description: 'Order ID not found', variant: 'destructive' });
                return;
              }
              await assignToDepartment(order.id, item.item_id, 'prepress');
              await refreshOrders();
              toast({ title: 'Design skipped', description: 'Product moved to Prepress' });
            } catch (error) {
              console.error('Error skipping design:', error);
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
        onClick: () => {
          // Navigate to order detail or show customer modal
          window.open(`/orders/${order.order_id}`, '_blank');
        },
        variant: 'outline',
        show: true,
      });
    }

    // DESIGN VIEW ACTIONS
    if (isDesign && (currentDept === 'design' || item.current_stage === 'design')) {
      actions.push({
        label: 'Upload Design',
        icon: <Upload className="h-4 w-4" />,
        onClick: () => {
          setUploadDialogOpen(true);
        },
        variant: 'default',
        show: true,
      });
      actions.push({
        label: 'Send for Approval',
        icon: <Send className="h-4 w-4" />,
        onClick: async () => {
          // Send back to Sales for customer approval - status will be "Waiting for Customer Approval"
          try {
            if (!order.id) {
              toast({ title: 'Error', description: 'Order ID not found', variant: 'destructive' });
              return;
            }
            await assignToDepartment(order.id, item.item_id, 'sales');
            await refreshOrders();
            toast({ 
              title: 'Sent for Approval', 
              description: 'Design sent to Sales for customer approval. Status: Waiting for Customer Approval' 
            });
          } catch (error) {
            console.error('Error sending for approval:', error);
            toast({ title: 'Error', description: 'Failed to send for approval', variant: 'destructive' });
          }
        },
        variant: 'default',
        show: itemStatus !== 'Waiting for Customer Approval', // Hide if already waiting
      });
      actions.push({
        label: 'Assign to Prepress',
        icon: <FileCheck className="h-4 w-4" />,
        onClick: async () => {
          try {
            if (!order.id) {
              toast({ title: 'Error', description: 'Order ID not found', variant: 'destructive' });
              return;
            }
            await assignToDepartment(order.id, item.item_id, 'prepress');
            await refreshOrders();
            toast({ title: 'Sent to Prepress', description: 'Product assigned to Prepress department' });
          } catch (error) {
            console.error('Error assigning to prepress:', error);
            toast({ title: 'Error', description: 'Failed to assign to prepress', variant: 'destructive' });
          }
        },
        variant: 'secondary',
        show: true,
      });
      actions.push({
        label: 'Send to Production',
        icon: <Factory className="h-4 w-4" />,
        onClick: () => {
          setProductionStageDialogOpen(true);
        },
        variant: 'secondary',
        show: true,
      });
      actions.push({
        label: 'Mark Complete',
        icon: <CheckCircle className="h-4 w-4" />,
        onClick: async () => {
          // Design-only orders - mark as completed
          try {
            if (!order.id) {
              toast({ title: 'Error', description: 'Order ID not found', variant: 'destructive' });
              return;
            }
            await updateItemStage(order.id, item.item_id, 'completed');
            await refreshOrders();
            toast({ title: 'Design Complete', description: 'Product marked as completed' });
          } catch (error) {
            console.error('Error marking complete:', error);
            toast({ title: 'Error', description: 'Failed to mark complete', variant: 'destructive' });
          }
        },
        variant: 'outline',
        show: true, // Design can complete design-only orders
      });
    }

    // PREPRESS VIEW ACTIONS
    if (isPrepress && (currentDept === 'prepress' || item.current_stage === 'prepress')) {
      actions.push({
        label: 'Send for Revision',
        icon: <ArrowRight className="h-4 w-4 rotate-180" />,
        onClick: async () => {
          try {
            if (!order.id) {
              toast({ title: 'Error', description: 'Order ID not found', variant: 'destructive' });
              return;
            }
            await assignToDepartment(order.id, item.item_id, 'design');
            await refreshOrders();
            toast({ title: 'Sent for Revision', description: 'Product sent back to Design' });
          } catch (error) {
            console.error('Error sending for revision:', error);
            toast({ title: 'Error', description: 'Failed to send for revision', variant: 'destructive' });
          }
        },
        variant: 'outline',
        show: true,
      });
      actions.push({
        label: 'Send to Production',
        icon: <Factory className="h-4 w-4" />,
        onClick: () => {
          setProductionStageDialogOpen(true);
        },
        variant: 'default',
        show: true,
      });
      actions.push({
        label: 'Upload Files',
        icon: <Upload className="h-4 w-4" />,
        onClick: () => {
          setUploadDialogOpen(true);
        },
        variant: 'secondary',
        show: true,
      });
    }

    // PRODUCTION VIEW ACTIONS
    if (isProduction && (currentDept === 'production' || item.current_stage === 'production')) {
      // If item has current_substage, show substage-specific actions
      if (item.current_substage) {
        const sequence = (item as any).production_stage_sequence || PRODUCTION_STEPS.map(s => s.key);
        const currentIndex = sequence.indexOf(item.current_substage);
        const isLastSubstage = currentIndex === sequence.length - 1;
        const substageLabel = PRODUCTION_STEPS.find(s => s.key === item.current_substage)?.label || item.current_substage;

        // Mark Started - only show if substage is not yet started
        actions.push({
          label: `Start ${substageLabel}`,
          icon: <Play className="h-4 w-4" />,
          onClick: async () => {
            try {
              if (!order.id) {
                toast({ title: 'Error', description: 'Order ID not found', variant: 'destructive' });
                return;
              }
              await startSubstage(order.id, item.item_id, item.current_substage as SubStage);
              await refreshOrders();
              toast({ 
                title: 'Stage Started', 
                description: `${substageLabel} process started` 
              });
            } catch (error) {
              console.error('Error starting substage:', error);
              toast({ 
                title: 'Error', 
                description: 'Failed to start stage', 
                variant: 'destructive' 
              });
            }
          },
          variant: 'default',
          show: true,
        });

        // Mark Completed - complete current substage
        actions.push({
          label: `Complete ${substageLabel}`,
          icon: <CheckCircle className="h-4 w-4" />,
          onClick: async () => {
            try {
              if (!order.id) {
                toast({ title: 'Error', description: 'Order ID not found', variant: 'destructive' });
                return;
              }
              
              // If last substage (packing), will move to dispatch automatically
              await completeSubstage(order.id, item.item_id);
              await refreshOrders();
              
              if (isLastSubstage) {
                toast({ 
                  title: 'Packing Complete', 
                  description: 'Item moved to dispatch stage' 
                });
              } else {
                toast({ 
                  title: 'Stage Completed', 
                  description: `${substageLabel} completed, moved to next stage` 
                });
              }
            } catch (error) {
              console.error('Error completing substage:', error);
              toast({ 
                title: 'Error', 
                description: 'Failed to complete stage', 
                variant: 'destructive' 
              });
            }
          },
          variant: 'default',
          show: true,
        });
      } else {
        // No substage - show general production actions
        actions.push({
          label: 'Mark Completed',
          icon: <CheckCircle className="h-4 w-4" />,
          onClick: async () => {
            try {
              if (!order.id) {
                toast({ title: 'Error', description: 'Order ID not found', variant: 'destructive' });
                return;
              }
              await updateItemStage(order.id, item.item_id, 'dispatch');
              await refreshOrders();
              toast({ title: 'Production Complete', description: 'Product ready for dispatch' });
            } catch (error) {
              console.error('Error updating stage:', error);
              toast({ title: 'Error', description: 'Failed to mark complete', variant: 'destructive' });
            }
          },
          variant: 'default',
          show: true,
        });
      }

      // Upload File - always available in production
      actions.push({
        label: 'Upload Photo',
        icon: <Upload className="h-4 w-4" />,
        onClick: () => {
          setUploadDialogOpen(true);
        },
        variant: 'secondary',
        show: true,
      });

      // Outsource - available in production
      actions.push({
        label: 'Outsource',
        icon: <Building2 className="h-4 w-4" />,
        onClick: () => {
          setOutsourceDialogOpen(true);
        },
        variant: 'outline',
        show: true,
      });
    }

    // OUTSOURCE INFO
    if (item.outsource_info) {
      actions.push({
        label: 'View Outsource',
        icon: <Building2 className="h-4 w-4" />,
        onClick: () => {
          window.open(`/outsource`, '_blank');
        },
        variant: 'outline',
        show: isAdmin || isProduction,
      });
    }

    // ASSIGN USER (if not assigned or admin)
    if ((isAdmin || currentDept === role) && !item.assigned_to) {
      actions.push({
        label: 'Assign User',
        icon: <User className="h-4 w-4" />,
        onClick: () => {
          setAssignUserDialogOpen(true);
        },
        variant: 'outline',
        show: true,
      });
    }

    // Remove actions that we already expose via the bottom quick-action bar
    const duplicateLabels = ['View Customer', 'Upload Photo', 'Assign User'];
    return actions.filter(a => a.show && !duplicateLabels.includes(a.label));
  }, [order, item, role, isAdmin, previousStage, itemStatus, assignToDepartment, updateItemStage, assignToUser, startSubstage, completeSubstage, refreshOrders, setAssignDeptDialogOpen, setUploadDialogOpen, setOutsourceDialogOpen, setAssignUserDialogOpen]);

  // Current production substage label (e.g. Foiling, Printing)
  const currentSubstageLabel = useMemo(() => {
    if (!item.current_substage) return null;
    const substage = PRODUCTION_STEPS.find(s => s.key === item.current_substage);
    return substage?.label || item.current_substage;
  }, [item.current_substage]);

  // All actions for icon buttons (no splitting needed)
  const allActions = availableActions;

  // Handle order number click - navigate to order details
  const handleOrderClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/orders/${order.order_id}`);
  };

  const shouldShowDeptBadge = item.assigned_department && item.assigned_department !== item.current_stage;
  const stageStatus =
    item.current_stage === 'sales'
      ? (!item.assigned_to ? 'Ready to assign' : 'In Sales')
      : item.current_stage === 'design'
        ? 'Pending Customer Approval'
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
                  {allActions.length > 4 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {allActions.slice(4).map((action, idx) => (
                        <Tooltip key={`icon-${idx}`}>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                action.onClick();
                              }}
                              className="h-8 w-8"
                            >
                              {action.icon}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="font-medium">{action.label}</p>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-start flex-wrap gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleOrderClick}
                      className="h-8 px-3 hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-1.5"
                    >
                      <Eye className="h-4 w-4" />
                      <span className="text-[11px]">View</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>View Full Details</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setUploadDialogOpen(true);
                      }}
                      className="h-8 px-3 hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-1.5"
                    >
                      <Upload className="h-4 w-4" />
                      <span className="text-[11px]">Upload</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>Upload Photo / File</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setNoteDialogOpen(true);
                      }}
                      className="h-8 px-3 hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-1.5"
                    >
                      <FileText className="h-4 w-4" />
                      <span className="text-[11px]">Note</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>Add note to order</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTimelineOpen(true);
                      }}
                      className="h-8 px-3 hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-1.5"
                    >
                      <Clock className="h-4 w-4" />
                      <span className="text-[11px]">Timeline</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>View Timeline</p>
                  </TooltipContent>
                </Tooltip>

                {item.assigned_department === 'sales' && (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAssignDeptDialogOpen(true);
                          }}
                          className="h-8 px-3 hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-1.5"
                        >
                          <Building2 className="h-4 w-4" />
                          <span className="text-[11px]">Dept</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>Assign Department</p>
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAssignUserDialogOpen(true);
                          }}
                          className="h-8 px-3 hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-1.5"
                        >
                          <User className="h-4 w-4" />
                          <span className="text-[11px]">User</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>Assign User</p>
                      </TooltipContent>
                    </Tooltip>

                    {(isAdmin || role === 'sales') && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!order.order_id) return;
                              if (!window.confirm(`Delete order ${order.order_id}? This action cannot be undone.`)) return;
                              try {
                                await deleteOrder(order.order_id);
                                await refreshOrders();
                              } catch (error) {
                                console.error('Error deleting order from card:', error);
                                toast({
                                  title: 'Error',
                                  description: 'Failed to delete order',
                                  variant: 'destructive',
                                });
                              }
                            }}
                            className="h-8 px-3 hover:bg-red-500/10 hover:text-red-500 transition-colors flex items-center gap-1.5"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="text-[11px]">Delete</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p>Delete Order</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <AssignUserDialog
        open={assignUserDialogOpen}
        onOpenChange={setAssignUserDialogOpen}
        department={item.assigned_department || item.current_stage}
        currentUserId={item.assigned_to}
        onAssign={async (userId, userName) => {
          if (!order.id) {
            toast({ title: 'Error', description: 'Order ID not found', variant: 'destructive' });
            return;
          }
          try {
            await assignToUser(order.id, item.item_id, userId, userName);
            toast({ title: 'Assigned', description: `Assigned to ${userName}` });
            await refreshOrders();
          } catch (error) {
            toast({ title: 'Error', description: 'Failed to assign user', variant: 'destructive' });
          }
        }}
      />

      <AssignDepartmentDialog
        open={assignDeptDialogOpen}
        onOpenChange={setAssignDeptDialogOpen}
        currentDepartment={item.assigned_department}
        onAssign={async (department) => {
          if (!order.id) {
            toast({ title: 'Error', description: 'Order ID not found', variant: 'destructive' });
            return;
          }
          try {
            await assignToDepartment(order.id, item.item_id, department);
            toast({ title: 'Assigned', description: `Assigned to ${department}` });
            await refreshOrders();
          } catch (error) {
            toast({ title: 'Error', description: 'Failed to assign department', variant: 'destructive' });
          }
        }}
      />

      <UploadFileDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        orderId={order.order_id}
        itemId={item.item_id}
        onUpload={async (file) => {
          if (!order.order_id) {
            toast({ title: 'Error', description: 'Order ID not found', variant: 'destructive' });
            return;
          }
          try {
            // uploadFile expects order.order_id (string), not order.id (UUID)
            await uploadFile(order.order_id, item.item_id, file);
            // Refresh orders to get updated file list
            await refreshOrders();
            toast({ 
              title: 'File Uploaded', 
              description: 'File uploaded successfully and will appear in the card' 
            });
          } catch (error) {
            console.error('Error uploading file:', error);
            toast({ 
              title: 'Upload Failed', 
              description: 'Failed to upload file. Please try again.', 
              variant: 'destructive' 
            });
          }
        }}
      />

      <ChangeStageDialog
        open={changeStageDialogOpen}
        onOpenChange={setChangeStageDialogOpen}
        currentStage={item.current_stage}
        currentSubstage={item.current_substage}
        onChangeStage={async (newStage, substage) => {
          if (!order.id) {
            toast({ title: 'Error', description: 'Order ID not found', variant: 'destructive' });
            return;
          }
          try {
            await updateItemStage(order.id, item.item_id, newStage, substage);
            toast({ title: 'Stage Updated', description: `Moved to ${newStage}` });
            await refreshOrders();
          } catch (error) {
            toast({ title: 'Error', description: 'Failed to update stage', variant: 'destructive' });
          }
        }}
      />

      {outsourceDialogOpen && (
        <OutsourceAssignmentDialog
          open={outsourceDialogOpen}
          onOpenChange={setOutsourceDialogOpen}
          productName={item.product_name}
          quantity={item.quantity}
          onAssign={async (vendorDetails, jobDetails) => {
            if (!order.id) {
              toast({ title: 'Error', description: 'Order ID not found', variant: 'destructive' });
              return;
            }
            try {
              await assignToOutsource(order.id, item.item_id, vendorDetails, jobDetails);
              await refreshOrders();
              toast({ title: 'Outsourced', description: `Assigned to ${vendorDetails.vendor_name}` });
              setOutsourceDialogOpen(false);
            } catch (error) {
              console.error('Error assigning outsource:', error);
              toast({ title: 'Error', description: 'Failed to assign outsource', variant: 'destructive' });
            }
          }}
        />
      )}

      {/* Production Stage Sequence Dialog */}
      <ProductionStageSequenceDialog
        open={productionStageDialogOpen}
        onOpenChange={setProductionStageDialogOpen}
        productName={item.product_name}
        orderId={order.id || order.order_id}
        currentSequence={(item as any).production_stage_sequence}
        onConfirm={async (sequence) => {
          if (!order.id) {
            toast({ title: 'Error', description: 'Order ID not found', variant: 'destructive' });
            return;
          }
          try {
            await sendToProduction(order.id, item.item_id, sequence);
            await refreshOrders();
            toast({ title: 'Sent to Production', description: 'Product assigned to Production with stage sequence' });
            setProductionStageDialogOpen(false);
          } catch (error) {
            console.error('Error sending to production:', error);
            toast({ title: 'Error', description: 'Failed to send to production', variant: 'destructive' });
          }
        }}
      />

      {/* Timeline Dialog */}
      <Dialog open={timelineOpen} onOpenChange={setTimelineOpen}>
        <DialogContent className="max-w-3xl h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Timeline - {order.order_id} ({item.product_name})
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-1">
            <OrderTimeline
              entries={getTimelineForOrder(order.order_id)?.filter(
                (entry) => !entry.item_id || entry.item_id === item.item_id
              ) || []}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Note Dialog */}
      <AddNoteDialog
        open={noteDialogOpen}
        onOpenChange={setNoteDialogOpen}
        onAdd={async (note, isPublic) => {
          try {
            await addNote(order.order_id, note);
            await refreshOrders();
          } catch (error) {
            toast({ title: 'Error', description: 'Failed to add note', variant: 'destructive' });
          }
        }}
      />

    </TooltipProvider>
  );
}

