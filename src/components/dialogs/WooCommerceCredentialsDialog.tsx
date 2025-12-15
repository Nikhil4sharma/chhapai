import { useState } from 'react';
import { ShoppingCart, Eye, EyeOff, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface WooCommerceCredentialsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentStoreUrl?: string | null;
  onSuccess: () => void;
}

export function WooCommerceCredentialsDialog({
  open,
  onOpenChange,
  currentStoreUrl,
  onSuccess,
}: WooCommerceCredentialsDialogProps) {
  const [credentials, setCredentials] = useState({
    store_url: '',
    consumer_key: '',
    consumer_secret: '',
  });
  const [showKey, setShowKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!credentials.store_url.trim() || !credentials.consumer_key.trim() || !credentials.consumer_secret.trim()) {
      toast({
        title: "Validation Error",
        description: "All fields are required",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('woocommerce', {
        body: { 
          action: 'update-credentials',
          ...credentials,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Credentials Updated",
          description: `Connected to ${data.storeUrl}`,
        });
        onSuccess();
        onOpenChange(false);
        setCredentials({ store_url: '', consumer_key: '', consumer_secret: '' });
      } else {
        toast({
          title: "Update Failed",
          description: data.error || "Could not validate credentials",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update credentials",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Update WooCommerce Credentials
          </DialogTitle>
          <DialogDescription>
            {currentStoreUrl 
              ? `Currently connected to: ${currentStoreUrl}` 
              : 'Enter your WooCommerce API credentials'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="store_url">Store URL</Label>
            <Input
              id="store_url"
              placeholder="https://yourstore.com"
              value={credentials.store_url}
              onChange={(e) => setCredentials({ ...credentials, store_url: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Your WooCommerce store URL (e.g., https://mystore.com)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="consumer_key">Consumer Key</Label>
            <div className="relative">
              <Input
                id="consumer_key"
                type={showKey ? 'text' : 'password'}
                placeholder="ck_xxxxxxxxxxxxxxxx"
                value={credentials.consumer_key}
                onChange={(e) => setCredentials({ ...credentials, consumer_key: e.target.value })}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="consumer_secret">Consumer Secret</Label>
            <div className="relative">
              <Input
                id="consumer_secret"
                type={showSecret ? 'text' : 'password'}
                placeholder="cs_xxxxxxxxxxxxxxxx"
                value={credentials.consumer_secret}
                onChange={(e) => setCredentials({ ...credentials, consumer_secret: e.target.value })}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() => setShowSecret(!showSecret)}
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="bg-primary/5 rounded-lg p-3 text-sm">
            <p className="font-medium text-foreground mb-1">How to get API keys:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
              <li>Go to WooCommerce → Settings → Advanced → REST API</li>
              <li>Click "Add Key" and set permissions to "Read"</li>
              <li>Copy the Consumer Key and Consumer Secret</li>
            </ol>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Validating...
              </>
            ) : (
              'Save Credentials'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
