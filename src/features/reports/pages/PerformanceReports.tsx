import { useState, useMemo, useEffect } from 'react';
import { format, subDays, parseISO } from 'date-fns';
import { Calendar, Clock, FileText, User, Filter, Download, TrendingUp, Package, Search, ArrowUpDown, ArrowUp, ArrowDown, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useWorkLogs } from '@/contexts/WorkLogContext';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useOrders } from '@/features/orders/context/OrderContext';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function PerformanceReports() {
  const { user, isAdmin, role, profile } = useAuth();
  const { getDailyPerformanceReport, workLogs, isLoading: logsLoading } = useWorkLogs();
  const { orders } = useOrders();
  
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedUserId, setSelectedUserId] = useState<string>(user?.uid || '');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('all');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  // Search and sort for work logs
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'time' | 'user' | 'order' | 'stage' | 'action' | 'date'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterStage, setFilterStage] = useState<string>('all');
  const [filterAction, setFilterAction] = useState<string>('all');

  // Get all users for admin filter
  const allUsers = useMemo(() => {
    const userMap = new Map<string, { id: string; name: string; department: string }>();
    workLogs.forEach(log => {
      if (!userMap.has(log.user_id)) {
        userMap.set(log.user_id, {
          id: log.user_id,
          name: log.user_name,
          department: log.department,
        });
      }
    });
    return Array.from(userMap.values());
  }, [workLogs]);

  // Get unique departments
  const departments = useMemo(() => {
    const deptSet = new Set<string>();
    workLogs.forEach(log => deptSet.add(log.department));
    return Array.from(deptSet).sort();
  }, [workLogs]);

  // Get unique order IDs
  const orderIds = useMemo(() => {
    const orderSet = new Set<string>();
    workLogs.forEach(log => orderSet.add(log.order_number));
    return Array.from(orderSet).sort();
  }, [workLogs]);

  useEffect(() => {
    if (user) {
      loadReport();
    }
  }, [selectedDate, selectedUserId, user, selectedDepartment, selectedOrderId]);

  const loadReport = async () => {
    if (!user) return;
    
    const userId = isAdmin && selectedUserId ? selectedUserId : user.uid;
    setLoading(true);
    
    try {
      const reportData = await getDailyPerformanceReport(userId, selectedDate);
      setReport(reportData);
    } catch (error) {
      console.error('Error loading report:', error);
      toast({
        title: "Error",
        description: "Failed to load performance report",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  // Export to CSV
  const exportToCSV = () => {
    if (!isAdmin || filteredLogs.length === 0) {
      toast({
        title: "No Data",
        description: "No data available to export",
        variant: "destructive",
      });
      return;
    }

    // Prepare CSV data
    const headers = ['Date', 'User', 'Department', 'Order Number', 'Product', 'Stage', 'Action', 'Summary', 'Time Spent (minutes)', 'Time Spent (formatted)'];
    const rows = filteredLogs.map(log => [
      log.work_date,
      log.user_name,
      log.department,
      log.order_number,
      getProductName(log.order_id, log.order_item_id),
      log.stage,
      log.action_type.replace('_', ' '),
      log.work_summary,
      log.time_spent_minutes.toString(),
      formatTime(log.time_spent_minutes),
    ]);

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `work-logs-${selectedDate}-${format(new Date(), 'HHmmss')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export Successful",
      description: `Exported ${filteredLogs.length} work log entries to CSV`,
    });
  };

  const getProductName = (orderId: string, itemId: string | null) => {
    // First try to find in work logs (if product_name is stored there)
    if (itemId) {
      const log = workLogs.find(l => l.order_id === orderId && l.order_item_id === itemId);
      if (log?.product_name) {
        return log.product_name;
      }
    }
    
    // Fallback to orders
    const order = orders.find(o => o.order_id === orderId || o.id === orderId);
    if (!order) return 'Unknown Product';
    
    if (itemId) {
      const item = order.items.find(i => i.item_id === itemId);
      return item?.product_name || 'Unknown Product';
    }
    
    return order.items[0]?.product_name || 'Unknown Product';
  };

  // Get unique stages and actions for filters
  const uniqueStages = useMemo(() => {
    const stages = new Set<string>();
    workLogs.forEach(log => stages.add(log.stage));
    return Array.from(stages).sort();
  }, [workLogs]);

  const uniqueActions = useMemo(() => {
    const actions = new Set<string>();
    workLogs.forEach(log => actions.add(log.action_type));
    return Array.from(actions).sort();
  }, [workLogs]);

  // Filter and sort work logs for admin view
  const filteredLogs = useMemo(() => {
    if (!isAdmin) return [];
    
    let filtered = workLogs;
    
    // Date filter
    if (selectedDate) {
      filtered = filtered.filter(log => log.work_date === selectedDate);
    }
    
    // User filter
    if (selectedUserId && selectedUserId !== 'all') {
      filtered = filtered.filter(log => log.user_id === selectedUserId);
    }
    
    // Department filter
    if (selectedDepartment && selectedDepartment !== 'all') {
      filtered = filtered.filter(log => log.department === selectedDepartment);
    }
    
    // Order filter
    if (selectedOrderId && selectedOrderId !== 'all') {
      filtered = filtered.filter(log => log.order_number === selectedOrderId);
    }
    
    // Stage filter
    if (filterStage && filterStage !== 'all') {
      filtered = filtered.filter(log => log.stage === filterStage);
    }
    
    // Action filter
    if (filterAction && filterAction !== 'all') {
      filtered = filtered.filter(log => log.action_type === filterAction);
    }
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(log => 
        log.user_name.toLowerCase().includes(query) ||
        log.order_number.toLowerCase().includes(query) ||
        log.work_summary.toLowerCase().includes(query) ||
        getProductName(log.order_id, log.order_item_id).toLowerCase().includes(query) ||
        log.department.toLowerCase().includes(query) ||
        log.stage.toLowerCase().includes(query) ||
        log.action_type.toLowerCase().includes(query)
      );
    }
    
    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'time':
          comparison = a.time_spent_minutes - b.time_spent_minutes;
          break;
        case 'user':
          comparison = a.user_name.localeCompare(b.user_name);
          break;
        case 'order':
          comparison = a.order_number.localeCompare(b.order_number);
          break;
        case 'stage':
          comparison = a.stage.localeCompare(b.stage);
          break;
        case 'action':
          comparison = a.action_type.localeCompare(b.action_type);
          break;
        case 'date':
        default:
          comparison = a.created_at.getTime() - b.created_at.getTime();
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }, [workLogs, selectedDate, selectedUserId, selectedDepartment, selectedOrderId, filterStage, filterAction, searchQuery, sortBy, sortOrder, isAdmin]);

  // Calculate stats for admin view
  const adminStats = useMemo(() => {
    if (!isAdmin) return null;
    
    const totalTime = filteredLogs.reduce((sum, log) => sum + log.time_spent_minutes, 0);
    const uniqueUsers = new Set(filteredLogs.map(log => log.user_id)).size;
    const uniqueOrders = new Set(filteredLogs.map(log => log.order_id)).size;
    const notesCount = filteredLogs.filter(log => log.action_type === 'note_added').length;
    
    return {
      totalTime,
      uniqueUsers,
      uniqueOrders,
      notesCount,
      totalActions: filteredLogs.length,
    };
  }, [filteredLogs, isAdmin]);

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">
            {isAdmin ? 'Daily Reports Dashboard' : 'My Daily Report'}
          </h1>
          <p className="text-muted-foreground">
            {isAdmin ? 'View and analyze team performance' : 'Track your daily work performance and productivity'}
          </p>
        </div>
        {isAdmin && filteredLogs.length > 0 && (
          <Button onClick={exportToCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export to CSV
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDate(format(subDays(new Date(), 1), 'yyyy-MM-dd'))}
                >
                  Yesterday
                </Button>
              </div>
            </div>

            {isAdmin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="user">User</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger id="user">
                      <SelectValue placeholder="All Users" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      {allUsers.map(u => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name} ({u.department})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                    <SelectTrigger id="department">
                      <SelectValue placeholder="All Departments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departments.map(dept => (
                        <SelectItem key={dept} value={dept}>
                          {dept.charAt(0).toUpperCase() + dept.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="order">Order</Label>
                  <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                    <SelectTrigger id="order">
                      <SelectValue placeholder="All Orders" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Orders</SelectItem>
                      {orderIds.map(orderId => (
                        <SelectItem key={orderId} value={orderId}>
                          {orderId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Admin View - Summary Stats */}
      {isAdmin && adminStats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Time</p>
                  <p className="text-2xl font-bold">{formatTime(adminStats.totalTime)}</p>
                </div>
                <Clock className="h-8 w-8 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Users</p>
                  <p className="text-2xl font-bold">{adminStats.uniqueUsers}</p>
                </div>
                <User className="h-8 w-8 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Orders</p>
                  <p className="text-2xl font-bold">{adminStats.uniqueOrders}</p>
                </div>
                <Package className="h-8 w-8 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="text-2xl font-bold">{adminStats.notesCount}</p>
                </div>
                <FileText className="h-8 w-8 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Actions</p>
                  <p className="text-2xl font-bold">{adminStats.totalActions}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* User Report View */}
      {!isAdmin && (
        <>
          {loading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Loading your performance report...</p>
              </CardContent>
            </Card>
          ) : report ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Total Working Time</p>
                        <p className="text-2xl font-bold">{formatTime(report.total_time_minutes)}</p>
                      </div>
                      <Clock className="h-8 w-8 text-primary opacity-50" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Orders Worked On</p>
                        <p className="text-2xl font-bold">{report.total_orders}</p>
                      </div>
                      <Package className="h-8 w-8 text-primary opacity-50" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Department</p>
                        <p className="text-2xl font-bold capitalize">{report.department}</p>
                      </div>
                      <User className="h-8 w-8 text-primary opacity-50" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Date</p>
                        <p className="text-lg font-bold">{format(parseISO(selectedDate), 'MMM d, yyyy')}</p>
                      </div>
                      <Calendar className="h-8 w-8 text-primary opacity-50" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Time Breakdown by Stage */}
              {(() => {
                const stageBreakdown = new Map<string, number>();
                report.order_breakdown.forEach((entry: any) => {
                  const current = stageBreakdown.get(entry.stage) || 0;
                  stageBreakdown.set(entry.stage, current + entry.time_spent_minutes);
                });
                
                return stageBreakdown.size > 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Time Breakdown by Stage
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Array.from(stageBreakdown.entries())
                          .sort((a, b) => b[1] - a[1])
                          .map(([stage, time]) => (
                            <div key={stage} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <Badge variant="outline" className="capitalize">
                                  {stage}
                                </Badge>
                                <div className="flex-1 bg-muted rounded-full h-2 max-w-xs">
                                  <div
                                    className="bg-primary h-2 rounded-full transition-all"
                                    style={{
                                      width: `${(time / report.total_time_minutes) * 100}%`
                                    }}
                                  />
                                </div>
                              </div>
                              <span className="font-semibold">{formatTime(time)}</span>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                ) : null;
              })()}

              {/* Order Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Order Breakdown - {format(parseISO(selectedDate), 'MMMM d, yyyy')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {report.order_breakdown.length === 0 ? (
                    <div className="text-center py-12">
                      <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">No work logged for this date</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Start working on orders to see your performance data here
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {report.order_breakdown
                        .sort((a: any, b: any) => b.time_spent_minutes - a.time_spent_minutes)
                        .map((entry: any, idx: number) => (
                          <div
                            key={idx}
                            className="border rounded-lg p-4 hover:bg-secondary/50 transition-colors"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold text-lg">{entry.order_number}</span>
                                  <Badge variant="outline" className="capitalize">
                                    {entry.stage}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {getProductName(entry.order_id, entry.order_item_id)}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-primary">
                                  {formatTime(entry.time_spent_minutes)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {entry.notes_count} {entry.notes_count === 1 ? 'note' : 'notes'}
                                </p>
                              </div>
                            </div>
                            {entry.actions.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {Array.from(new Set(entry.actions)).slice(0, 5).map((action: string) => (
                                  <Badge key={action} variant="secondary" className="text-xs capitalize">
                                    {action.replace('_', ' ')}
                                  </Badge>
                                ))}
                                {entry.actions.length > 5 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{entry.actions.length - 5} more
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Product Breakdown */}
              {(() => {
                const productBreakdown = new Map<string, { time: number; orders: Set<string> }>();
                report.order_breakdown.forEach((entry: any) => {
                  const productName = getProductName(entry.order_id, entry.order_item_id);
                  const current = productBreakdown.get(productName) || { time: 0, orders: new Set() };
                  current.time += entry.time_spent_minutes;
                  current.orders.add(entry.order_number);
                  productBreakdown.set(productName, current);
                });
                
                return productBreakdown.size > 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Time Breakdown by Product
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Array.from(productBreakdown.entries())
                          .sort((a, b) => b[1].time - a[1].time)
                          .map(([product, data]) => (
                            <div key={product} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                              <div className="flex-1">
                                <p className="font-medium">{product}</p>
                                <p className="text-xs text-muted-foreground">
                                  {data.orders.size} {data.orders.size === 1 ? 'order' : 'orders'}
                                </p>
                              </div>
                              <span className="font-semibold">{formatTime(data.time)}</span>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                ) : null;
              })()}
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No performance data available for this date</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Work on orders to see your performance data here
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Admin View - Detailed Logs with Categorization */}
      {isAdmin && (
        <>
          {/* Search and Advanced Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Search & Filter Work Logs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Search */}
                <div className="space-y-2">
                  <Label htmlFor="search">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Search logs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                    {searchQuery && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
                        onClick={() => setSearchQuery('')}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Sort By */}
                <div className="space-y-2">
                  <Label htmlFor="sortBy">Sort By</Label>
                  <div className="flex gap-2">
                    <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                      <SelectTrigger id="sortBy" className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date">Date</SelectItem>
                        <SelectItem value="time">Time Spent</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="order">Order</SelectItem>
                        <SelectItem value="stage">Stage</SelectItem>
                        <SelectItem value="action">Action</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                      title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                    >
                      {sortOrder === 'asc' ? (
                        <ArrowUp className="h-4 w-4" />
                      ) : (
                        <ArrowDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Filter by Stage */}
                <div className="space-y-2">
                  <Label htmlFor="filterStage">Filter by Stage</Label>
                  <Select value={filterStage} onValueChange={setFilterStage}>
                    <SelectTrigger id="filterStage">
                      <SelectValue placeholder="All Stages" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Stages</SelectItem>
                      {uniqueStages.map(stage => (
                        <SelectItem key={stage} value={stage}>
                          {stage.charAt(0).toUpperCase() + stage.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filter by Action */}
                <div className="space-y-2">
                  <Label htmlFor="filterAction">Filter by Action</Label>
                  <Select value={filterAction} onValueChange={setFilterAction}>
                    <SelectTrigger id="filterAction">
                      <SelectValue placeholder="All Actions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Actions</SelectItem>
                      {uniqueActions.map(action => (
                        <SelectItem key={action} value={action}>
                          {action.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Clear Filters Button */}
              {(searchQuery || filterStage !== 'all' || filterAction !== 'all') && (
                <div className="mt-4 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery('');
                      setFilterStage('all');
                      setFilterAction('all');
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear Filters
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Grouped by User */}
          {selectedUserId && selectedUserId !== 'all' ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  User Work Logs - {allUsers.find(u => u.id === selectedUserId)?.name || 'Unknown'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading || logsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : filteredLogs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No work logs found for selected filters</p>
                ) : (
                  <div className="space-y-3">
                    {/* Group by Order - Collapsible */}
                    {(() => {
                      const OrderCollapsibleItem = ({ orderNum, orderLogs }: { orderNum: string; orderLogs: typeof filteredLogs }) => {
                        const [isOpen, setIsOpen] = useState(false);
                        const orderTime = orderLogs.reduce((sum, log) => sum + log.time_spent_minutes, 0);
                        
                        return (
                          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                            <div className="border rounded-lg bg-secondary/20 overflow-hidden">
                              <CollapsibleTrigger asChild>
                                <Button
                                  variant="ghost"
                                  className="w-full justify-between p-4 h-auto hover:bg-secondary/50"
                                >
                                  <div className="flex items-center justify-between w-full">
                                    <div className="text-left">
                                      <h4 className="font-semibold text-lg">{orderNum}</h4>
                                      <p className="text-sm text-muted-foreground">
                                        {orderLogs.length} {orderLogs.length === 1 ? 'action' : 'actions'} • {formatTime(orderTime)}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <p className="text-lg font-bold text-primary">{formatTime(orderTime)}</p>
                                      {isOpen ? (
                                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                                      ) : (
                                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                      )}
                                    </div>
                                  </div>
                                </Button>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="px-4 pb-4 space-y-2">
                                  {orderLogs.map((log) => (
                                    <div key={log.log_id} className="flex items-center justify-between p-3 bg-background rounded border">
                                      <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                        <div>
                                          <p className="text-muted-foreground text-xs mb-1">Product</p>
                                          <p className="font-medium">{getProductName(log.order_id, log.order_item_id)}</p>
                                        </div>
                                        <div>
                                          <p className="text-muted-foreground text-xs mb-1">Stage</p>
                                          <Badge variant="secondary" className="capitalize text-xs">
                                            {log.stage}
                                          </Badge>
                                        </div>
                                        <div>
                                          <p className="text-muted-foreground text-xs mb-1">Action</p>
                                          <Badge variant="outline" className="capitalize text-xs">
                                            {log.action_type.replace('_', ' ')}
                                          </Badge>
                                        </div>
                                        <div>
                                          <p className="text-muted-foreground text-xs mb-1">Time</p>
                                          <p className="font-semibold">{formatTime(log.time_spent_minutes)}</p>
                                        </div>
                                      </div>
                                      {log.work_summary && (
                                        <div className="ml-4 max-w-xs">
                                          <p className="text-xs text-muted-foreground truncate" title={log.work_summary}>
                                            {log.work_summary}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        );
                      };

                      return Array.from(new Set(filteredLogs.map(log => log.order_number))).map(orderNum => {
                        const orderLogs = filteredLogs.filter(log => log.order_number === orderNum);
                        return <OrderCollapsibleItem key={orderNum} orderNum={orderNum} orderLogs={orderLogs} />;
                      });
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    All Work Logs - {format(parseISO(selectedDate), 'MMMM d, yyyy')}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {filteredLogs.length} {filteredLogs.length === 1 ? 'log' : 'logs'}
                    </Badge>
                    {searchQuery || filterStage !== 'all' || filterAction !== 'all' ? (
                      <Badge variant="outline" className="text-xs">
                        Filtered
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading || logsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : filteredLogs.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">No work logs found for selected filters</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      {searchQuery || filterStage !== 'all' || filterAction !== 'all' 
                        ? 'Try adjusting your search or filters'
                        : 'Try adjusting your filters or select a different date'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Group by Order - Collapsible */}
                    {(() => {
                      const OrderCollapsibleItem = ({ orderNum, orderLogs }: { orderNum: string; orderLogs: typeof filteredLogs }) => {
                        const [isOpen, setIsOpen] = useState(false);
                        const orderTime = orderLogs.reduce((sum, log) => sum + log.time_spent_minutes, 0);
                        const uniqueUsers = new Set(orderLogs.map(l => l.user_name)).size;
                        const uniqueStages = new Set(orderLogs.map(l => l.stage)).size;
                        
                        return (
                          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                            <div className="border rounded-lg bg-secondary/20 overflow-hidden">
                              <CollapsibleTrigger asChild>
                                <Button
                                  variant="ghost"
                                  className="w-full justify-between p-4 h-auto hover:bg-secondary/50"
                                >
                                  <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-4 text-left">
                                      <div>
                                        <h4 className="font-semibold text-lg">{orderNum}</h4>
                                        <div className="flex items-center gap-3 mt-1">
                                          <p className="text-sm text-muted-foreground">
                                            {orderLogs.length} {orderLogs.length === 1 ? 'action' : 'actions'}
                                          </p>
                                          <span className="text-muted-foreground">•</span>
                                          <p className="text-sm font-medium text-primary">{formatTime(orderTime)}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs">
                                          {uniqueUsers} {uniqueUsers === 1 ? 'user' : 'users'}
                                        </Badge>
                                        <Badge variant="secondary" className="text-xs">
                                          {uniqueStages} {uniqueStages === 1 ? 'stage' : 'stages'}
                                        </Badge>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <p className="text-lg font-bold text-primary">{formatTime(orderTime)}</p>
                                      {isOpen ? (
                                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                                      ) : (
                                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                      )}
                                    </div>
                                  </div>
                                </Button>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="px-4 pb-4">
                                  <div className="overflow-x-auto">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>User</TableHead>
                                          <TableHead>Department</TableHead>
                                          <TableHead>Product</TableHead>
                                          <TableHead>Stage</TableHead>
                                          <TableHead>Action</TableHead>
                                          <TableHead>Summary</TableHead>
                                          <TableHead>Time</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {orderLogs.map((log) => (
                                          <TableRow key={log.log_id}>
                                            <TableCell className="font-medium">{log.user_name}</TableCell>
                                            <TableCell>
                                              <Badge variant="outline" className="capitalize text-xs">
                                                {log.department}
                                              </Badge>
                                            </TableCell>
                                            <TableCell>{getProductName(log.order_id, log.order_item_id)}</TableCell>
                                            <TableCell>
                                              <Badge variant="secondary" className="capitalize text-xs">
                                                {log.stage}
                                              </Badge>
                                            </TableCell>
                                            <TableCell>
                                              <Badge variant="outline" className="capitalize text-xs">
                                                {log.action_type.replace('_', ' ')}
                                              </Badge>
                                            </TableCell>
                                            <TableCell className="max-w-xs truncate" title={log.work_summary}>
                                              {log.work_summary}
                                            </TableCell>
                                            <TableCell className="font-semibold">{formatTime(log.time_spent_minutes)}</TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        );
                      };

                      const orderGroups = new Map<string, typeof filteredLogs>();
                      filteredLogs.forEach(log => {
                        const orderNum = log.order_number;
                        if (!orderGroups.has(orderNum)) {
                          orderGroups.set(orderNum, []);
                        }
                        orderGroups.get(orderNum)!.push(log);
                      });

                      return Array.from(orderGroups.entries())
                        .sort((a, b) => {
                          const aTime = a[1].reduce((sum, log) => sum + log.time_spent_minutes, 0);
                          const bTime = b[1].reduce((sum, log) => sum + log.time_spent_minutes, 0);
                          return sortBy === 'time' && sortOrder === 'desc' ? bTime - aTime : aTime - bTime;
                        })
                        .map(([orderNum, orderLogs]) => (
                          <OrderCollapsibleItem key={orderNum} orderNum={orderNum} orderLogs={orderLogs} />
                        ));
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

    </div>
  );
}


