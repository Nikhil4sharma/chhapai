import { useState, useEffect } from 'react';
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
import { useAuth } from '@/contexts/AuthContext';
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
  const { isAdmin } = useAuth();
  const [credentials, setCredentials] = useState({
    store_url: '',
    consumer_key: '',
    consumer_secret: '',
  });
  const [showKey, setShowKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load existing credentials when dialog opens (admin only)
  useEffect(() => {
    if (open && isAdmin) {
      loadCredentials();
    }
  }, [open, isAdmin]);

  const loadCredentials = async () => {
    try {
      const { data: credsData, error: credsError } = await supabase
        .from('woocommerce_credentials')
        .select('*')
        .eq('setting_key', 'config')
        .maybeSingle();

      if (credsError) {
        // Handle 406 or other errors gracefully
        if (credsError.code === 'PGRST116' || credsError.status === 406) {
          console.warn('[WooCommerce] Credentials table structure issue or not found:', credsError);
          // Pre-fill store URL if provided
          if (currentStoreUrl) {
            setCredentials(prev => ({ ...prev, store_url: currentStoreUrl }));
          }
          return;
        }
        console.error('Error loading credentials:', credsError);
        return;
      }

      if (credsData) {
        setCredentials({
          store_url: credsData.store_url || '',
          consumer_key: credsData.consumer_key ? '••••••••••••••••' : '', // Mask existing key
          consumer_secret: credsData.consumer_secret ? '••••••••••••••••' : '', // Mask existing secret
        });
      } else {
        // Pre-fill store URL if provided
        if (currentStoreUrl) {
          setCredentials(prev => ({ ...prev, store_url: currentStoreUrl }));
        }
      }
    } catch (error) {
      console.error('Error loading credentials:', error);
      // Pre-fill store URL if provided even on error
      if (currentStoreUrl) {
        setCredentials(prev => ({ ...prev, store_url: currentStoreUrl }));
      }
    }
  };

  const handleSubmit = async () => {
    // Check admin access
    if (!isAdmin) {
      toast({
        title: "Access Denied",
        description: "Only administrators can update WooCommerce credentials",
        variant: "destructive",
      });
      return;
    }

    if (!credentials.store_url.trim() || !credentials.consumer_key.trim() || !credentials.consumer_secret.trim()) {
      toast({
        title: "Validation Error",
        description: "All fields are required",
        variant: "destructive",
      });
      return;
    }

    // Validate URL format
    let normalizedUrl = credentials.store_url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }
    normalizedUrl = normalizedUrl.replace(/\/$/, '');

    setIsLoading(true);
    try {
      // Validate credentials by testing connection
      const testAuth = btoa(`${credentials.consumer_key}:${credentials.consumer_secret}`);
      const testUrl = `${normalizedUrl}/wp-json/wc/v3/system_status`;
      
      const testResponse = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${testAuth}`,
          'Content-Type': 'application/json',
        },
      });

      if (!testResponse.ok) {
        throw new Error(`Connection failed: ${testResponse.status} ${testResponse.statusText}`);
      }

      // Save credentials to Supabase (admin-only table)
      // Check if masked values are being used (user didn't change them)
      const { data: existingCreds } = await supabase
        .from('woocommerce_credentials')
        .select('*')
        .eq('setting_key', 'config')
        .maybeSingle();

      const finalKey = credentials.consumer_key.includes('••••') && existingCreds?.consumer_key
        ? existingCreds.consumer_key
        : credentials.consumer_key;
      
      const finalSecret = credentials.consumer_secret.includes('••••') && existingCreds?.consumer_secret
        ? existingCreds.consumer_secret
        : credentials.consumer_secret;

      // Use upsert with proper conflict resolution
      const { error: saveError } = await supabase
        .from('woocommerce_credentials')
        .upsert({
          setting_key: 'config',
          store_url: normalizedUrl,
          consumer_key: finalKey,
          consumer_secret: finalSecret,
        }, {
          onConflict: 'setting_key',
          ignoreDuplicates: false
        });

      if (saveError) {
        console.error('[WooCommerce] Save error:', saveError);
        // Provide more specific error message
        if (saveError.code === 'PGRST116' || saveError.status === 406) {
          throw new Error('Table structure issue. Please ensure woocommerce_credentials table exists and RLS policies are set.');
        }
        if (saveError.code === '42501' || saveError.message?.includes('permission denied')) {
          throw new Error('Permission denied. Only admins can update WooCommerce credentials.');
        }
        throw saveError;
      }

      toast({
        title: "Credentials Updated",
        description: `Successfully connected to ${normalizedUrl}`,
      });
      
      onSuccess();
      onOpenChange(false);
      setCredentials({ store_url: '', consumer_key: '', consumer_secret: '' });
    } catch (error: any) {
      console.error('Error updating credentials:', error);
      toast({
        title: "Update Failed",
        description: error.message || "Could not validate or save credentials. Please check your API keys.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Don't show dialog if not admin
  if (!isAdmin) {
    return null;
  }

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
              : 'Enter your WooCommerce API credentials (Admin Only)'
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
              onChange={(e) => {
                // Only update if not masked value
                if (!e.target.value.includes('••••')) {
                  setCredentials({ ...credentials, consumer_key: e.target.value });
                }
              }}
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
              onChange={(e) => {
                // Only update if not masked value
                if (!e.target.value.includes('••••')) {
                  setCredentials({ ...credentials, consumer_secret: e.target.value });
                }
              }}
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
