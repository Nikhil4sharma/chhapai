import { useParams, Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { UpdateDeliveryDateDialog } from '@/components/dialogs/UpdateDeliveryDateDialog';
import { 
  ArrowLeft, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  Package,
  Upload,
  Edit,
  MoreHorizontal,
  Users,
  MessageSquare,
  ArrowRight,
  FileText,
  CheckCircle,
  Factory,
  Truck,
  Trash2,
  UserCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Palette,
  Copy,
  Check,
  Lock,
  Building2,
  Clock,
  X,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PriorityBadge } from '@/components/orders/PriorityBadge';
import { StageBadge } from '@/components/orders/StageBadge';
import { OrderTimeline } from '@/components/orders/OrderTimeline';
import { FilePreview } from '@/components/orders/FilePreview';
import { FileHistory } from '@/components/orders/FileHistory';
import { ProductSpecifications } from '@/components/orders/ProductSpecifications';
import { ShippingDetails } from '@/components/orders/ShippingDetails';
import { OrderFinancials } from '@/components/orders/OrderFinancials';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useOrders } from '@/contexts/OrderContext';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkLogs } from '@/contexts/WorkLogContext';
import { useFinancialAccess } from '@/hooks/useFinancialAccess';
import { toast } from '@/hooks/use-toast';
import { UploadFileDialog } from '@/components/dialogs/UploadFileDialog';
import { AssignDepartmentDialog } from '@/components/dialogs/AssignDepartmentDialog';
import { AssignUserDialog } from '@/components/dialogs/AssignUserDialog';
import { AddNoteDialog } from '@/components/dialogs/AddNoteDialog';
import { AddWorkNoteDialog } from '@/components/dialogs/AddWorkNoteDialog';
import { EditOrderDialog } from '@/components/dialogs/EditOrderDialog';
import { ProductionStageSequenceDialog } from '@/components/dialogs/ProductionStageSequenceDialog';
import { OutsourceAssignmentDialog } from '@/components/dialogs/OutsourceAssignmentDialog';
import { FollowUpNoteDialog } from '@/components/dialogs/FollowUpNoteDialog';
import { VendorDispatchDialog } from '@/components/dialogs/VendorDispatchDialog';
import { ReceiveFromVendorDialog } from '@/components/dialogs/ReceiveFromVendorDialog';
import { QualityCheckDialog } from '@/components/dialogs/QualityCheckDialog';
import { PostQCDecisionDialog } from '@/components/dialogs/PostQCDecisionDialog';
import { PRODUCTION_STEPS, STAGE_LABELS, Stage, SubStage, VendorDetails, OutsourceJobDetails, OUTSOURCE_STAGE_LABELS, OutsourceStage, TimelineEntry, OrderItem } from '@/types/order';
import { shouldShowButton, getButtonDisabledReason, canPerformAction } from '@/utils/buttonVisibility';

