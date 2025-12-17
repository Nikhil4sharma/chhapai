import { useState, useEffect, useCallback } from 'react';
import { 
  Settings as SettingsIcon, 
  Bell, 
  Shield, 
  Palette, 
  Database, 
  Save, 
  Plus, 
  Trash2,
  ShoppingCart,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Edit,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { PRODUCTION_STEPS } from '@/types/order';
import { WooCommerceCredentialsDialog } from '@/components/dialogs/WooCommerceCredentialsDialog';
import { doc, getDoc, setDoc, updateDoc, Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';

export default function Settings() {
  const { isAdmin, user } = useAuth();
  const [notifications, setNotifications] = useState({
    email: true,
    push: true, // Default ON for all users
    orderUpdates: true,
    urgentAlerts: true,
  });
  const [productionStages, setProductionStages] = useState<Array<{ key: string; label: string; order: number }>>(
    PRODUCTION_STEPS.map(s => ({ key: s.key, label: s.label, order: s.order }))
  );
  const [newStageName, setNewStageName] = useState('');
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load notification preferences and production stages from Firestore (only once on mount)
  useEffect(() => {
    if (!user || settingsLoaded) return;
    
    const loadSettings = async () => {
      try {
        const settingsRef = doc(db, 'user_settings', user.uid);
        const settingsSnap = await getDoc(settingsRef);
        
        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          
          // Load notification preferences
          if (data.email_notifications !== undefined || data.push_notifications !== undefined) {
            setNotifications({
              email: data.email_notifications ?? true,
              push: data.push_notifications ?? true, // Default ON
              orderUpdates: data.order_updates ?? true,
              urgentAlerts: data.urgent_alerts ?? true,
            });
          }
          
          // Load production stages (admin only) - check app_settings first
          if (isAdmin) {
            try {
              const appSettingsRef = doc(db, 'app_settings', 'production_stages');
              const appSettingsSnap = await getDoc(appSettingsRef);
              
              if (appSettingsSnap.exists()) {
                const appData = appSettingsSnap.data();
                if (appData.stages && Array.isArray(appData.stages) && appData.stages.length > 0) {
                  setProductionStages(appData.stages);
                }
              } else if (data.production_stages && Array.isArray(data.production_stages) && data.production_stages.length > 0) {
                // Fallback to user_settings for backward compatibility
                setProductionStages(data.production_stages);
              }
            } catch (error) {
              console.error('Error loading production stages:', error);
            }
          }
        }
        setSettingsLoaded(true);
      } catch (error) {
        console.error('Error loading settings:', error);
        setSettingsLoaded(true);
      }
    };
    
    loadSettings();
  }, [user, isAdmin, settingsLoaded]);

  // WooCommerce settings - only non-sensitive preferences stored locally
  const [wooSettings, setWooSettings] = useState({
    autoSync: true,
    syncInterval: 15,
    lastSync: null as Date | null,
    isConnected: false,
    storeUrlMasked: null as string | null,
  });
  const [syncLoading, setSyncLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [checkingConfig, setCheckingConfig] = useState(true);
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [autoSyncInterval, setAutoSyncInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  // Load saved non-sensitive settings and check server config
  useEffect(() => {
    // Load only non-sensitive preferences from localStorage
    const savedPrefs = localStorage.getItem('woocommerce_preferences');
    if (savedPrefs) {
      const parsed = JSON.parse(savedPrefs);
      setWooSettings(prev => ({
        ...prev,
        autoSync: parsed.autoSync ?? true,
        syncInterval: parsed.syncInterval ?? 15,
        lastSync: parsed.lastSync ? new Date(parsed.lastSync) : null,
      }));
    }

    // Check if credentials are configured on the server
    checkWooCommerceConfig();
  }, []);

  // Auto Sync functionality - runs at interval
  useEffect(() => {
    // Clear existing interval
    if (autoSyncInterval) {
      clearInterval(autoSyncInterval);
      setAutoSyncInterval(null);
    }

    // Only set up auto sync if enabled and connected
    if (wooSettings.autoSync && wooSettings.isConnected && isAdmin) {
      const intervalMs = wooSettings.syncInterval * 60 * 1000; // Convert minutes to milliseconds
      
      // Calculate time until next sync
      const now = new Date();
      const lastSync = wooSettings.lastSync;
      let timeUntilNextSync = intervalMs;
      
      if (lastSync) {
        const timeSinceLastSync = now.getTime() - lastSync.getTime();
        if (timeSinceLastSync < intervalMs) {
          timeUntilNextSync = intervalMs - timeSinceLastSync;
        }
      }

      // Set up interval
      const timeout = setTimeout(() => {
        // First sync (silent - no loading indicator)
        handleManualSync().catch(console.error);
        
        // Then set up recurring interval
        const interval = setInterval(() => {
          handleManualSync().catch(console.error);
        }, intervalMs);
        
        setAutoSyncInterval(interval);
      }, timeUntilNextSync);

      return () => {
        clearTimeout(timeout);
        if (autoSyncInterval) {
          clearInterval(autoSyncInterval);
        }
      };
    }

    return () => {
      if (autoSyncInterval) {
        clearInterval(autoSyncInterval);
      }
    };
  }, [wooSettings.autoSync, wooSettings.syncInterval, wooSettings.isConnected, wooSettings.lastSync, isAdmin, handleManualSync, autoSyncInterval]);

  const checkWooCommerceConfig = async () => {
    if (!isAdmin) return;
    
    setCheckingConfig(true);
    try {
      const credsRef = doc(db, 'woocommerce_credentials', 'config');
      const credsSnap = await getDoc(credsRef);
      
      if (credsSnap.exists()) {
        const data = credsSnap.data();
        setWooSettings(prev => ({
          ...prev,
          isConnected: !!(data.store_url && data.consumer_key && data.consumer_secret),
          storeUrlMasked: data.store_url || null,
        }));
      } else {
        setWooSettings(prev => ({
          ...prev,
          isConnected: false,
          storeUrlMasked: null,
        }));
      }
    } catch (error) {
      console.error('Failed to check WooCommerce config:', error);
      setWooSettings(prev => ({
        ...prev,
        isConnected: false,
        storeUrlMasked: null,
      }));
    } finally {
      setCheckingConfig(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    
    try {
      const settingsRef = doc(db, 'user_settings', user.uid);
      
      const settingsData: any = {
        user_id: user.uid,
        email_notifications: notifications.email,
        push_notifications: notifications.push,
        order_updates: notifications.orderUpdates,
        urgent_alerts: notifications.urgentAlerts,
        updated_at: Timestamp.now(),
      };
      
      await setDoc(settingsRef, settingsData, { merge: true });
      
      // Save production stages separately to app_settings (admin only)
      if (isAdmin) {
        try {
          const appSettingsRef = doc(db, 'app_settings', 'production_stages');
          await setDoc(appSettingsRef, {
            stages: productionStages,
            updated_at: Timestamp.now(),
          }, { merge: true });
        } catch (error) {
          console.error('Error saving production stages:', error);
        }
      }
      
      // Mark as saved to prevent reload from overwriting
      setSettingsLoaded(true);
      
      toast({
        title: "Settings Saved",
        description: "Your preferences have been updated and saved successfully",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    }
  };

  const handleAddStage = async () => {
    if (!newStageName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a stage name",
        variant: "destructive",
      });
      return;
    }
    
    if (!isAdmin) {
      toast({
        title: "Error",
        description: "Only admins can add stages",
        variant: "destructive",
      });
      return;
    }
    
    const newStage = {
      key: newStageName.toLowerCase().replace(/\s+/g, '_'),
      label: newStageName,
      order: productionStages.length + 1,
    };
    
    const updatedStages = [...productionStages, newStage];
    setProductionStages(updatedStages);
    setNewStageName('');
    
    // Save immediately to Firestore
    try {
      const appSettingsRef = doc(db, 'app_settings', 'production_stages');
      await setDoc(appSettingsRef, {
        stages: updatedStages,
        updated_at: Timestamp.now(),
      }, { merge: true });
      
      toast({
        title: "Stage Added",
        description: `"${newStageName}" has been added and saved`,
      });
    } catch (error) {
      console.error('Error saving stage:', error);
      toast({
        title: "Error",
        description: "Failed to save stage. Please try again.",
        variant: "destructive",
      });
      // Revert the change
      setProductionStages(productionStages);
    }
  };

  const handleRemoveStage = async (key: string) => {
    if (!isAdmin) {
      toast({
        title: "Error",
        description: "Only admins can remove stages",
        variant: "destructive",
      });
      return;
    }
    
    const updatedStages = productionStages.filter(s => s.key !== key);
    setProductionStages(updatedStages);
    
    // Save immediately to Firestore
    try {
      const appSettingsRef = doc(db, 'app_settings', 'production_stages');
      await setDoc(appSettingsRef, {
        stages: updatedStages,
        updated_at: Timestamp.now(),
      }, { merge: true });
      
      toast({
        title: "Stage Removed",
        description: "Production stage has been removed and saved",
      });
    } catch (error) {
      console.error('Error removing stage:', error);
      toast({
        title: "Error",
        description: "Failed to remove stage. Please try again.",
        variant: "destructive",
      });
      // Revert the change
      setProductionStages(productionStages);
    }
  };

  const handleSaveWooCommercePrefs = () => {
    // Only save non-sensitive preferences
    localStorage.setItem('woocommerce_preferences', JSON.stringify({
      autoSync: wooSettings.autoSync,
      syncInterval: wooSettings.syncInterval,
      lastSync: wooSettings.lastSync?.toISOString() || null,
    }));
    toast({
      title: "Preferences Saved",
      description: "Your WooCommerce sync preferences have been saved",
    });
  };

  const handleTestConnection = async () => {
    if (!isAdmin) return;
    
    setTestingConnection(true);
    try {
      const credsRef = doc(db, 'woocommerce_credentials', 'config');
      const credsSnap = await getDoc(credsRef);
      
      if (!credsSnap.exists()) {
        throw new Error('WooCommerce credentials not configured');
      }
      
      const data = credsSnap.data();
      if (!data.store_url || !data.consumer_key || !data.consumer_secret) {
        throw new Error('Incomplete credentials');
      }

      // Test connection
      const testAuth = btoa(`${data.consumer_key}:${data.consumer_secret}`);
      const testUrl = `${data.store_url}/wp-json/wc/v3/system_status`;
      
      const testResponse = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${testAuth}`,
          'Content-Type': 'application/json',
        },
      });

      if (testResponse.ok) {
        setWooSettings(prev => ({ ...prev, isConnected: true }));
        toast({
          title: "Connection Successful",
          description: "Successfully connected to your WooCommerce store",
        });
      } else {
        throw new Error(`Connection failed: ${testResponse.status} ${testResponse.statusText}`);
      }
    } catch (error: any) {
      toast({
        title: "Connection Failed",
        description: error.message || "Could not connect to WooCommerce. Please check your credentials.",
        variant: "destructive",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleManualSync = useCallback(async () => {
    if (!isAdmin) return;
    
    if (!wooSettings.isConnected) {
      toast({
        title: "Error",
        description: "Please configure WooCommerce credentials first",
        variant: "destructive",
      });
      return;
    }

    setSyncLoading(true);
    try {
      // Get WooCommerce credentials
      const credsRef = doc(db, 'woocommerce_credentials', 'config');
      const credsSnap = await getDoc(credsRef);
      
      if (!credsSnap.exists()) {
        throw new Error('WooCommerce credentials not configured');
      }
      
      const creds = credsSnap.data();
      if (!creds.store_url || !creds.consumer_key || !creds.consumer_secret) {
        throw new Error('Incomplete credentials');
      }

      // Fetch processing orders from WooCommerce
      const auth = btoa(`${creds.consumer_key}:${creds.consumer_secret}`);
      const ordersUrl = `${creds.store_url}/wp-json/wc/v3/orders?status=processing&per_page=100`;
      
      const response = await fetch(ordersUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch orders: ${response.status} ${response.statusText}`);
      }

      const wooOrders = await response.json();
      
      // Import orders to Firestore
      let imported = 0;
      let skipped = 0;

      for (const wooOrder of wooOrders) {
        // Check if order already exists
        const existingQuery = query(collection(db, 'orders'), where('woo_order_id', '==', wooOrder.id.toString()));
        const existingSnapshot = await getDocs(existingQuery);
        
        const orderId = `WC-${wooOrder.id}`;
        const orderRef = doc(db, 'orders', orderId);
        
        // Parse product meta data from WooCommerce
        const parseProductMeta = (metaData: any[]) => {
          const EXCLUDED_KEYS = ['sku', 'SKU', 'notes', '_sku', 'product_sku', '_reduced_stock', '_restock_refunded_items', '_product_addons', '_qty'];
          const specifications: Record<string, string> = {};
          if (Array.isArray(metaData)) {
            for (const meta of metaData) {
              if (!meta.key || meta.key.startsWith('_')) continue;
              
              // Skip SKU and excluded keys
              const metaKey = meta.key.toLowerCase();
              if (EXCLUDED_KEYS.some(k => metaKey.includes(k.toLowerCase()))) continue;
              
              const displayKey = meta.display_key || meta.key;
              const displayValue = meta.display_value || meta.value;
              
              if (displayValue && typeof displayValue === 'string' && displayValue.trim()) {
                specifications[displayKey] = displayValue.trim();
              }
            }
          }
          return specifications;
        };

        if (!existingSnapshot.empty) {
          // Update existing order
          const existingOrder = existingSnapshot.docs[0];
          const existingOrderId = existingOrder.id;
          
          // Update order document
          await updateDoc(doc(db, 'orders', existingOrderId), {
            customer_name: `${wooOrder.billing.first_name} ${wooOrder.billing.last_name}`.trim(),
            customer_phone: wooOrder.billing.phone || '',
            customer_email: wooOrder.billing.email || '',
            customer_address: wooOrder.billing.address_1 || '',
            billing_city: wooOrder.billing.city || '',
            billing_state: wooOrder.billing.state || '',
            billing_pincode: wooOrder.billing.postcode || '',
            shipping_name: wooOrder.shipping.first_name ? `${wooOrder.shipping.first_name} ${wooOrder.shipping.last_name}`.trim() : null,
            shipping_email: wooOrder.shipping.email || null,
            shipping_phone: wooOrder.shipping.phone || null,
            shipping_address: wooOrder.shipping.address_1 || null,
            shipping_city: wooOrder.shipping.city || null,
            shipping_state: wooOrder.shipping.state || null,
            shipping_pincode: wooOrder.shipping.postcode || null,
            order_total: parseFloat(wooOrder.total) || 0,
            payment_status: wooOrder.status,
            order_status: wooOrder.status,
            updated_at: Timestamp.now(),
            global_notes: wooOrder.customer_note || null,
          });

          // Update or create order items
          for (const lineItem of wooOrder.line_items || []) {
            const itemId = `${orderId}-${lineItem.id}`;
            const itemRef = doc(db, 'order_items', itemId);
            const itemSnap = await getDoc(itemRef);
            
            const specifications = parseProductMeta(lineItem.meta_data || []);
            
            if (itemSnap.exists()) {
              // Update existing item
              await updateDoc(itemRef, {
                product_name: lineItem.name,
                quantity: lineItem.quantity,
                line_total: parseFloat(lineItem.total) || 0,
                specifications: specifications,
                woo_meta: {
                  product_id: lineItem.product_id,
                  variation_id: lineItem.variation_id,
                },
                updated_at: Timestamp.now(),
              });
            } else {
              // Create new item
              const deliveryDate = new Date();
              deliveryDate.setDate(deliveryDate.getDate() + 7);
              
              await setDoc(itemRef, {
                order_id: orderId,
                product_name: lineItem.name,
                quantity: lineItem.quantity,
                line_total: parseFloat(lineItem.total) || 0,
                specifications: specifications,
                woo_meta: {
                  product_id: lineItem.product_id,
                  variation_id: lineItem.variation_id,
                },
                need_design: true,
                current_stage: 'sales',
                current_substage: null,
                assigned_to: null,
                assigned_department: 'sales',
                delivery_date: Timestamp.fromDate(deliveryDate),
                is_ready_for_production: false,
                is_dispatched: false,
                created_at: Timestamp.fromDate(new Date(wooOrder.date_created)),
                updated_at: Timestamp.now(),
              });
            }
          }
          
          skipped++;
          continue;
        }

        // Create new order document
        await setDoc(orderRef, {
          order_id: orderId,
          woo_order_id: wooOrder.id.toString(),
          source: 'woocommerce',
          customer_name: `${wooOrder.billing.first_name} ${wooOrder.billing.last_name}`.trim(),
          customer_phone: wooOrder.billing.phone || '',
          customer_email: wooOrder.billing.email || '',
          customer_address: wooOrder.billing.address_1 || '',
          billing_city: wooOrder.billing.city || '',
          billing_state: wooOrder.billing.state || '',
          billing_pincode: wooOrder.billing.postcode || '',
          shipping_name: wooOrder.shipping.first_name ? `${wooOrder.shipping.first_name} ${wooOrder.shipping.last_name}`.trim() : null,
          shipping_email: wooOrder.shipping.email || null,
          shipping_phone: wooOrder.shipping.phone || null,
          shipping_address: wooOrder.shipping.address_1 || null,
          shipping_city: wooOrder.shipping.city || null,
          shipping_state: wooOrder.shipping.state || null,
          shipping_pincode: wooOrder.shipping.postcode || null,
          order_total: parseFloat(wooOrder.total) || 0,
          tax_cgst: null,
          tax_sgst: null,
          payment_status: wooOrder.status,
          order_status: wooOrder.status,
          created_by: user?.uid || '',
          created_at: Timestamp.fromDate(new Date(wooOrder.date_created)),
          updated_at: Timestamp.now(),
          is_completed: false,
          global_notes: wooOrder.customer_note || null,
        });

        // Create order items
        for (const lineItem of wooOrder.line_items || []) {
          const itemId = `${orderId}-${lineItem.id}`;
          const itemRef = doc(db, 'order_items', itemId);
          
          // Calculate delivery date (default to 7 days from now)
          const deliveryDate = new Date();
          deliveryDate.setDate(deliveryDate.getDate() + 7);
          
          const specifications = parseProductMeta(lineItem.meta_data || []);
          
          await setDoc(itemRef, {
            order_id: orderId,
            product_name: lineItem.name,
            quantity: lineItem.quantity,
            line_total: parseFloat(lineItem.total) || 0,
            specifications: specifications,
            woo_meta: {
              product_id: lineItem.product_id,
              variation_id: lineItem.variation_id,
            },
            need_design: true,
            current_stage: 'sales',
            current_substage: null,
            assigned_to: null,
            assigned_department: 'sales',
            delivery_date: Timestamp.fromDate(deliveryDate),
            is_ready_for_production: false,
            is_dispatched: false,
            created_at: Timestamp.fromDate(new Date(wooOrder.date_created)),
            updated_at: Timestamp.now(),
          });
        }

        imported++;
      }
      
      const now = new Date();
      setWooSettings(prev => ({ ...prev, lastSync: now }));
      localStorage.setItem('woocommerce_preferences', JSON.stringify({
        autoSync: wooSettings.autoSync,
        syncInterval: wooSettings.syncInterval,
        lastSync: now.toISOString(),
      }));
      
      // Restart auto sync interval after manual sync
      if (wooSettings.autoSync) {
        // Clear existing interval
        if (autoSyncInterval) {
          clearInterval(autoSyncInterval);
        }
        
        // Restart interval
        const intervalMs = wooSettings.syncInterval * 60 * 1000;
        const interval = setInterval(() => {
          handleManualSync();
        }, intervalMs);
        setAutoSyncInterval(interval);
      }
      
      toast({
        title: "Sync Complete",
        description: `Imported ${imported} new orders, updated ${skipped} existing orders`,
      });
    } catch (error: any) {
      console.error('Sync error:', error);
      toast({
        title: "Sync Failed",
        description: error.message || "Could not sync orders. Please check your credentials and try again.",
        variant: "destructive",
      });
    } finally {
      setSyncLoading(false);
    }
  }, [isAdmin, wooSettings.isConnected, wooSettings.autoSync, wooSettings.syncInterval, autoSyncInterval, user]);

  return (
    <TooltipProvider>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <SettingsIcon className="h-6 w-6" />
            Settings
          </h1>
          <p className="text-muted-foreground">Manage your application preferences</p>
        </div>

        <Tabs defaultValue="notifications" className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="notifications" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5">
              <Bell className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Notifications</span>
            </TabsTrigger>
            <TabsTrigger value="appearance" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5">
              <Palette className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Appearance</span>
            </TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger value="woocommerce" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5">
                  <ShoppingCart className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">WooCommerce</span>
                </TabsTrigger>
                <TabsTrigger value="stages" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5">
                  <Database className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Stages</span>
                </TabsTrigger>
                <TabsTrigger value="security" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5">
                  <Shield className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Security</span>
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* Notifications */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Choose how you want to be notified</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <Label className="text-sm">Email Notifications</Label>
                    <p className="text-xs sm:text-sm text-muted-foreground">Receive notifications via email</p>
                  </div>
                  <Switch 
                    checked={notifications.email}
                    onCheckedChange={(checked) => setNotifications({...notifications, email: checked})}
                  />
                </div>
                <Separator />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <Label className="text-sm">Push Notifications</Label>
                    <p className="text-xs sm:text-sm text-muted-foreground">Receive push notifications in browser</p>
                  </div>
                  <Switch 
                    checked={notifications.push}
                    onCheckedChange={(checked) => setNotifications({...notifications, push: checked})}
                  />
                </div>
                <Separator />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <Label className="text-sm">Order Updates</Label>
                    <p className="text-xs sm:text-sm text-muted-foreground">Get notified when orders change status</p>
                  </div>
                  <Switch 
                    checked={notifications.orderUpdates}
                    onCheckedChange={(checked) => setNotifications({...notifications, orderUpdates: checked})}
                  />
                </div>
                <Separator />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <Label className="text-sm">Urgent Alerts</Label>
                    <p className="text-xs sm:text-sm text-muted-foreground">Get alerts for high-priority items</p>
                  </div>
                  <Switch 
                    checked={notifications.urgentAlerts}
                    onCheckedChange={(checked) => setNotifications({...notifications, urgentAlerts: checked})}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance */}
          <TabsContent value="appearance">
            <Card>
              <CardHeader>
                <CardTitle>Appearance Settings</CardTitle>
                <CardDescription>Customize how the app looks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Theme</Label>
                  <p className="text-sm text-muted-foreground mb-4">
                    Use the theme toggle in the header to switch between light and dark mode
                  </p>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input defaultValue="Chhapai" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* WooCommerce Integration (Admin Only) */}
          {isAdmin && (
            <TabsContent value="woocommerce">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    WooCommerce Integration
                    {wooSettings.isConnected ? (
                      <Badge variant="success" className="ml-2">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="ml-2">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Not Connected
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Connect your WooCommerce store to automatically sync processing orders
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {checkingConfig ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Checking configuration...
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-secondary/50 rounded-lg p-4">
                        <h4 className="font-medium text-foreground mb-2">Credentials Configuration</h4>
                        {wooSettings.isConnected ? (
                          <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">
                              ✓ WooCommerce credentials are configured securely on the server.
                            </p>
                            {wooSettings.storeUrlMasked && (
                              <p className="text-sm text-muted-foreground">
                                Store: <span className="font-mono">{wooSettings.storeUrlMasked}</span>
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <p className="text-sm text-muted-foreground">
                              WooCommerce credentials are configured via backend secrets for security.
                            </p>
                            <div className="bg-primary/5 rounded-lg p-3 text-sm">
                              <p className="font-medium text-foreground mb-2">Required Secrets:</p>
                              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                <li><code className="text-xs bg-muted px-1 rounded">WOOCOMMERCE_STORE_URL</code> - Your store URL</li>
                                <li><code className="text-xs bg-muted px-1 rounded">WOOCOMMERCE_CONSUMER_KEY</code> - API Key</li>
                                <li><code className="text-xs bg-muted px-1 rounded">WOOCOMMERCE_CONSUMER_SECRET</code> - API Secret</li>
                              </ul>
                              <p className="mt-3 text-xs">
                                These secrets are already configured in your backend. Click "Refresh Status" to verify.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="outline"
                              onClick={() => setCredentialsDialogOpen(true)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Update Credentials
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Update WooCommerce API credentials</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="outline"
                              onClick={handleTestConnection}
                              disabled={testingConnection || !wooSettings.isConnected}
                            >
                              {testingConnection ? 'Testing...' : 'Test Connection'}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {wooSettings.isConnected 
                              ? 'Test WooCommerce API connection' 
                              : 'Configure credentials first'}
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="outline"
                              onClick={checkWooCommerceConfig}
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Refresh Status
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Check if credentials are configured</TooltipContent>
                        </Tooltip>
                      </div>

                      {/* Credentials Dialog */}
                      <WooCommerceCredentialsDialog
                        open={credentialsDialogOpen}
                        onOpenChange={setCredentialsDialogOpen}
                        currentStoreUrl={wooSettings.storeUrlMasked}
                        onSuccess={checkWooCommerceConfig}
                      />
                    </div>
                  )}

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium text-foreground">Sync Settings</h4>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-0.5 min-w-0">
                        <Label className="text-sm">Auto Sync</Label>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          Automatically sync orders every {wooSettings.syncInterval} minutes
                        </p>
                      </div>
                      <Switch 
                        checked={wooSettings.autoSync}
                        onCheckedChange={(checked) => {
                          setWooSettings({...wooSettings, autoSync: checked});
                          // Auto-save to localStorage
                          const savedPrefs = localStorage.getItem('woocommerce_preferences');
                          const parsed = savedPrefs ? JSON.parse(savedPrefs) : {};
                          localStorage.setItem('woocommerce_preferences', JSON.stringify({
                            ...parsed,
                            autoSync: checked,
                            syncInterval: wooSettings.syncInterval,
                            lastSync: wooSettings.lastSync?.toISOString() || null,
                          }));
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Sync Interval (minutes)</Label>
                      <Input
                        type="number"
                        min={5}
                        max={60}
                        value={wooSettings.syncInterval}
                        onChange={(e) => {
                          const newInterval = parseInt(e.target.value) || 15;
                          setWooSettings({...wooSettings, syncInterval: newInterval});
                          // Auto-save to localStorage
                          const savedPrefs = localStorage.getItem('woocommerce_preferences');
                          const parsed = savedPrefs ? JSON.parse(savedPrefs) : {};
                          localStorage.setItem('woocommerce_preferences', JSON.stringify({
                            ...parsed,
                            autoSync: wooSettings.autoSync,
                            syncInterval: newInterval,
                            lastSync: wooSettings.lastSync?.toISOString() || null,
                          }));
                        }}
                        className="w-24"
                      />
                    </div>

                    <div className="bg-secondary/50 rounded-lg p-3 sm:p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground text-sm">Manual Sync</p>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            Sync "Processing" orders from WooCommerce now
                          </p>
                          {wooSettings.lastSync && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Last synced: {wooSettings.lastSync.toLocaleString()}
                            </p>
                          )}
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              onClick={handleManualSync}
                              disabled={syncLoading || !wooSettings.isConnected}
                              className="w-full sm:w-auto"
                            >
                              <RefreshCw className={`h-4 w-4 mr-2 ${syncLoading ? 'animate-spin' : ''}`} />
                              {syncLoading ? 'Syncing...' : 'Sync Now'}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {wooSettings.isConnected 
                              ? 'Fetch processing orders from WooCommerce' 
                              : 'Connect to WooCommerce first'}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>

                    <div className="text-sm text-muted-foreground bg-primary/5 rounded-lg p-3">
                      <p className="font-medium text-foreground mb-1">Important Notes:</p>
                      <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm">
                        <li>Only orders with "Processing" status will be imported</li>
                        <li>Orders will be created in the Sales stage</li>
                        <li><strong>WooCommerce API key must have Read/Write permissions</strong></li>
                        <li>If you get 401 errors, regenerate your API key with proper permissions</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Production Stages (Admin Only) */}
          {isAdmin && (
            <TabsContent value="stages">
              <Card>
                <CardHeader>
                  <CardTitle>Production Stages</CardTitle>
                  <CardDescription>Manage production workflow stages</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 sm:space-y-6">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input 
                      placeholder="New stage name..."
                      value={newStageName}
                      onChange={(e) => setNewStageName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddStage()}
                      className="flex-1"
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button onClick={handleAddStage} className="w-full sm:w-auto">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Stage
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Add a new production stage</TooltipContent>
                    </Tooltip>
                  </div>

                  <div className="space-y-2">
                    {productionStages.map((stage, index) => (
                      <div 
                        key={stage.key}
                        className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{index + 1}</Badge>
                          <span className="font-medium text-foreground">{stage.label}</span>
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon-sm"
                              onClick={() => handleRemoveStage(stage.key)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Remove this stage</TooltipContent>
                        </Tooltip>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Security (Admin Only) */}
          {isAdmin && (
            <TabsContent value="security">
              <Card>
                <CardHeader>
                  <CardTitle>Security Settings</CardTitle>
                  <CardDescription>Manage security preferences</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 sm:space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5 min-w-0">
                      <Label className="text-sm">Two-Factor Authentication</Label>
                      <p className="text-xs sm:text-sm text-muted-foreground">Add an extra layer of security</p>
                    </div>
                    <Switch />
                  </div>
                  <Separator />
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5 min-w-0">
                      <Label className="text-sm">Session Timeout</Label>
                      <p className="text-xs sm:text-sm text-muted-foreground">Automatically log out after inactivity</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        {/* Save Button */}
        <div className="flex justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save all settings</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
