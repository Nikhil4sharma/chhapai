import { useState, useMemo, useCallback } from 'react';
import { Building2, Search, Filter, Calendar, Package, AlertCircle, CheckCircle, Clock, Truck, FileText, Plus, Edit, Settings } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { PriorityBadge } from '@/features/orders/components/PriorityBadge';
import { StageBadge } from '@/features/orders/components/StageBadge';
import { FilePreview } from '@/features/orders/components/FilePreview';
import { useOrders } from '@/features/orders/context/OrderContext';
import { useAuth } from '@/features/auth/context/AuthContext';
import { format, isAfter, isBefore, differenceInDays } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { OUTSOURCE_STAGE_LABELS, OutsourceStage } from '@/types/order';

export default function Outsource() {
  const { orders, isLoading } = useOrders();
  const { isAdmin, role } = useAuth();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [vendorFilter, setVendorFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('vendor_in_progress'); // Default to vendor_in_progress tab
  const [stageFilter, setStageFilter] = useState<string>('vendor_in_progress'); // Default filter to vendor_in_progress
  const [workTypeFilter, setWorkTypeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');

  // Get all outsource items
  const outsourceItems = useMemo(() => {
    return orders
      .filter(order => !order.is_completed)
      .flatMap(order =>
        order.items
          .filter(item => item.current_stage === 'outsource' && item.outsource_info)
          .map(item => ({
            order,
            item,
            outsourceInfo: item.outsource_info!,
          }))
      );
  }, [orders]);

  // Get unique vendors for filter - optimized
  const vendors = useMemo(() => {
    const vendorSet = new Set<string>();
    const length = outsourceItems.length;
    for (let i = 0; i < length; i++) {
      const name = outsourceItems[i].outsourceInfo.vendor.vendor_name;
      if (name) vendorSet.add(name);
    }
    return Array.from(vendorSet).sort();
  }, [outsourceItems]);

  // Get unique work types for filter - optimized
  const workTypes = useMemo(() => {
    const typeSet = new Set<string>();
    const length = outsourceItems.length;
    for (let i = 0; i < length; i++) {
      const workType = outsourceItems[i].outsourceInfo.job_details.work_type;
      if (workType) typeSet.add(workType);
    }
    return Array.from(typeSet).sort();
  }, [outsourceItems]);

  // Filter items
  const filteredItems = useMemo(() => {
    return outsourceItems.filter(({ order, item, outsourceInfo }) => {
      // Search filter
      const matchesSearch = searchTerm === '' ||
        order.order_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        outsourceInfo.vendor.vendor_name.toLowerCase().includes(searchTerm.toLowerCase());

      // Vendor filter
      const matchesVendor = vendorFilter === 'all' ||
        outsourceInfo.vendor.vendor_name === vendorFilter;

      // Stage filter
      const matchesStage = stageFilter === 'all' ||
        outsourceInfo.current_outsource_stage === stageFilter;

      // Work type filter
      const matchesWorkType = workTypeFilter === 'all' ||
        outsourceInfo.job_details.work_type === workTypeFilter;

      // Date filter
      let matchesDate = true;
      if (dateFilter === 'overdue') {
        const expectedDate = outsourceInfo.job_details.expected_ready_date;
        matchesDate = isBefore(expectedDate, new Date()) &&
          outsourceInfo.current_outsource_stage !== 'received_from_vendor' &&
          outsourceInfo.current_outsource_stage !== 'quality_check' &&
          outsourceInfo.current_outsource_stage !== 'decision_pending';
      } else if (dateFilter === 'today') {
        const expectedDate = outsourceInfo.job_details.expected_ready_date;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const expected = new Date(expectedDate);
        expected.setHours(0, 0, 0, 0);
        matchesDate = expected.getTime() === today.getTime();
      } else if (dateFilter === 'this-week') {
        const expectedDate = outsourceInfo.job_details.expected_ready_date;
        const today = new Date();
        const weekFromNow = new Date(today);
        weekFromNow.setDate(today.getDate() + 7);
        matchesDate = isAfter(expectedDate, today) && isBefore(expectedDate, weekFromNow);
      }

      return matchesSearch && matchesVendor && matchesStage && matchesWorkType && matchesDate;
    });
  }, [outsourceItems, searchTerm, vendorFilter, stageFilter, workTypeFilter, dateFilter]);

  // Group items by stage
  const itemsByStage = useMemo(() => {
    const grouped: Record<OutsourceStage, typeof filteredItems> = {
      outsourced: [],
      vendor_in_progress: [],
      vendor_dispatched: [],
      received_from_vendor: [],
      quality_check: [],
      decision_pending: [],
    };

    filteredItems.forEach(item => {
      const stage = item.outsourceInfo.current_outsource_stage;
      if (grouped[stage]) {
        grouped[stage].push(item);
      }
    });

    return grouped;
  }, [filteredItems]);

  // Calculate stats with realtime updates
  const stats = useMemo(() => {
    const total = outsourceItems.length;
    const withVendor = outsourceItems.filter(({ outsourceInfo }) =>
      outsourceInfo.current_outsource_stage === 'vendor_in_progress' ||
      outsourceInfo.current_outsource_stage === 'vendor_dispatched'
    ).length;
    const dispatched = outsourceItems.filter(({ outsourceInfo }) =>
      outsourceInfo.current_outsource_stage === 'vendor_dispatched'
    ).length;
    const pendingQC = outsourceItems.filter(({ outsourceInfo }) =>
      outsourceInfo.current_outsource_stage === 'quality_check'
    ).length;
    const delayed = outsourceItems.filter(({ outsourceInfo }) => {
      const expectedDate = outsourceInfo.job_details.expected_ready_date;
      return isBefore(expectedDate, new Date()) &&
        outsourceInfo.current_outsource_stage !== 'received_from_vendor' &&
        outsourceInfo.current_outsource_stage !== 'quality_check' &&
        outsourceInfo.current_outsource_stage !== 'decision_pending';
    }).length;

    return { total, withVendor, dispatched, pendingQC, delayed };
  }, [outsourceItems]);

  // Handle card click - navigate to filtered view
  const handleCardClick = useCallback((filterType: 'total' | 'withVendor' | 'dispatched' | 'pendingQC' | 'delayed') => {
    // Reset filters
    setVendorFilter('all');
    setWorkTypeFilter('all');
    setDateFilter('all');
    setSearchTerm('');

    // Apply specific filter and switch tab based on card clicked
    switch (filterType) {
      case 'withVendor':
        setStageFilter('vendor_in_progress');
        setActiveTab('vendor_in_progress');
        break;
      case 'dispatched':
        setStageFilter('vendor_dispatched');
        setActiveTab('vendor_dispatched');
        break;
      case 'pendingQC':
        setStageFilter('quality_check');
        setActiveTab('quality_check');
        break;
      case 'delayed':
        setDateFilter('overdue');
        setStageFilter('all');
        setActiveTab('all');
        break;
      default:
        // total - show all, reset filters
        setStageFilter('all');
        setActiveTab('all');
        break;
    }

    // Scroll to tabs section
    setTimeout(() => {
      const tabsSection = document.querySelector('[role="tablist"]');
      tabsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading outsource orders...</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col gap-4">
        {/* Header */}
        <div className="flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-display font-bold flex items-center gap-2">
                <Building2 className="h-6 w-6" />
                Outsource Management
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Track and manage external vendor work
              </p>
            </div>
            {isAdmin && (
              <Button onClick={() => navigate('/admin/settings?tab=vendors')} variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Manage Vendors
              </Button>
            )}
          </div>

          {/* Stats Cards - Clickable with navigation */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
            <Card
              className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              onClick={() => handleCardClick('total')}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-stage-outsource/10 flex items-center justify-center">
                    <Package className="h-5 w-5 text-stage-outsource" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.total}</p>
                    <p className="text-xs text-muted-foreground">Total Outsourced</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              onClick={() => handleCardClick('withVendor')}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.withVendor}</p>
                    <p className="text-xs text-muted-foreground">With Vendor</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              onClick={() => handleCardClick('dispatched')}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <Truck className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.dispatched}</p>
                    <p className="text-xs text-muted-foreground">Dispatched</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              onClick={() => handleCardClick('pendingQC')}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.pendingQC}</p>
                    <p className="text-xs text-muted-foreground">Pending QC</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              onClick={() => handleCardClick('delayed')}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.delayed}</p>
                    <p className="text-xs text-muted-foreground">Delayed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search orders, products, vendors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={vendorFilter} onValueChange={setVendorFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Vendor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vendors</SelectItem>
                {vendors.map(vendor => (
                  <SelectItem key={vendor} value={vendor}>{vendor}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {Object.entries(OUTSOURCE_STAGE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={workTypeFilter} onValueChange={setWorkTypeFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Work Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Work Types</SelectItem>
                {workTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dates</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="this-week">This Week</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabs for different stages */}
        <div className="flex-1 min-h-0 flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="flex-shrink-0 flex-wrap">
              <TabsTrigger value="all">All ({filteredItems.length})</TabsTrigger>
              <TabsTrigger value="outsourced">Outsourced ({itemsByStage.outsourced.length})</TabsTrigger>
              <TabsTrigger value="vendor_in_progress">In Progress ({itemsByStage.vendor_in_progress.length})</TabsTrigger>
              <TabsTrigger value="vendor_dispatched">Dispatched ({itemsByStage.vendor_dispatched.length})</TabsTrigger>
              <TabsTrigger value="received_from_vendor">Received ({itemsByStage.received_from_vendor.length})</TabsTrigger>
              <TabsTrigger value="quality_check">QC ({itemsByStage.quality_check.length})</TabsTrigger>
              <TabsTrigger value="decision_pending">Decision ({itemsByStage.decision_pending.length})</TabsTrigger>
            </TabsList>

            {['all', ...Object.keys(OUTSOURCE_STAGE_LABELS)].map((tabValue) => {
              const itemsToShow = tabValue === 'all'
                ? filteredItems
                : itemsByStage[tabValue as OutsourceStage] || [];

              return (
                <TabsContent key={tabValue} value={tabValue} className="flex-1 mt-4 overflow-hidden">
                  <div className="h-full overflow-y-auto custom-scrollbar pr-2">
                    {itemsToShow.length === 0 ? (
                      <Card>
                        <CardContent className="flex flex-col items-center justify-center py-12">
                          <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                          <p className="text-muted-foreground">No items found</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-3">
                        {itemsToShow.map(({ order, item, outsourceInfo }) => {
                          const isDelayed = isBefore(outsourceInfo.job_details.expected_ready_date, new Date()) &&
                            outsourceInfo.current_outsource_stage !== 'received_from_vendor' &&
                            outsourceInfo.current_outsource_stage !== 'quality_check' &&
                            outsourceInfo.current_outsource_stage !== 'decision_pending';
                          const daysOverdue = isDelayed
                            ? differenceInDays(new Date(), outsourceInfo.job_details.expected_ready_date)
                            : 0;

                          return (
                            <Card key={`${order.order_id}-${item.item_id}`} className="hover:shadow-md transition-shadow">
                              <CardContent className="p-4">
                                <div className="flex flex-col sm:flex-row gap-4">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                      <div className="flex-1 min-w-0">
                                        <Link
                                          to={`/orders/${order.order_id}`}
                                          className="font-semibold text-foreground hover:underline block truncate"
                                        >
                                          {order.order_id}
                                        </Link>
                                        <p className="text-sm text-muted-foreground truncate">{item.product_name}</p>
                                      </div>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        <PriorityBadge priority={item.priority_computed} />
                                        <Badge variant={`stage-${item.current_stage}` as any}>
                                          {OUTSOURCE_STAGE_LABELS[outsourceInfo.current_outsource_stage]}
                                        </Badge>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-1">Vendor</p>
                                        <p className="text-sm font-medium">{outsourceInfo.vendor.vendor_name}</p>
                                        {outsourceInfo.vendor.contact_person && (
                                          <p className="text-xs text-muted-foreground">{outsourceInfo.vendor.contact_person}</p>
                                        )}
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-1">Work Type</p>
                                        <p className="text-sm font-medium">{outsourceInfo.job_details.work_type}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-1">Expected Ready</p>
                                        <div className="flex items-center gap-2">
                                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                          <p className={`text-sm font-medium ${isDelayed ? 'text-destructive' : ''}`}>
                                            {format(outsourceInfo.job_details.expected_ready_date, 'MMM d, yyyy')}
                                          </p>
                                          {isDelayed && (
                                            <Badge variant="destructive" className="text-xs">
                                              {daysOverdue}d overdue
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-1">Quantity</p>
                                        <p className="text-sm font-medium">{outsourceInfo.job_details.quantity_sent}</p>
                                      </div>
                                    </div>

                                    {outsourceInfo.job_details.special_instructions && (
                                      <div className="mt-3 p-2 bg-secondary/50 rounded text-xs">
                                        <p className="text-muted-foreground mb-1">Special Instructions:</p>
                                        <p className="text-foreground">{outsourceInfo.job_details.special_instructions}</p>
                                      </div>
                                    )}

                                    {item.files && item.files.length > 0 && (
                                      <div className="mt-3">
                                        <FilePreview files={item.files} compact />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </div>
      </div>
    </TooltipProvider>
  );
}

