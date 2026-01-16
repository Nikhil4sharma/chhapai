import { useState, useEffect, useMemo } from 'react';
import { Play, CheckSquare, Camera, Clock, CheckCircle, ArrowRight, ArrowLeft, Truck, AlertTriangle, User, Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductCard } from '@/features/orders/components/ProductCard';
import { OrderGroupList } from '@/features/orders/components/OrderGroupList';
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
            // Filter by assigned_department AND current_stage
            const itemDept = (item.assigned_department || '').toLowerCase().trim();
            const itemStage = (item.current_stage || '').toLowerCase().trim();
            const deptLower = 'production';

            // Check if item belongs to production
            const isProductionItem = itemDept === deptLower || itemStage === deptLower || item.status === 'ready_for_dispatch';

            if (!isProductionItem) return false;

            // Exclude items that are fully completed/dispatched (They go to 'Completed' or History)
            // But keep them if they are just "Ready for Dispatch" or in "Dispatch" stage but not yet "is_dispatched"
            if (item.is_dispatched || item.current_stage === 'completed') {
              // Optional: Allow viewing completed if we want? 
              // logic says "return false" for main list. 
              // But let's stick to hiding completed to keep list clean.
              return false;
            }

            // Allow Dispatch Pending items to be seen?
            // If we strictly hide 'dispatch' stage, then once it moves to dispatch, it disappears from Production dashboard.
            // That might be intended if there is a separate Dispatch Team.
            // But if Production IS Dispatch, they need to see it.
            // user role 'production' should see 'dispatch' items?
            // "Production department ko unke order nhi dikh rhe" -> "Production department can't see THEIR orders".

            // If the item is in 'production' stage, it definitely should show.

            // Visibility check for users
            if (isAdmin || role === 'sales') return true;

            // Production users see everything in production
            return true;
          })
          .map(item => ({
            order,
            item,
          }))
      );
  }, [orders, isAdmin, profile, user, role]);

  // Filter by selected user tab (for admin)
  const userFilteredProductionItems = useMemo(() => {
    if (!isAdmin || selectedUserTab === 'all') {
      return allProductionItems;
    }
    return allProductionItems.filter(({ item }) => item.assigned_to === selectedUserTab);
  }, [allProductionItems, isAdmin, selectedUserTab]);

  // Get urgent items for production department
  const urgentProductionItems = useMemo(() => {
    return userFilteredProductionItems.filter(({ item }) => item.priority_computed === 'red');
  }, [userFilteredProductionItems]);

  // Separate assigned items (assigned_to is set) from unassigned items
  const assignedProductionItems = useMemo(() => {
    return userFilteredProductionItems.filter(({ item }) => item.assigned_to === user?.id);
  }, [userFilteredProductionItems, user]);

  // Get items by status
  const inProgressItems = useMemo(() => {
    return userFilteredProductionItems.filter(({ item }) => {
      return item.current_stage === 'production' &&
        item.assigned_department === 'production' &&
        !item.is_dispatched;
    });
  }, [userFilteredProductionItems]);

  const completedItems = useMemo(() => {
    return userFilteredProductionItems.filter(({ item }) => {
      return item.is_dispatched ||
        item.current_stage === 'dispatch' ||
        item.current_stage === 'completed';
    });
  }, [userFilteredProductionItems]);

  // Calculate realtime stats for Production dashboard
  const productionStats = useMemo(() => {
    return {
      totalItems: userFilteredProductionItems.length,
      urgentItems: urgentProductionItems.length,
      assignedToMe: assignedProductionItems.length,
      yellowPriority: userFilteredProductionItems.filter(({ item }) => item.priority_computed === 'yellow').length,
      bluePriority: userFilteredProductionItems.filter(({ item }) => item.priority_computed === 'blue').length,
    };
  }, [userFilteredProductionItems, urgentProductionItems, assignedProductionItems]);

  // Tab state for filtering
  const [activeTab, setActiveTab] = useState<'in_progress' | 'completed' | 'assigned' | 'urgent' | 'all'>('assigned');
  const [activeStage, setActiveStage] = useState<string>('all');

  // Filter items based on active tab (for production, also respect substage filter)
  const productionItems = useMemo(() => {
    let filtered = userFilteredProductionItems;

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
  }, [userFilteredProductionItems, inProgressItems, completedItems, assignedProductionItems, urgentProductionItems, activeTab]);

  const getItemsBySubstage = (substage: string | null) => {
    if (substage === 'all') return productionItems;
    return productionItems.filter(({ item }) => item.current_substage === substage);
  };

  // Final filtered list based on activeStage
  const filteredByStage = useMemo(() => {
    return getItemsBySubstage(activeStage);
  }, [productionItems, activeStage]);

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

        {/* User Tabs for Admin */}
        {isAdmin && productionUsers.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filter by Team Member</span>
            <Tabs value={selectedUserTab} onValueChange={setSelectedUserTab} className="w-full">
              <TabsList className="h-auto p-1 bg-slate-100 dark:bg-slate-800 rounded-lg flex flex-wrap gap-1 justify-start overflow-visible">
                <TabsTrigger
                  value="all"
                  className="rounded-md px-3 py-1.5 text-xs font-medium data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:shadow-sm transition-all"
                >
                  All Users
                </TabsTrigger>
                {productionUsers.map((productionUser) => {
                  return (
                    <TabsTrigger
                      key={productionUser.user_id}
                      value={productionUser.user_id}
                      className="rounded-md px-3 py-1.5 text-xs font-medium data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:shadow-sm transition-all"
                    >
                      {productionUser.full_name}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
          </div>
        )}

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
                  {userFilteredProductionItems.length}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </div>
        </Tabs>

        {/* Production Stages Filter - Scrollable (Secondary Filter) */}
        <div className="flex-shrink-0 overflow-x-auto pb-2 -mt-2">
          <Tabs value={activeStage} onValueChange={setActiveStage} className="w-full">
            <TabsList className="inline-flex h-auto p-1 bg-muted/50">
              <TabsTrigger value="all" className="px-3 text-xs h-7">
                All Stages
              </TabsTrigger>
              {getAllUsedStages().map((step) => {
                const count = activeStage === step.key ? 0 : getItemsBySubstage(step.key).length; // simple count check
                return (
                  <TabsTrigger key={step.key} value={step.key} className="px-3 text-xs h-7">
                    {step.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2 pb-20">
          <OrderGroupList
            products={filteredByStage}
            emptyMessage={
              activeStage === 'all'
                ? "No items found in this view"
                : `No items found in ${activeStage} stage`
            }
            showFinancials={false}
          />
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

