import { Link } from 'react-router-dom';
import { ArrowLeft, Edit, MoreHorizontal, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface OrderHeaderProps {
    orderId: string;
    onEdit: () => void;
    onDelete?: () => void;
    canDelete?: boolean;
}

export function OrderHeader({ orderId, onEdit, onDelete, canDelete }: OrderHeaderProps) {
    return (
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
            <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
                {/* Left: Back Button */}
                <Button variant="ghost" size="sm" asChild className="gap-2">
                    <Link to="/dashboard">
                        <ArrowLeft className="h-4 w-4" />
                        <span className="hidden sm:inline">Back</span>
                    </Link>
                </Button>

                {/* Center: Order ID (on mobile, moves to left on desktop) */}
                <h1 className="text-lg sm:text-xl font-semibold absolute left-1/2 -translate-x-1/2 sm:relative sm:left-0 sm:translate-x-0">
                    Order #{orderId}
                </h1>

                {/* Right: Actions */}
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={onEdit} className="gap-2">
                        <Edit className="h-4 w-4" />
                        <span className="hidden sm:inline">Edit</span>
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9 w-9 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => window.print()}>
                                Print Order
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                Duplicate Order
                            </DropdownMenuItem>
                            {canDelete && onDelete && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        className="text-destructive"
                                        onClick={onDelete}
                                    >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete Order
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </div>
    );
}
