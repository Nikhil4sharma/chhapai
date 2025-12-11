import { useParams, Link } from 'react-router-dom';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PriorityBadge } from '@/components/orders/PriorityBadge';
import { StageBadge } from '@/components/orders/StageBadge';
import { OrderTimeline } from '@/components/orders/OrderTimeline';
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
import { useOrders } from '@/contexts/OrderContext';
import { useAuth } from '@/contexts/AuthContext';
import { UploadFileDialog } from '@/components/dialogs/UploadFileDialog';
import { AssignDepartmentDialog } from '@/components/dialogs/AssignDepartmentDialog';
import { AddNoteDialog } from '@/components/dialogs/AddNoteDialog';
import { EditOrderDialog } from '@/components/dialogs/EditOrderDialog';
import { ChangeStageDialog } from '@/components/dialogs/ChangeStageDialog';
import { PRODUCTION_STEPS, STAGE_LABELS, Stage, SubStage } from '@/types/order';

export default function OrderDetail() {
  const { orderId } = useParams();
  const { getOrderById, getTimelineForOrder, uploadFile, assignToDepartment, addNote, updateOrder, updateItemStage, completeSubstage } = useOrders();
  const { isAdmin, role } = useAuth();
  
  const order = getOrderById(orderId || '');
  const timeline = orderId ? getTimelineForOrder(orderId) : [];

  // Dialog states
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

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

  const handleUpload = async (file: File) => {
    if (selectedItemId) {
      await uploadFile(orderId!, selectedItemId, file);
    }
  };

  const handleAssign = (department: string) => {
    if (selectedItemId) {
      assignToDepartment(orderId!, selectedItemId, department);
    }
  };

  const handleAddNote = (note: string, isPublic: boolean) => {
    addNote(orderId!, note);
  };

  const handleEditSave = (updates: Partial<typeof order>) => {
    updateOrder(orderId!, updates);
  };

  const handleStageChange = (stage: Stage, substage?: SubStage) => {
    if (selectedItemId) {
      updateItemStage(orderId!, selectedItemId, stage, substage);
    }
  };

  const handleNextStage = (itemId: string) => {
    completeSubstage(orderId!, itemId);
  };

  const openDialogForItem = (dialog: 'upload' | 'assign' | 'stage', itemId: string) => {
    setSelectedItemId(itemId);
    if (dialog === 'upload') setUploadDialogOpen(true);
    if (dialog === 'assign') setAssignDialogOpen(true);
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
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">
                  Cancel Order
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Items */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-display flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Order Items ({order.items.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                          
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                            <div>
                              <span className="text-muted-foreground">Quantity</span>
                              <p className="font-medium">{item.quantity}</p>
                            </div>
                            {item.specifications.paper && (
                              <div>
                                <span className="text-muted-foreground">Paper</span>
                                <p className="font-medium">{item.specifications.paper}</p>
                              </div>
                            )}
                            {item.specifications.size && (
                              <div>
                                <span className="text-muted-foreground">Size</span>
                                <p className="font-medium">{item.specifications.size}</p>
                              </div>
                            )}
                            {item.specifications.finishing && (
                              <div>
                                <span className="text-muted-foreground">Finishing</span>
                                <p className="font-medium">{item.specifications.finishing}</p>
                              </div>
                            )}
                          </div>
                          
                          {item.specifications.notes && (
                            <p className="mt-3 text-sm text-muted-foreground bg-secondary/50 p-2 rounded">
                              {item.specifications.notes}
                            </p>
                          )}

                          {/* Files */}
                          {item.files.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {item.files.map((file) => (
                                <a
                                  key={file.file_id}
                                  href={file.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-sm text-primary hover:underline bg-primary/5 px-2 py-1 rounded"
                                >
                                  <FileText className="h-3 w-3" />
                                  View File
                                </a>
                              ))}
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
                              Assign
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Assign to department</TooltipContent>
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
            </Card>

            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-display">Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <OrderTimeline entries={timeline} />
              </CardContent>
            </Card>
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
                  <a 
                    href={`tel:${order.customer.phone}`}
                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Phone className="h-4 w-4" />
                    {order.customer.phone}
                  </a>
                  <a 
                    href={`mailto:${order.customer.email}`}
                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Mail className="h-4 w-4" />
                    {order.customer.email}
                  </a>
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 mt-0.5" />
                    <span>{order.customer.address}</span>
                  </div>
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
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
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Dialogs */}
        <UploadFileDialog
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          onUpload={handleUpload}
          orderId={orderId!}
          itemId={selectedItemId || undefined}
        />

        <AssignDepartmentDialog
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
          onAssign={handleAssign}
          currentDepartment={mainItem?.assigned_department}
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
      </div>
    </TooltipProvider>
  );
}
