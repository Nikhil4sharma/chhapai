import { useState, useEffect, useMemo } from 'react';
import { Play, CheckSquare, Camera, Clock, CheckCircle, ArrowRight, ArrowLeft, Truck, AlertTriangle, User, Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductCard } from '@/features/orders/components/ProductCard';
import { PRODUCTION_STEPS, SubStage, DispatchInfo, Order, OrderItem } from '@/types/order';
import { useOrders } from '@/features/orders/context/OrderContext';
import { useAuth } from '@/features/auth/context/AuthContext';
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
import { DispatchValidationDialog } from '@/components/dialogs/DispatchValidationDialog';
import { supabase } from '@/integrations/supabase/client';

interface ProductionUser {
  user_id: string;
  full_name: string;
  department: string;
}

export default function Production() {
  const { orders, updateItemStage, updateItemSubstage, completeSubstage, uploadFile, getTimelineForOrder, addNote, markAsDispatched } = useOrders();
  const { profile, isAdmin, user, role } = useAuth();
  const [selectedUserTab, setSelectedUserTab] = useState<string>('all');
  const [productionUsers, setProductionUsers] = useState<ProductionUser[]>([]);
  const [dispatchDialogOpen, setDispatchDialogOpen] = useState(false);
  const [selectedItemForDispatch, setSelectedItemForDispatch] = useState<{ orderId: string; itemId: string; productName: string } | null>(null);

  // Fetch production users for admin tabs
  useEffect(() => {
    if (isAdmin) {
      const fetchProductionUsers = async () => {
        try {
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('user_id, full_name, department')
            .eq('department', 'production');

          if (profilesError) throw profilesError;

          const users = (profilesData || []).map(profile => ({
            user_id: profile.user_id,
            full_name: profile.full_name || 'Unknown',
            department: profile.department || 'production',
          }));
          setProductionUsers(users);
        } catch (error) {
          console.error('Error fetching production users:', error);
        }
      };
      fetchProductionUsers();
    }
  }, [isAdmin]);

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
            // CRITICAL: Exclude items in dispatch stage - they should only show in Dispatch page
            if (item.current_stage === 'dispatch') {
              return false;
            }

            // CRITICAL: Exclude items that are dispatched or completed - they should only show in Dispatch page
            if (item.current_stage === 'completed' || item.is_dispatched) {
              return false;
            }

            // NOTE: Items in packing substage SHOULD show in Production page
            // They will move to dispatch stage only after packing is completed

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

            // CRITICAL FIX: Visibility logic (CORRECTED)
            // - Admin sees ALL items in production department
            // - Sales sees ALL items in production department
            // - Department users see ALL items in their department (regardless of assigned_to)
            // - assigned_to does NOT control department-level visibility
            // - assigned_to is only used for "Assigned to Me" tab filtering

            if (isAdmin || role === 'sales') {
              return true; // Admin and Sales see everything
            }

            // Department users ALWAYS see items in their department
            // assigned_to does NOT filter out items from department view
            // This ensures department-wide visibility (read-only for assigned items)
            return isProductionUser;
          })
          .map(item => ({
            order,
            item,
          }))
      );
  }, [orders, isAdmin, profile, user, role]);

  // Get urgent items for production department
  const urgentProductionItems = useMemo(() => {
    return allProductionItems.filter(({ item }) => item.priority_computed === 'red');
  }, [allProductionItems]);

  // Separate assigned items (assigned_to is set) from unassigned items
  const assignedProductionItems = useMemo(() => {
    return allProductionItems.filter(({ item }) => item.assigned_to === user?.id);
  }, [allProductionItems, user]);

  // Get items by status
  const inProgressItems = useMemo(() => {
    return allProductionItems.filter(({ item }) => {
      return item.current_stage === 'production' &&
        item.assigned_department === 'production' &&
        !item.is_dispatched;
    });
  }, [allProductionItems]);

  const completedItems = useMemo(() => {
    return allProductionItems.filter(({ item }) => {
      return item.is_dispatched ||
        item.current_stage === 'dispatch' ||
        item.current_stage === 'completed';
    });
  }, [allProductionItems]);

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

  // Tab state for filtering
  const [activeTab, setActiveTab] = useState<'in_progress' | 'completed' | 'assigned' | 'urgent' | 'all'>('in_progress');

  // Filter items based on active tab (for production, also respect substage filter)
  const productionItems = useMemo(() => {
    let filtered = allProductionItems;

    if (activeTab === 'in_progress') {
      filtered = inProgressItems;
    } else if (activeTab === 'completed') {
      filtered = completedItems;
    } else if (activeTab === 'assigned') {
      filtered = assignedProductionItems;
    } else if (activeTab === 'urgent') {
      filtered = urgentProductionItems;
    }
    // 'all' tab already filtered

    return filtered;
  }, [allProductionItems, inProgressItems, completedItems, assignedProductionItems, urgentProductionItems, activeTab, isAdmin, selectedUserTab]);

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

  const handleCompleteStage = async (orderId: string, itemId: string) => {
    const order = orders.find(o => o.order_id === orderId);
    const item = order?.items.find(i => i.item_id === itemId);

    if (!order || !item) return;

    // Check if this is the last substage (packing)
    const sequence = (item as any).production_stage_sequence || ['foiling', 'printing', 'pasting', 'cutting', 'letterpress', 'embossing', 'packing'];
    const currentIndex = sequence.indexOf(item.current_substage);
    const isLastSubstage = currentIndex === sequence.length - 1;

    // CRITICAL: If completing packing (last stage), show dispatch tracking dialog
    // User must fill tracking details before item is marked as dispatched
    if (isLastSubstage && item.current_substage === 'packing') {
      setSelectedItemForDispatch({ orderId, itemId, productName: item.product_name });
      setDispatchDialogOpen(true);
    } else {
      // For other stages, just complete normally
      await completeSubstage(orderId, itemId);
    }
  };

  const handleConfirmDispatch = async (dispatchInfo: DispatchInfo) => {
    if (!selectedItemForDispatch) return;

    try {
      // First complete the substage (this will move item to dispatch stage)
      await completeSubstage(selectedItemForDispatch.orderId, selectedItemForDispatch.itemId);

      // Then mark as dispatched with tracking details (this marks as completed)
      await markAsDispatched(selectedItemForDispatch.orderId, selectedItemForDispatch.itemId, dispatchInfo);

      setDispatchDialogOpen(false);
      setSelectedItemForDispatch(null);

      toast({
        title: "Item Dispatched",
        description: "Item has been marked as dispatched with tracking details",
      });
    } catch (error) {
      console.error('Error dispatching item:', error);
      toast({
        title: "Error",
        description: "Failed to dispatch item",
        variant: "destructive",
      });
    }
  };

  const handleCancelDispatch = async () => {
    if (!selectedItemForDispatch) return;

    // If user cancels, still complete the substage to move to dispatch stage
    // But don't mark as dispatched - user can do that later from Dispatch page
    try {
      await completeSubstage(selectedItemForDispatch.orderId, selectedItemForDispatch.itemId);
      toast({
        title: "Packing Complete",
        description: "Item moved to dispatch stage. Add tracking details from Dispatch page.",
      });
    } catch (error) {
      console.error('Error completing substage:', error);
    }

    setDispatchDialogOpen(false);
    setSelectedItemForDispatch(null);
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

  // Get all unique stages from all items' production_stage_sequence
  const getAllUsedStages = () => {
    const stageSet = new Set<string>();
    productionItems.forEach(({ item }) => {
      if (item.production_stage_sequence && item.production_stage_sequence.length > 0) {
        item.production_stage_sequence.forEach((key: string) => stageSet.add(key));
      } else {
        // If no sequence, add all default stages
        PRODUCTION_STEPS.forEach(s => stageSet.add(s.key));
      }
    });
    // Convert to array and map to stage objects with labels
    return Array.from(stageSet).map(key => {
      const defaultStep = PRODUCTION_STEPS.find(s => s.key === key);
      return { key, label: defaultStep?.label || key };
    }).sort((a, b) => {
      // Sort by order in PRODUCTION_STEPS to maintain sequence
      const aOrder = PRODUCTION_STEPS.findIndex(s => s.key === a.key);
      const bOrder = PRODUCTION_STEPS.findIndex(s => s.key === b.key);
      return aOrder - bOrder;
    });
  };

  const getCurrentSubstageIndex = (item: any) => {
    const stages = getItemStages(item);
    if (!item.current_substage) return -1;
    return stages.findIndex((s: any) => s.key === item.current_substage);
  };

  // Get previous and next stages for navigation
  const getStageNavigation = (item: any) => {
    const stages = getItemStages(item);
    const currentIndex = getCurrentSubstageIndex(item);

    return {
      previous: currentIndex > 0 ? stages[currentIndex - 1] : null,
      current: currentIndex >= 0 ? stages[currentIndex] : null,
      next: currentIndex < stages.length - 1 ? stages[currentIndex + 1] : null,
      isFirst: currentIndex === 0,
      isLast: currentIndex === stages.length - 1,
    };
  };

  // Handle backward navigation (go to previous stage)
  const handleGoToPreviousStage = async (orderId: string, itemId: string) => {
    const order = orders.find(o => o.order_id === orderId);
    const item = order?.items.find(i => i.item_id === itemId);
    if (!item) return;

    const nav = getStageNavigation(item);
    if (nav.previous) {
      await updateItemSubstage(orderId, itemId, nav.previous.key as SubStage);
      toast({
        title: "Moved to Previous Stage",
        description: `Moved back to ${nav.previous.label}`,
      });
    }
  };

  // Handle forward navigation (go to next stage)
  const handleGoToNextStage = async (orderId: string, itemId: string) => {
    const order = orders.find(o => o.order_id === orderId);
    const item = order?.items.find(i => i.item_id === itemId);
    if (!item) return;

    const nav = getStageNavigation(item);
    if (nav.next) {
      await updateItemSubstage(orderId, itemId, nav.next.key as SubStage);
      toast({
        title: "Moved to Next Stage",
        description: `Moved forward to ${nav.next.label}`,
      });
    }
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

        {/* Main Tabs: Status-based */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <div className="overflow-x-auto pb-2">
            <TabsList className="inline-flex h-auto">
              <TabsTrigger value="in_progress" className="text-sm">
                In Progress
                <Badge variant="secondary" className="ml-2">
                  {inProgressItems.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="completed" className="text-sm">
                Completed
                <Badge variant="secondary" className="ml-2">
                  {completedItems.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="assigned" className="text-sm">
                Assigned to Me
                <Badge variant="secondary" className="ml-2">
                  {assignedProductionItems.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="urgent" className="text-sm">
                Urgent
                <Badge variant="destructive" className="ml-2">
                  {urgentProductionItems.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="all" className="text-sm">
                All
                <Badge variant="secondary" className="ml-2">
                  {allProductionItems.length}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </div>
        </Tabs>

        {/* User Tabs for Admin (only show on 'all' tab) */}
        {isAdmin && productionUsers.length > 0 && activeTab === 'all' && (
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
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col min-h-0">
            <div className="flex-shrink-0 overflow-x-auto pb-2">
              <TabsList className="inline-flex h-auto p-1 bg-secondary/50">
                <TabsTrigger value="all" className="px-4">
                  All
                  <Badge variant="secondary" className="ml-2">{productionItems.length}</Badge>
                </TabsTrigger>
                {getAllUsedStages().map((step) => {
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

            {['all', ...getAllUsedStages().map(s => s.key)].map((tabValue) => (
              <TabsContent key={tabValue} value={tabValue} className="flex-1 mt-4 overflow-hidden">
                <div className="h-full overflow-y-auto custom-scrollbar pr-2">
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
                    <div className="space-y-3">
                      {(() => {
                        const items = getItemsBySubstage(tabValue === 'all' ? 'all' : tabValue);
                        // Group items by order_id to assign suffixes (A, B, C, etc.)
                        const itemsByOrder = new Map<string, Array<{ order: Order; item: OrderItem }>>();
                        items.forEach(({ order, item }) => {
                          const orderKey = order.order_id;
                          if (!itemsByOrder.has(orderKey)) {
                            itemsByOrder.set(orderKey, []);
                          }
                          itemsByOrder.get(orderKey)!.push({ order, item });
                        });

                        // Flatten with suffixes
                        const itemsWithSuffixes: Array<{ order: Order; item: OrderItem; suffix: string }> = [];
                        itemsByOrder.forEach((itemsList, orderKey) => {
                          itemsList.forEach(({ order, item }, index) => {
                            const suffix = itemsList.length > 1 ? String.fromCharCode(65 + index) : ''; // A, B, C, etc.
                            itemsWithSuffixes.push({ order, item, suffix });
                          });
                        });

                        return itemsWithSuffixes.map(({ order, item, suffix }) => (
                          <ProductCard
                            key={`${order.order_id}-${item.item_id}`}
                            order={order}
                            item={item}
                            productSuffix={suffix}
                          />
                        ));
                      })()}
                    </div>
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

        {/* Dispatch Tracking Dialog - Shows when packing is completed */}
        {selectedItemForDispatch && (
          <DispatchValidationDialog
            open={dispatchDialogOpen}
            onOpenChange={(open) => {
              if (!open) {
                // If dialog is closed without confirming, still complete substage
                handleCancelDispatch();
              }
            }}
            productName={selectedItemForDispatch.productName}
            orderId={selectedItemForDispatch.orderId}
            onConfirm={handleConfirmDispatch}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

