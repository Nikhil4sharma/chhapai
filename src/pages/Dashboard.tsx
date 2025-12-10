import { ShoppingCart, AlertTriangle, Package, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { StageProgress } from '@/components/dashboard/StageProgress';
import { OrderCard } from '@/components/orders/OrderCard';
import { mockOrders, getDashboardStats } from '@/data/mockData';

export default function Dashboard() {
  const stats = getDashboardStats();
  const urgentOrders = mockOrders.filter(o => o.priority_computed === 'red');

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Orders"
          value={stats.totalOrders}
          icon={ShoppingCart}
          variant="primary"
          trend={{ value: 12, isPositive: true }}
        />
        <StatsCard
          title="Urgent Items"
          value={stats.urgentItems}
          icon={AlertTriangle}
          variant="danger"
        />
        <StatsCard
          title="In Production"
          value={stats.byStage.production}
          icon={Package}
          variant="warning"
        />
        <StatsCard
          title="Completed Today"
          value={stats.byStage.completed}
          icon={TrendingUp}
        />
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
          {mockOrders.slice(0, 6).map((order) => (
            <OrderCard key={order.order_id} order={order} />
          ))}
        </div>
      </div>
    </div>
  );
}
