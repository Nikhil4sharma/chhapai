import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  ArrowLeft, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  Package,
  Upload,
  Edit,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { PriorityBadge } from '@/components/orders/PriorityBadge';
import { StageBadge } from '@/components/orders/StageBadge';
import { OrderTimeline } from '@/components/orders/OrderTimeline';
import { mockOrders, getTimeline } from '@/data/mockData';

export default function OrderDetail() {
  const { orderId } = useParams();
  const order = mockOrders.find(o => o.order_id === orderId);
  const timeline = orderId ? getTimeline(orderId) : [];

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-xl font-semibold mb-2">Order not found</h2>
        <p className="text-muted-foreground mb-4">The order you're looking for doesn't exist.</p>
        <Button asChild>
          <Link to="/dashboard">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" asChild>
        <Link to="/dashboard">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Link>
      </Button>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-display font-bold">{order.order_id}</h1>
            <PriorityBadge priority={order.priority_computed} showLabel />
            {order.source === 'wordpress' && (
              <Badge variant="outline">WooCommerce</Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            Created {format(order.created_at, 'MMMM d, yyyy')} • 
            Last updated {format(order.updated_at, 'MMM d, h:mm a')}
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="outline" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order Items ({order.items.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.items.map((item, index) => (
                <div key={item.item_id}>
                  {index > 0 && <Separator className="my-4" />}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">{item.product_name}</h4>
                        <PriorityBadge priority={item.priority_computed} />
                        <StageBadge stage={item.current_stage} />
                      </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">Quantity</span>
                          <p className="font-medium">{item.quantity}</p>
                        </div>
                        {item.specifications.paper && (
                          <div>
                            <span className="text-muted-foreground">Paper</span>
                            <p className="font-medium">{item.specifications.paper}</p>
                          </div>
                        )}
                        {item.specifications.size && (
                          <div>
                            <span className="text-muted-foreground">Size</span>
                            <p className="font-medium">{item.specifications.size}</p>
                          </div>
                        )}
                        {item.specifications.finishing && (
                          <div>
                            <span className="text-muted-foreground">Finishing</span>
                            <p className="font-medium">{item.specifications.finishing}</p>
                          </div>
                        )}
                      </div>
                      
                      {item.specifications.notes && (
                        <p className="mt-3 text-sm text-muted-foreground bg-secondary/50 p-2 rounded">
                          {item.specifications.notes}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{format(item.delivery_date, 'MMM d, yyyy')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderTimeline entries={timeline} />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display">Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium text-lg">{order.customer.name}</h4>
              </div>
              
              <div className="space-y-2 text-sm">
                <a 
                  href={`tel:${order.customer.phone}`}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Phone className="h-4 w-4" />
                  {order.customer.phone}
                </a>
                <a 
                  href={`mailto:${order.customer.email}`}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Mail className="h-4 w-4" />
                  {order.customer.email}
                </a>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 mt-0.5" />
                  <span>{order.customer.address}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Delivery */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display">Delivery</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">
                    {order.order_level_delivery_date 
                      ? format(order.order_level_delivery_date, 'EEEE, MMMM d, yyyy')
                      : 'No date set'
                    }
                  </p>
                  <p className="text-sm text-muted-foreground">Expected delivery</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {order.global_notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-display">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{order.global_notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Upload File
              </Button>
              <Button variant="outline" className="w-full" size="sm">
                Assign to Department
              </Button>
              <Button variant="outline" className="w-full" size="sm">
                Add Note
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
