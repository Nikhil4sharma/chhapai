import { useParams, Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useState } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PriorityBadge } from '@/components/orders/PriorityBadge';
import { StageBadge } from '@/components/orders/StageBadge';
import { OrderTimeline } from '@/components/orders/OrderTimeline';
import { FilePreview } from '@/components/orders/FilePreview';
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
import { useOrders } from '@/contexts/OrderContext';
import { useAuth } from '@/contexts/AuthContext';
import { UploadFileDialog } from '@/components/dialogs/UploadFileDialog';
import { AssignDepartmentDialog } from '@/components/dialogs/AssignDepartmentDialog';
import { AssignUserDialog } from '@/components/dialogs/AssignUserDialog';
import { AddNoteDialog } from '@/components/dialogs/AddNoteDialog';
import { EditOrderDialog } from '@/components/dialogs/EditOrderDialog';
import { ChangeStageDialog } from '@/components/dialogs/ChangeStageDialog';
import { PRODUCTION_STEPS, STAGE_LABELS, Stage, SubStage } from '@/types/order';

export default function OrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { 
    getOrderById, 
    getTimelineForOrder, 
    uploadFile, 
    assignToDepartment, 
    assignToUser,
    addNote, 
    updateOrder, 
    updateItemStage, 
    completeSubstage, 
    sendToProduction, 
    markAsDispatched,
    deleteOrder,
    isLoading,
    refreshOrders,
  } = useOrders();
  const { isAdmin, role } = useAuth();
  
  const order = getOrderById(orderId || '');
  const timeline = orderId ? getTimelineForOrder(orderId) : [];

  // Dialog states
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignUserDialogOpen, setAssignUserDialogOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  
  // Collapsible states
  const [itemsOpen, setItemsOpen] = useState(true);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(true);

  const canDelete = isAdmin || role === 'sales';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <TooltipProvider>
        <div className="flex flex-col items-center justify-center py-12">
          <h2 className="text-xl font-semibold mb-2">Order not found</h2>
          <p className="text-muted-foreground mb-4">The order you're looking for doesn't exist.</p>
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

  const handleUpload = async (file: File, replaceExisting: boolean) => {
    if (selectedItemId) {
      await uploadFile(orderId!, selectedItemId, file, replaceExisting);
    }
  };

  const handleAssign = async (department: string) => {
    if (selectedItemId) {
      await assignToDepartment(orderId!, selectedItemId, department);
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

  const handleStageChange = async (stage: Stage, substage?: SubStage) => {
    if (selectedItemId) {
      await updateItemStage(orderId!, selectedItemId, stage, substage);
    }
  };

  const handleNextStage = async (itemId: string) => {
    await completeSubstage(orderId!, itemId);
  };

  const handleDelete = async () => {
    await deleteOrder(orderId!);
    navigate('/dashboard');
  };

  const openDialogForItem = (dialog: 'upload' | 'assign' | 'assignUser' | 'stage', itemId: string) => {
    setSelectedItemId(itemId);
    if (dialog === 'upload') setUploadDialogOpen(true);
    if (dialog === 'assign') setAssignDialogOpen(true);
    if (dialog === 'assignUser') setAssignUserDialogOpen(true);
    if (dialog === 'stage') setStageDialogOpen(true);
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Back button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Back to Dashboard</TooltipContent>
        </Tooltip>

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-2xl font-display font-bold">{order.order_id}</h1>
              <PriorityBadge priority={order.priority_computed} showLabel />
              {order.source === 'wordpress' && (
                <Badge variant="outline">WooCommerce</Badge>
              )}
              {order.is_completed && (
                <Badge className="bg-green-500">Completed</Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              Created {format(order.created_at, 'MMMM d, yyyy')} • 
              Last updated {format(order.updated_at, 'MMM d, h:mm a')}
            </p>
          </div>
          
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit order details</TooltipContent>
            </Tooltip>
            
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>More actions</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Items - Collapsible */}
            <Collapsible open={itemsOpen} onOpenChange={setItemsOpen}>
              <Card>
                <CardHeader className="pb-3">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between cursor-pointer hover:bg-muted/50 -mx-4 -my-2 px-4 py-2 rounded-lg transition-colors">
                      <CardTitle className="text-lg font-display flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Order Items ({order.items.length})
                      </CardTitle>
                      {itemsOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                    </div>
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="space-y-4 pt-0">
                    {order.items.map((item, index) => (
                      <div key={item.item_id}>
                        {index > 0 && <Separator className="my-4" />}
                        <div className="flex flex-col gap-4">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <h4 className="font-medium">{item.product_name}</h4>
                                <PriorityBadge priority={item.priority_computed} />
                                <StageBadge stage={item.current_stage} />
                                {item.current_substage && (
                                  <Badge variant="outline" className="capitalize">
                                    {item.current_substage}
                                  </Badge>
                                )}
                              </div>

                              {/* Assigned user */}
                              {item.assigned_to_name && (
                                <div className="flex items-center gap-2 mb-2 text-sm text-primary">
                                  <UserCircle className="h-4 w-4" />
                                  <span>Assigned to: <strong>{item.assigned_to_name}</strong></span>
                                </div>
                              )}
                              
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Quantity</span>
                                  <p className="font-medium">{item.quantity}</p>
                                </div>
                                {item.sku && (
                                  <div>
                                    <span className="text-muted-foreground">SKU</span>
                                    <p className="font-medium">{item.sku}</p>
                                  </div>
                                )}
                                {item.line_total && (
                                  <div>
                                    <span className="text-muted-foreground">Line Total</span>
                                    <p className="font-medium">₹{item.line_total.toFixed(2)}</p>
                                  </div>
                                )}
                              </div>
                              
                              {/* Product Specifications from WooCommerce */}
                              <ProductSpecifications item={item} />

                              {/* Files with FilePreview component */}
                              {item.files.length > 0 && (
                                <div className="mt-3">
                                  <p className="text-xs text-muted-foreground mb-2">Files ({item.files.length})</p>
                                  <FilePreview 
                                    files={item.files} 
                                    compact 
                                    onFileDeleted={() => refreshOrders()}
                                  />
                                </div>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span>{format(item.delivery_date, 'MMM d, yyyy')}</span>
                            </div>
                          </div>

                          {/* Item Actions */}
                          <div className="flex flex-wrap gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => openDialogForItem('stage', item.item_id)}
                                >
                                  <ArrowRight className="h-4 w-4 mr-1" />
                                  Change Stage
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Change item stage</TooltipContent>
                            </Tooltip>

                            {item.current_stage === 'production' && item.current_substage && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    size="sm"
                                    onClick={() => handleNextStage(item.item_id)}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Complete {item.current_substage}
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
                                  onClick={() => openDialogForItem('assign', item.item_id)}
                                >
                                  <Users className="h-4 w-4 mr-1" />
                                  Assign Dept
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Assign to department</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => openDialogForItem('assignUser', item.item_id)}
                                >
                                  <UserCircle className="h-4 w-4 mr-1" />
                                  Assign User
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Assign to team member</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => openDialogForItem('upload', item.item_id)}
                                >
                                  <Upload className="h-4 w-4 mr-1" />
                                  Upload
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Upload file for this item</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Timeline - Collapsible */}
            <Collapsible open={timelineOpen} onOpenChange={setTimelineOpen}>
              <Card>
                <CardHeader className="pb-3">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between cursor-pointer hover:bg-muted/50 -mx-4 -my-2 px-4 py-2 rounded-lg transition-colors">
                      <CardTitle className="text-lg font-display">Timeline ({timeline.length})</CardTitle>
                      {timelineOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                    </div>
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <OrderTimeline entries={timeline} />
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Customer info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-display">Customer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium text-lg">{order.customer.name}</h4>
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

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-display">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {/* Send to Production - show only if not already in production/dispatch/completed */}
                {mainItem && !['production', 'dispatch', 'completed'].includes(mainItem.current_stage) && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        className="w-full" 
                        size="sm"
                        onClick={() => sendToProduction(orderId!, mainItem.item_id)}
                      >
                        <Factory className="h-4 w-4 mr-2" />
                        Send to Production
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Send this item to production workflow</TooltipContent>
                  </Tooltip>
                )}

                {/* Mark as Dispatched - show only if in dispatch stage */}
                {mainItem && mainItem.current_stage === 'dispatch' && (
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
                    <TooltipContent>Mark this item as dispatched and complete the order</TooltipContent>
                  </Tooltip>
                )}

                {/* Mark Complete - show only if not completed */}
                {mainItem && mainItem.current_stage !== 'completed' && (
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
                      <Upload className="h-4 w-4 mr-2" />
                      Upload File
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Upload a file to this order</TooltipContent>
                </Tooltip>
                
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
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      size="sm"
                      onClick={() => setNoteDialogOpen(true)}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Add Note
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Add a note to this order</TooltipContent>
                </Tooltip>

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

        <EditOrderDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          order={order}
          onSave={handleEditSave}
        />

        {selectedItemId && (
          <ChangeStageDialog
            open={stageDialogOpen}
            onOpenChange={setStageDialogOpen}
            onChangeStage={handleStageChange}
            currentStage={order.items.find(i => i.item_id === selectedItemId)?.current_stage || 'sales'}
            currentSubstage={order.items.find(i => i.item_id === selectedItemId)?.current_substage}
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
      </div>
    </TooltipProvider>
  );
}
