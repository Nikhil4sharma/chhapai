import { useState, useEffect } from 'react';
import { Users, Clock, TrendingUp, TrendingDown, AlertCircle, RefreshCw, Download, UserCheck, UserX } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAnalytics } from '@/contexts/AnalyticsContext';
import { useAuth } from '@/features/auth/context/AuthContext';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { UserRole } from '@/types/order';

export default function UserProductivityReports() {
  const { isAdmin } = useAuth();
  const { getAllUsersProductivity, getUserProductivity, isLoading } = useAnalytics();

  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d');
  const [startDate, setStartDate] = useState<Date>(startOfDay(subDays(new Date(), 30)));
  const [endDate, setEndDate] = useState<Date>(endOfDay(new Date()));
  const [userMetrics, setUserMetrics] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserMetrics, setSelectedUserMetrics] = useState<any>(null);

  useEffect(() => {
    if (!isAdmin) {
      toast({
        title: "Access Denied",
        description: "User Productivity Reports are only available for administrators",
        variant: "destructive",
      });
      return;
    }

    loadReports();
  }, [isAdmin, dateRange, startDate, endDate]);

  useEffect(() => {
    if (selectedUserId) {
      loadUserDetails();
    }
  }, [selectedUserId, startDate, endDate]);

  const loadReports = async () => {
    try {
      const metrics = await getAllUsersProductivity(startDate, endDate);
      setUserMetrics(metrics);
    } catch (error) {
      console.error('Error loading user productivity:', error);
      toast({
        title: "Error",
        description: "Failed to load user productivity reports",
        variant: "destructive",
      });
    }
  };

  const loadUserDetails = async () => {
    if (!selectedUserId) return;
    try {
      const metrics = await getUserProductivity(selectedUserId, startDate, endDate);
      setSelectedUserMetrics(metrics);
    } catch (error) {
      console.error('Error loading user details:', error);
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
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
            <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              User Productivity Reports are only available for administrators.
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
          <h1 className="text-2xl sm:text-3xl font-bold">User Productivity Reports</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Track individual user performance, workload, and productivity metrics
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
          <Button variant="outline" onClick={loadReports} disabled={isLoading} className="w-full sm:w-auto">
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {isLoading && userMetrics.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User List */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>All Users</CardTitle>
                <CardDescription>
                  Sorted by productivity score
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {userMetrics.map((user) => (
                    <div
                      key={user.user_id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedUserId === user.user_id
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedUserId(user.user_id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{user.user_name}</h3>
                            <Badge variant="outline" className="text-xs capitalize">
                              {user.department}
                            </Badge>
                            {user.is_overloaded && (
                              <Badge variant="destructive" className="text-xs">
                                Overloaded
                              </Badge>
                            )}
                            {user.is_underutilized && (
                              <Badge variant="secondary" className="text-xs">
                                Underutilized
                              </Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Orders</p>
                              <p className="font-semibold">{user.orders_handled}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Weekly Hours</p>
                              <p className="font-semibold">{user.weekly_working_hours.toFixed(1)}h</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Avg/Order</p>
                              <p className="font-semibold">{user.average_time_per_order_minutes.toFixed(0)}m</p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold mb-1">{user.productivity_score}</div>
                          <Badge
                            variant={
                              user.productivity_score >= 80
                                ? 'default'
                                : user.productivity_score >= 50
                                ? 'secondary'
                                : 'destructive'
                            }
                          >
                            Score
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* User Details */}
          <div className="space-y-4">
            {selectedUserMetrics ? (
              <Card>
                <CardHeader>
                  <CardTitle>{selectedUserMetrics.user_name}</CardTitle>
                  <CardDescription className="capitalize">{selectedUserMetrics.department}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center p-4 bg-primary/10 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Productivity Score</p>
                    <p className="text-4xl font-bold">{selectedUserMetrics.productivity_score}</p>
                    <Badge
                      variant={
                        selectedUserMetrics.productivity_score >= 80
                          ? 'default'
                          : selectedUserMetrics.productivity_score >= 50
                          ? 'secondary'
                          : 'destructive'
                      }
                      className="mt-2"
                    >
                      {selectedUserMetrics.productivity_score >= 80
                        ? 'Excellent'
                        : selectedUserMetrics.productivity_score >= 50
                        ? 'Good'
                        : 'Needs Improvement'}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded">
                      <span className="text-sm">Orders Handled</span>
                      <span className="font-semibold">{selectedUserMetrics.orders_handled}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded">
                      <span className="text-sm">Weekly Hours</span>
                      <span className="font-semibold">{selectedUserMetrics.weekly_working_hours.toFixed(1)}h</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded">
                      <span className="text-sm">Avg Time/Order</span>
                      <span className="font-semibold">{selectedUserMetrics.average_time_per_order_minutes.toFixed(0)}m</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded">
                      <span className="text-sm">Delay Contributions</span>
                      <span className="font-semibold">{selectedUserMetrics.delay_contributions}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded">
                      <span className="text-sm">Delay Resolutions</span>
                      <span className="font-semibold text-green-600">{selectedUserMetrics.delay_resolutions}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="flex items-center gap-2 mb-2">
                      {selectedUserMetrics.is_overloaded ? (
                        <>
                          <UserX className="h-4 w-4 text-red-500" />
                          <span className="text-sm font-medium text-red-600">Overloaded</span>
                        </>
                      ) : selectedUserMetrics.is_underutilized ? (
                        <>
                          <AlertCircle className="h-4 w-4 text-yellow-500" />
                          <span className="text-sm font-medium text-yellow-600">Underutilized</span>
                        </>
                      ) : (
                        <>
                          <UserCheck className="h-4 w-4 text-green-500" />
                          <span className="text-sm font-medium text-green-600">Optimal Workload</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Performance Trend: <span className="capitalize font-medium">{selectedUserMetrics.performance_trend}</span>
                    </p>
                  </div>

                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium mb-2">Daily Working Hours</p>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {Object.entries(selectedUserMetrics.daily_working_hours || {}).map(([date, hours]: [string, any]) => (
                        <div key={date} className="flex items-center justify-between text-xs">
                          <span>{format(new Date(date), 'MMM d')}</span>
                          <span className="font-semibold">{hours.toFixed(1)}h</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">Select a user to view detailed metrics</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

