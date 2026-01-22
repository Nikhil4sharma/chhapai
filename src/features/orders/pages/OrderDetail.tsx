import { useParams, useNavigate } from 'react-router-dom';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { Loader2, Package } from 'lucide-react';
import { useOrders } from '@/features/orders/context/OrderContext';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useFinancialAccess } from '@/hooks/useFinancialAccess';
import { toast } from '@/hooks/use-toast';
import { useChat } from '@/features/chat/context/ChatContext';
import { OrderHeader } from '@/features/orders/components/OrderHeader';
import { OrderStatusCard } from '@/features/orders/components/OrderStatusCard';
import { ProductItemCard } from '@/features/orders/components/ProductItemCard';
import { OrderCommunication } from '@/features/orders/components/OrderCommunication';
import { PaymentCard } from '@/features/orders/components/PaymentCard';
import { EditOrderDialog } from '@/components/dialogs/EditOrderDialog';
import { UploadFileDialog } from '@/components/dialogs/UploadFileDialog';
import { AssignUserDialog } from '@/components/dialogs/AssignUserDialog';
import { AssignDepartmentDialog } from '@/components/dialogs/AssignDepartmentDialog';
import { AddNoteDialog } from '@/components/dialogs/AddNoteDialog';
import { ProcessOrderDialog } from '@/components/dialogs/ProcessOrderDialog';
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

import { useUiVisibility } from '@/hooks/useUiVisibility';

// ... imports

