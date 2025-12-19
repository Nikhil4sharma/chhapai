import { useState, useEffect } from 'react';
import { Factory, Clock, TrendingUp, TrendingDown, AlertTriangle, RefreshCw, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAnalytics } from '@/contexts/AnalyticsContext';
import { useAuth } from '@/contexts/AuthContext';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { UserRole, STAGE_LABELS } from '@/types/order';

export default function DepartmentEfficiencyReports() {
  const { isAdmin } = useAuth();
  const { getAllDepartmentsEfficiency, getDepartmentEfficiency, isLoading } = useAnalytics();

  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d');
  const [startDate, setStartDate] = useState<Date>(startOfDay(subDays(new Date(), 30)));
  const [endDate, setEndDate] = useState<Date>(endOfDay(new Date()));
  const [selectedDepartment, setSelectedDepartment] = useState<UserRole | 'all'>('all');
  const [allDeptMetrics, setAllDeptMetrics] = useState<Record<string, any>>({});
  const [singleDeptMetrics, setSingleDeptMetrics] = useState<any>(null);

  useEffect(() => {
    if (!isAdmin) {
      toast({
        title: "Access Denied",
        description: "Department Efficiency Reports are only available for administrators",
        variant: "destructive",
      });
      return;
    }

    loadReports();
  }, [isAdmin, dateRange, startDate, endDate, selectedDepartment]);

  const loadReports = async () => {
    try {
      if (selectedDepartment === 'all') {
        const metrics = await getAllDepartmentsEfficiency(startDate, endDate);
        setAllDeptMetrics(metrics);
        setSingleDeptMetrics(null);
      } else {
        const metrics = await getDepartmentEfficiency(selectedDepartment, startDate, endDate);
        setSingleDeptMetrics(metrics);
        setAllDeptMetrics({});
      }
    } catch (error) {
      console.error('Error loading department efficiency:', error);
      toast({
        title: "Error",
        description: "Failed to load department efficiency reports",
        variant: "destructive",
      });
    }
  };

  const handleDateRangeChange = (range: string) => {
    setDateRange(range as any);
    const now = new Date();
    switch (range) {
      case '7d':
        setStartDate(startOfDay(subDays(now, 7)));
        setEndDate(endOfDay(now));
        break;
      case '30d':
        setStartDate(startOfDay(subDays(now, 30)));
        setEndDate(endOfDay(now));
        break;
      case '90d':
        setStartDate(startOfDay(subDays(now, 90)));
        setEndDate(endOfDay(now));
        break;
    }
  };

  if (!isAdmin) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
            <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              Department Efficiency Reports are only available for administrators.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Header - Mobile Responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Department Efficiency Reports</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Track department performance, bottlenecks, and efficiency metrics
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Select value={dateRange} onValueChange={handleDateRangeChange}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedDepartment} onValueChange={(value) => setSelectedDepartment(value as any)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              <SelectItem value="sales">Sales</SelectItem>
              <SelectItem value="design">Design</SelectItem>
              <SelectItem value="prepress">Prepress</SelectItem>
              <SelectItem value="production">Production</SelectItem>
              <SelectItem value="outsource">Outsource</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadReports} disabled={isLoading} className="w-full sm:w-auto">
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {isLoading && !singleDeptMetrics && Object.keys(allDeptMetrics).length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : selectedDepartment === 'all' ? (
        // All Departments View - Mobile Responsive
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {Object.entries(allDeptMetrics).map(([dept, metrics]: [string, any]) => (
            <Card 
              key={dept}
              className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02]"
              onClick={() => setSelectedDepartment(dept as any)}
            >
              <CardHeader>
                <CardTitle className="capitalize flex items-center gap-2">
                  <Factory className="h-5 w-5" />
                  {dept} Department
                </CardTitle>
                <CardDescription>
                  {format(startDate, 'MMM d')} - {format(endDate, 'MMM d')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Processed</p>
                    <p className="text-2xl font-bold">{metrics.orders_processed}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pending</p>
                    <p className="text-2xl font-bold text-yellow-600">{metrics.orders_pending}</p>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-sm font-medium mb-3">Average Time per Stage</p>
                  <div className="space-y-2">
                    {Object.entries(metrics.average_time_per_stage_hours || {}).map(([stage, hours]: [string, any]) => (
                      hours > 0 && (
                        <div key={stage} className="flex items-center justify-between text-sm">
                          <span className="capitalize">{STAGE_LABELS[stage as keyof typeof STAGE_LABELS] || stage}</span>
                          <span className="font-semibold">{hours.toFixed(1)}h</span>
                        </div>
                      )
                    ))}
                  </div>
                </div>

                {metrics.bottleneck_stages && metrics.bottleneck_stages.length > 0 && (
                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium mb-2 text-red-600">Bottlenecks Detected</p>
                    <div className="flex flex-wrap gap-1">
                      {metrics.bottleneck_stages.map((stage: string) => (
                        <Badge key={stage} variant="destructive" className="text-xs">
                          {STAGE_LABELS[stage as keyof typeof STAGE_LABELS] || stage}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">Workload Ratio</p>
                  <p className="text-lg font-semibold">{metrics.workload_vs_throughput_ratio.toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        // Single Department Detailed View
        singleDeptMetrics && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="capitalize flex items-center gap-2">
                  <Factory className="h-5 w-5" />
                  {selectedDepartment} Department - Detailed Report
                </CardTitle>
                <CardDescription>
                  {format(startDate, 'MMM d, yyyy')} - {format(endDate, 'MMM d, yyyy')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Orders Processed</p>
                    <p className="text-3xl font-bold text-green-600">{singleDeptMetrics.orders_processed}</p>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Orders Pending</p>
                    <p className="text-3xl font-bold text-yellow-600">{singleDeptMetrics.orders_pending}</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Workload Ratio</p>
                    <p className="text-3xl font-bold text-blue-600">{singleDeptMetrics.workload_vs_throughput_ratio.toFixed(2)}</p>
                  </div>
                </div>

                <Tabs defaultValue="stages" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="stages">Stage Durations</TabsTrigger>
                    <TabsTrigger value="bottlenecks">Bottlenecks</TabsTrigger>
                    <TabsTrigger value="handover">Handover Delays</TabsTrigger>
                  </TabsList>

                  <TabsContent value="stages" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Average Time per Stage</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {Object.entries(singleDeptMetrics.average_time_per_stage_hours || {}).map(([stage, hours]: [string, any]) => (
                            hours > 0 && (
                              <div key={stage} className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium capitalize">
                                    {STAGE_LABELS[stage as keyof typeof STAGE_LABELS] || stage}
                                  </span>
                                  <span className="text-lg font-bold">{hours.toFixed(1)} hours</span>
                                </div>
                                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary"
                                    style={{ width: `${Math.min(100, (hours / 120) * 100)}%` }}
                                  />
                                </div>
                              </div>
                            )
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="bottlenecks" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-red-500" />
                          Bottleneck Stages
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {singleDeptMetrics.bottleneck_stages && singleDeptMetrics.bottleneck_stages.length > 0 ? (
                          <div className="space-y-3">
                            {singleDeptMetrics.bottleneck_stages.map((stage: string) => {
                              const avgHours = singleDeptMetrics.average_time_per_stage_hours[stage] || 0;
                              return (
                                <div key={stage} className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="font-semibold capitalize">
                                      {STAGE_LABELS[stage as keyof typeof STAGE_LABELS] || stage}
                                    </span>
                                    <Badge variant="destructive">Bottleneck</Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    Average duration: {avgHours.toFixed(1)} hours
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-center py-8">No bottlenecks detected</p>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="handover" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Handover Delays</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {Object.keys(singleDeptMetrics.handover_delays_hours || {}).length > 0 ? (
                          <div className="space-y-3">
                            {Object.entries(singleDeptMetrics.handover_delays_hours || {}).map(([stage, delay]: [string, any]) => (
                              <div key={stage} className="flex items-center justify-between p-3 border rounded-lg">
                                <span className="capitalize">{stage}</span>
                                <span className="font-semibold">{delay.toFixed(1)}h delay</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-center py-8">No handover delay data available</p>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        )
      )}
    </div>
  );
}

