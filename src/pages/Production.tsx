import { useState } from 'react';
import { Play, CheckSquare, Camera, Clock, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getItemsByStage } from '@/data/mockData';
import { PriorityBadge } from '@/components/orders/PriorityBadge';
import { PRODUCTION_STEPS } from '@/types/order';
import { format } from 'date-fns';

export default function Production() {
  const productionItems = getItemsByStage('production');
  const [activeTab, setActiveTab] = useState('all');

  const getItemsBySubstage = (substage: string | null) => {
    if (substage === 'all') return productionItems;
    return productionItems.filter(item => item.item.current_substage === substage);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground">
            {productionItems.length} item{productionItems.length !== 1 ? 's' : ''} in production
          </p>
        </div>
      </div>

      {/* Production Stages Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="overflow-x-auto pb-2">
          <TabsList className="inline-flex h-auto p-1 bg-secondary/50">
            <TabsTrigger value="all" className="px-4">
              All
              <Badge variant="secondary" className="ml-2">{productionItems.length}</Badge>
            </TabsTrigger>
            {PRODUCTION_STEPS.map((step) => {
              const count = getItemsBySubstage(step.key).length;
              return (
                <TabsTrigger key={step.key} value={step.key} className="px-4">
                  {step.label}
                  {count > 0 && (
                    <Badge variant="secondary" className="ml-2">{count}</Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {['all', ...PRODUCTION_STEPS.map(s => s.key)].map((tabValue) => (
          <TabsContent key={tabValue} value={tabValue}>
            <div className="space-y-4">
              {getItemsBySubstage(tabValue === 'all' ? 'all' : tabValue).length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <CheckCircle className="h-12 w-12 mx-auto text-success mb-4" />
                    <h3 className="font-semibold text-lg mb-2">No items here</h3>
                    <p className="text-muted-foreground">
                      {tabValue === 'all' 
                        ? 'No items currently in production.'
                        : `No items in ${tabValue} stage.`
                      }
                    </p>
                  </CardContent>
                </Card>
              ) : (
                getItemsBySubstage(tabValue === 'all' ? 'all' : tabValue).map(({ customer, order_id, item }) => (
                  <Card key={`${order_id}-${item.item_id}`} className="card-hover">
                    <CardContent className="p-0">
                      {/* Priority bar */}
                      <div 
                        className={`h-1 ${
                          item.priority_computed === 'blue' ? 'bg-priority-blue' :
                          item.priority_computed === 'yellow' ? 'bg-priority-yellow' :
                          'bg-priority-red'
                        }`}
                      />
                      
                      <div className="p-4">
                        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                          {/* Item info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3 className="font-semibold truncate">{item.product_name}</h3>
                              <PriorityBadge priority={item.priority_computed} showLabel />
                              {item.current_substage && (
                                <Badge variant="stage-production">
                                  {item.current_substage}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {order_id} • {customer.name} • Qty: {item.quantity}
                            </p>
                            
                            {/* Specs */}
                            <div className="flex flex-wrap gap-2">
                              {item.specifications.paper && (
                                <Badge variant="outline" className="text-xs">
                                  {item.specifications.paper}
                                </Badge>
                              )}
                              {item.specifications.finishing && (
                                <Badge variant="outline" className="text-xs">
                                  {item.specifications.finishing}
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Delivery info */}
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>Due: {format(item.delivery_date, 'MMM d, yyyy')}</span>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm">
                              <Camera className="h-4 w-4 mr-2" />
                              Photo
                            </Button>
                            {item.current_substage ? (
                              <Button size="sm" variant="success">
                                <CheckSquare className="h-4 w-4 mr-2" />
                                Complete Stage
                              </Button>
                            ) : (
                              <Button size="sm">
                                <Play className="h-4 w-4 mr-2" />
                                Start Stage
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
