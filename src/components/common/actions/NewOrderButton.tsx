
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface NewOrderButtonProps {
    className?: string;
    variant?: 'default' | 'outline' | 'ghost' | 'secondary';
    collapsed?: boolean;
    onClick?: () => void;
}

export function NewOrderButton({ className, variant = 'default', collapsed = false, onClick }: NewOrderButtonProps) {
    const navigate = useNavigate();

    const handleClick = () => {
        if (onClick) {
            onClick();
        } else {
            navigate('/orders/new');
        }
    };

    if (collapsed) {
        return (
            <Button
                size="icon"
                variant={variant}
                className={cn(
                    "h-10 w-10 rounded-full shadow-md bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:scale-105 transition-transform",
                    className
                )}
                onClick={handleClick}
                title="New Order"
            >
                <Plus className="h-5 w-5" />
            </Button>
        );
    }

    return (
        <Button
            size="sm"
            variant={variant}
            className={cn(
                "h-10 px-5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-all duration-300 shadow-md hover:shadow-lg hover:scale-[1.02]",
                className
            )}
            onClick={handleClick}
        >
            <Plus className="h-4 w-4 mr-2" />
            <span className="text-sm font-bold tracking-wide">New Order</span>
        </Button>
    );
}
