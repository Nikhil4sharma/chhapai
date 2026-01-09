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

    console.log('[Design] Filtering items:', {
      user_id: user?.id,
      role: role,
      userRole: userRole,
      profileDepartment: profile?.department,
      userProfileDept: userProfileDept,
      deptLower: deptLower,
      isDesignUser: isDesignUser,
      isAdmin: isAdmin,
      totalOrders: orders.length,
    });

    const filtered = orders
      .filter(order => !order.is_completed && !order.archived_from_wc)
      .flatMap(order =>
        order.items
          .filter(item => {
            // Filter by assigned_department (primary check)
            const itemDept = (item.assigned_department || '').toLowerCase().trim();
            const itemStage = (item.current_stage || '').toLowerCase().trim();

            // CRITICAL: Item must be assigned to design department
            // Check both assigned_department and current_stage as fallback
            const isDesignItem = itemDept === deptLower || (itemStage === deptLower && !item.assigned_department);

            if (!isDesignItem) {
              return false;
            }

            // CRITICAL FIX: Visibility logic (CORRECTED)
            // - Admin sees ALL items in design department
            // - Sales sees ALL items in design department
            // - Department users see ALL items in their department (regardless of assigned_to)
            // - assigned_to does NOT control department-level visibility
            // - assigned_to is only used for "Assigned to Me" tab filtering

            if (isAdmin || role === 'sales') {
              return true; // Admin and Sales see everything
            }

            // CRITICAL: User must be in design department to see any design items
            if (!isDesignUser) {
              return false;
            }

            // Department users ALWAYS see items in their department
            // assigned_to does NOT filter out items from department view
            // This ensures department-wide visibility (read-only for assigned items)
            return true;
          })
          .map(item => ({
            order,
            item,
          }))
      );

    console.log('[Design] Filtered items count:', filtered.length, {
      totalOrders: orders.length,
      isDesignUser: isDesignUser,
      userRole: role,
      userProfileDept: profile?.department,
    });

    return filtered;
  }, [orders, isAdmin, user, role, profile]);

  // Separate assigned items (assigned_to is set) from unassigned items
  const assignedDesignItems = useMemo(() => {
    // FIX: Use user?.id instead of user?.uid (Supabase uses id, not uid)
    return allDesignItems.filter(({ item }) => item.assigned_to === user?.id);
  }, [allDesignItems, user]);

  // Get urgent items for design department
  const urgentDesignItems = useMemo(() => {
    return allDesignItems.filter(({ item }) => item.priority_computed === 'red');
  }, [allDesignItems]);

  // Calculate realtime stats for Design dashboard
  const designStats = useMemo(() => {
    return {
      totalItems: allDesignItems.length,
      urgentItems: urgentDesignItems.length,
      assignedToMe: assignedDesignItems.length,
      yellowPriority: allDesignItems.filter(({ item }) => item.priority_computed === 'yellow').length,
      bluePriority: allDesignItems.filter(({ item }) => item.priority_computed === 'blue').length,
    };
  }, [allDesignItems, urgentDesignItems, assignedDesignItems]);

  // Get items by status
  const pendingApprovalItems = useMemo(() => {
    return allDesignItems.filter(({ item, order }) => {
      // Items sent to sales from design (waiting for approval)
      return item.current_stage === 'sales' &&
        item.assigned_department === 'sales' &&
        item.need_design &&
        item.files && item.files.some(f => f.type === 'image' || f.type === 'proof');
    });
  }, [allDesignItems]);

  const inProgressItems = useMemo(() => {
    return allDesignItems.filter(({ item }) => {
      // Items currently in design department and not completed
      return item.current_stage === 'design' &&
        item.assigned_department === 'design';
    });
  }, [allDesignItems]);

  const completedItems = useMemo(() => {
    return allDesignItems.filter(({ item }) => {
      // Items that moved out of design (completed design work)
      return (item.current_stage === 'prepress' ||
        item.current_stage === 'production' ||
        item.current_stage === 'completed') &&
        (item.assigned_department === 'prepress' ||
          item.assigned_department === 'production');
    });
  }, [allDesignItems]);

  // Tab state for filtering
  const [activeTab, setActiveTab] = useState<'all' | 'pending_approval' | 'in_progress' | 'completed' | 'assigned' | 'urgent'>('in_progress');

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
    // For admin, also respect user filter
    if (isAdmin && selectedUserTab !== 'all') {
      return allDesignItems.filter(({ item }) => item.assigned_to === selectedUserTab);
    }
    return allDesignItems;
  }, [allDesignItems, pendingApprovalItems, inProgressItems, completedItems, assignedDesignItems, urgentDesignItems, activeTab, isAdmin, selectedUserTab]);

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
              <TabsTrigger value="pending_approval" className="text-sm">
                Pending Approval
                <Badge variant="secondary" className="ml-2">
                  {pendingApprovalItems.length}
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
                  {assignedDesignItems.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="urgent" className="text-sm">
                Urgent
                <Badge variant="destructive" className="ml-2">
                  {urgentDesignItems.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="all" className="text-sm">
                All
                <Badge variant="secondary" className="ml-2">
                  {allDesignItems.length}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </div>
        </Tabs>

        {/* User Tabs for Admin (only show on 'all' tab) */}
        {isAdmin && designUsers.length > 0 && activeTab === 'all' && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm font-medium text-muted-foreground">Filter by User:</span>
            <Tabs value={selectedUserTab} onValueChange={setSelectedUserTab} className="w-full">
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="all" className="text-sm">
                  All Users
                  <Badge variant="secondary" className="ml-2">
                    {allDesignItems.length}
                  </Badge>
                </TabsTrigger>
                {designUsers.map((designUser) => {
                  const userItemCount = allDesignItems.filter(({ item }) => item.assigned_to === designUser.user_id).length;
                  return (
                    <TabsTrigger key={designUser.user_id} value={designUser.user_id} className="text-sm">
                      {designUser.full_name}
                      <Badge variant="secondary" className="ml-2">{userItemCount}</Badge>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
          </div>
        )}

        {/* Design Queue - Scrollable - Show Products (not orders) */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2">
          {designItems.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <h3 className="font-semibold text-lg mb-2">All caught up!</h3>
                <p className="text-muted-foreground">No products currently need design work.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {(() => {
                // Group items by order_id to assign suffixes (A, B, C, etc.)
                const itemsByOrder = new Map<string, Array<{ order: Order; item: OrderItem }>>();
                designItems.forEach(({ order, item }) => {
                  const orderKey = order.order_id;
                  if (!itemsByOrder.has(orderKey)) {
                    itemsByOrder.set(orderKey, []);
                  }
                  itemsByOrder.get(orderKey)!.push({ order, item });
                });

                // Flatten with suffixes
                const itemsWithSuffixes: Array<{ order: Order; item: OrderItem; suffix: string }> = [];
                itemsByOrder.forEach((items, orderKey) => {
                  items.forEach(({ order, item }, index) => {
                    const suffix = items.length > 1 ? String.fromCharCode(65 + index) : ''; // A, B, C, etc.
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