export default function OrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { 
    getOrderById, 
    getTimelineForOrder, 
    uploadFile, 
    assignToDepartment,
    assignToOutsource,
    assignToUser,
    addNote, 
    updateOrder, 
    updateItemStage, 
    completeSubstage, 
    sendToProduction, 
    markAsDispatched,
    deleteOrder,
    updateItemDeliveryDate,
    updateOutsourceStage,
    addFollowUpNote,
    vendorDispatch,
    receiveFromVendor,
    qualityCheck,
    postQCDecision,
    isLoading,
    refreshOrders,
  } = useOrders();
  const { isAdmin, role, user } = useAuth();
  const { canViewFinancials } = useFinancialAccess();
  const { getWorkNotesByOrder, addWorkNote, getWorkLogsByOrder } = useWorkLogs();
  
  const order = getOrderById(orderId || '');
  const timelineEntries = orderId ? getTimelineForOrder(orderId) : [];
  const workNotes = orderId ? getWorkNotesByOrder(orderId) : [];
  const workLogsForOrder = orderId ? getWorkLogsByOrder(orderId) : [];
  
  // Merge timeline entries with work logs for comprehensive timeline view
  const timeline = useMemo(() => {
    const combined: TimelineEntry[] = [...timelineEntries];
    
    // Convert work logs to timeline entries
    workLogsForOrder.forEach(log => {
      combined.push({
        timeline_id: log.log_id,
        order_id: log.order_id,
        item_id: log.order_item_id || undefined,
        stage: log.stage as any,
        action: log.action_type.replace('_', ' ') as any,
        performed_by: log.user_id,
        performed_by_name: log.user_name,
        notes: `${log.work_summary}${log.time_spent_minutes > 0 ? ` (${Math.floor(log.time_spent_minutes / 60)}h ${log.time_spent_minutes % 60}m)` : ''}`,
        is_public: true,
        created_at: log.created_at,
      });
    });
    
    // Sort by created_at descending (newest first)
    return combined.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [timelineEntries, workLogsForOrder]);

  // Dialog states
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignUserDialogOpen, setAssignUserDialogOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deliveryDateDialogOpen, setDeliveryDateDialogOpen] = useState(false);
  const [workNoteDialogOpen, setWorkNoteDialogOpen] = useState(false);
  const [productionStageDialogOpen, setProductionStageDialogOpen] = useState(false);
  const [timelineDialogOpen, setTimelineDialogOpen] = useState(false);
  const [highlightedTimelineId, setHighlightedTimelineId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedItemForDeliveryDate, setSelectedItemForDeliveryDate] = useState<{ itemId: string; productName: string; currentDate: Date } | null>(null);
  const [selectedItemForProduction, setSelectedItemForProduction] = useState<{ orderId: string; itemId: string; productName: string; currentSequence?: string[] | null } | null>(null);
  const [pendingDepartmentAssignment, setPendingDepartmentAssignment] = useState<string | null>(null);
  const [outsourceDialogOpen, setOutsourceDialogOpen] = useState(false);
  const [selectedItemForOutsource, setSelectedItemForOutsource] = useState<{ itemId: string; productName: string; quantity: number } | null>(null);
  const [followUpNoteDialogOpen, setFollowUpNoteDialogOpen] = useState(false);
  const [vendorDispatchDialogOpen, setVendorDispatchDialogOpen] = useState(false);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [qcDialogOpen, setQcDialogOpen] = useState(false);
  const [postQCDialogOpen, setPostQCDialogOpen] = useState(false);
  const [selectedItemForOutsourceAction, setSelectedItemForOutsourceAction] = useState<{ itemId: string; productName: string } | null>(null);
  
  // Collapsible states - Important sections open by default for quick access
  const [itemsOpen, setItemsOpen] = useState(true);
  const [timelineOpen, setTimelineOpen] = useState(true); // Open by default
  const [customerOpen, setCustomerOpen] = useState(true); // Open by default for quick access
  const [expandedItems, setExpandedItems] = useState<Record<string, {
    details: boolean;
    specifications: boolean;
    files: boolean;
  }>>({});
  // Product cards collapsible state - first product open by default
  // Product cards collapsible state - first product open by default
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});

  const canDelete = isAdmin || role === 'sales';

  // Check if user can edit an item based on current stage and assigned department
  const canEditItem = useCallback((item: OrderItem): boolean => {
    if (isAdmin) return true;
    if (role === 'sales') return true; // Sales can edit all
    
    // User can only edit if item is in their department's stage
    const stageToDept: Record<Stage, string> = {
      sales: 'sales',
      design: 'design',
      prepress: 'prepress',
      production: 'production',
      dispatch: 'production',
      completed: 'production',
    };
    
    const itemDept = stageToDept[item.current_stage];
    return itemDept === role || item.assigned_department === role;
  }, [isAdmin, role]);

  // Initialize first product as expanded if not already set
  // This hook must be called before any early returns
  useEffect(() => {
    if (order && order.items && order.items.length > 0 && Object.keys(expandedProducts).length === 0) {
      setExpandedProducts({ [order.items[0].item_id]: true });
    }
  }, [order, expandedProducts]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // CRITICAL FIX: Only show "Order not found" if loading is complete AND order is still not found
  // Don't show false negative during loading or while snapshot is updating
  if (!isLoading && !order) {
    return (
      <TooltipProvider>
        <div className="flex flex-col items-center justify-center py-12">
          <h2 className="text-xl font-semibold mb-2">Order not found</h2>
          <p className="text-muted-foreground mb-4">The order you're looking for doesn't exist or you don't have access to it.</p>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild>
                <Link to="/dashboard">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Go back to dashboard</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    );
  }

  // Check if order has items
  if (!order.items || order.items.length === 0) {
    return (
      <TooltipProvider>
        <div className="flex flex-col items-center justify-center py-12">
          <h2 className="text-xl font-semibold mb-2">Order has no items</h2>
          <p className="text-muted-foreground mb-4">This order doesn't have any items.</p>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild>
                <Link to="/dashboard">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Go back to dashboard</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    );
  }

  const mainItem = order.items[0];
  const selectedItem = order.items.find(i => i.item_id === selectedItemId);
  
  // Get delivery date for summary card
  const deliveryDate = mainItem?.delivery_date || order.order_level_delivery_date;

  const handleUpload = async (file: File, replaceExisting: boolean) => {
    if (selectedItemId) {
      await uploadFile(orderId!, selectedItemId, file, replaceExisting);
    }
  };

  const handleAssign = async (department: string) => {
    if (selectedItemId) {
      const item = order.items.find(i => i.item_id === selectedItemId);
      if (!item) return;

      // If assigning to production, show production stages dialog first
      if (department === 'production') {
        setSelectedItemForProduction({
          orderId: orderId!,
          itemId: selectedItemId,
          productName: item.product_name,
          currentSequence: (item as any).production_stage_sequence
        });
        setProductionStageDialogOpen(true);
        // Store department assignment to complete after stages are selected
        setPendingDepartmentAssignment(department);
      } else if (department === 'outsource') {
        // If assigning to outsource, show outsource assignment dialog
        setSelectedItemForOutsource({
          itemId: selectedItemId,
          productName: item.product_name,
          quantity: item.quantity
        });
        setOutsourceDialogOpen(true);
      } else {
        await assignToDepartment(orderId!, selectedItemId, department);
      }
    }
  };

  const handleOutsourceAssign = async (vendor: VendorDetails, jobDetails: OutsourceJobDetails) => {
    if (selectedItemForOutsource) {
      await assignToOutsource(orderId!, selectedItemForOutsource.itemId, vendor, jobDetails);
      setOutsourceDialogOpen(false);
      setSelectedItemForOutsource(null);
    }
  };

  const handleAssignUser = async (userId: string, userName: string) => {
    if (selectedItemId) {
      await assignToUser(orderId!, selectedItemId, userId, userName);
    }
  };

  const handleAddNote = (note: string, isPublic: boolean) => {
    addNote(orderId!, note);
  };

  const handleEditSave = (updates: Partial<typeof order>) => {
    updateOrder(orderId!, updates);
  };


  const handleNextStage = async (itemId: string) => {
    await completeSubstage(orderId!, itemId);
  };

  const handleDelete = async () => {
    await deleteOrder(orderId!);
    navigate('/dashboard');
  };

  const openDialogForItem = (dialog: 'upload' | 'assign' | 'assignUser', itemId: string) => {
    setSelectedItemId(itemId);
    if (dialog === 'upload') setUploadDialogOpen(true);
    if (dialog === 'assign') setAssignDialogOpen(true);
    if (dialog === 'assignUser') setAssignUserDialogOpen(true);
  };

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col">
        {/* Sticky Header Section */}
        <div className="sticky top-0 z-10 bg-background border-b pb-4 pt-4 space-y-3 flex-shrink-0">
          {/* Order Header - Always Visible */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-display font-bold truncate">Order #{order.order_id}</h1>
                <PriorityBadge priority={order.priority_computed} showLabel />
                {order.source === 'wordpress' && (
                  <Badge variant="outline" className="text-xs">WooCommerce</Badge>
                )}
                {order.is_completed && (
                  <Badge className="bg-green-500 text-xs">Completed</Badge>
                )}
              </div>
              
              {/* Delivery Date - Color Coded */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Calendar className={`h-4 w-4 ${
                    order.priority_computed === 'red' ? 'text-red-500' :
                    order.priority_computed === 'yellow' ? 'text-yellow-500' :
                    'text-blue-500'
                  }`} />
                  <span className={`text-sm font-medium ${
                    order.priority_computed === 'red' ? 'text-red-600 dark:text-red-400' :
                    order.priority_computed === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-blue-600 dark:text-blue-400'
                  }`}>
                    Delivery: {deliveryDate ? format(deliveryDate, 'MMM d, yyyy') : 'Not set'}
                  </span>
                </div>
                
                {/* Current Stage */}
                {mainItem && (
                  <div className="flex items-center gap-2">
                    <StageBadge stage={mainItem.current_stage} />
                  </div>
                )}
                
                {/* Assigned To */}
                {mainItem?.assigned_to_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <UserCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Assigned to: <strong>{mainItem.assigned_to_name}</strong></span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex gap-2 flex-shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 sm:h-9 text-xs sm:text-sm" onClick={() => setEditDialogOpen(true)}>
                    <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                    <span className="hidden sm:inline">Edit</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit order details</TooltipContent>
              </Tooltip>
              
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 w-8 sm:h-9 sm:w-9 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>More actions</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" className="bg-popover">
                  <DropdownMenuItem onClick={() => window.print()}>
                    Print Order
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    Duplicate Order
                  </DropdownMenuItem>
                  {canDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => setDeleteDialogOpen(true)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Order
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Summary Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Status Card */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">Status</p>
                <Package className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {mainItem && <StageBadge stage={mainItem.current_stage} />}
              </div>
            </Card>

            {/* Priority Card */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">Priority</p>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </div>
              <PriorityBadge priority={order.priority_computed} />
            </Card>

            {/* Items Card */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">Items</p>
                <Package className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-lg font-semibold">{order.items.length}</p>
            </Card>

            {/* Delivery Card */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">Delivery</p>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold">
                {deliveryDate ? format(deliveryDate, 'MMM d, yyyy') : 'Not set'}
              </p>
            </Card>
          </div>
        </div>

        {/* Scrollable Content Grid */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main content - Products Section */}
          <div className="lg:col-span-2 flex flex-col gap-4 min-h-0">
            {/* Items - Scrollable Container */}
            <Card className="flex-1 flex flex-col min-h-0">
              <Collapsible open={itemsOpen} onOpenChange={setItemsOpen}>
                <CardHeader className="flex-shrink-0 pb-3">
                  <CollapsibleTrigger asChild>
                    <div 
                      className="flex items-center justify-between cursor-pointer hover:bg-muted/50 -mx-4 -my-2 px-4 py-2 rounded-lg transition-colors"
                    >
                      <CardTitle className="text-lg font-display flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Order Items ({order.items.length})
                      </CardTitle>
                      {itemsOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                    </div>
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="flex-1 overflow-y-auto custom-scrollbar pt-0 space-y-4">
                    {order.items.map((item, index) => {
                      const deliveryDateFormatted = format(item.delivery_date, 'd MMMM yyyy');
                      const priorityColor = item.priority_computed === 'red' 
                        ? 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                        : item.priority_computed === 'yellow'
                        ? 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800'
                        : 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800';
                      
                      const itemExpanded = expandedItems[item.item_id] || {
                        details: false,
                        specifications: false,
                        files: false,
                      };
                      
                      const toggleItemSection = (section: 'details' | 'specifications' | 'files') => {
                        setExpandedItems(prev => ({
                          ...prev,
                          [item.item_id]: {
                            ...prev[item.item_id],
                            [section]: !prev[item.item_id]?.[section],
                          }
                        }));
                      };

                      const isProductExpanded = expandedProducts[item.item_id] ?? (index === 0); // First product open by default
                      const toggleProduct = () => {
                        setExpandedProducts(prev => ({
                          ...prev,
                          [item.item_id]: !prev[item.item_id],
                        }));
                      };
                      
                      return (
                      <Collapsible 
                        key={item.item_id} 
                        open={isProductExpanded} 
                        onOpenChange={toggleProduct}
                        className={`bg-card border-2 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 ${index > 0 ? 'mt-4 sm:mt-6' : ''}`}
                      >
                        {/* Product Header - Always Visible & Clickable */}
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center justify-between p-4 sm:p-5 lg:p-6 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-xl">
                            <div className="flex flex-col gap-3 sm:gap-4 flex-1 min-w-0">
                              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2 flex-wrap">
                                    <h4 className="font-bold text-lg sm:text-xl text-foreground break-words">{item.product_name}</h4>
                                    <Badge 
                                      className={`${priorityColor} border font-medium text-xs px-2.5 py-0.5 w-fit`}
                                    >
                                      {deliveryDateFormatted}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <PriorityBadge priority={item.priority_computed} />
                                    <StageBadge stage={item.current_stage} />
                                    {item.current_substage && (
                                      <Badge variant="outline" className="capitalize text-xs">
                                        {item.current_substage}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="text-left sm:text-right">
                                  <p className="text-xs text-muted-foreground mb-1">Order Number</p>
                                  <p className="font-bold text-primary text-sm sm:text-base">{order.order_id}</p>
                                </div>
                              </div>

                              {/* Assigned user */}
                              {item.assigned_to_name && (
                                <div className="flex items-center gap-2 text-sm text-primary bg-primary/5 px-3 py-2 rounded-md border border-primary/10">
                                  <UserCircle className="h-4 w-4" />
                                  <span>Assigned to: <strong>{item.assigned_to_name}</strong></span>
                                </div>
                              )}

                              {/* Tracking Details - Show if dispatched */}
                              {item.is_dispatched && item.dispatch_info && (
                                <div className="border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 rounded-lg p-4 space-y-3">
                                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                                    <Truck className="h-5 w-5" />
                                    <h5 className="font-semibold text-base">Tracking Details</h5>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1">Courier Company</p>
                                      <p className="font-medium">{item.dispatch_info.courier_company}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1">Tracking / AWB Number</p>
                                      <p className="font-medium font-mono">{item.dispatch_info.tracking_number}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1">Dispatch Date</p>
                                      <p className="font-medium">{format(new Date(item.dispatch_info.dispatch_date), 'MMM d, yyyy')}</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex-shrink-0 ml-2">
                              {isProductExpanded ? (
                                <ChevronUp className="h-5 w-5 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        </CollapsibleTrigger>

                        {/* Product Content - Collapsible */}
                        <CollapsibleContent>
                          <div className="px-4 sm:px-5 lg:px-6 pb-4 sm:pb-5 lg:pb-6 pt-0">
                            <div className="flex flex-col gap-4 sm:gap-5">
                              {/* Product Details - Collapsible */}
                              <Collapsible open={itemExpanded.details} onOpenChange={() => toggleItemSection('details')}>
                            <CollapsibleTrigger asChild>
                              <div className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded-lg p-3 -mx-1 transition-colors">
                                <div className="flex items-center gap-2">
                                  <Package className="h-4 w-4 text-muted-foreground" />
                                  <h5 className="font-semibold text-sm sm:text-base">Product Details</h5>
                                </div>
                                {itemExpanded.details ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg mt-2">
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Product Name</p>
                                  <p className="font-semibold text-sm sm:text-base">{item.product_name}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Quantity</p>
                                  <p className="font-semibold text-sm sm:text-base">{item.quantity}</p>
                                </div>
                                {/* Financial data only for admin/sales */}
                                {canViewFinancials && item.line_total && (
                                  <div className="sm:col-span-2">
                                    <p className="text-xs text-muted-foreground mb-1">Line Total</p>
                                    <div className="flex items-baseline gap-2 flex-wrap">
                                      <p className="font-semibold text-base sm:text-lg">₹{item.line_total.toFixed(2)}</p>
                                      <p className="text-xs text-muted-foreground">
                                        ({item.quantity} × ₹{(item.line_total / item.quantity).toFixed(2)})
                                      </p>
                                    </div>
                                  </div>
                                )}
                                <div className="flex items-center justify-between sm:col-span-2">
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Delivery Date</p>
                                    <div className="flex items-center gap-1.5">
                                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                      <p className="font-semibold text-sm sm:text-base">{format(item.delivery_date, 'MMM d, yyyy')}</p>
                                    </div>
                                  </div>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedItemForDeliveryDate({
                                            itemId: item.item_id,
                                            productName: item.product_name,
                                            currentDate: item.delivery_date,
                                          });
                                          setDeliveryDateDialogOpen(true);
                                        }}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Update delivery date</TooltipContent>
                                  </Tooltip>
                                </div>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>

                              {/* Outsource Information */}
                              {item.current_stage === 'outsource' && item.outsource_info && (
                                <div className="border-t pt-4 space-y-4">
                                  <div className="bg-stage-outsource/5 border border-stage-outsource/20 rounded-lg p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                  <h5 className="font-semibold text-foreground flex items-center gap-2">
                                    <Building2 className="h-4 w-4" />
                                    Outsource Details
                                  </h5>
                                  <Badge variant={`stage-${item.current_stage}` as any}>
                                    {OUTSOURCE_STAGE_LABELS[item.outsource_info.current_outsource_stage]}
                                  </Badge>
                                </div>

                                {/* Vendor Card */}
                                <div className="bg-background rounded-lg p-3 border border-border">
                                  <p className="text-xs text-muted-foreground mb-2">Vendor Information</p>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                    <div>
                                      <p className="font-medium">{item.outsource_info.vendor.vendor_name}</p>
                                      {item.outsource_info.vendor.vendor_company && (
                                        <p className="text-xs text-muted-foreground">{item.outsource_info.vendor.vendor_company}</p>
                                      )}
                                    </div>
                                    <div className="space-y-1">
                                      {item.outsource_info.vendor.contact_person && (
                                        <div className="flex items-center gap-1.5 text-xs">
                                          <UserCircle className="h-3 w-3" />
                                          <span>{item.outsource_info.vendor.contact_person}</span>
                                        </div>
                                      )}
                                      <div className="flex items-center gap-1.5 text-xs">
                                        <Phone className="h-3 w-3" />
                                        <span>{item.outsource_info.vendor.phone}</span>
                                      </div>
                                      {item.outsource_info.vendor.email && (
                                        <div className="flex items-center gap-1.5 text-xs">
                                          <Mail className="h-3 w-3" />
                                          <span>{item.outsource_info.vendor.email}</span>
                                        </div>
                                      )}
                                      {item.outsource_info.vendor.city && (
                                        <div className="flex items-center gap-1.5 text-xs">
                                          <MapPin className="h-3 w-3" />
                                          <span>{item.outsource_info.vendor.city}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Job Details */}
                                <div className="bg-background rounded-lg p-3 border border-border">
                                  <p className="text-xs text-muted-foreground mb-2">Job Details</p>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                    <div>
                                      <p className="text-xs text-muted-foreground">Work Type</p>
                                      <p className="font-medium">{item.outsource_info.job_details.work_type}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground">Expected Ready</p>
                                      <p className="font-medium">{format(item.outsource_info.job_details.expected_ready_date, 'MMM d, yyyy')}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground">Quantity Sent</p>
                                      <p className="font-medium">{item.outsource_info.job_details.quantity_sent}</p>
                                    </div>
                                    {item.outsource_info.job_details.special_instructions && (
                                      <div className="sm:col-span-2">
                                        <p className="text-xs text-muted-foreground">Special Instructions</p>
                                        <p className="text-sm">{item.outsource_info.job_details.special_instructions}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Follow-Up Notes */}
                                {item.outsource_info.follow_up_notes && item.outsource_info.follow_up_notes.length > 0 && (
                                  <div className="bg-background rounded-lg p-3 border border-border">
                                    <p className="text-xs text-muted-foreground mb-2">Follow-Up Notes</p>
                                    <div className="space-y-2 max-h-40 overflow-y-auto">
                                      {item.outsource_info.follow_up_notes.map((note) => (
                                        <div key={note.note_id} className="text-xs p-2 bg-secondary/50 rounded">
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="font-medium">{note.created_by_name}</span>
                                            <span className="text-muted-foreground">{format(note.created_at, 'MMM d, h:mm a')}</span>
                                          </div>
                                          <p className="text-foreground">{note.note}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Outsource Actions */}
                                {(isAdmin || role === 'sales' || role === 'prepress') && (
                                  <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                                    {/* Add Follow-Up Note - Available at all stages */}
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedItemForOutsourceAction({
                                          itemId: item.item_id,
                                          productName: item.product_name,
                                        });
                                        setFollowUpNoteDialogOpen(true);
                                      }}
                                    >
                                      <FileText className="h-4 w-4 mr-1" />
                                      Add Note
                                    </Button>

                                    {/* Stage-specific actions */}
                                    {item.outsource_info.current_outsource_stage === 'outsourced' && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          updateOutsourceStage(orderId!, item.item_id, 'vendor_in_progress');
                                        }}
                                      >
                                        <ArrowRight className="h-4 w-4 mr-1" />
                                        Mark In Progress
                                      </Button>
                                    )}

                                    {item.outsource_info.current_outsource_stage === 'vendor_in_progress' && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setSelectedItemForOutsourceAction({
                                            itemId: item.item_id,
                                            productName: item.product_name,
                                          });
                                          setVendorDispatchDialogOpen(true);
                                        }}
                                      >
                                        <Truck className="h-4 w-4 mr-1" />
                                        Mark Dispatched
                                      </Button>
                                    )}

                                    {item.outsource_info.current_outsource_stage === 'vendor_dispatched' && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setSelectedItemForOutsourceAction({
                                            itemId: item.item_id,
                                            productName: item.product_name,
                                          });
                                          setReceiveDialogOpen(true);
                                        }}
                                      >
                                        <Package className="h-4 w-4 mr-1" />
                                        Mark Received
                                      </Button>
                                    )}

                                    {item.outsource_info.current_outsource_stage === 'received_from_vendor' && (
                                      <Button
                                        size="sm"
                                        onClick={() => {
                                          updateOutsourceStage(orderId!, item.item_id, 'quality_check');
                                        }}
                                      >
                                        <CheckCircle className="h-4 w-4 mr-1" />
                                        Start QC
                                      </Button>
                                    )}

                                    {item.outsource_info.current_outsource_stage === 'quality_check' && (
                                      <Button
                                        size="sm"
                                        onClick={() => {
                                          setSelectedItemForOutsourceAction({
                                            itemId: item.item_id,
                                            productName: item.product_name,
                                          });
                                          setQcDialogOpen(true);
                                        }}
                                      >
                                        <CheckCircle className="h-4 w-4 mr-1" />
                                        Perform QC
                                      </Button>
                                    )}

                                    {item.outsource_info.current_outsource_stage === 'decision_pending' && (
                                      <Button
                                        size="sm"
                                        onClick={() => {
                                          setSelectedItemForOutsourceAction({
                                            itemId: item.item_id,
                                            productName: item.product_name,
                                          });
                                          setPostQCDialogOpen(true);
                                        }}
                                      >
                                        <ArrowRight className="h-4 w-4 mr-1" />
                                        Make Decision
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                                </div>
                              )}

                              {/* Product Specifications - Collapsible */}
                              <Collapsible open={itemExpanded.specifications} onOpenChange={() => toggleItemSection('specifications')}>
                                <CollapsibleTrigger asChild>
                              <div className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded-lg p-3 -mx-1 transition-colors border-t pt-4">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-muted-foreground" />
                                  <h5 className="font-semibold text-sm sm:text-base">Product Specifications</h5>
                                  {item.specifications && Object.keys(item.specifications).length > 0 && (
                                    <Badge variant="secondary" className="text-xs">
                                      {Object.keys(item.specifications).filter(k => !/^\d+$/.test(k) && !['sku', 'SKU', 'notes', '_sku', 'product_sku', 'id'].includes(k.toLowerCase())).length} specs
                                    </Badge>
                                  )}
                                </div>
                                {itemExpanded.specifications ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="pt-3">
                                <ProductSpecifications item={item} />
                              </div>
                            </CollapsibleContent>
                          </Collapsible>

                              {/* Files with FileHistory component - Collapsible */}
                              <Collapsible open={itemExpanded.files} onOpenChange={() => toggleItemSection('files')}>
                            <CollapsibleTrigger asChild>
                              <div className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded-lg p-3 -mx-1 transition-colors border-t pt-4">
                                <div className="flex items-center gap-2">
                                  <Upload className="h-4 w-4 text-muted-foreground" />
                                  <h5 className="font-semibold text-sm sm:text-base">
                                    Files ({new Set(item.files.map(f => f.type || 'other')).size} role{item.files.length !== 1 ? 's' : ''})
                                  </h5>
                                  {item.files.length > 0 && (
                                    <Badge variant="secondary" className="text-xs">
                                      {item.files.length} file{item.files.length !== 1 ? 's' : ''}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {canEditItem(item) && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedItemId(item.item_id);
                                        setUploadDialogOpen(true);
                                      }}
                                    >
                                      <Upload className="h-3 w-3 mr-1" />
                                      Upload
                                    </Button>
                                  )}
                                  {itemExpanded.files ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                </div>
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="pt-3">
                                {item.files.length > 0 ? (
                                  <FileHistory 
                                    files={item.files} 
                                    orderId={orderId || ''}
                                    itemId={item.item_id}
                                    onFileDeleted={() => refreshOrders()}
                                  />
                                ) : (
                                  <div className="text-center py-6 text-muted-foreground border border-dashed rounded-lg">
                                    <Upload className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No files uploaded yet</p>
                                    {canEditItem(item) && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-3"
                                        onClick={() => {
                                          setSelectedItemId(item.item_id);
                                          setUploadDialogOpen(true);
                                        }}
                                      >
                                        <Upload className="h-4 w-4 mr-2" />
                                        Upload File
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>

                              {/* Item Actions - Only show if user can edit this item */}
                              {canEditItem(item) && (
                            <div className="border-t pt-4 sm:pt-5">
                              <div className="flex flex-wrap gap-2 sm:gap-2.5">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      className="flex-1 sm:flex-initial min-w-[140px]"
                                      onClick={() => {
                                        setSelectedItemId(item.item_id);
                                        setWorkNoteDialogOpen(true);
                                      }}
                                    >
                                      <MessageSquare className="h-4 w-4 mr-1.5" />
                                      <span className="text-xs sm:text-sm">Work Note</span>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Add a work note for this item</TooltipContent>
                                </Tooltip>

                                {/* Show Assign Dept first (more common workflow) */}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      className="flex-1 sm:flex-initial min-w-[140px]"
                                      onClick={() => openDialogForItem('assign', item.item_id)}
                                    >
                                      <Users className="h-4 w-4 mr-1.5" />
                                      <span className="text-xs sm:text-sm">Assign Dept</span>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Assign to department (automatically updates stage)
                                  </TooltipContent>
                                </Tooltip>

                                {item.current_stage === 'production' && item.current_substage && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button 
                                        size="sm"
                                        className="flex-1 sm:flex-initial min-w-[140px]"
                                        onClick={() => handleNextStage(item.item_id)}
                                      >
                                        <CheckCircle className="h-4 w-4 mr-1.5" />
                                        <span className="text-xs sm:text-sm">Complete {item.current_substage}</span>
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Mark {item.current_substage} as complete and move to next</TooltipContent>
                                  </Tooltip>
                                )}

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      className="flex-1 sm:flex-initial min-w-[140px]"
                                      onClick={() => openDialogForItem('assignUser', item.item_id)}
                                    >
                                      <UserCircle className="h-4 w-4 mr-1.5" />
                                      <span className="text-xs sm:text-sm">Assign User</span>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Assign to team member</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      className="flex-1 sm:flex-initial min-w-[140px]"
                                      onClick={() => openDialogForItem('upload', item.item_id)}
                                    >
                                      <Upload className="h-4 w-4 mr-1.5" />
                                      <span className="text-xs sm:text-sm">Upload</span>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Upload file for this item</TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                              )}
                              
                              {/* Show message if user cannot edit */}
                              {!canEditItem(item) && (
                            <div className="border-t pt-4 sm:pt-5">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/50 rounded-lg p-3">
                                <Lock className="h-4 w-4" />
                                <p>This item is in <span className="font-medium capitalize">{item.current_stage}</span> stage. Only {item.current_stage} department can make changes.</p>
                              </div>
                            </div>
                          )}
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                    })}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>

            {/* Timeline - Separate Scrollable Container with better sizing */}
            <Card className="flex flex-col overflow-hidden">
              <Collapsible open={timelineOpen} onOpenChange={setTimelineOpen} defaultOpen={true}>
                <CardHeader className="flex-shrink-0 pb-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CollapsibleTrigger asChild>
                      <div 
                        className="flex items-center justify-between cursor-pointer hover:bg-muted/50 -mx-4 -my-2 px-4 py-2 rounded-lg transition-colors flex-1 min-w-0"
                      >
                        <CardTitle className="text-base sm:text-lg font-display truncate">Timeline ({timeline.length})</CardTitle>
                        {timelineOpen ? <ChevronUp className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0 ml-2" /> : <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0 ml-2" />}
                      </div>
                    </CollapsibleTrigger>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setTimelineDialogOpen(true);
                        setHighlightedTimelineId(null);
                      }}
                      className="shrink-0 h-8 sm:h-9 text-xs sm:text-sm"
                    >
                      <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                      <span className="hidden xs:inline">View Full</span>
                      <span className="xs:hidden">Full</span>
                    </Button>
                  </div>
                </CardHeader>
                <CollapsibleContent className="flex-1 min-h-0 overflow-hidden">
                  <CardContent className="h-full max-h-[400px] sm:max-h-[500px] lg:max-h-[600px] overflow-y-auto custom-scrollbar pt-0 px-4 sm:px-6">
                    <OrderTimeline 
                      entries={timeline} 
                      onEntryClick={(entryId) => {
                        setHighlightedTimelineId(entryId);
                        setTimelineDialogOpen(true);
                      }}
                      highlightedId={highlightedTimelineId}
                    />
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          </div>

          {/* Sidebar - Scrollable */}
          <div className="lg:col-span-1 flex flex-col gap-4 min-h-0 max-h-full overflow-y-auto custom-scrollbar">
            {/* Customer info */}
            <Card>
              <Collapsible open={customerOpen} onOpenChange={setCustomerOpen} defaultOpen={true}>
                <CardHeader className="flex-shrink-0 pb-3">
                  <CollapsibleTrigger asChild>
                    <div 
                      className="flex items-center justify-between cursor-pointer hover:bg-muted/50 -mx-4 -my-2 px-4 py-2 rounded-lg transition-colors"
                    >
                      <CardTitle className="text-base sm:text-lg font-display">Customer Details</CardTitle>
                      {customerOpen ? <ChevronUp className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />}
                    </div>
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="space-y-4 pt-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-lg">{order.customer.name}</h4>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const customerDetails = [
                                `Name: ${order.customer.name}`,
                                order.customer.phone && `Phone: ${order.customer.phone}`,
                                order.customer.email && `Email: ${order.customer.email}`,
                                order.customer.address && `Address: ${order.customer.address}`,
                              ].filter(Boolean).join('\n');
                              await navigator.clipboard.writeText(customerDetails);
                              toast({
                                title: "Copied!",
                                description: "Customer details copied to clipboard",
                              });
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copy customer details</TooltipContent>
                      </Tooltip>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      {order.customer.phone && (
                        <a 
                          href={`tel:${order.customer.phone}`}
                          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Phone className="h-4 w-4" />
                          {order.customer.phone}
                        </a>
                      )}
                      {order.customer.email && (
                        <a 
                          href={`mailto:${order.customer.email}`}
                          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Mail className="h-4 w-4" />
                          {order.customer.email}
                        </a>
                      )}
                      {order.customer.address && (
                        <div className="flex items-start gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4 mt-0.5" />
                          <span>{order.customer.address}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>

            {/* Delivery */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-display">Delivery</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {order.order_level_delivery_date 
                        ? format(order.order_level_delivery_date, 'EEEE, MMMM d, yyyy')
                        : 'No date set'
                      }
                    </p>
                    <p className="text-sm text-muted-foreground">Expected delivery</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Shipping Details */}
            <ShippingDetails order={order} />

            {/* Order Financials (for WooCommerce orders) */}
            <OrderFinancials order={order} />

            {/* Notes */}
            {order.global_notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-display">Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{order.global_notes}</p>
                </CardContent>
              </Card>
            )}

            {/* Actions - Dynamic based on role */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base sm:text-lg font-display">Quick Actions</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Department-specific actions</p>
              </CardHeader>
              <CardContent className="space-y-2.5 sm:space-y-3">
                {/* SALES ACTIONS */}
                {(isAdmin || role === 'sales') && (
                  <>
                    {/* Assign to Design/Prepress */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline"
                          className="w-full" 
                          size="sm"
                          onClick={() => {
                            setSelectedItemId(mainItem?.item_id || null);
                            setAssignDialogOpen(true);
                          }}
                        >
                          <Users className="h-4 w-4 mr-2" />
                          Assign to Department
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Assign this order to a department</TooltipContent>
                    </Tooltip>
                  </>
                )}

                {/* DESIGN ACTIONS */}
                {(isAdmin || role === 'design') && mainItem?.current_stage === 'design' && (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          className="w-full" 
                          size="sm"
                          onClick={() => updateItemStage(orderId!, mainItem.item_id, 'prepress')}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Send to Prepress
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Move to prepress for file preparation</TooltipContent>
                    </Tooltip>
                  </>
                )}

                {/* PREPRESS ACTIONS */}
                {(isAdmin || role === 'prepress') && mainItem?.current_stage === 'prepress' && (
                  <>
                    <DropdownMenu>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuTrigger asChild>
                            <Button className="w-full" size="sm">
                              <Factory className="h-4 w-4 mr-2" />
                              Send to Production
                            </Button>
                          </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent>Define stages and send to production</TooltipContent>
                      </Tooltip>
                      <DropdownMenuContent align="end" className="bg-popover">
                        <DropdownMenuItem 
                          onClick={() => {
                            setSelectedItemForProduction({
                              orderId: orderId!,
                              itemId: mainItem.item_id,
                              productName: mainItem.product_name,
                              currentSequence: (mainItem as any).production_stage_sequence
                            });
                            setProductionStageDialogOpen(true);
                          }}
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Define Stages & Send
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => {
                            setSelectedItemForOutsource({
                              itemId: mainItem.item_id,
                              productName: mainItem.product_name,
                              quantity: mainItem.quantity
                            });
                            setOutsourceDialogOpen(true);
                          }}
                          className="text-blue-500"
                        >
                          <Building2 className="h-4 w-4 mr-2" />
                          Outsource
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline"
                          className="w-full" 
                          size="sm"
                          onClick={() => updateItemStage(orderId!, mainItem.item_id, 'design')}
                        >
                          <Palette className="h-4 w-4 mr-2" />
                          Return to Design
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Send back to design for revisions</TooltipContent>
                    </Tooltip>
                  </>
                )}

                {/* PRODUCTION ACTIONS */}
                {(isAdmin || role === 'production') && mainItem?.current_stage === 'production' && (
                  <>
                    {mainItem.current_substage && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            className="w-full" 
                            size="sm"
                            onClick={() => completeSubstage(orderId!, mainItem.item_id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Complete {mainItem.current_substage}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Mark {mainItem.current_substage} as complete</TooltipContent>
                      </Tooltip>
                    )}
                  </>
                )}

                {/* DISPATCH ACTIONS */}
                {(isAdmin || role === 'production') && mainItem?.current_stage === 'dispatch' && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        className="w-full bg-green-600 hover:bg-green-700" 
                        size="sm"
                        onClick={() => markAsDispatched(orderId!, mainItem.item_id)}
                      >
                        <Truck className="h-4 w-4 mr-2" />
                        Mark Dispatched
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Mark this item as dispatched</TooltipContent>
                  </Tooltip>
                )}

                {/* ADMIN-ONLY ACTIONS */}
                {isAdmin && mainItem && mainItem.current_stage !== 'completed' && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline"
                        className="w-full border-green-500/50 hover:bg-green-500/10" 
                        size="sm"
                        onClick={() => updateItemStage(orderId!, mainItem.item_id, 'completed')}
                      >
                        <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                        Mark Complete
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Mark this order item as completed</TooltipContent>
                  </Tooltip>
                )}

                <Separator className="my-2" />

                {/* Common actions - all roles */}
                <Separator className="my-2.5 sm:my-3" />
                <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                  {/* Upload Button - Only show if user can upload */}
                  {shouldShowButton({
                    buttonType: 'upload',
                    userRole: role || 'sales',
                    isAdmin,
                    itemStage: mainItem?.current_stage || 'sales',
                    itemAssignedDepartment: mainItem?.assigned_department,
                    itemAssignedTo: mainItem?.assigned_to,
                    currentUserId: user?.uid,
                  }) ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline"
                          className="w-full" 
                          size="sm"
                          onClick={() => {
                            setSelectedItemId(mainItem?.item_id || null);
                            setUploadDialogOpen(true);
                          }}
                        >
                          <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                          <span className="text-xs sm:text-sm">Upload</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Upload a file to this order</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Button 
                            variant="outline"
                            className="w-full opacity-50 cursor-not-allowed" 
                            size="sm"
                            disabled
                          >
                            <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                            <span className="text-xs sm:text-sm">Upload</span>
                          </Button>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        {getButtonDisabledReason({
                          buttonType: 'upload',
                          userRole: role || 'sales',
                          isAdmin,
                          itemStage: mainItem?.current_stage || 'sales',
                        }) || 'You cannot upload files'}
                      </TooltipContent>
                    </Tooltip>
                  )}
                  
                  {/* Add Note - Always visible */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="w-full" 
                        size="sm"
                        onClick={() => setNoteDialogOpen(true)}
                      >
                        <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                        <span className="text-xs sm:text-sm">Add Note</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Add a note to this order</TooltipContent>
                  </Tooltip>
                </div>

                {canDelete && (
                  <>
                    <Separator className="my-2" />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="destructive"
                          className="w-full" 
                          size="sm"
                          onClick={() => setDeleteDialogOpen(true)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Order
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Permanently delete this order</TooltipContent>
                    </Tooltip>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Dialogs */}
        <UploadFileDialog
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          onUpload={(file) => handleUpload(file, false)}
          orderId={orderId!}
          itemId={selectedItemId || undefined}
        />

        <AssignDepartmentDialog
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
          onAssign={handleAssign}
          currentDepartment={selectedItem?.assigned_department}
        />

        <AssignUserDialog
          open={assignUserDialogOpen}
          onOpenChange={setAssignUserDialogOpen}
          onAssign={handleAssignUser}
          department={selectedItem?.assigned_department || 'sales'}
          currentUserId={selectedItem?.assigned_to}
        />

        <AddNoteDialog
          open={noteDialogOpen}
          onOpenChange={setNoteDialogOpen}
          onAdd={handleAddNote}
        />

        {selectedItemId && order && (
          <AddWorkNoteDialog
            open={workNoteDialogOpen}
            onOpenChange={setWorkNoteDialogOpen}
            orderId={order.id || order.order_id}
            itemId={selectedItemId}
            stage={order.items.find(i => i.item_id === selectedItemId)?.current_stage || 'sales'}
            productName={order.items.find(i => i.item_id === selectedItemId)?.product_name}
          />
        )}

        <EditOrderDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          order={order}
          onSave={handleEditSave}
        />


        {/* Production Stage Sequence Dialog */}
        {selectedItemForProduction && (
          <ProductionStageSequenceDialog
            open={productionStageDialogOpen}
            onOpenChange={(open) => {
              setProductionStageDialogOpen(open);
              if (!open) {
                setSelectedItemForProduction(null);
                setPendingDepartmentAssignment(null);
              }
            }}
            productName={selectedItemForProduction.productName}
            orderId={selectedItemForProduction.orderId}
            currentSequence={selectedItemForProduction.currentSequence}
            onConfirm={async (sequence) => {
              if (pendingDepartmentAssignment === 'production') {
                // Assign to production department with stages
                await sendToProduction(selectedItemForProduction.orderId, selectedItemForProduction.itemId, sequence);
                setPendingDepartmentAssignment(null);
              } else {
                // Direct send to production
                await sendToProduction(selectedItemForProduction.orderId, selectedItemForProduction.itemId, sequence);
              }
              setProductionStageDialogOpen(false);
              setSelectedItemForProduction(null);
            }}
          />
        )}

        {/* Update Delivery Date Dialog */}
        {selectedItemForDeliveryDate && (
          <UpdateDeliveryDateDialog
            open={deliveryDateDialogOpen}
            onOpenChange={setDeliveryDateDialogOpen}
            currentDate={selectedItemForDeliveryDate.currentDate}
            productName={selectedItemForDeliveryDate.productName}
            onSave={async (date) => {
              if (orderId) {
                await updateItemDeliveryDate(orderId, selectedItemForDeliveryDate.itemId, date);
              }
            }}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Order</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete order <strong>{order.order_id}</strong>? 
                This action cannot be undone and will permanently remove all associated items, 
                files, and timeline entries.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Outsource Assignment Dialog */}
        {selectedItemForOutsource && (
          <OutsourceAssignmentDialog
            open={outsourceDialogOpen}
            onOpenChange={setOutsourceDialogOpen}
            onAssign={handleOutsourceAssign}
            productName={selectedItemForOutsource.productName}
            quantity={selectedItemForOutsource.quantity}
          />
        )}

        {/* Follow-Up Note Dialog */}
        {selectedItemForOutsourceAction && (
          <FollowUpNoteDialog
            open={followUpNoteDialogOpen}
            onOpenChange={setFollowUpNoteDialogOpen}
            onSave={async (note) => {
              await addFollowUpNote(orderId!, selectedItemForOutsourceAction.itemId, note);
            }}
            productName={selectedItemForOutsourceAction.productName}
          />
        )}

        {/* Vendor Dispatch Dialog */}
        {selectedItemForOutsourceAction && (
          <VendorDispatchDialog
            open={vendorDispatchDialogOpen}
            onOpenChange={setVendorDispatchDialogOpen}
            onSave={async (courierName, trackingNumber, dispatchDate) => {
              await vendorDispatch(orderId!, selectedItemForOutsourceAction.itemId, courierName, trackingNumber, dispatchDate);
            }}
            productName={selectedItemForOutsourceAction.productName}
          />
        )}

        {/* Receive from Vendor Dialog */}
        {selectedItemForOutsourceAction && (
          <ReceiveFromVendorDialog
            open={receiveDialogOpen}
            onOpenChange={setReceiveDialogOpen}
            onSave={async (receiverName, receivedDate) => {
              await receiveFromVendor(orderId!, selectedItemForOutsourceAction.itemId, receiverName, receivedDate);
            }}
            productName={selectedItemForOutsourceAction.productName}
          />
        )}

        {/* Quality Check Dialog */}
        {selectedItemForOutsourceAction && (
          <QualityCheckDialog
            open={qcDialogOpen}
            onOpenChange={setQcDialogOpen}
            onSave={async (result, notes) => {
              await qualityCheck(orderId!, selectedItemForOutsourceAction.itemId, result, notes);
            }}
            productName={selectedItemForOutsourceAction.productName}
          />
        )}

        {/* Post-QC Decision Dialog */}
        {selectedItemForOutsourceAction && (
          <PostQCDecisionDialog
            open={postQCDialogOpen}
            onOpenChange={setPostQCDialogOpen}
            onSave={async (decision) => {
              await postQCDecision(orderId!, selectedItemForOutsourceAction.itemId, decision);
            }}
            productName={selectedItemForOutsourceAction.productName}
          />
        )}

        {/* Timeline Dialog - Full Screen Popup */}
        <Dialog open={timelineDialogOpen} onOpenChange={setTimelineDialogOpen}>
          <DialogContent className="max-w-4xl w-[95vw] h-[90vh] max-h-[90vh] flex flex-col p-0 gap-0 [&>button]:hidden">
            <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
              <div className="flex items-center justify-between">
                <DialogTitle className="text-xl font-display flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Order Timeline ({timeline.length} entries)
                </DialogTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setTimelineDialogOpen(false)}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </DialogHeader>
            <ScrollArea className="flex-1 px-6 py-4">
              <div className="pr-4">
                <OrderTimeline 
                  entries={timeline} 
                  onEntryClick={(entryId) => {
                    setHighlightedTimelineId(entryId);
                  }}
                  highlightedId={highlightedTimelineId}
                />
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
