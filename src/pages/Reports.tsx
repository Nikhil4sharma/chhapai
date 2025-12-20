import { useState, useMemo } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Calendar, Download, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useOrders } from '@/contexts/OrderContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export default function Reports() {
  const [period, setPeriod] = useState('month');
  const { orders, getCompletedOrders, isLoading } = useOrders();
  const { profileReady, isLoading: authLoading } = useAuth();
  
  // CRITICAL: Wait for auth to be ready before rendering
  if (!profileReady || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  const completedOrders = getCompletedOrders();

  // Calculate real stats from orders with department-wise counts
  const stats = useMemo(() => {
    const byStage = {
      sales: 0,
      design: 0,
      prepress: 0,
      production: 0,
      dispatch: 0,
      completed: 0,
    };
    
    const byPriority = {
      red: 0,
      yellow: 0,
      blue: 0,
    };

    const byDepartment = {
      sales: 0,
      design: 0,
      prepress: 0,
      production: 0,
    };

    let totalItems = 0;

    orders.forEach(order => {
      order.items.forEach(item => {
        byStage[item.current_stage]++;
        byPriority[item.priority_computed]++;
        totalItems++;
        // Count by assigned department
        if (item.assigned_department && byDepartment[item.assigned_department as keyof typeof byDepartment] !== undefined) {
          byDepartment[item.assigned_department as keyof typeof byDepartment]++;
        }
      });
    });

    completedOrders.forEach(order => {
      order.items.forEach(item => {
        if (item.current_stage === 'completed') {
          byStage.completed++;
        }
      });
    });

    return { byStage, byPriority, byDepartment, totalItems };
  }, [orders, completedOrders]);

  // Calculate stage distribution
  const stageData = useMemo(() => {
    const total = Object.values(stats.byStage).reduce((a, b) => a + b, 0);
    return [
      { stage: 'Sales', count: stats.byStage.sales, percentage: total > 0 ? Math.round((stats.byStage.sales / total) * 100) : 0 },
      { stage: 'Design', count: stats.byStage.design, percentage: total > 0 ? Math.round((stats.byStage.design / total) * 100) : 0 },
      { stage: 'Prepress', count: stats.byStage.prepress, percentage: total > 0 ? Math.round((stats.byStage.prepress / total) * 100) : 0 },
      { stage: 'Production', count: stats.byStage.production, percentage: total > 0 ? Math.round((stats.byStage.production / total) * 100) : 0 },
      { stage: 'Dispatch', count: stats.byStage.dispatch, percentage: total > 0 ? Math.round((stats.byStage.dispatch / total) * 100) : 0 },
    ];
  }, [stats]);

  // Report cards with real data
  const reportData = useMemo(() => [
    { label: 'Active Orders', value: orders.length, change: 0, isPositive: true },
    { label: 'Completed Orders', value: completedOrders.length, change: 0, isPositive: true },
    { label: 'Total Items', value: stats.totalItems, change: 0, isPositive: true },
    { label: 'Urgent Items', value: stats.byPriority.red, change: 0, isPositive: false },
  ], [orders, completedOrders, stats]);

  const handleExport = () => {
    // Generate CSV export
    const csvData = orders.map(order => ({
      order_id: order.order_id,
      customer: order.customer.name,
      items: order.items.length,
      status: order.is_completed ? 'Completed' : 'In Progress',
      created_at: order.created_at.toISOString(),
    }));

    const csvContent = [
      Object.keys(csvData[0] || {}).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();

    toast({
      title: "Export Complete",
      description: "Your report has been downloaded",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading reports...</span>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Reports & Analytics</h1>
            <p className="text-muted-foreground">Track your business performance</p>
          </div>
          <div className="flex gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[140px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export report as CSV</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {reportData.map((item) => (
            <Card key={item.label}>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground mb-1">{item.label}</p>
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-bold text-foreground">{item.value}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Department-wise Order Counts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display">Orders by Department</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-primary/5 rounded-lg">
                <p className="text-2xl font-bold text-primary">{stats.byDepartment.sales}</p>
                <p className="text-sm text-muted-foreground mt-1">Sales</p>
              </div>
              <div className="text-center p-4 bg-blue-500/5 rounded-lg">
                <p className="text-2xl font-bold text-blue-500">{stats.byDepartment.design}</p>
                <p className="text-sm text-muted-foreground mt-1">Design</p>
              </div>
              <div className="text-center p-4 bg-purple-500/5 rounded-lg">
                <p className="text-2xl font-bold text-purple-500">{stats.byDepartment.prepress}</p>
                <p className="text-sm text-muted-foreground mt-1">Prepress</p>
              </div>
              <div className="text-center p-4 bg-orange-500/5 rounded-lg">
                <p className="text-2xl font-bold text-orange-500">{stats.byDepartment.production}</p>
                <p className="text-sm text-muted-foreground mt-1">Production</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stage Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Items by Stage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stageData.map((item) => (
                <div key={item.stage}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground">{item.stage}</span>
                    <span className="text-sm text-muted-foreground">{item.count} items</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Priority Distribution */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-priority-red/10 flex items-center justify-center">
                  <span className="text-xl font-bold text-priority-red">{stats.byPriority.red}</span>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Urgent (Red)</p>
                  <p className="font-semibold text-foreground">Less than 3 days</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-priority-yellow/10 flex items-center justify-center">
                  <span className="text-xl font-bold text-priority-yellow">{stats.byPriority.yellow}</span>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Warning (Yellow)</p>
                  <p className="font-semibold text-foreground">3-5 days left</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-priority-blue/10 flex items-center justify-center">
                  <span className="text-xl font-bold text-priority-blue">{stats.byPriority.blue}</span>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Normal (Blue)</p>
                  <p className="font-semibold text-foreground">5+ days left</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}