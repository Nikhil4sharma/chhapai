import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Calendar } from 'lucide-react';
import type { LeaveBalance } from '../types';

interface LeaveBalanceCardProps {
    balance: LeaveBalance;
}

export function LeaveBalanceCard({ balance }: LeaveBalanceCardProps) {
    const total = balance.leave_type?.days_allowed_per_year || 0;
    const used = balance.used || 0;
    const remaining = total - used;
    const percentage = total > 0 ? (used / total) * 100 : 0;

    return (
        <Card
            className="hover:shadow-lg transition-shadow border-l-4"
            style={{ borderLeftColor: balance.leave_type?.color || '#6366f1' }}
        >
            <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            {balance.leave_type?.name || 'Unknown'}
                        </p>
                        <p
                            className="text-2xl font-bold mt-1"
                            style={{ color: balance.leave_type?.color || '#6366f1' }}
                        >
                            {remaining}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            of {total} days remaining
                        </p>
                    </div>
                    <Calendar
                        className="h-8 w-8 opacity-20"
                        style={{ color: balance.leave_type?.color || '#6366f1' }}
                    />
                </div>

                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                        <span>Used: {used} days</span>
                        <span>{Math.round(percentage)}%</span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                </div>
            </CardContent>
        </Card>
    );
}
