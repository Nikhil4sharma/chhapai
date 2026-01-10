import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, CheckCircle2, Loader2 } from 'lucide-react';
import { CreateOrderDialogProps } from './types';
import { useCreateOrder } from './useCreateOrder';
import { AdminAssignmentSection } from './AdminAssignmentSection';
import { OrderInfoSection } from './OrderInfoSection';
import { CustomerSection } from './CustomerSection';
import { ProductList } from './ProductList';
import { OrderSummary } from './OrderSummary';
import { useAuth } from '@/features/auth/context/AuthContext';

export function CreateOrderDialog({
    open,
    onOpenChange,
    onOrderCreated
}: CreateOrderDialogProps) {
    const { isAdmin, role } = useAuth();

    const {
        // State
        isCreating,
        isCheckingDuplicate,
        isFetchingWooCommerce,
        isSearchingCustomers,
        orderNumber,
        orderNumberError,
        deliveryDate,
        globalNotes,
        wooOrderData,
        isWooCommerceOrder,
        wooCommerceCheckStatus,
        wooCommerceError,
        showPreviewCard,
        wooCommerceCached,
        wooCommerceImportedAt,
        customerData,
        customerSearchOpen,
        customerSearchQuery,
        customerSearchResults,
        products,
        activeProductIndex,
        selectedDepartment,
        selectedUser,
        departmentUsers,

        // Actions
        setOrderNumber,
        setDeliveryDate,
        setGlobalNotes,
        setCustomerData,
        setCustomerSearchOpen,
        setCustomerSearchQuery,
        setSelectedDepartment,
        setSelectedUser,
        setActiveProductIndex,
        handleOrderNumberChange,
        checkWooCommerceOrder,
        handleConfirmImport,
        handleCustomerSearch,
        selectCustomer,
        addProduct,
        removeProduct,
        updateProduct,
        addSpecification,
        removeSpecification,
        handleCreate,
        resetForm,
        setShowPreviewCard,
        setWooOrderData,
        setWooCommerceCheckStatus,
        isGST,
        setIsGST
    } = useCreateOrder(open, onOpenChange, onOrderCreated);

    return (
        <Dialog open={open} onOpenChange={(value) => {
            if (!value) resetForm();
            onOpenChange(value);
        }}>
            <DialogContent className="max-w-[95vw] sm:max-w-4xl lg:max-w-5xl max-h-[92vh] p-0 gap-0 overflow-hidden bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 border-slate-200 dark:border-slate-800 shadow-2xl">
                <DialogTitle className="sr-only">Create New Order</DialogTitle>
                <DialogHeader className="px-4 sm:px-6 lg:px-8 py-5 sm:py-6 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm sticky top-0 z-10">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30">
                                <Plus className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                                    Create New Order
                                </DialogTitle>
                                <DialogDescription className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                    Create a new manual order with customer details and multiple products
                                </DialogDescription>
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                <ScrollArea className="max-h-[calc(92vh-200px)]">
                    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
                        {isAdmin && (
                            <AdminAssignmentSection
                                selectedDepartment={selectedDepartment}
                                setSelectedDepartment={setSelectedDepartment}
                                selectedUser={selectedUser}
                                setSelectedUser={setSelectedUser}
                                departmentUsers={departmentUsers}
                            />
                        )}

                        <OrderInfoSection
                            orderNumber={orderNumber}
                            setOrderNumber={setOrderNumber}
                            handleOrderNumberChange={handleOrderNumberChange}
                            orderNumberError={orderNumberError}
                            isWooCommerceOrder={isWooCommerceOrder}
                            isAdmin={isAdmin}
                            role={role}
                            checkWooCommerceOrder={checkWooCommerceOrder}
                            isFetchingWooCommerce={isFetchingWooCommerce}
                            isCheckingDuplicate={isCheckingDuplicate}
                            wooCommerceCheckStatus={wooCommerceCheckStatus}
                            wooCommerceError={wooCommerceError}
                            showPreviewCard={showPreviewCard}
                            wooOrderData={wooOrderData}
                            setShowPreviewCard={setShowPreviewCard}
                            setWooOrderData={setWooOrderData}
                            setWooCommerceCheckStatus={setWooCommerceCheckStatus}
                            handleConfirmImport={handleConfirmImport}
                            wooCommerceCached={wooCommerceCached}
                            wooCommerceImportedAt={wooCommerceImportedAt}
                        />

                        <CustomerSection
                            customerData={customerData}
                            setCustomerData={setCustomerData}
                            isWooCommerceOrder={isWooCommerceOrder}
                            customerSearchOpen={customerSearchOpen}
                            setCustomerSearchOpen={setCustomerSearchOpen}
                            customerSearchQuery={customerSearchQuery}
                            setCustomerSearchQuery={setCustomerSearchQuery}
                            customerSearchResults={customerSearchResults}
                            isSearchingCustomers={isSearchingCustomers}
                            handleCustomerSearch={handleCustomerSearch}
                            selectCustomer={selectCustomer}
                        />

                        <ProductList
                            products={products}
                            addProduct={addProduct}
                            removeProduct={removeProduct}
                            updateProduct={updateProduct}
                            addSpecification={addSpecification}
                            removeSpecification={removeSpecification}
                            activeProductIndex={activeProductIndex}
                            setActiveProductIndex={setActiveProductIndex}
                            isWooCommerceOrder={isWooCommerceOrder}
                        />

                        <OrderSummary
                            deliveryDate={deliveryDate}
                            setDeliveryDate={setDeliveryDate}
                            globalNotes={globalNotes}
                            setGlobalNotes={setGlobalNotes}
                            isGST={isGST}
                            setIsGST={setIsGST}
                            isWooCommerceOrder={isWooCommerceOrder}
                        />
                    </div>
                </ScrollArea>

                <DialogFooter className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm sticky bottom-0 z-10 flex flex-row items-center justify-end gap-3 sm:gap-4">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        disabled={isCreating || isCheckingDuplicate}
                        className="h-11 px-6 font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all rounded-xl"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCreate}
                        disabled={isCreating || isCheckingDuplicate || !!orderNumberError || !orderNumber.trim()}
                        className="h-11 px-8 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                        {isCreating ? (
                            <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin text-white/80" />
                                <span>Creating Order...</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4" />
                                <span>Create {products.length} Item Order</span>
                            </div>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
