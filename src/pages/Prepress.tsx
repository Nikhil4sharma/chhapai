import { useState } from 'react';
import { FileCheck, CheckCircle, Clock, ArrowRight, Upload, Eye, FileText, Image as ImageIcon, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PriorityBadge } from '@/components/orders/PriorityBadge';
import { useOrders } from '@/contexts/OrderContext';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { UploadFileDialog } from '@/components/dialogs/UploadFileDialog';

export default function Prepress() {
  const { orders, updateItemStage, uploadFile, sendToProduction } = useOrders();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{ orderId: string; itemId: string } | null>(null);
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; type: string } | null>(null);

  // Get items in prepress stage
  const prepressItems = orders.flatMap(order => 
    order.items
      .filter(item => item.current_stage === 'prepress')
      .map(item => ({
        order,
        item,
      }))
  );

  const handleSendToProduction = (orderId: string, itemId: string) => {
    sendToProduction(orderId, itemId);
  };

  const handleSendBackToDesign = (orderId: string, itemId: string) => {
    updateItemStage(orderId, itemId, 'design');
    toast({
      title: "Sent Back to Design",
      description: "Item requires design revisions",
    });
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

  const openFilePreview = (file: { url: string; file_name: string; type: string }) => {
    setPreviewFile({ url: file.url, name: file.file_name, type: file.type });
  };

  const isImageFile = (type: string) => {
    return type === 'image' || type.includes('image');
  };

  const isPdfFile = (name: string) => {
    return name.toLowerCase().endsWith('.pdf');
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Prepress Dashboard</h1>
            <p className="text-muted-foreground">
              {prepressItems.length} item{prepressItems.length !== 1 ? 's' : ''} in prepress
            </p>
          </div>
        </div>

        {/* Prepress Queue */}
        <div className="space-y-4">
          {prepressItems.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <h3 className="font-semibold text-lg mb-2">All caught up!</h3>
                <p className="text-muted-foreground">No items currently in prepress.</p>
              </CardContent>
            </Card>
          ) : (
            prepressItems.map(({ order, item }) => (
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

                        {/* Files with Preview */}
                        {item.files.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs text-muted-foreground mb-2">Files ({item.files.length})</p>
                            <div className="flex flex-wrap gap-2">
                              {item.files.map((file) => (
                                <div
                                  key={file.file_id}
                                  className="group relative"
                                >
                                  {isImageFile(file.type) ? (
                                    <button
                                      onClick={() => openFilePreview({ url: file.url, file_name: file.file_name || 'Image', type: file.type })}
                                      className="flex items-center gap-2 bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-lg p-2 transition-colors"
                                    >
                                      <div className="w-12 h-12 rounded overflow-hidden bg-muted flex items-center justify-center">
                                        <img 
                                          src={file.url} 
                                          alt={file.file_name || 'Preview'}
                                          className="w-full h-full object-cover"
                                          onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                          }}
                                        />
                                        <ImageIcon className="h-6 w-6 text-muted-foreground hidden" />
                                      </div>
                                      <div className="text-left">
                                        <p className="text-xs font-medium text-foreground truncate max-w-[100px]">
                                          {file.file_name || 'Image'}
                                        </p>
                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                          <Eye className="h-3 w-3" />
                                          Preview
                                        </p>
                                      </div>
                                    </button>
                                  ) : (
                                    <a
                                      href={file.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-2 bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-lg p-2 transition-colors"
                                    >
                                      <div className="w-12 h-12 rounded overflow-hidden bg-muted flex items-center justify-center">
                                        <FileText className="h-6 w-6 text-primary" />
                                      </div>
                                      <div className="text-left">
                                        <p className="text-xs font-medium text-foreground truncate max-w-[100px]">
                                          {file.file_name || 'Document'}
                                        </p>
                                        <p className="text-xs text-primary flex items-center gap-1">
                                          <Eye className="h-3 w-3" />
                                          Open
                                        </p>
                                      </div>
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
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
                              Upload Final
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Upload final print-ready file</TooltipContent>
                        </Tooltip>

                        <DropdownMenu>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" className="bg-green-600 hover:bg-green-700">
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Approve
                                </Button>
                              </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent>Approve and send to production</TooltipContent>
                          </Tooltip>
                          <DropdownMenuContent align="end" className="bg-popover">
                            <DropdownMenuItem onClick={() => handleSendToProduction(order.order_id, item.item_id)}>
                              <ArrowRight className="h-4 w-4 mr-2" />
                              Send to Production
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleSendBackToDesign(order.order_id, item.item_id)}
                              className="text-orange-500"
                            >
                              <ArrowRight className="h-4 w-4 mr-2 rotate-180" />
                              Send Back to Design
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

        {/* File Preview Dialog */}
        <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                {previewFile?.name}
              </DialogTitle>
            </DialogHeader>
            {previewFile && (
              <div className="flex items-center justify-center bg-muted/50 rounded-lg p-4 min-h-[400px]">
                {isImageFile(previewFile.type) ? (
                  <img 
                    src={previewFile.url} 
                    alt={previewFile.name}
                    className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
                  />
                ) : (
                  <div className="text-center">
                    <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">Preview not available for this file type</p>
                    <Button asChild>
                      <a href={previewFile.url} target="_blank" rel="noopener noreferrer">
                        <Eye className="h-4 w-4 mr-2" />
                        Open in New Tab
                      </a>
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
