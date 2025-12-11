import { useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Calendar, Download, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getDashboardStats } from '@/data/mockData';
import { toast } from '@/hooks/use-toast';

const reportData = [
  { label: 'Orders Completed', value: 156, change: 12, isPositive: true },
  { label: 'On-Time Delivery', value: '94%', change: 3, isPositive: true },
  { label: 'Average Processing Time', value: '2.4 days', change: 0.3, isPositive: false },
  { label: 'Customer Satisfaction', value: '4.8/5', change: 0.2, isPositive: true },
];

const stageData = [
  { stage: 'Sales', count: 12, percentage: 15 },
  { stage: 'Design', count: 18, percentage: 22 },
  { stage: 'Prepress', count: 8, percentage: 10 },
  { stage: 'Production', count: 32, percentage: 40 },
  { stage: 'Dispatch', count: 10, percentage: 13 },
];

export default function Reports() {
  const [period, setPeriod] = useState('month');
  const stats = getDashboardStats();

  const handleExport = () => {
    toast({
      title: "Export Started",
      description: "Your report will be downloaded shortly",
    });
  };

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
              <TooltipContent>Export report as PDF</TooltipContent>
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
                  <div className={`flex items-center text-sm ${item.isPositive ? 'text-green-500' : 'text-priority-red'}`}>
                    {item.isPositive ? (
                      <TrendingUp className="h-4 w-4 mr-1" />
                    ) : (
                      <TrendingDown className="h-4 w-4 mr-1" />
                    )}
                    {item.change}%
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Stage Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Orders by Stage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stageData.map((item) => (
                <div key={item.stage}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground">{item.stage}</span>
                    <span className="text-sm text-muted-foreground">{item.count} orders</span>
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
