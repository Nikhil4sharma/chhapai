import { useState } from 'react';
import { format } from 'date-fns';
import {
    ChevronDown, ChevronUp,
    Upload, Users, FileText, UserPlus, Building2, PlayCircle, Palette
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { OrderItem } from '@/types/order';
import { ProductSpecifications } from '@/features/orders/components/ProductSpecifications';
import { FilePreview } from '@/features/orders/components/FilePreview';
import { cn } from '@/lib/utils';
import { DesignBriefDialog } from './DesignBriefDialog';
import { useUiVisibility } from '@/hooks/useUiVisibility';

interface ProductItemCardProps {
    item: OrderItem;
    orderId: string;
    orderUUID: string; // Add UUID prop
    onUpload: () => void;
    onAssignUser: () => void;
    onAddNote: () => void;
    onAssignDepartment?: () => void;
    onWorkflowAction?: (action: string) => void;
    canEdit: boolean;
}

export function ProductItemCard({
    item,
    orderId,
    orderUUID,
    onUpload,
    onAssignUser,
    onAddNote,
    onAssignDepartment,
    onWorkflowAction,
    canEdit
}: ProductItemCardProps) {
    const [isOpen, setIsOpen] = useState(true);
    const [showSpecs, setShowSpecs] = useState(false);
    const [designBriefOpen, setDesignBriefOpen] = useState(false);

    // UI Visibility Logic - Specific Scope for Order Details Items
    const { canView } = useUiVisibility('order_details_item');

    const priorityColor =
        item.priority_computed === 'red' ? 'border-l-red-500' :
            item.priority_computed === 'yellow' ? 'border-l-yellow-500' :
                'border-l-blue-500';

    // Department colors for badges
    const deptColors = {
        sales: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200',
        design: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200',
        prepress: 'bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-200',
        production: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200',
        outsource: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200',
        dispatch: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-200',
        completed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200',
    };

    return (
        <Card className={cn("border-l-4 transition-all hover:shadow-md bg-card/50", priorityColor)}>
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                {/* Header */}
                <div className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                        <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-lg tracking-tight">
                                    {canView('odi_product_name') ? item.product_name : 'Product Item'}
                                </h3>
                                {canView('odi_status_badge') && (
                                    <Badge
                                        variant="secondary"
                                        className={cn("capitalize text-xs font-semibold px-2 py-0.5 border", deptColors[item.current_stage as keyof typeof deptColors] || deptColors.sales)}
                                    >
                                        {item.current_stage}
                                    </Badge>
                                )}
                            </div>

                            {/* Quick Info Grid - Compact */}
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                                {canView('odi_quantity') && (
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-medium uppercase tracking-wider opacity-70">Qty:</span>
                                        <span className="font-semibold text-foreground">{item.quantity}</span>
                                    </div>
                                )}

                                {canView('odi_delivery_date') && (
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-medium uppercase tracking-wider opacity-70">Delivery:</span>
                                        <span className="font-semibold text-foreground text-xs">
                                            {format(new Date(item.delivery_date), 'MMM d, yyyy')}
                                        </span>
                                    </div>
                                )}

                                {canView('odi_assigned_to') && item.assigned_to_name && (
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-medium uppercase tracking-wider opacity-70">Assigned:</span>
                                        <div className="flex items-center gap-1 bg-muted/50 px-1.5 py-0.5 rounded text-foreground font-medium text-xs">
                                            <Users className="w-3 h-3" />
                                            {item.assigned_to_name}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Collapse Toggle */}
                        <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0 opacity-50 hover:opacity-100">
                                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                        </CollapsibleTrigger>
                    </div>

                    {/* Action Buttons - Refined Layout */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">

                        {/* Primary Process Button - Prominent */}
                        {canEdit && canView('odi_process_button') && onWorkflowAction && item.current_stage !== 'completed' && (
                            <Button
                                size="sm"
                                onClick={() => onWorkflowAction('process')}
                                className="h-8 text-xs font-semibold shadow-sm bg-primary/90 hover:bg-primary text-primary-foreground"
                            >
                                <PlayCircle className="h-3.5 w-3.5 mr-1.5" />
                                Process
                            </Button>
                        )}

                        {/* Secondary Actions - Ghost/Outline */}
                        {canView('odi_brief_button') && ['design', 'prepress', 'production'].includes(item.current_stage) && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDesignBriefOpen(true)}
                                className="h-8 text-xs"
                            >
                                <Palette className="h-3.5 w-3.5 mr-1.5 opacity-70" />
                                <span className="capitalize">{item.current_stage} Brief</span>
                            </Button>
                        )}

                        {canView('odi_upload_button') && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onUpload}
                                className="h-8 text-xs text-muted-foreground hover:text-foreground"
                            >
                                <Upload className="h-3.5 w-3.5 mr-1.5" />
                                Upload
                            </Button>
                        )}



                        {canView('odi_add_note_button') && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onAddNote}
                                className="h-8 text-xs text-muted-foreground hover:text-foreground ml-auto"
                            >
                                <FileText className="h-3.5 w-3.5 mr-1.5" />
                                Note
                            </Button>
                        )}
                    </div>
                </div>

                {/* Collapsible Content */}
                <CollapsibleContent>
                    <div className="border-t border-border/50 bg-muted/20 px-4 py-3 space-y-3">
                        {/* Specifications */}
                        {canView('odi_specs_section') && (
                            <div className="rounded-md border bg-card/60 overflow-hidden">
                                <button
                                    onClick={() => setShowSpecs(!showSpecs)}
                                    className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold bg-muted/40 hover:bg-muted/60 transition-colors"
                                >
                                    <span>Product Specifications</span>
                                    {showSpecs ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                </button>
                                {showSpecs && (
                                    <div className="p-3">
                                        <ProductSpecifications item={item} />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Files */}
                        {canView('odi_files_section') && item.files && item.files.length > 0 && (
                            <div className="pt-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Attached Files</span>
                                    <Badge variant="secondary" className="h-4 px-1 text-[10px]">{item.files.length}</Badge>
                                </div>
                                <FilePreview
                                    files={item.files}
                                    orderId={orderId}
                                    itemId={item.item_id}
                                    productName={item.product_name}
                                    department={item.current_stage}
                                    canDelete={canEdit}
                                />
                            </div>
                        )}
                    </div>
                </CollapsibleContent>
            </Collapsible>

            <DesignBriefDialog
                open={designBriefOpen}
                onOpenChange={setDesignBriefOpen}
                orderId={orderId}
                orderUUID={orderUUID}
                item={item}
            />
        </Card>
    );
}
