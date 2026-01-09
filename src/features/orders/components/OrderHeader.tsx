import { Link } from 'react-router-dom';
import { ArrowLeft, Edit, MoreHorizontal, Trash2, MessageSquare } from 'lucide-react';
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
    onChat?: () => void;
}

export function OrderHeader({ orderId, onEdit, onDelete, canDelete, onChat }: OrderHeaderProps) {
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

                {/* Center: Order ID */}
                <h1 className="text-lg sm:text-xl font-semibold sm:absolute sm:left-1/2 sm:-translate-x-1/2">
                    Order #{orderId}
                </h1>

                {/* Right: Actions */}
                <div className="flex items-center gap-2">
                    {onChat && (
                        <Button variant="outline" size="sm" onClick={onChat} className="gap-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 bg-indigo-50/50">
                            <MessageSquare className="h-4 w-4" />
                            <span className="hidden sm:inline">Chat</span>
                        </Button>
                    )}

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
