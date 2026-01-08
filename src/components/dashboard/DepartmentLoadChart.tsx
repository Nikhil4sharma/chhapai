
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useOrders } from '@/features/orders/context/OrderContext';

export function DepartmentLoadChart() {
    const { orders } = useOrders();

    const data = useMemo(() => {
        // Initialize counts
        const counts = {
            sales: 0,
            design: 0,
            production: 0,
            dispatch: 0
        };

        // Calculate active items per department/stage
        orders.forEach(order => {
            if (order.is_completed) return;

            order.items.forEach(item => {
                if (item.is_dispatched) return;

                const stage = (item.current_stage || '').toLowerCase();

                // Map stages to main departments
                if (stage === 'sales') counts.sales++;
                else if (stage === 'design' || stage === 'pre-press') counts.design++;
                else if (stage === 'production') counts.production++;
                else if (stage === 'dispatch' || stage === 'packaging') counts.dispatch++;
            });
        });

        return [
            { name: 'Sales', count: counts.sales, color: '#6366f1' },       // Indigo
            { name: 'Design', count: counts.design, color: '#ec4899' },      // Pink
            { name: 'Production', count: counts.production, color: '#eab308' }, // Yellow
            { name: 'Dispatch', count: counts.dispatch, color: '#22c55e' }   // Green
        ];
    }, [orders]);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 rounded-lg shadow-xl">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}</p>
                    <p className="text-xs text-slate-500 mt-1">
                        Active Items: <span className="font-bold text-indigo-600">{payload[0].value}</span>
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <Card className="border-none shadow-sm hover:shadow-md transition-shadow bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-700 dark:text-slate-200">Department Load</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                            <XAxis type="number" hide />
                            <YAxis
                                type="category"
                                dataKey="name"
                                tick={{ fontSize: 12, fill: '#64748b' }}
                                width={80}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20} background={{ fill: '#f1f5f9', radius: [0, 4, 4, 0] }}>
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
