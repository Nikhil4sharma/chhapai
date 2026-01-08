
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface AddCustomerButtonProps {
    className?: string;
    variant?: 'default' | 'outline' | 'ghost';
}

export function AddCustomerButton({ className, variant = 'outline' }: AddCustomerButtonProps) {
    const navigate = useNavigate();

    return (
        <Button
            variant={variant}
            size="sm"
            className={cn(
                "h-9 px-3 rounded-full border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-300 shadow-sm hover:shadow text-slate-600 dark:text-slate-300",
                className
            )}
            onClick={() => navigate('/customers?action=new')}
        >
            <UserPlus className="h-4 w-4 mr-2" />
            <span className="text-xs font-semibold">Add Customer</span>
        </Button>
    );
}
