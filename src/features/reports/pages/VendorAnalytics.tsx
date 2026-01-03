import { useState, useEffect } from 'react';
import { Building2, Clock, TrendingUp, TrendingDown, AlertTriangle, RefreshCw, Package, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAnalytics } from '@/contexts/AnalyticsContext';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useOrders } from '@/features/orders/context/OrderContext';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function VendorAnalytics() {
  const { isAdmin } = useAuth();
  const { orders } = useOrders();
  const { getAllVendorsAnalytics, getVendorAnalytics, isLoading } = useAnalytics();

  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d');
  const [startDate, setStartDate] = useState<Date>(startOfDay(subDays(new Date(), 30)));
  const [endDate, setEndDate] = useState<Date>(endOfDay(new Date()));
  const [vendorMetrics, setVendorMetrics] = useState<any[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const [selectedVendorMetrics, setSelectedVendorMetrics] = useState<any>(null);

  // Get unique vendor names from orders
  const vendorNames = Array.from(
    new Set(
      orders.flatMap(order =>
        order.items
          .filter(item => item.outsource_info?.vendor.vendor_name)
          .map(item => item.outsource_info!.vendor.vendor_name)
      )
    )
  );

  useEffect(() => {
    if (!isAdmin) {
      toast({
        title: "Access Denied",
        description: "Vendor Analytics are only available for administrators",
        variant: "destructive",
      });
      return;
    }

    loadReports();
  }, [isAdmin, dateRange, startDate, endDate]);

  useEffect(() => {
    if (selectedVendor) {
      loadVendorDetails();
    }
  }, [selectedVendor, startDate, endDate]);

  const loadReports = async () => {
    try {
      const metrics = await getAllVendorsAnalytics(startDate, endDate);
      setVendorMetrics(metrics);
    } catch (error) {
      console.error('Error loading vendor analytics:', error);
      toast({
        title: "Error",
        description: "Failed to load vendor analytics",
        variant: "destructive",
      });
    }
  };

  const loadVendorDetails = async () => {
    if (!selectedVendor) return;
    try {
      const metrics = await getVendorAnalytics(selectedVendor, startDate, endDate);
      setSelectedVendorMetrics(metrics);
    } catch (error) {
      console.error('Error loading vendor details:', error);
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
              Vendor Analytics are only available for administrators.
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
          <h1 className="text-2xl sm:text-3xl font-bold">Outsource Vendor Analytics</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Track vendor performance, turnaround times, and quality metrics
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

      {isLoading && vendorMetrics.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : vendorMetrics.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No vendor data available for the selected period</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Vendor List */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>All Vendors</CardTitle>
                <CardDescription>
                  Performance comparison
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {vendorMetrics.map((vendor) => (
                    <div
                      key={vendor.vendor_name}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedVendor === vendor.vendor_name
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedVendor(vendor.vendor_name)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{vendor.vendor_name}</h3>
                            {vendor.delay_percentage > 50 && (
                              <Badge variant="destructive" className="text-xs">
                                High Delays
                              </Badge>
                            )}
                            {vendor.quality_issues_count > 0 && (
                              <Badge variant="destructive" className="text-xs">
                                Quality Issues
                              </Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Total Orders</p>
                              <p className="font-semibold">{vendor.total_orders}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Avg Turnaround</p>
                              <p className="font-semibold">{vendor.average_turnaround_time_hours.toFixed(1)}h</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Delay %</p>
                              <p className={`font-semibold ${vendor.delay_percentage > 30 ? 'text-red-600' : vendor.delay_percentage > 10 ? 'text-yellow-600' : 'text-green-600'}`}>
                                {vendor.delay_percentage.toFixed(1)}%
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold mb-1">{vendor.follow_up_effectiveness}</div>
                          <Badge
                            variant={
                              vendor.follow_up_effectiveness >= 80
                                ? 'default'
                                : vendor.follow_up_effectiveness >= 50
                                ? 'secondary'
                                : 'destructive'
                            }
                          >
                            Effectiveness
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Vendor Details */}
          <div className="space-y-4">
            {selectedVendorMetrics ? (
              <Card>
                <CardHeader>
                  <CardTitle>{selectedVendorMetrics.vendor_name}</CardTitle>
                  <CardDescription>
                    {format(startDate, 'MMM d')} - {format(endDate, 'MMM d')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Total Orders</p>
                      <p className="text-2xl font-bold">{selectedVendorMetrics.total_orders}</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Avg Turnaround</p>
                      <p className="text-2xl font-bold">{selectedVendorMetrics.average_turnaround_time_hours.toFixed(1)}h</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded">
                      <span className="text-sm">Delay Percentage</span>
                      <span className={`font-semibold ${selectedVendorMetrics.delay_percentage > 30 ? 'text-red-600' : selectedVendorMetrics.delay_percentage > 10 ? 'text-yellow-600' : 'text-green-600'}`}>
                        {selectedVendorMetrics.delay_percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded">
                      <span className="text-sm">Quality Issues</span>
                      <span className={`font-semibold flex items-center gap-1 ${selectedVendorMetrics.quality_issues_count > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {selectedVendorMetrics.quality_issues_count > 0 ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                        {selectedVendorMetrics.quality_issues_count}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded">
                      <span className="text-sm">Follow-up Effectiveness</span>
                      <span className="font-semibold">{selectedVendorMetrics.follow_up_effectiveness}/100</span>
                    </div>
                  </div>

                  {selectedVendorMetrics.vs_inhouse_performance && (
                    <div className="pt-4 border-t">
                      <p className="text-sm font-medium mb-3">vs In-House Performance</p>
                      <div className="space-y-2">
                        {selectedVendorMetrics.vs_inhouse_performance.faster_by_percentage > 0 && (
                          <div className="flex items-center justify-between text-sm p-2 bg-green-50 dark:bg-green-900/20 rounded">
                            <span className="flex items-center gap-1">
                              <TrendingUp className="h-4 w-4 text-green-600" />
                              Faster
                            </span>
                            <span className="font-semibold text-green-600">
                              {selectedVendorMetrics.vs_inhouse_performance.faster_by_percentage.toFixed(1)}%
                            </span>
                          </div>
                        )}
                        {selectedVendorMetrics.vs_inhouse_performance.slower_by_percentage > 0 && (
                          <div className="flex items-center justify-between text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded">
                            <span className="flex items-center gap-1">
                              <TrendingDown className="h-4 w-4 text-red-600" />
                              Slower
                            </span>
                            <span className="font-semibold text-red-600">
                              {selectedVendorMetrics.vs_inhouse_performance.slower_by_percentage.toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">Select a vendor to view detailed metrics</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

