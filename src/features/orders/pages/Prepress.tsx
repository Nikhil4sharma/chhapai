import { useState, useMemo, useEffect } from 'react';
import { FileCheck, CheckCircle, Clock, ArrowRight, Upload, Eye, FileText, Image as ImageIcon, Settings, Building2, AlertTriangle, Package, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PriorityBadge } from '@/features/orders/components/PriorityBadge';
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
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { UploadFileDialog } from '@/components/dialogs/UploadFileDialog';
import { ProductionStageSequenceDialog } from '@/components/dialogs/ProductionStageSequenceDialog';
import { OutsourceAssignmentDialog } from '@/components/dialogs/OutsourceAssignmentDialog';
import { VendorDetails, OutsourceJobDetails, Order, OrderItem } from '@/types/order';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductCard } from '@/features/orders/components/ProductCard';
import { OrderGroupList } from '@/features/orders/components/OrderGroupList';

interface PrepressUser {
  user_id: string;
  full_name: string;
  department: string;
}

export default function Prepress() {
  const { orders, updateItemStage, uploadFile, sendToProduction, assignToOutsource } = useOrders();
  const { isAdmin, role, user, profile } = useAuth();
  const [selectedUserTab, setSelectedUserTab] = useState<string>('all');
  const [prepressUsers, setPrepressUsers] = useState<PrepressUser[]>([]);

  // Fetch prepress users for admin tabs
  useEffect(() => {
    if (isAdmin) {
      const fetchPrepressUsers = async () => {
        try {
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('user_id, full_name, department')
            .eq('department', 'prepress');

          if (profilesError) throw profilesError;

          const users = (profilesData || []).map(profile => ({
            user_id: profile.user_id,
            full_name: profile.full_name || 'Unknown',
            department: profile.department || 'prepress',
          }));
          setPrepressUsers(users);
        } catch (error) {
          console.error('Error fetching prepress users:', error);
        }
      };
      fetchPrepressUsers();
    }
  }, [isAdmin]);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [stageSequenceDialogOpen, setStageSequenceDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{
    orderId: string;
    itemId: string;
    productName: string;
    currentSequence?: string[] | null;
  } | null>(null);
  const [outsourceDialogOpen, setOutsourceDialogOpen] = useState(false);
  const [selectedItemForOutsource, setSelectedItemForOutsource] = useState<{
    orderId: string;
    itemId: string;
    productName: string;
    quantity: number;
  } | null>(null);
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; type: string } | null>(null);

  // CRITICAL FIX: Start from ALL orders, filter items by assigned_department and current_stage
  // Department is stored on order_items.assigned_department, NOT on orders
  // This ensures orders persist after assignment and don't disappear on re-render
  const allPrepressItems = useMemo(() => {
    const department = 'prepress';
    const deptLower = department.toLowerCase().trim();

    // Check user's department - use role first, then profile.department
    const userDepartment = (role || profile?.department || '').toLowerCase().trim();
    const isPrepressUser = userDepartment === deptLower || isAdmin;

    return orders
      .filter(order => !order.is_completed && !order.archived_from_wc)
      .flatMap(order =>
        order.items
          .filter(item => {
            // Filter by assigned_department AND current_stage
            const itemDept = (item.assigned_department || '').toLowerCase().trim();
            const itemStage = (item.current_stage || '').toLowerCase().trim();
            const isPrepressItem = itemDept === deptLower || itemStage === deptLower;

            if (!isPrepressItem) return false;

            // CRITICAL FIX: Visibility logic (CORRECTED)
            // - Admin sees ALL items in prepress department
            // - Sales sees ALL items in prepress department
            // - Department users see ALL items in their department (regardless of assigned_to)
            // - assigned_to does NOT control department-level visibility
            // - assigned_to is only used for "Assigned to Me" tab filtering

            if (isAdmin || role === 'sales') {
              return true; // Admin and Sales see everything
            }

            // Department users ALWAYS see items in their department
            // assigned_to does NOT filter out items from department view
            // This ensures department-wide visibility (read-only for assigned items)
            return isPrepressUser;
          })
          .map(item => ({
            order,
            item,
          }))
      );
  }, [orders, isAdmin, user, role, profile]);

  // Filter by selected user tab (for admin)
  const userFilteredPrepressItems = useMemo(() => {
    if (!isAdmin || selectedUserTab === 'all') {
      return allPrepressItems;
    }
    return allPrepressItems.filter(({ item }) => item.assigned_to === selectedUserTab);
  }, [allPrepressItems, isAdmin, selectedUserTab]);

  // Get urgent items for prepress department
  const urgentPrepressItems = useMemo(() => {
    return userFilteredPrepressItems.filter(({ item }) => item.priority_computed === 'red');
  }, [userFilteredPrepressItems]);

  // Separate assigned items (assigned_to is set) from unassigned items
  const assignedPrepressItems = useMemo(() => {
    return userFilteredPrepressItems.filter(({ item }) => item.assigned_to === user?.id);
  }, [userFilteredPrepressItems, user]);

  // Get items by status
  const inProgressItems = useMemo(() => {
    return userFilteredPrepressItems.filter(({ item }) => {
      return item.current_stage === 'prepress' &&
        item.assigned_department === 'prepress';
    });
  }, [userFilteredPrepressItems]);

  const completedItems = useMemo(() => {
    return userFilteredPrepressItems.filter(({ item }) => {
      return (item.current_stage === 'production' ||
        item.current_stage === 'completed') &&
        (item.assigned_department === 'production');
    });
  }, [userFilteredPrepressItems]);

  // Calculate realtime stats for Prepress dashboard
  const prepressStats = useMemo(() => {
    return {
      totalItems: userFilteredPrepressItems.length,
      urgentItems: urgentPrepressItems.length,
      assignedToMe: assignedPrepressItems.length,
      yellowPriority: userFilteredPrepressItems.filter(({ item }) => item.priority_computed === 'yellow').length,
      bluePriority: userFilteredPrepressItems.filter(({ item }) => item.priority_computed === 'blue').length,
    };
  }, [userFilteredPrepressItems, urgentPrepressItems, assignedPrepressItems]);

  // Tab state for filtering
  const [activeTab, setActiveTab] = useState<'all' | 'assigned' | 'completed' | 'in_progress' | 'urgent'>('all');

  // Filter items based on active tab
  const prepressItems = useMemo(() => {
    if (activeTab === 'in_progress') {
      return inProgressItems;
    } else if (activeTab === 'completed') {
      return completedItems;
    } else if (activeTab === 'assigned') {
      return assignedPrepressItems;
    } else if (activeTab === 'urgent') {
      return urgentPrepressItems;
    }
    // 'all' tab
    return userFilteredPrepressItems;
  }, [userFilteredPrepressItems, inProgressItems, completedItems, assignedPrepressItems, urgentPrepressItems, activeTab]);


  const handleSendToProduction = (orderId: string, itemId: string, productName: string, currentSequence?: string[] | null) => {
    setSelectedItem({ orderId, itemId, productName, currentSequence });
    setStageSequenceDialogOpen(true);
  };

  const handleConfirmProduction = (sequence: string[]) => {
    if (selectedItem) {
      sendToProduction(selectedItem.orderId, selectedItem.itemId, sequence);
    }
  };

  const handleSendBackToDesign = (orderId: string, itemId: string) => {
    updateItemStage(orderId, itemId, 'design');
    toast({
      title: "Sent Back to Design",
      description: "Item requires design revisions",
    });
  };

  const handleOutsourceClick = (orderId: string, itemId: string, productName: string, quantity: number) => {
    setSelectedItemForOutsource({ orderId, itemId, productName, quantity });
    setOutsourceDialogOpen(true);
  };

  const handleOutsourceAssign = async (vendor: VendorDetails, jobDetails: OutsourceJobDetails) => {
    if (selectedItemForOutsource) {
      await assignToOutsource(
        selectedItemForOutsource.orderId,
        selectedItemForOutsource.itemId,
        vendor,
        jobDetails
      );
      setOutsourceDialogOpen(false);
      setSelectedItemForOutsource(null);
      toast({
        title: "Assigned to Outsource",
        description: `${selectedItemForOutsource.productName} has been assigned to ${vendor.vendor_name}`,
      });
    }
  };

  const handleUploadClick = (orderId: string, itemId: string, productName: string) => {
    setSelectedItem({ orderId, itemId, productName });
    setUploadDialogOpen(true);
  };

  const handleUpload = async (file: File) => {
    if (selectedItem) {
      await uploadFile(selectedItem.orderId, selectedItem.itemId, file);
    }
  };

  const openFilePreview = (file: { url: string; file_name: string; type: string }) => {
    setPreviewFile({ url: file.url, name: file.file_name, type: file.type });
  };

  const isImageFile = (type: string) => {
    return type === 'image' || type.includes('image');
  };

  const isPdfFile = (name: string, type: string) => {
    return name?.toLowerCase().endsWith('.pdf') || type === 'application/pdf' || type?.includes('pdf');
  };

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col gap-4">
        {/* Header - Fixed */}
        <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Prepress Dashboard</h1>
            <p className="text-muted-foreground">
              {prepressItems.length} item{prepressItems.length !== 1 ? 's' : ''} in prepress
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
                <span className="text-2xl font-bold">{prepressStats.totalItems}</span>
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
                <span className="text-2xl font-bold text-red-500">{prepressStats.urgentItems}</span>
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
                <span className="text-2xl font-bold text-blue-500">{prepressStats.assignedToMe}</span>
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
                <span className="text-2xl font-bold text-yellow-500">{prepressStats.yellowPriority}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* User Tabs for Admin */}
        {isAdmin && prepressUsers.length > 0 && (
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
                {prepressUsers.map((prepressUser) => {
                  return (
                    <TabsTrigger
                      key={prepressUser.user_id}
                      value={prepressUser.user_id}
                      className="rounded-md px-3 py-1.5 text-xs font-medium data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:shadow-sm transition-all"
                    >
                      {prepressUser.full_name}
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
                  {userFilteredPrepressItems.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="assigned" className="text-sm">
                Assigned to Me
                <Badge variant="secondary" className="ml-2">
                  {assignedPrepressItems.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="completed" className="text-sm">
                Completed
                <Badge variant="secondary" className="ml-2">
                  {completedItems.length}
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
                  {urgentPrepressItems.length}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </div>
        </Tabs>

        {/* Prepress Queue - Scrollable - Show Products (not orders) */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2 pb-20">
          <OrderGroupList
            products={prepressItems}
            emptyMessage={prepressItems.length === 0 ? "All caught up! No items in prepress." : "No items found"}
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
        {selectedItem && (
          <ProductionStageSequenceDialog
            open={stageSequenceDialogOpen}
            onOpenChange={setStageSequenceDialogOpen}
            productName={selectedItem.productName}
            orderId={selectedItem.orderId}
            currentSequence={selectedItem.currentSequence}
            onConfirm={handleConfirmProduction}
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

        {/* File Preview Dialog */}
        <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                {previewFile?.name}
              </DialogTitle>
            </DialogHeader>
            {previewFile && (
              <div className="flex items-center justify-center bg-muted/50 rounded-lg p-4 min-h-[400px]">
                {isPdfFile(previewFile.name, previewFile.type) ? (
                  <div className="w-full h-[70vh]">
                    <iframe
                      src={`https://docs.google.com/viewer?url=${encodeURIComponent(previewFile.url)}&embedded=true`}
                      className="w-full h-full rounded-lg border border-border"
                      title={previewFile.name}
                      allow="fullscreen"
                    />
                  </div>
                ) : isImageFile(previewFile.type) ? (
                  <img
                    src={previewFile.url}
                    alt={previewFile.name}
                    className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
                  />
                ) : (
                  <div className="text-center">
                    <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">Preview not available for this file type</p>
                    <Button asChild>
                      <a href={previewFile.url} target="_blank" rel="noopener noreferrer">
                        <Eye className="h-4 w-4 mr-2" />
                        Open in New Tab
                      </a>
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

