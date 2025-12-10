import { FileCheck, Upload, Send, Clock, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getItemsByStage } from '@/data/mockData';
import { PriorityBadge } from '@/components/orders/PriorityBadge';
import { format } from 'date-fns';

export default function Prepress() {
  const prepressItems = getItemsByStage('prepress');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground">
            {prepressItems.length} item{prepressItems.length !== 1 ? 's' : ''} ready for prepress
          </p>
        </div>
      </div>

      {/* Prepress Queue */}
      <div className="space-y-4">
        {prepressItems.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="h-12 w-12 mx-auto text-success mb-4" />
              <h3 className="font-semibold text-lg mb-2">Queue is empty</h3>
              <p className="text-muted-foreground">No items currently need prepress work.</p>
            </CardContent>
          </Card>
        ) : (
          prepressItems.map(({ customer, order_id, item }) => (
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
                  <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    {/* Item info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">{item.product_name}</h3>
                        <PriorityBadge priority={item.priority_computed} showLabel />
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {order_id} • {customer.name}
                      </p>
                      
                      {/* Specs grid */}
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
                    </div>

                    {/* Delivery & Actions */}
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>Due: {format(item.delivery_date, 'MMM d, yyyy')}</span>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Final
                        </Button>
                        <Button size="sm" variant="success">
                          <Send className="h-4 w-4 mr-2" />
                          Send to Production
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Attached proofs */}
                  {item.files.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-sm font-medium mb-2">Attached Files</p>
                      <div className="flex flex-wrap gap-2">
                        {item.files.map((file) => (
                          <a
                            key={file.file_id}
                            href={file.url}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-lg text-sm hover:bg-secondary/80 transition-colors"
                          >
                            <FileCheck className="h-4 w-4 text-primary" />
                            <span>{file.type} proof</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
