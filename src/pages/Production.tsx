import { useState } from 'react';
import { Play, CheckSquare, Camera, Clock, CheckCircle, ArrowRight, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PriorityBadge } from '@/components/orders/PriorityBadge';
import { FilePreview } from '@/components/orders/FilePreview';
import { PRODUCTION_STEPS, SubStage } from '@/types/order';
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
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { UploadFileDialog } from '@/components/dialogs/UploadFileDialog';

export default function Production() {
  const { orders, updateItemStage, updateItemSubstage, completeSubstage, uploadFile } = useOrders();
  const [activeTab, setActiveTab] = useState('all');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{ orderId: string; itemId: string } | null>(null);

  // Get items in production stage
  const productionItems = orders.flatMap(order => 
    order.items
      .filter(item => item.current_stage === 'production')
      .map(item => ({
        order,
        item,
      }))
  );

  const getItemsBySubstage = (substage: string | null) => {
    if (substage === 'all') return productionItems;
    return productionItems.filter(({ item }) => item.current_substage === substage);
  };

  const handleStartStage = (orderId: string, itemId: string, substage: SubStage) => {
    updateItemSubstage(orderId, itemId, substage);
    toast({
      title: "Stage Started",
      description: `Started ${substage} process`,
    });
  };

  const handleCompleteStage = (orderId: string, itemId: string) => {
    completeSubstage(orderId, itemId);
  };

  const handleSendToDispatch = (orderId: string, itemId: string) => {
    updateItemStage(orderId, itemId, 'dispatch');
    toast({
      title: "Ready for Dispatch",
      description: "Item has been sent to Dispatch",
    });
  };

  const handleUploadClick = (orderId: string, itemId: string) => {
    setSelectedItem({ orderId, itemId });
    setUploadDialogOpen(true);
  };

  const handleUpload = async (file: File) => {
    if (selectedItem) {
      await uploadFile(selectedItem.orderId, selectedItem.itemId, file);
      toast({
        title: "Photo Uploaded",
        description: "Production photo has been saved",
      });
    }
  };

  const getItemStages = (item: any) => {
    // Use item's production_stage_sequence if defined, otherwise fallback to default
    if (item.production_stage_sequence && item.production_stage_sequence.length > 0) {
      return item.production_stage_sequence.map((key: string) => {
        const defaultStep = PRODUCTION_STEPS.find(s => s.key === key);
        return { key, label: defaultStep?.label || key };
      });
    }
    return PRODUCTION_STEPS;
  };

  const getCurrentSubstageIndex = (item: any) => {
    const stages = getItemStages(item);
    if (!item.current_substage) return -1;
    return stages.findIndex((s: any) => s.key === item.current_substage);
  };

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col gap-4">
        {/* Header - Fixed */}
        <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Production Dashboard</h1>
            <p className="text-muted-foreground">
              {productionItems.length} item{productionItems.length !== 1 ? 's' : ''} in production
            </p>
          </div>
        </div>

        {/* Production Stages Tabs - Scrollable content */}
        <div className="flex-1 min-h-0 flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <div className="flex-shrink-0 overflow-x-auto pb-2">
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
              <TabsContent key={tabValue} value={tabValue} className="flex-1 mt-4 overflow-hidden">
                <div className="h-full overflow-y-auto custom-scrollbar pr-2 space-y-4">
                {getItemsBySubstage(tabValue === 'all' ? 'all' : tabValue).length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
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
                  getItemsBySubstage(tabValue === 'all' ? 'all' : tabValue).map(({ order, item }) => (
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
                                className="flex items-center gap-2 mb-1 flex-wrap hover:underline"
                              >
                                <h3 className="font-semibold truncate text-foreground">{item.product_name}</h3>
                                <PriorityBadge priority={item.priority_computed} showLabel />
                                {item.current_substage && (
                                  <Badge variant="stage-production">
                                    {item.current_substage}
                                  </Badge>
                                )}
                              </Link>
                              <p className="text-sm text-muted-foreground mb-2">
                                {order.order_id} • {order.customer.name} • Qty: {item.quantity}
                              </p>
                              
                              <div className="flex flex-wrap gap-2">
                                {item.specifications.paper && (
                                  <Badge variant="outline" className="text-xs">{item.specifications.paper}</Badge>
                                )}
                                {item.specifications.finishing && (
                                  <Badge variant="outline" className="text-xs">{item.specifications.finishing}</Badge>
                                )}
                              </div>
                              {item.files && item.files.length > 0 && (
                                <FilePreview files={item.files} compact />
                              )}

                              {/* Progress indicator - uses item's stage sequence */}
                              <div className="mt-3 flex items-center gap-1">
                                {getItemStages(item).map((step: any, index: number) => {
                                  const currentIndex = getCurrentSubstageIndex(item);
                                  const isCompleted = index < currentIndex;
                                  const isCurrent = index === currentIndex;
                                  return (
                                    <Tooltip key={step.key}>
                                      <TooltipTrigger asChild>
                                        <div 
                                          className={`h-2 flex-1 rounded-full transition-colors ${
                                            isCompleted ? 'bg-green-500' :
                                            isCurrent ? 'bg-primary' :
                                            'bg-secondary'
                                          }`}
                                        />
                                      </TooltipTrigger>
                                      <TooltipContent>{step.label}</TooltipContent>
                                    </Tooltip>
                                  );
                                })}
                              </div>
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
                                    <Camera className="h-4 w-4 mr-2" />
                                    Photo
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Upload production photo</TooltipContent>
                              </Tooltip>

                              {item.current_substage ? (
                                <DropdownMenu>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <DropdownMenuTrigger asChild>
                                        <Button size="sm" className="bg-green-600 hover:bg-green-700">
                                          <CheckSquare className="h-4 w-4 mr-2" />
                                          Complete {item.current_substage}
                                        </Button>
                                      </DropdownMenuTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent>Complete current stage</TooltipContent>
                                  </Tooltip>
                                  <DropdownMenuContent align="end" className="bg-popover">
                                    <DropdownMenuItem onClick={() => handleCompleteStage(order.order_id, item.item_id)}>
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      Complete & Next Stage
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    {getItemStages(item).map((step: any) => (
                                      <DropdownMenuItem 
                                        key={step.key}
                                        onClick={() => handleStartStage(order.order_id, item.item_id, step.key as SubStage)}
                                      >
                                        <ArrowRight className="h-4 w-4 mr-2" />
                                        Jump to {step.label}
                                      </DropdownMenuItem>
                                    ))}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleSendToDispatch(order.order_id, item.item_id)}>
                                      <Truck className="h-4 w-4 mr-2" />
                                      Send to Dispatch
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              ) : (
                                <DropdownMenu>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <DropdownMenuTrigger asChild>
                                        <Button size="sm">
                                          <Play className="h-4 w-4 mr-2" />
                                          Start Stage
                                        </Button>
                                      </DropdownMenuTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent>Select production stage to start</TooltipContent>
                                  </Tooltip>
                                  <DropdownMenuContent align="end" className="bg-popover">
                                    {getItemStages(item).map((step: any) => (
                                      <DropdownMenuItem 
                                        key={step.key}
                                        onClick={() => handleStartStage(order.order_id, item.item_id, step.key as SubStage)}
                                      >
                                        <Play className="h-4 w-4 mr-2" />
                                        Start {step.label}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
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
