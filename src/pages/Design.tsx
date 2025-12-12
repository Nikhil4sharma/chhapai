import { useState } from 'react';
import { Upload, CheckCircle, Clock, ArrowRight, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PriorityBadge } from '@/components/orders/PriorityBadge';
import { FilePreview } from '@/components/orders/FilePreview';
import { useOrders } from '@/contexts/OrderContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UploadFileDialog } from '@/components/dialogs/UploadFileDialog';

export default function Design() {
  const { orders, updateItemStage, uploadFile, sendToProduction } = useOrders();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{ orderId: string; itemId: string } | null>(null);

  // Get items in design stage
  const designItems = orders.flatMap(order => 
    order.items
      .filter(item => item.current_stage === 'design')
      .map(item => ({
        order,
        item,
      }))
  );

  const handleMarkComplete = (orderId: string, itemId: string) => {
    updateItemStage(orderId, itemId, 'prepress');
    toast({
      title: "Design Complete",
      description: "Item has been sent to Prepress",
    });
  };

  const handleSendToPrepress = (orderId: string, itemId: string) => {
    updateItemStage(orderId, itemId, 'prepress');
    toast({
      title: "Sent to Prepress",
      description: "Item has been sent to Prepress department",
    });
  };

  const handleSendToProduction = (orderId: string, itemId: string) => {
    sendToProduction(orderId, itemId);
  };

  const handleUploadClick = (orderId: string, itemId: string) => {
    setSelectedItem({ orderId, itemId });
    setUploadDialogOpen(true);
  };

  const handleUpload = async (file: File) => {
    if (selectedItem) {
      await uploadFile(selectedItem.orderId, selectedItem.itemId, file);
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Design Dashboard</h1>
            <p className="text-muted-foreground">
              {designItems.length} item{designItems.length !== 1 ? 's' : ''} assigned to design
            </p>
          </div>
        </div>

        {/* Design Queue */}
        <div className="space-y-4">
          {designItems.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <h3 className="font-semibold text-lg mb-2">All caught up!</h3>
                <p className="text-muted-foreground">No items currently need design work.</p>
              </CardContent>
            </Card>
          ) : (
            designItems.map(({ order, item }) => (
              <Card key={`${order.order_id}-${item.item_id}`} className="card-hover overflow-hidden">
                <CardContent className="p-0">
                  <div 
                    className={`h-1 ${
                      item.priority_computed === 'blue' ? 'bg-priority-blue' :
                      item.priority_computed === 'yellow' ? 'bg-priority-yellow' :
                      'bg-priority-red'
                    }`}
                  />
                  
                  <div className="p-4">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <Link 
                          to={`/orders/${order.order_id}`}
                          className="flex items-center gap-2 mb-1 hover:underline"
                        >
                          <h3 className="font-semibold truncate text-foreground">{item.product_name}</h3>
                          <PriorityBadge priority={item.priority_computed} showLabel />
                        </Link>
                        <p className="text-sm text-muted-foreground mb-2">
                          {order.order_id} • {order.customer.name} • Qty: {item.quantity}
                        </p>
                        
                        <div className="flex flex-wrap gap-2">
                          {item.specifications.paper && (
                            <Badge variant="outline" className="text-xs">{item.specifications.paper}</Badge>
                          )}
                          {item.specifications.size && (
                            <Badge variant="outline" className="text-xs">{item.specifications.size}</Badge>
                          )}
                          {item.specifications.finishing && (
                            <Badge variant="outline" className="text-xs">{item.specifications.finishing}</Badge>
                          )}
                        </div>
                        {item.files && item.files.length > 0 && (
                          <FilePreview files={item.files} compact />
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>Due: {format(item.delivery_date, 'MMM d, yyyy')}</span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleUploadClick(order.order_id, item.item_id)}
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              Upload Proof
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Upload design proof</TooltipContent>
                        </Tooltip>

                        <DropdownMenu>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm">
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Complete
                                </Button>
                              </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent>Mark design complete</TooltipContent>
                          </Tooltip>
                          <DropdownMenuContent align="end" className="bg-popover">
                            <DropdownMenuItem onClick={() => handleSendToPrepress(order.order_id, item.item_id)}>
                              <ArrowRight className="h-4 w-4 mr-2" />
                              Send to Prepress
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSendToProduction(order.order_id, item.item_id)}>
                              <ArrowRight className="h-4 w-4 mr-2" />
                              Send to Production
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {item.specifications.notes && (
                      <div className="mt-3 p-3 bg-secondary/50 rounded-lg">
                        <p className="text-sm text-foreground">
                          <span className="font-medium">Notes:</span> {item.specifications.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Upload Dialog */}
        {selectedItem && (
          <UploadFileDialog
            open={uploadDialogOpen}
            onOpenChange={setUploadDialogOpen}
            onUpload={handleUpload}
            orderId={selectedItem.orderId}
            itemId={selectedItem.itemId}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
