import { ShoppingCart, AlertTriangle, Package, TrendingUp, CheckCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { StageProgress } from '@/components/dashboard/StageProgress';
import { OrderCard } from '@/components/orders/OrderCard';
import { useOrders } from '@/contexts/OrderContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export default function Dashboard() {
  const { getOrdersByDepartment, getCompletedOrders, isLoading } = useOrders();
  const { isAdmin, role, profile } = useAuth();
  const navigate = useNavigate();
  
  const orders = getOrdersByDepartment();
  const completedOrders = getCompletedOrders();
  const urgentOrders = orders.filter(o => o.priority_computed === 'red');
  
  // Calculate stats
  const stats = {
    totalOrders: orders.length,
    urgentItems: 0,
    byStage: {
      sales: 0,
      design: 0,
      prepress: 0,
      production: 0,
      dispatch: 0,
      completed: 0,
    },
  };

  orders.forEach(order => {
    order.items.forEach(item => {
      stats.byStage[item.current_stage]++;
      if (item.priority_computed === 'red') {
        stats.urgentItems++;
      }
    });
  });

  completedOrders.forEach(order => {
    order.items.forEach(item => {
      if (item.current_stage === 'completed') {
        stats.byStage.completed++;
      }
    });
  });

  const handleCardClick = (path: string) => {
    navigate(path);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading orders...</span>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Welcome message */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">
              Welcome, {profile?.full_name || 'User'}
            </h1>
            <p className="text-muted-foreground">
              {isAdmin ? 'Admin Dashboard - All departments' : `${role?.charAt(0).toUpperCase()}${role?.slice(1)} Department`}
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <div 
                className="cursor-pointer transition-transform hover:scale-[1.02]"
                onClick={() => handleCardClick('/sales')}
              >
                <StatsCard
                  title="Total Orders"
                  value={stats.totalOrders}
                  icon={ShoppingCart}
                  variant="primary"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>View all orders in Sales</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <div 
                className="cursor-pointer transition-transform hover:scale-[1.02]"
                onClick={() => handleCardClick('/production')}
              >
                <StatsCard
                  title="Urgent Items"
                  value={stats.urgentItems}
                  icon={AlertTriangle}
                  variant="danger"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>View urgent items</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <div 
                className="cursor-pointer transition-transform hover:scale-[1.02]"
                onClick={() => handleCardClick('/production')}
              >
                <StatsCard
                  title="In Production"
                  value={stats.byStage.production}
                  icon={Package}
                  variant="warning"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>View production queue</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <div 
                className="cursor-pointer transition-transform hover:scale-[1.02]"
                onClick={() => handleCardClick('/dispatch')}
              >
                <StatsCard
                  title="Completed"
                  value={stats.byStage.completed}
                  icon={TrendingUp}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>View completed orders</TooltipContent>
          </Tooltip>
        </div>

        {/* Stage Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display">Items by Stage</CardTitle>
          </CardHeader>
          <CardContent>
            <StageProgress data={stats.byStage} />
          </CardContent>
        </Card>

        {/* Orders Tabs */}
        <Tabs defaultValue="active" className="space-y-4">
          <TabsList>
            <TabsTrigger value="active">Active Orders ({orders.length})</TabsTrigger>
            <TabsTrigger value="urgent">Urgent ({urgentOrders.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completedOrders.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            {orders.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {orders.slice(0, 9).map((order) => (
                  <OrderCard key={order.order_id} order={order} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No active orders found</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="urgent">
            {urgentOrders.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {urgentOrders.map((order) => (
                  <OrderCard key={order.order_id} order={order} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                  <p className="text-muted-foreground">No urgent orders!</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="completed">
            {completedOrders.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {completedOrders.map((order) => (
                  <OrderCard key={order.order_id} order={order} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No completed orders yet</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
