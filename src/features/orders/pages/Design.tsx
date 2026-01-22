import { useState, useMemo, useEffect } from 'react';
import { Upload, CheckCircle, Clock, ArrowRight, Send, Building2, Settings, MessageSquare, FileText, RotateCcw, AlertTriangle, Package, User } from 'lucide-react';
import { ProductCard } from '@/features/orders/components/ProductCard';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PriorityBadge } from '@/features/orders/components/PriorityBadge';
import { FilePreview } from '@/features/orders/components/FilePreview';
import { useOrders } from '@/features/orders/context/OrderContext';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useWorkLogs } from '@/contexts/WorkLogContext';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
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
} from '@/components/ui/dropdown-menu';
import { UploadFileDialog } from '@/components/dialogs/UploadFileDialog';
import { ProductionStageSequenceDialog } from '@/components/dialogs/ProductionStageSequenceDialog';
import { OutsourceAssignmentDialog } from '@/components/dialogs/OutsourceAssignmentDialog';
import { AddWorkNoteDialog } from '@/components/dialogs/AddWorkNoteDialog';
import { VendorDetails, OutsourceJobDetails, Order, OrderItem } from '@/types/order';
import { OrderGroupList } from '@/features/orders/components/OrderGroupList';

interface DesignUser {
  user_id: string;
  full_name: string;
  department: string;
}

