import { useState, useMemo, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  AlertTriangle, 
  Clock, 
  Package, 
  Users, 
  Calendar,
  Download,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAnalytics } from '@/contexts/AnalyticsContext';
import { useAuth } from '@/features/auth/context/AuthContext';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function AnalyticsDashboard() {
  const { isAdmin } = useAuth();
  const {
    getExecutiveKPIs,
    getDeliveryPerformance,
    getAllDepartmentsEfficiency,
    getAllUsersProductivity,
    getAllOrderHealthScores,
    isLoading,
  } = useAnalytics();

  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d');
  const [startDate, setStartDate] = useState<Date>(startOfDay(subDays(new Date(), 30)));
  const [endDate, setEndDate] = useState<Date>(endOfDay(new Date()));
  const [kpis, setKpis] = useState<any>(null);
  const [deliveryMetrics, setDeliveryMetrics] = useState<any>(null);
  const [deptEfficiency, setDeptEfficiency] = useState<any>(null);
  const [userProductivity, setUserProductivity] = useState<any>(null);
  const [healthScores, setHealthScores] = useState<any>(null);

  useEffect(() => {
    if (!isAdmin) {
      toast({
        title: "Access Denied",
        description: "Analytics dashboard is only available for administrators",
        variant: "destructive",
      });
      return;
    }

    loadAnalytics();
  }, [isAdmin, dateRange, startDate, endDate]);

  const loadAnalytics = async () => {
    try {
      const [kpisData, deliveryData, deptData, userData, healthData] = await Promise.all([
        getExecutiveKPIs(startDate, endDate),
        getDeliveryPerformance(startDate, endDate),
        getAllDepartmentsEfficiency(startDate, endDate),
        getAllUsersProductivity(startDate, endDate),
        getAllOrderHealthScores(),
      ]);

      setKpis(kpisData);
      setDeliveryMetrics(deliveryData);
      setDeptEfficiency(deptData);
      setUserProductivity(userData);
      setHealthScores(healthData);
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast({
        title: "Error",
        description: "Failed to load analytics data",
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
              Analytics dashboard is only available for administrators.
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
          <h1 className="text-2xl sm:text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Real-time operational intelligence and performance insights
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
          <Button variant="outline" onClick={loadAnalytics} disabled={isLoading} className="w-full sm:w-auto">
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {isLoading && !kpis ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <TooltipProvider>
          <Tabs defaultValue="overview" className="space-y-4 sm:space-y-6">
            <TabsList className="w-full overflow-x-auto flex-nowrap sm:flex-wrap">
              <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
              <TabsTrigger value="delivery" className="text-xs sm:text-sm">Delivery</TabsTrigger>
              <TabsTrigger value="departments" className="text-xs sm:text-sm">Departments</TabsTrigger>
              <TabsTrigger value="users" className="text-xs sm:text-sm">Users</TabsTrigger>
              <TabsTrigger value="health" className="text-xs sm:text-sm">Health</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {kpis && (
                <>
                  {/* KPI Cards - Clickable with Navigation */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02]" onClick={() => window.location.href = '/sales'}>
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs sm:text-sm font-medium">Total Orders</CardTitle>
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </CardHeader>
                          <CardContent>
                            <div className="text-xl sm:text-2xl font-bold">{kpis.total_orders}</div>
                            <p className="text-xs text-muted-foreground">
                              {format(startDate, 'MMM d')} - {format(endDate, 'MMM d')}
                            </p>
                          </CardContent>
                        </Card>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Click to view all orders in Sales department</p>
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02]" onClick={() => window.location.href = '/analytics?tab=delivery'}>
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs sm:text-sm font-medium">On-Time Delivery</CardTitle>
                            <TrendingUp className="h-4 w-4 text-green-500" />
                          </CardHeader>
                          <CardContent>
                            <div className="text-xl sm:text-2xl font-bold">{kpis.on_time_delivery_rate.toFixed(1)}%</div>
                            <p className="text-xs text-muted-foreground">
                              {deliveryMetrics?.on_time_deliveries || 0} of {deliveryMetrics?.total_orders || 0} orders
                            </p>
                          </CardContent>
                        </Card>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Click to view detailed delivery performance metrics</p>
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02]" onClick={() => window.location.href = '/analytics?tab=health'}>
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs sm:text-sm font-medium">At Risk Orders</CardTitle>
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          </CardHeader>
                          <CardContent>
                            <div className="text-xl sm:text-2xl font-bold">{kpis.at_risk_orders}</div>
                            <p className="text-xs text-muted-foreground">
                              {kpis.delayed_orders} delayed orders
                            </p>
                          </CardContent>
                        </Card>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Click to view order health scores and risk analysis</p>
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02]" onClick={() => window.location.href = '/reports/department-efficiency'}>
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs sm:text-sm font-medium">Avg Lifecycle</CardTitle>
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          </CardHeader>
                          <CardContent>
                            <div className="text-xl sm:text-2xl font-bold">
                              {kpis.average_order_lifecycle_hours.toFixed(1)}h
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Average order duration
                            </p>
                          </CardContent>
                        </Card>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Click to view department efficiency and lifecycle analysis</p>
                      </TooltipContent>
                    </Tooltip>
                </div>

                {/* Self-Learning Status Card */}
                <Card className="col-span-full bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      Self-Learning Analytics Active
                    </CardTitle>
                    <CardDescription>
                      Analytics are continuously improving based on historical order patterns
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Learning Status</p>
                        <p className="text-lg font-semibold text-green-600 dark:text-green-400">Active</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Data Points Analyzed</p>
                        <p className="text-lg font-semibold">{kpis.total_orders}+ Orders</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Accuracy Improvement</p>
                        <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">Auto-Enhancing</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Risk Alerts */}
                {kpis.risk_alerts && kpis.risk_alerts.length > 0 && (
                  <Card className="col-span-full">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-yellow-500" />
                        Risk Alerts
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {kpis.risk_alerts.map((alert: any, index: number) => (
                          <div
                            key={index}
                            className={`p-4 rounded-lg border ${
                              alert.severity === 'high'
                                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                                : alert.severity === 'medium'
                                ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                                : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <Badge
                                  variant={
                                    alert.severity === 'high'
                                      ? 'destructive'
                                      : alert.severity === 'medium'
                                      ? 'default'
                                      : 'secondary'
                                  }
                                  className="mb-2"
                                >
                                  {alert.severity.toUpperCase()}
                                </Badge>
                                <p className="font-medium">{alert.message}</p>
                                {alert.affected_orders.length > 0 && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    Affected: {alert.affected_orders.length} orders
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Top Delay Causes */}
                {kpis.top_delay_causes && kpis.top_delay_causes.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Top Delay Causes</CardTitle>
                      <CardDescription>Most common reasons for delays</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {kpis.top_delay_causes.map((cause: any, index: number) => (
                          <div key={index} className="flex items-center justify-between p-2 rounded">
                            <span className="capitalize">{cause.category.replace(/_/g, ' ')}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{cause.count}</span>
                              <span className="text-sm text-muted-foreground">
                                ({cause.percentage.toFixed(1)}%)
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* Delivery Performance Tab */}
          <TabsContent value="delivery" className="space-y-6">
            {deliveryMetrics && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Delivery Status Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span>On Time</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500"
                              style={{
                                width: `${deliveryMetrics.on_time_percentage}%`,
                              }}
                            />
                          </div>
                          <span className="font-semibold w-16 text-right">
                            {deliveryMetrics.on_time_percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Delayed</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-red-500"
                              style={{
                                width: `${
                                  (deliveryMetrics.delayed_deliveries /
                                    deliveryMetrics.total_orders) *
                                  100
                                }%`,
                              }}
                            />
                          </div>
                          <span className="font-semibold w-16 text-right">
                            {deliveryMetrics.delayed_deliveries}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>At Risk</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-yellow-500"
                              style={{
                                width: `${
                                  (deliveryMetrics.at_risk_deliveries /
                                    deliveryMetrics.total_orders) *
                                  100
                                }%`,
                              }}
                            />
                          </div>
                          <span className="font-semibold w-16 text-right">
                            {deliveryMetrics.at_risk_deliveries}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Department Delay Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(deliveryMetrics.department_delays || {}).map(
                        ([dept, data]: [string, any]) => (
                          <div key={dept} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="capitalize">{dept}</span>
                              <span className="font-semibold">
                                {data.count} ({data.percentage.toFixed(1)}%)
                              </span>
                            </div>
                            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-red-500"
                                style={{ width: `${data.percentage}%` }}
                              />
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Department Efficiency Tab */}
          <TabsContent value="departments" className="space-y-6">
            {deptEfficiency && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(deptEfficiency).map(([dept, metrics]: [string, any]) => (
                  <Card key={dept}>
                    <CardHeader>
                      <CardTitle className="capitalize">{dept}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span>Processed</span>
                          <span className="font-semibold">{metrics.orders_processed}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span>Pending</span>
                          <span className="font-semibold">{metrics.orders_pending}</span>
                        </div>
                      </div>
                      {metrics.bottleneck_stages.length > 0 && (
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground mb-2">Bottlenecks:</p>
                          <div className="flex flex-wrap gap-1">
                            {metrics.bottleneck_stages.map((stage: string) => (
                              <Badge key={stage} variant="destructive" className="text-xs">
                                {stage}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* User Productivity Tab */}
          <TabsContent value="users" className="space-y-6">
            {userProductivity && userProductivity.length > 0 && (
              <div className="space-y-4">
                {userProductivity.map((user: any) => (
                  <Card key={user.user_id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>{user.user_name}</CardTitle>
                        <Badge
                          variant={
                            user.is_overloaded
                              ? 'destructive'
                              : user.is_underutilized
                              ? 'secondary'
                              : 'default'
                          }
                        >
                          Score: {user.productivity_score}
                        </Badge>
                      </div>
                      <CardDescription className="capitalize">{user.department}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Orders Handled</p>
                          <p className="font-semibold text-lg">{user.orders_handled}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Weekly Hours</p>
                          <p className="font-semibold text-lg">
                            {user.weekly_working_hours.toFixed(1)}h
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Avg Time/Order</p>
                          <p className="font-semibold text-lg">
                            {user.average_time_per_order_minutes.toFixed(0)}m
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Trend</p>
                          <p className="font-semibold text-lg capitalize">
                            {user.performance_trend}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Order Health Tab */}
          <TabsContent value="health" className="space-y-6">
            {healthScores && healthScores.length > 0 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-green-600">Healthy Orders</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        {healthScores.filter((s: any) => s.status === 'green').length}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-yellow-600">At Risk Orders</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        {healthScores.filter((s: any) => s.status === 'yellow').length}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-red-600">Critical Orders</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        {healthScores.filter((s: any) => s.status === 'red').length}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Order Health Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {healthScores.slice(0, 20).map((score: any) => (
                        <div
                          key={`${score.order_id}-${score.item_id}`}
                          className="flex items-center justify-between p-3 rounded-lg border"
                        >
                          <div>
                            <span className="font-medium">Order #{score.order_id}</span>
                            {score.item_id && (
                              <span className="text-sm text-muted-foreground ml-2">
                                Item: {score.item_id.slice(0, 8)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            <Badge
                              variant={
                                score.status === 'green'
                                  ? 'default'
                                  : score.status === 'yellow'
                                  ? 'secondary'
                                  : 'destructive'
                              }
                            >
                              {score.score}/100
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
          </Tabs>
        </TooltipProvider>
      )}
    </div>
  );
}