export default function OrderDetailNew() {
    const { orderId } = useParams();
    const navigate = useNavigate();
    const { isAdmin, role } = useAuth();
    const { canViewFinancials } = useFinancialAccess();
    const { openNewChat } = useChat();
    // UI Visibility Hook
    const { canView } = useUiVisibility('order_details');

    const {
        getOrderById,
        getTimelineForOrder,
        uploadFile,
        assignToUser,
        assignToDepartment,
        addNote,
        updateOrder,
        deleteOrder,
        isLoading,
        refreshOrders,
        fetchOrderTimeline,
    } = useOrders();

    // ... (rest of the hook usage and state)
    // Get order data
    const order = getOrderById(orderId || '');
    const timeline = orderId ? getTimelineForOrder(orderId) : [];

    // Fetch full timeline for this order on mount
    useEffect(() => {
        if (order?.id) {
            fetchOrderTimeline(order.id);
        }
    }, [order?.id, fetchOrderTimeline]);

    // Dialog states
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [assignUserDialogOpen, setAssignUserDialogOpen] = useState(false);
    const [assignDepartmentDialogOpen, setAssignDepartmentDialogOpen] = useState(false);
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [processDialogOpen, setProcessDialogOpen] = useState(false);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

    // Filter items based on user role
    const filteredItems = useMemo(() => {
        if (!order?.items) return [];
        if (isAdmin || role === 'sales') return order.items;

        if (role) {
            const userDept = role.toLowerCase();
            return order.items.filter(item => {
                const itemDept = (item.assigned_department || '').toLowerCase();
                const itemStage = (item.current_stage || '').toLowerCase();
                return itemDept === userDept || itemStage === userDept;
            });
        }

        return order.items;
    }, [order, isAdmin, role]);

    const mainItem = filteredItems[0] || null;
    const deliveryDate = mainItem?.delivery_date || order?.order_level_delivery_date;
    const canDelete = isAdmin || role === 'sales';

    // Handlers (keep as is)
    const handleEdit = useCallback(() => {
        setEditDialogOpen(true);
    }, []);

    const handleDelete = useCallback(async () => {
        if (!orderId) return;
        await deleteOrder(orderId);
        navigate('/dashboard');
        toast({
            title: 'Order Deleted',
            description: 'The order has been deleted successfully',
        });
    }, [orderId, deleteOrder, navigate]);

    const handleEditSave = useCallback((updates: Partial<typeof order>) => {
        if (!orderId) return;
        updateOrder(orderId, updates);
        setEditDialogOpen(false);
    }, [orderId, updateOrder]);

    const handleChat = useCallback(() => {
        if (!order || !orderId) return;
        openNewChat({
            orderId: order.id, // UUID
            orderReadableId: order.order_id
        });
    }, [order, orderId, openNewChat]);

    const handleUpload = useCallback(async (file: File) => {
        if (!orderId || !selectedItemId) return;
        await uploadFile(orderId, selectedItemId, file, false);
        await refreshOrders();
        setUploadDialogOpen(false);
    }, [orderId, selectedItemId, uploadFile, refreshOrders]);

    const handleAssignUser = useCallback(async (userId: string, userName: string) => {
        if (!orderId || !selectedItemId) return;
        await assignToUser(orderId, selectedItemId, userId, userName);
        await refreshOrders();
        setAssignUserDialogOpen(false);
    }, [orderId, selectedItemId, assignToUser, refreshOrders]);

    const handleAssignDepartment = useCallback(async (department: string) => {
        if (!selectedItemId || !orderId) return;
        await assignToDepartment(orderId, selectedItemId, department);
        await refreshOrders();
        setAssignDepartmentDialogOpen(false);
        toast({
            title: "Department Assigned",
            description: `Item assigned to ${department} department`,
        });
    }, [selectedItemId, orderId, assignToDepartment, refreshOrders]);

    const handleAddNote = useCallback((note: string) => {
        if (!orderId) return;
        addNote(orderId, note);
        setNoteDialogOpen(false);
    }, [orderId, addNote]);

    const openUploadForItem = useCallback((itemId: string) => {
        setSelectedItemId(itemId);
        setUploadDialogOpen(true);
    }, []);

    const openAssignUserForItem = useCallback((itemId: string) => {
        setSelectedItemId(itemId);
        setAssignUserDialogOpen(true);
    }, []);

    const openNoteForItem = useCallback((itemId: string) => {
        setSelectedItemId(itemId);
        setNoteDialogOpen(true);
    }, []);

    const openAssignDepartmentForItem = useCallback((itemId: string) => {
        setSelectedItemId(itemId);
        setAssignDepartmentDialogOpen(true);
    }, []);

    const openProcessForItem = useCallback((itemId: string) => {
        setSelectedItemId(itemId);
        setProcessDialogOpen(true);
    }, []);

    const handleWorkflowAction = useCallback(async (itemId: string, action: string) => {
        if (!orderId) return;

        if (action === 'process_order' || action === 'assign_design') {
            openProcessForItem(itemId);
            return;
        }

        try {
            const item = filteredItems.find(i => i.item_id === itemId);
            if (!item) return;

            const currentStage = item.current_stage;
            const stageProgression: Record<string, string> = {
                'sales': 'design',
                'design': 'prepress',
                'prepress': 'production',
                'production': 'dispatch',
                'dispatch': 'completed',
            };

            const nextStage = stageProgression[currentStage];
            if (!nextStage) {
                toast({
                    title: "Already Completed",
                    description: "This order is already at the final stage",
                });
                return;
            }

            await assignToDepartment(orderId, itemId, nextStage);
            toast({ title: "Status Updated", description: `Moved from ${currentStage} to ${nextStage}` });
            await refreshOrders();
        } catch (error) {
            console.error('Workflow action failed:', error);
            toast({ title: "Action Failed", description: "Could not update status.", variant: "destructive" });
        }
    }, [orderId, filteredItems, assignToDepartment, refreshOrders, openProcessForItem]);

    const canEditItem = useCallback((itemId: string) => {
        if (isAdmin || role === 'sales') return true;
        const item = filteredItems.find(i => i.item_id === itemId);
        if (!item) return false;
        return item.assigned_department === role || item.current_stage === role;
    }, [isAdmin, role, filteredItems]);

    const handleUpdatePayment = useCallback(async (amount: number, mode: string) => {
        if (!orderId || !order) return;

        try {
            const currentReceived = order.financials?.amount_received || 0;
            const newReceived = currentReceived + amount;
            const totalAmount = order.financials?.total || 0;

            await updateOrder(orderId, {
                financials: {
                    ...order.financials,
                    amount_received: newReceived,
                    payment_status: newReceived >= totalAmount ? 'paid' :
                        newReceived > 0 ? 'partial' : 'pending'
                }
            });

            await addNote(orderId, `Payment received: ₹${amount.toLocaleString('en-IN')} via ${mode}`);
            await refreshOrders();

            toast({
                title: 'Payment Updated',
                description: `₹${amount.toLocaleString('en-IN')} added successfully`,
            });
        } catch (error) {
            console.error('Payment update failed:', error);
            toast({
                title: 'Update Failed',
                description: 'Could not update payment. Please try again.',
                variant: 'destructive',
            });
        }
    }, [orderId, order, updateOrder, addNote, refreshOrders]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!order) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen">
                <h2 className="text-xl font-semibold mb-2">Order not found</h2>
                <p className="text-muted-foreground">
                    This order doesn't exist or you don't have access to it.
                </p>
            </div>
        );
    }

    const selectedItem = selectedItemId
        ? filteredItems.find(i => i.item_id === selectedItemId)
        : null;

    return (
        <div className="min-h-screen bg-background">
            {canView('od_header') && (
                <OrderHeader
                    orderId={order.order_id}
                    onEdit={handleEdit}
                    onDelete={canDelete ? () => setDeleteDialogOpen(true) : undefined}
                    canDelete={canDelete}
                />
            )}

            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
                {canView('od_status_card') && (
                    <OrderStatusCard
                        order={order}
                        mainItem={mainItem}
                        deliveryDate={deliveryDate}
                    />
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-4">
                        {canView('od_items_list') && (
                            <>
                                <div className="flex items-center gap-2 mb-4">
                                    <Package className="h-5 w-5 text-muted-foreground" />
                                    <h2 className="text-lg font-semibold">
                                        Order Items ({filteredItems.length})
                                    </h2>
                                </div>

                                {filteredItems.length > 0 ? (
                                    <div className="space-y-4">
                                        {filteredItems.map((item) => (
                                            <ProductItemCard
                                                key={item.item_id}
                                                item={item}
                                                orderId={order.order_id}
                                                orderUUID={order.id || ''}
                                                onUpload={() => openUploadForItem(item.item_id)}
                                                onAssignUser={() => openAssignUserForItem(item.item_id)}
                                                onAddNote={() => openNoteForItem(item.item_id)}
                                                onAssignDepartment={() => openAssignDepartmentForItem(item.item_id)}
                                                onWorkflowAction={(action) => handleWorkflowAction(item.item_id, action)}
                                                canEdit={canEditItem(item.item_id)}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                        <p>No items to display</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="space-y-4">
                        {canView('od_timeline') && (
                            <OrderCommunication
                                orderId={order.id}
                                timeline={timeline}
                                globalNotes={order.global_notes}
                                className="h-[600px]"
                            />
                        )}
                        {canView('od_payment_card') && (
                            <PaymentCard
                                order={order}
                                canView={canViewFinancials}
                                onUpdatePayment={handleUpdatePayment}
                            />
                        )}
                    </div>
                </div>
            </div>

            {order && (
                <>
                    <EditOrderDialog
                        open={editDialogOpen}
                        onOpenChange={setEditDialogOpen}
                        order={order}
                        onSave={handleEditSave}
                    />

                    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete Order?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete order #{order.order_id}.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    {selectedItem && (
                        <>
                            <UploadFileDialog
                                open={uploadDialogOpen}
                                onOpenChange={setUploadDialogOpen}
                                orderId={order.order_id}
                                itemId={selectedItem.item_id}
                                onUpload={handleUpload}
                            />

                            <AssignUserDialog
                                open={assignUserDialogOpen}
                                onOpenChange={setAssignUserDialogOpen}
                                department={selectedItem.current_stage}
                                currentUserId={selectedItem.assigned_to}
                                onAssign={handleAssignUser}
                            />

                            <AssignDepartmentDialog
                                open={assignDepartmentDialogOpen}
                                onOpenChange={setAssignDepartmentDialogOpen}
                                currentDepartment={selectedItem.current_stage}
                                onAssign={handleAssignDepartment}
                            />

                            <ProcessOrderDialog
                                open={processDialogOpen}
                                onOpenChange={setProcessDialogOpen}
                                order={order}
                                item={selectedItem}
                            />
                        </>
                    )}

                    <AddNoteDialog
                        open={noteDialogOpen}
                        onOpenChange={setNoteDialogOpen}
                        onAdd={handleAddNote}
                    />
                </>
            )}
        </div >
    );
}