export default function Design() {
  const { orders, updateItemStage, uploadFile, sendToProduction, assignToOutsource } = useOrders();
  const { getWorkNotesByOrder } = useWorkLogs();
  const { isAdmin, role, user, profile } = useAuth();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{ orderId: string; itemId: string } | null>(null);
  const [productionStageDialogOpen, setProductionStageDialogOpen] = useState(false);
  const [selectedItemForProduction, setSelectedItemForProduction] = useState<{ orderId: string; itemId: string; productName: string; currentSequence?: string[] | null } | null>(null);
  const [outsourceDialogOpen, setOutsourceDialogOpen] = useState(false);
  const [selectedItemForOutsource, setSelectedItemForOutsource] = useState<{ orderId: string; itemId: string; productName: string; quantity: number } | null>(null);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [selectedItemForNote, setSelectedItemForNote] = useState<{ orderId: string; itemId: string; productName: string } | null>(null);
  const [searchParams] = useSearchParams();
  const [selectedUserTab, setSelectedUserTab] = useState<string>(searchParams.get('assigned_user') || 'all');
  const [designUsers, setDesignUsers] = useState<DesignUser[]>([]);

  // Fetch design users for admin tabs
  useEffect(() => {
    if (isAdmin) {
      const fetchDesignUsers = async () => {
        try {
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('user_id, full_name, department')
            .eq('department', 'design');

          if (profilesError) throw profilesError;

          const users = (profilesData || []).map(profile => ({
            user_id: profile.user_id,
            full_name: profile.full_name || 'Unknown',
            department: profile.department || 'design',
          }));
          setDesignUsers(users);
        } catch (error) {
          console.error('Error fetching design users:', error);
        }
      };
      fetchDesignUsers();
    }
  }, [isAdmin]);

  // CRITICAL FIX: Start from ALL orders, filter items by assigned_department and current_stage
  // Department is stored on order_items.assigned_department, NOT on orders
  // This ensures orders persist after assignment and don't disappear on re-render
  const allDesignItems = useMemo(() => {
    const department = 'design';
    const deptLower = department.toLowerCase().trim();

    // Check user's department - use role first, then profile.department
    const userRole = (role || '').toLowerCase().trim();
    const userProfileDept = (profile?.department || '').toLowerCase().trim();
    const isDesignUser = userRole === deptLower || userProfileDept === deptLower || isAdmin;

    const filtered = orders
      .filter(order => !order.is_completed && !order.archived_from_wc)
      .flatMap(order =>
        order.items
          .filter(item => {
            // Filter by assigned_department (primary check)
            const itemDept = (item.assigned_department || '').toLowerCase().trim();
            const itemStage = (item.current_stage || '').toLowerCase().trim();

            // CRITICAL: Item must be assigned to design department
            // Check assigned_department, current_stage, AND status for robustness
            const isDesignDept =
              itemDept === 'design' ||
              itemStage === 'design' ||
              (item.status && item.status.toLowerCase().includes('design'));

            // ALSO INCLUDE: Items sent to Sales for Approval (so they show in Pending Approval tab)
            const isPendingApprovalInSales = (itemDept === 'sales') &&
              (item.status === 'pending_for_customer_approval' || item.status === 'pending_client_approval') &&
              item.need_design;

            const isDesignItem = isDesignDept || isPendingApprovalInSales;

            if (!isDesignItem) {
              return false;
            }

            // CRITICAL FIX: Visibility logic (STRICT)
            // - Admin sees ALL items in design department
            // - Sales sees ALL items in design department
            // - Design department users see:
            //    1. Items assigned SPECIFICALLY to them
            //    2. Items that are UNASSIGNED (assigned_to is null or empty)
            //    3. Items assigned to '_unassign' (if that sentinel is used)
            // - Design users CANNOT see items assigned to OTHER Design users (or other departments)

            // VISIBILITY LOGIC (Simplified - Trust RLS):
            // 1. Admin & Sales see everything
            if (isAdmin || role === 'sales') {
              return true;
            }

            // 2. Design users see items that RLS has already approved
            // RLS checks: assigned_to, department match, stage match
            // No need to duplicate that logic here
            if (isDesignUser) {
              return true;
            }

            // 3. Other roles don't see design items
            return false;
          })
          .map(item => ({
            order,
            item,
          }))
      );


    console.log('[Design] === END FILTERING ===');
    console.log('[Design] Filtered items count:', filtered.length);
    if (filtered.length > 0) {
      console.log('[Design] Sample filtered items:', filtered.slice(0, 3).map(f => ({
        productName: f.item.product_name,
        assignedTo: f.item.assigned_to,
        matchesUserId: f.item.assigned_to === user?.id,
        assignedDept: f.item.assigned_department,
        currentStage: f.item.current_stage,
      })));
    } else {
      console.warn('[Design] No design items found!');
    }

    return filtered;
  }, [orders, isAdmin, user, role, profile]);

  // Filter by selected user tab (for admin)
  const userFilteredDesignItems = useMemo(() => {
    if (!isAdmin || selectedUserTab === 'all') {
      return allDesignItems;
    }
    return allDesignItems.filter(({ item }) => item.assigned_to === selectedUserTab);
  }, [allDesignItems, isAdmin, selectedUserTab]);

  // Separate assigned items (assigned_to is set) from unassigned items
  const assignedDesignItems = useMemo(() => {
    // FIX: Use user?.id instead of user?.uid (Supabase uses id, not uid)
    return userFilteredDesignItems.filter(({ item }) => item.assigned_to === user?.id);
  }, [userFilteredDesignItems, user]);

  // Get urgent items for design department
  const urgentDesignItems = useMemo(() => {
    return userFilteredDesignItems.filter(({ item }) => item.priority_computed === 'red');
  }, [userFilteredDesignItems]);

  // Calculate realtime stats for Design dashboard
  const designStats = useMemo(() => {
    return {
      totalItems: userFilteredDesignItems.length,
      urgentItems: urgentDesignItems.length,
      assignedToMe: assignedDesignItems.length,
      yellowPriority: userFilteredDesignItems.filter(({ item }) => item.priority_computed === 'yellow').length,
      bluePriority: userFilteredDesignItems.filter(({ item }) => item.priority_computed === 'blue').length,
    };
  }, [userFilteredDesignItems, urgentDesignItems, assignedDesignItems]);

  // Get items by status
  const pendingApprovalItems = useMemo(() => {
    return userFilteredDesignItems.filter(({ item, order }) => {
      // Items sent to sales from design (waiting for approval)
      // Or items that are specifically in pending status for customer approval
      const isPendingStatus = item.status === 'pending_for_customer_approval' || item.status === 'pending_client_approval';
      const isWithSales = (item.assigned_department === 'sales' || item.current_stage === 'sales');

      return (isWithSales || isPendingStatus) && item.need_design;
    });
  }, [userFilteredDesignItems]);

  const inProgressItems = useMemo(() => {
    return userFilteredDesignItems.filter(({ item }) => {
      // Items currently in design department and not completed
      // Also include rejected items (revisions) and approved items waiting to be handed off
      const isDesignDept = item.assigned_department === 'design' || item.current_stage === 'design';
      const isWorkingStatus = item.status === 'design_in_progress' || item.status === 'rejected' || item.status === 'approved';

      return isDesignDept && isWorkingStatus;
    });
  }, [userFilteredDesignItems]);

  const completedItems = useMemo(() => {
    return userFilteredDesignItems.filter(({ item }) => {
      // Items that moved out of design (completed design work)
      return (item.current_stage === 'prepress' ||
        item.current_stage === 'production' ||
        item.current_stage === 'completed') &&
        (item.assigned_department === 'prepress' ||
          item.assigned_department === 'production');
    });
  }, [userFilteredDesignItems]);

  // Tab state for filtering
  const [activeTab, setActiveTab] = useState<'all' | 'assigned' | 'completed' | 'urgent' | 'pending_approval' | 'in_progress'>('all');

  // Filter items based on active tab
  const designItems = useMemo(() => {
    if (activeTab === 'pending_approval') {
      return pendingApprovalItems;
    } else if (activeTab === 'in_progress') {
      return inProgressItems;
    } else if (activeTab === 'completed') {
      return completedItems;
    } else if (activeTab === 'assigned') {
      return assignedDesignItems;
    } else if (activeTab === 'urgent') {
      return urgentDesignItems;
    }
    // 'all' tab - show all design items
    return userFilteredDesignItems;
  }, [userFilteredDesignItems, pendingApprovalItems, inProgressItems, completedItems, assignedDesignItems, urgentDesignItems, activeTab]);

  // PRODUCT-CENTRIC: No need to group back into orders - show products directly

  // Debug logging for design department
  useEffect(() => {
    console.log('[Design] ========== DEBUG INFO ==========');
    console.log('[Design] User Info:', {
      user_id: user?.id, // FIX: Use user?.id instead of user?.uid (Supabase uses id, not uid)
      role: role,
      profile_department: profile?.department,
      isAdmin: isAdmin,
      isDesignUser: (role || profile?.department || '').toLowerCase().trim() === 'design',
    });
    console.log('[Design] Orders Count:', orders.length);
    console.log('[Design] All Design Items Count:', allDesignItems.length);
    console.log('[Design] Filtered Design Items Count:', designItems.length);
    console.log('[Design] Design Items Count:', designItems.length);

    // Show sample items
    if (allDesignItems.length > 0) {
      console.log('[Design] Sample Design Items (first 3):', allDesignItems.slice(0, 3).map(({ item, order }) => ({
        order_id: order.order_id,
        item_id: item.item_id,
        product_name: item.product_name,
        assigned_department: item.assigned_department,
        current_stage: item.current_stage,
        assigned_to: item.assigned_to,
        user_can_see: !item.assigned_to || item.assigned_to === user?.id, // FIX: Use user?.id instead of user?.uid
      })));
    } else {
      console.warn('[Design] No design items found!');
      // Check if there are any items in orders that should be visible
      const allItemsInOrders = orders.flatMap(o => o.items);
      const designItemsInOrders = allItemsInOrders.filter(item => {
        const dept = (item.assigned_department || '').toLowerCase().trim();
        const stage = (item.current_stage || '').toLowerCase().trim();
        return dept === 'design' || stage === 'design';
      });
      console.log('[Design] Total items in orders with design dept/stage:', designItemsInOrders.length);
      if (designItemsInOrders.length > 0) {
        console.log('[Design] Sample items that should be visible:', designItemsInOrders.slice(0, 3).map(item => ({
          item_id: item.item_id,
          assigned_department: item.assigned_department,
          current_stage: item.current_stage,
          assigned_to: item.assigned_to,
        })));
      }
    }
    console.log('[Design] =================================');
  }, [orders, allDesignItems, designItems, user, role, profile, isAdmin]);

  const handleMarkComplete = (orderId: string, itemId: string) => {
    updateItemStage(orderId, itemId, 'prepress');
    toast({
      title: "Design Complete",
      description: "Item has been sent to Prepress",
    });
  };

  const handleSendToPrepress = async (orderId: string, itemId: string) => {
    // Check if design notes exist for this item
    const order = orders.find(o => o.order_id === orderId);
    const item = order?.items.find(i => i.item_id === itemId);
    if (!order || !item) return;

    const workNotes = getWorkNotesByOrder(order.id || orderId);
    const designNotes = workNotes.filter(note =>
      (note.order_item_id === itemId || note.order_item_id === null) &&
      note.stage === 'design'
    );

    if (designNotes.length === 0) {
      toast({
        title: "Design Notes Required",
        description: "Please add design notes before moving to next stage",
        variant: "destructive",
      });
      setSelectedItemForNote({ orderId, itemId, productName: item.product_name });
      setNoteDialogOpen(true);
      return;
    }

    await updateItemStage(orderId, itemId, 'prepress');
    toast({
      title: "Sent to Prepress",
      description: "Item has been sent to Prepress department",
    });
  };

  const handleSendToProduction = (orderId: string, itemId: string) => {
    const order = orders.find(o => o.order_id === orderId);
    const item = order?.items.find(i => i.item_id === itemId);
    if (!order || !item) return;

    setSelectedItemForProduction({
      orderId,
      itemId,
      productName: item.product_name,
      currentSequence: (item as any).production_stage_sequence
    });
    setProductionStageDialogOpen(true);
  };

  const handleOutsourceClick = (orderId: string, itemId: string, productName: string, quantity: number) => {
    setSelectedItemForOutsource({ orderId, itemId, productName, quantity });
    setOutsourceDialogOpen(true);
  };

  const handleOutsourceAssign = async (vendor: VendorDetails, jobDetails: OutsourceJobDetails) => {
    if (selectedItemForOutsource) {
      await assignToOutsource(selectedItemForOutsource.orderId, selectedItemForOutsource.itemId, vendor, jobDetails);
      setOutsourceDialogOpen(false);
      setSelectedItemForOutsource(null);
    }
  };

  const handleUploadClick = (orderId: string, itemId: string) => {
    setSelectedItem({ orderId, itemId });
    setUploadDialogOpen(true);
  };

  const handleUpload = async (file: File) => {
    if (selectedItem) {
      await uploadFile(selectedItem.orderId, selectedItem.itemId, file);
    }
  };

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col gap-4">
        {/* Header - Fixed */}
        <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Design Dashboard</h1>
            <p className="text-muted-foreground">
              {designItems.length} item{designItems.length !== 1 ? 's' : ''} {activeTab === 'assigned' ? 'assigned to you' : activeTab === 'urgent' ? 'urgent' : 'in design'}
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
                <span className="text-2xl font-bold">{designStats.totalItems}</span>
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
                <span className="text-2xl font-bold text-red-500">{designStats.urgentItems}</span>
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
                <span className="text-2xl font-bold text-blue-500">{designStats.assignedToMe}</span>
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
                <span className="text-2xl font-bold text-yellow-500">{designStats.yellowPriority}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* User Tabs for Admin */}
        {isAdmin && designUsers.length > 0 && (
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
                {designUsers.map((designUser) => {
                  return (
                    <TabsTrigger
                      key={designUser.user_id}
                      value={designUser.user_id}
                      className="rounded-md px-3 py-1.5 text-xs font-medium data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:shadow-sm transition-all"
                    >
                      {designUser.full_name}
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
              <TabsTrigger value="all" className="text-sm">
                All Orders
                <Badge variant="secondary" className="ml-2">
                  {userFilteredDesignItems.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="assigned" className="text-sm">
                Assigned to Me
                <Badge variant="secondary" className="ml-2">
                  {assignedDesignItems.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="completed" className="text-sm">
                Completed
                <Badge variant="secondary" className="ml-2">
                  {completedItems.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="pending_approval" className="text-sm">
                Pending Approval
                <Badge variant="secondary" className="ml-2">
                  {pendingApprovalItems.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="in_progress" className="text-sm">
                In Progress
                <Badge variant="secondary" className="ml-2">
                  {inProgressItems.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="urgent" className="text-sm">
                Urgent
                <Badge variant="destructive" className="ml-2">
                  {urgentDesignItems.length}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </div>
        </Tabs>

        {/* Design Queue - Scrollable - Show Products (not orders) */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2 pb-20">
          <OrderGroupList
            products={designItems}
            emptyMessage={designItems.length === 0 ? "No design items found" : "No items matching filter"}
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

        {/* Production Stage Sequence Dialog */}
        {selectedItemForProduction && (
          <ProductionStageSequenceDialog
            open={productionStageDialogOpen}
            onOpenChange={setProductionStageDialogOpen}
            productName={selectedItemForProduction.productName}
            orderId={selectedItemForProduction.orderId}
            currentSequence={selectedItemForProduction.currentSequence}
            onConfirm={(sequence) => {
              sendToProduction(selectedItemForProduction.orderId, selectedItemForProduction.itemId, sequence);
              setProductionStageDialogOpen(false);
              setSelectedItemForProduction(null);
            }}
          />
        )}

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

        {/* Design Notes Dialog */}
        {selectedItemForNote && (
          <AddWorkNoteDialog
            open={noteDialogOpen}
            onOpenChange={(open) => {
              setNoteDialogOpen(open);
              if (!open) setSelectedItemForNote(null);
            }}
            orderId={orders.find(o => o.order_id === selectedItemForNote.orderId)?.id || selectedItemForNote.orderId}
            itemId={selectedItemForNote.itemId}
            stage="design"
            productName={selectedItemForNote.productName}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
