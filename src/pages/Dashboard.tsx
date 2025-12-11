import { ShoppingCart, AlertTriangle, Package, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { StageProgress } from '@/components/dashboard/StageProgress';
import { OrderCard } from '@/components/orders/OrderCard';
import { useOrders } from '@/contexts/OrderContext';
import { useNavigate } from 'react-router-dom';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export default function Dashboard() {
  const { getOrdersByDepartment } = useOrders();
  const navigate = useNavigate();
  
  const orders = getOrdersByDepartment();
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

  const handleCardClick = (path: string) => {
    navigate(path);
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
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
                  trend={{ value: 12, isPositive: true }}
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
                  title="Completed Today"
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

        {/* Urgent Orders */}
        {urgentOrders.length > 0 && (
          <div>
            <h2 className="text-lg font-display font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-priority-red" />
              Urgent Orders
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {urgentOrders.map((order) => (
                <OrderCard key={order.order_id} order={order} />
              ))}
            </div>
          </div>
        )}

        {/* Recent Orders */}
        <div>
          <h2 className="text-lg font-display font-semibold mb-4">Recent Orders</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders.slice(0, 6).map((order) => (
              <OrderCard key={order.order_id} order={order} />
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
