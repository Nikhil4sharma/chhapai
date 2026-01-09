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
        <Card className={cn("border-l-4 transition-all hover:shadow-md", priorityColor)}>
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                {/* Header */}
                <div className="p-4 sm:p-6">
                    <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-semibold text-base sm:text-lg truncate">
                                    {item.product_name}
                                </h3>
                                <Badge
                                    variant="outline"
                                    className={cn("text-xs shrink-0 border", deptColors[item.current_stage as keyof typeof deptColors] || deptColors.sales)}
                                >
                                    {item.current_stage}
                                </Badge>
                            </div>

                            {/* Quick Info Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground">Quantity</p>
                                    <p className="font-medium">{item.quantity}</p>
                                </div>

                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground">Delivery</p>
                                    <p className="font-medium text-xs sm:text-sm">
                                        {format(new Date(item.delivery_date), 'MMM d, yyyy')}
                                    </p>
                                </div>

                                {item.assigned_to_name && (
                                    <div className="space-y-1 col-span-2 sm:col-span-1">
                                        <p className="text-xs text-muted-foreground">Assigned</p>
                                        <p className="font-medium truncate text-xs sm:text-sm">
                                            {item.assigned_to_name}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Collapse Toggle */}
                        <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                {isOpen ? (
                                    <ChevronUp className="h-4 w-4" />
                                ) : (
                                    <ChevronDown className="h-4 w-4" />
                                )}
                            </Button>
                        </CollapsibleTrigger>
                    </div>

                    {/* Action Buttons - Apple Style */}
                    <div className="flex flex-wrap gap-2">
                        {/* Design Brief Button */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDesignBriefOpen(true)}
                            className="group hover:bg-indigo-50 dark:hover:bg-indigo-950/20 hover:border-indigo-300 transition-all border-indigo-200"
                        >
                            <Palette className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform text-indigo-600 dark:text-indigo-400" />
                            Design Brief
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onUpload}
                            className="group hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:border-blue-300 transition-all"
                        >
                            <Upload className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
                            Upload File
                        </Button>

                        {canEdit && (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={onAssignUser}
                                    className="group hover:bg-purple-50 dark:hover:bg-purple-950/20 hover:border-purple-300 transition-all"
                                >
                                    <UserPlus className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
                                    Assign User
                                </Button>

                                {onAssignDepartment && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={onAssignDepartment}
                                        className="group hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:border-orange-300 transition-all"
                                    >
                                        <Building2 className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
                                        Assign Dept
                                    </Button>
                                )}

                                {onWorkflowAction && item.current_stage !== 'completed' && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onWorkflowAction('process')}
                                        className="group hover:bg-green-50 dark:hover:bg-green-950/20 hover:border-green-300 transition-all"
                                    >
                                        <PlayCircle className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
                                        Process
                                    </Button>
                                )}
                            </>
                        )}

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onAddNote}
                            className="group hover:bg-yellow-50 dark:hover:bg-yellow-950/20 hover:border-yellow-300 transition-all"
                        >
                            <FileText className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
                            Add Note
                        </Button>
                    </div>
                </div>

                {/* Collapsible Content */}
                <CollapsibleContent>
                    <div className="border-t px-4 sm:px-6 py-4 space-y-4 bg-muted/30">
                        {/* Specifications */}
                        <div>
                            <button
                                onClick={() => setShowSpecs(!showSpecs)}
                                className="flex items-center justify-between w-full text-sm font-medium mb-2 hover:text-primary transition-colors"
                            >
                                <span>Product Specifications</span>
                                {showSpecs ? (
                                    <ChevronUp className="h-4 w-4" />
                                ) : (
                                    <ChevronDown className="h-4 w-4" />
                                )}
                            </button>
                            {showSpecs && (
                                <div className="bg-background rounded-lg p-3">
                                    <ProductSpecifications item={item} />
                                </div>
                            )}
                        </div>

                        {/* Files */}
                        {item.files && item.files.length > 0 && (
                            <div>
                                <p className="text-sm font-medium mb-2">Files ({item.files.length})</p>
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
