import { useState, useEffect, useMemo } from 'react';
import { Play, CheckSquare, Camera, Clock, CheckCircle, ArrowRight, Truck, AlertTriangle, User, Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PriorityBadge } from '@/components/orders/PriorityBadge';
import { FilePreview } from '@/components/orders/FilePreview';
import { PRODUCTION_STEPS, SubStage } from '@/types/order';
import { useOrders } from '@/contexts/OrderContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
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
import { UploadFileDialog } from '@/components/dialogs/UploadFileDialog';
import { AddDelayReasonDialog } from '@/components/dialogs/AddDelayReasonDialog';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';

interface ProductionUser {
  user_id: string;
  full_name: string;
  department: string;
}

export default function Production() {
  const { orders, updateItemStage, updateItemSubstage, completeSubstage, uploadFile, getTimelineForOrder, addNote } = useOrders();
  const { profile, isAdmin, user } = useAuth();
  const [selectedUserTab, setSelectedUserTab] = useState<string>('all');
  const [productionUsers, setProductionUsers] = useState<ProductionUser[]>([]);

  // Fetch production users for admin tabs
  useEffect(() => {
    if (isAdmin) {
      const fetchProductionUsers = async () => {
        try {
          const profilesQuery = query(
            collection(db, 'profiles'),
            where('department', '==', 'production')
          );
          const snapshot = await getDocs(profilesQuery);
          const users = snapshot.docs.map(doc => ({
            user_id: doc.data().user_id,
            full_name: doc.data().full_name || 'Unknown',
            department: doc.data().department || 'production',
          }));
          setProductionUsers(users);
        } catch (error) {
          console.error('Error fetching production users:', error);
        }
      };
      fetchProductionUsers();
    }
  }, [isAdmin]);
  const [activeTab, setActiveTab] = useState('all');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{ orderId: string; itemId: string } | null>(null);
  const [delayDialogOpen, setDelayDialogOpen] = useState(false);
  const [selectedItemForDelay, setSelectedItemForDelay] = useState<{ orderId: string; itemId: string; productName: string; stageName: string } | null>(null);

  // CRITICAL FIX: Start from ALL orders, filter items by assigned_department and current_stage
  // Department is stored on order_items.assigned_department, NOT on orders
  // This ensures orders persist after assignment and don't disappear on re-render
  const allProductionItems = useMemo(() => {
    const department = 'production';
    const deptLower = department.toLowerCase().trim();
    
    // Check user's department - use role first, then profile.department
    const userDepartment = (role || profile?.department || '').toLowerCase().trim();
    const isProductionUser = userDepartment === deptLower || isAdmin;
    
    return orders
      .filter(order => !order.is_completed && !order.archived_from_wc)
      .flatMap(order => 
        order.items
          .filter(item => {
            // Filter by assigned_department AND current_stage
            const itemDept = (item.assigned_department || '').toLowerCase().trim();
            const itemStage = (item.current_stage || '').toLowerCase().trim();
            const isProductionItem = itemDept === deptLower || itemStage === deptLower;
            
            if (!isProductionItem) return false;
            
            // If user has assigned production_stage, only show items in that stage
            if (!isAdmin && profile?.production_stage) {
              if (item.current_substage !== profile.production_stage) {
                return false;
              }
            }
            
            // CRITICAL FIX: Visibility logic
            // - Admin sees ALL items in production department
            // - If item.assigned_to IS NULL → visible to ALL users in production department
            // - If item.assigned_to IS SET:
            //   - Admin sees it
            //   - ONLY that assigned user sees it (even if they're in production department)
            if (isAdmin) {
              return true; // Admin sees everything
            }
            
            // For non-admin users, check assignment
            if (item.assigned_to) {
              // Item is assigned - only the assigned user can see it
              // CRITICAL: Must check if user is in production department AND is the assigned user
              return isProductionUser && item.assigned_to === user?.uid;
            }
            
            // No user assigned - visible to all users in production department
            return isProductionUser;
          })
          .map(item => ({
            order,
            item,
          }))
      );
  }, [orders, isAdmin, profile, user, role]);

  // Filter by selected user tab (for admin)
  const productionItems = useMemo(() => {
    if (!isAdmin || selectedUserTab === 'all') {
      return allProductionItems;
    }
    return allProductionItems.filter(({ item }) => item.assigned_to === selectedUserTab);
  }, [allProductionItems, isAdmin, selectedUserTab]);
  
  // Get urgent items for production department
  const urgentProductionItems = useMemo(() => {
    return allProductionItems.filter(({ item }) => item.priority_computed === 'red');
  }, [allProductionItems]);

  // Separate assigned items (assigned_to is set) from unassigned items
  const assignedProductionItems = useMemo(() => {
    return allProductionItems.filter(({ item }) => item.assigned_to === user?.uid);
  }, [allProductionItems, user]);

  // Calculate realtime stats for Production dashboard
  const productionStats = useMemo(() => {
    return {
      totalItems: allProductionItems.length,
      urgentItems: urgentProductionItems.length,
      assignedToMe: assignedProductionItems.length,
      yellowPriority: allProductionItems.filter(({ item }) => item.priority_computed === 'yellow').length,
      bluePriority: allProductionItems.filter(({ item }) => item.priority_computed === 'blue').length,
    };
  }, [allProductionItems, urgentProductionItems, assignedProductionItems]);

  const getItemsBySubstage = (substage: string | null) => {
    if (substage === 'all') return productionItems;
    return productionItems.filter(({ item }) => item.current_substage === substage);
  };

  const handleStartStage = (orderId: string, itemId: string, substage: SubStage) => {
    updateItemSubstage(orderId, itemId, substage);
    toast({
      title: "Stage Started",
      description: `Started ${substage} process`,
    });
  };

  const handleCompleteStage = (orderId: string, itemId: string) => {
    completeSubstage(orderId, itemId);
  };

  const handleSendToDispatch = (orderId: string, itemId: string) => {
    updateItemStage(orderId, itemId, 'dispatch');
    toast({
      title: "Ready for Dispatch",
      description: "Item has been sent to Dispatch",
    });
  };

  const handleUploadClick = (orderId: string, itemId: string) => {
    setSelectedItem({ orderId, itemId });
    setUploadDialogOpen(true);
  };

  const handleUpload = async (file: File) => {
    if (selectedItem) {
      await uploadFile(selectedItem.orderId, selectedItem.itemId, file);
      toast({
        title: "Photo Uploaded",
        description: "Production photo has been saved",
      });
    }
  };

  const getItemStages = (item: any) => {
    // Use item's production_stage_sequence if defined, otherwise fallback to default
    if (item.production_stage_sequence && item.production_stage_sequence.length > 0) {
      return item.production_stage_sequence.map((key: string) => {
        const defaultStep = PRODUCTION_STEPS.find(s => s.key === key);
        return { key, label: defaultStep?.label || key };
      });
    }
    return PRODUCTION_STEPS;
  };

  const getCurrentSubstageIndex = (item: any) => {
    const stages = getItemStages(item);
    if (!item.current_substage) return -1;
    return stages.findIndex((s: any) => s.key === item.current_substage);
  };

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col gap-4">
        {/* Header - Fixed */}
        <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Production Dashboard</h1>
            <p className="text-muted-foreground">
              {productionItems.length} item{productionItems.length !== 1 ? 's' : ''} in production
            </p>
          </div>
        </div>

        {/* Realtime Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{productionStats.totalItems}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Urgent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <span className="text-2xl font-bold text-red-500">{productionStats.urgentItems}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Assigned to Me</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-blue-500" />
                <span className="text-2xl font-bold text-blue-500">{productionStats.assignedToMe}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Yellow Priority</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-500" />
                <span className="text-2xl font-bold text-yellow-500">{productionStats.yellowPriority}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* User Tabs for Admin */}
        {isAdmin && productionUsers.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm font-medium text-muted-foreground">Filter by User:</span>
            <Tabs value={selectedUserTab} onValueChange={setSelectedUserTab} className="w-full">
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="all" className="text-sm">
                  All Users
                  <Badge variant="secondary" className="ml-2">
                    {allProductionItems.length}
                  </Badge>
                </TabsTrigger>
                {productionUsers.map((productionUser) => {
                  const userItemCount = allProductionItems.filter(({ item }) => item.assigned_to === productionUser.user_id).length;
                  return (
                    <TabsTrigger key={productionUser.user_id} value={productionUser.user_id} className="text-sm">
                      {productionUser.full_name}
                      <Badge variant="secondary" className="ml-2">{userItemCount}</Badge>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
          </div>
        )}

        {/* Production Stages Tabs - Scrollable content */}
        <div className="flex-1 min-h-0 flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <div className="flex-shrink-0 overflow-x-auto pb-2">
              <TabsList className="inline-flex h-auto p-1 bg-secondary/50">
                <TabsTrigger value="all" className="px-4">
                  All
                  <Badge variant="secondary" className="ml-2">{productionItems.length}</Badge>
                </TabsTrigger>
                {PRODUCTION_STEPS.map((step) => {
                  const count = getItemsBySubstage(step.key).length;
                  return (
                    <TabsTrigger key={step.key} value={step.key} className="px-4">
                      {step.label}
                      {count > 0 && (
                        <Badge variant="secondary" className="ml-2">{count}</Badge>
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            {['all', ...PRODUCTION_STEPS.map(s => s.key)].map((tabValue) => (
              <TabsContent key={tabValue} value={tabValue} className="flex-1 mt-4 overflow-hidden">
                <div className="h-full overflow-y-auto custom-scrollbar pr-2 space-y-4">
                {getItemsBySubstage(tabValue === 'all' ? 'all' : tabValue).length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                      <h3 className="font-semibold text-lg mb-2">No items here</h3>
                      <p className="text-muted-foreground">
                        {tabValue === 'all' 
                          ? 'No items currently in production.'
                          : `No items in ${tabValue} stage.`
                        }
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  getItemsBySubstage(tabValue === 'all' ? 'all' : tabValue).map(({ order, item }) => (
                    <Card key={`${order.order_id}-${item.item_id}`} className="card-hover overflow-visible transition-all duration-200 hover:shadow-lg relative">
                      <CardContent className="p-0 overflow-visible">
                        <div 
                          className={`h-1 ${
                            item.priority_computed === 'blue' ? 'bg-priority-blue' :
                            item.priority_computed === 'yellow' ? 'bg-priority-yellow' :
                            'bg-priority-red'
                          }`}
                        />
                        
                        <div className="p-4">
                          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                            <div className="flex-1 min-w-0">
                              {/* Order ID - Always visible */}
                              <Link 
                                to={`/orders/${order.order_id}`}
                                className="text-sm font-bold text-primary hover:underline"
                              >
                                {order.order_id}
                              </Link>
                              
                              <div className="flex items-center gap-2 mb-1 flex-wrap mt-1">
                                <h3 className="font-semibold truncate text-foreground">{item.product_name}</h3>
                                <span className="text-sm text-muted-foreground">— Qty {item.quantity}</span>
                                <PriorityBadge priority={item.priority_computed} showLabel />
                                {item.current_substage && (
                                  <Badge variant="stage-production">
                                    {item.current_substage}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {order.customer.name}
                              </p>
                              
                              <div className="flex flex-wrap gap-2">
                                {item.specifications.paper && (
                                  <Badge variant="outline" className="text-xs">{item.specifications.paper}</Badge>
                                )}
                                {item.specifications.finishing && (
                                  <Badge variant="outline" className="text-xs">{item.specifications.finishing}</Badge>
                                )}
                              </div>
                              {item.files && item.files.length > 0 && (
                                <FilePreview files={item.files} compact />
                              )}

                              {/* Progress indicator - uses item's stage sequence */}
                              <div className="mt-3 space-y-2">
                                <div className="flex items-center gap-1">
                                  {getItemStages(item).map((step: any, index: number) => {
                                    const currentIndex = getCurrentSubstageIndex(item);
                                    const isCompleted = index < currentIndex;
                                    const isCurrent = index === currentIndex;
                                    return (
                                      <Tooltip key={step.key}>
                                        <TooltipTrigger asChild>
                                          <div 
                                            className={`h-2 flex-1 rounded-full transition-colors ${
                                              isCompleted ? 'bg-green-500' :
                                              isCurrent ? 'bg-primary' :
                                              'bg-secondary'
                                            }`}
                                          />
                                        </TooltipTrigger>
                                        <TooltipContent>{step.label}</TooltipContent>
                                      </Tooltip>
                                    );
                                  })}
                                </div>
                                
                                {/* Show current stage info - who handled it and when */}
                                {item.current_substage && (() => {
                                  const timeline = getTimelineForOrder(order.order_id, item.item_id);
                                  const stageEntries = timeline.filter(e => 
                                    e.substage === item.current_substage && 
                                    (e.action === 'substage_started' || e.action === 'substage_completed')
                                  );
                                  const latestEntry = stageEntries[0];
                                  
                                  if (latestEntry) {
                                    return (
                                      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                                        <div className="flex items-center gap-1">
                                          <User className="h-3 w-3" />
                                          <span>{latestEntry.performed_by_name}</span>
                                        </div>
                                        <span>•</span>
                                        <div className="flex items-center gap-1">
                                          <Clock className="h-3 w-3" />
                                          <span>Started: {format(latestEntry.created_at, 'MMM d, HH:mm')}</span>
                                        </div>
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="h-4 w-4" />
                              <span>Due: {format(item.delivery_date, 'MMM d, yyyy')}</span>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => handleUploadClick(order.order_id, item.item_id)}
                                  >
                                    <Camera className="h-4 w-4 mr-2" />
                                    Photo
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Upload production photo</TooltipContent>
                              </Tooltip>

                              {item.current_substage ? (
                                <DropdownMenu>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <DropdownMenuTrigger asChild>
                                        <Button size="sm" className="bg-green-600 hover:bg-green-700">
                                          <CheckSquare className="h-4 w-4 mr-2" />
                                          Complete {item.current_substage}
                                        </Button>
                                      </DropdownMenuTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent>Complete current stage</TooltipContent>
                                  </Tooltip>
                                  <DropdownMenuContent align="end" className="bg-popover">
                                    <DropdownMenuItem onClick={() => handleCompleteStage(order.order_id, item.item_id)}>
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      Complete & Next Stage
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    {getItemStages(item).map((step: any) => (
                                      <DropdownMenuItem 
                                        key={step.key}
                                        onClick={() => handleStartStage(order.order_id, item.item_id, step.key as SubStage)}
                                      >
                                        <ArrowRight className="h-4 w-4 mr-2" />
                                        Jump to {step.label}
                                      </DropdownMenuItem>
                                    ))}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      onClick={() => {
                                        setSelectedItemForDelay({
                                          orderId: order.order_id,
                                          itemId: item.item_id,
                                          productName: item.product_name,
                                          stageName: item.current_substage || 'production'
                                        });
                                        setDelayDialogOpen(true);
                                      }}
                                      className="text-yellow-600 dark:text-yellow-400"
                                    >
                                      <AlertTriangle className="h-4 w-4 mr-2" />
                                      Add Delay Reason
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleSendToDispatch(order.order_id, item.item_id)}>
                                      <Truck className="h-4 w-4 mr-2" />
                                      Send to Dispatch
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              ) : (
                                <DropdownMenu>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <DropdownMenuTrigger asChild>
                                        <Button size="sm">
                                          <Play className="h-4 w-4 mr-2" />
                                          Start Stage
                                        </Button>
                                      </DropdownMenuTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent>Select production stage to start</TooltipContent>
                                  </Tooltip>
                                  <DropdownMenuContent align="end" className="bg-popover">
                                    {getItemStages(item).map((step: any) => (
                                      <DropdownMenuItem 
                                        key={step.key}
                                        onClick={() => handleStartStage(order.order_id, item.item_id, step.key as SubStage)}
                                      >
                                        <Play className="h-4 w-4 mr-2" />
                                        Start {step.label}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {/* Upload Dialog */}
        {selectedItem && (
          <UploadFileDialog
            open={uploadDialogOpen}
            onOpenChange={setUploadDialogOpen}
            onUpload={handleUpload}
            orderId={selectedItem.orderId}
            itemId={selectedItem.itemId}
          />
        )}

        {/* Delay Reason Dialog */}
        {selectedItemForDelay && (
          <AddDelayReasonDialog
            open={delayDialogOpen}
            onOpenChange={setDelayDialogOpen}
            productName={selectedItemForDelay.productName}
            stageName={selectedItemForDelay.stageName}
            onSave={async (reason) => {
              // Add delay reason as a note
              await addNote(selectedItemForDelay.orderId, `[DELAY - ${selectedItemForDelay.stageName}] ${reason}`);
              toast({
                title: "Delay Reason Recorded",
                description: "Delay reason has been saved to order notes",
              });
              setSelectedItemForDelay(null);
            }}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
