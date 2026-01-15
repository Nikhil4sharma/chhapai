import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import type { LeaveRequest } from '../types';

interface LeaveHistoryTableProps {
    requests: LeaveRequest[];
}

export function LeaveHistoryTable({ requests }: LeaveHistoryTableProps) {
    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'approved': return <CheckCircle className="h-4 w-4" />;
            case 'rejected': return <XCircle className="h-4 w-4" />;
            case 'cancelled': return <XCircle className="h-4 w-4" />;
            default: return <Clock className="h-4 w-4" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved': return 'bg-emerald-500 hover:bg-emerald-600';
            case 'rejected': return 'bg-red-500 hover:bg-red-600';
            case 'cancelled': return 'bg-slate-500 hover:bg-slate-600';
            default: return 'bg-amber-500 hover:bg-amber-600';
        }
    };

    if (requests.length === 0) {
        return (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No leave requests found</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Leave Type
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Duration
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Days
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Status
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Reason
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {requests.map((request) => (
                        <tr
                            key={request.id}
                            className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                        >
                            <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="h-3 w-3 rounded-full"
                                        style={{ backgroundColor: request.leave_type?.color || '#6366f1' }}
                                    />
                                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                        {request.leave_type?.name || 'Unknown'}
                                    </span>
                                </div>
                            </td>
                            <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">
                                {format(new Date(request.start_date), 'dd MMM yyyy')} - {format(new Date(request.end_date), 'dd MMM yyyy')}
                            </td>
                            <td className="py-3 px-4">
                                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    {request.days_count}
                                </span>
                            </td>
                            <td className="py-3 px-4">
                                <Badge className={`${getStatusColor(request.status)} text-white border-none flex items-center gap-1 w-fit`}>
                                    {getStatusIcon(request.status)}
                                    {request.status.toUpperCase()}
                                </Badge>
                            </td>
                            <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400 max-w-xs truncate">
                                {request.reason || '-'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
