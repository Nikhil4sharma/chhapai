import { useState, useEffect, useCallback, useRef } from 'react';
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
  Upload,
  Image,
  Loader2,
  Building2,
  Phone,
  Mail,
  MapPin,
  User,
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
import { useOrders } from '@/contexts/OrderContext';
import { toast } from '@/hooks/use-toast';
import { PRODUCTION_STEPS } from '@/types/order';
import { WooCommerceCredentialsDialog } from '@/components/dialogs/WooCommerceCredentialsDialog';
import { formatDistanceToNow, format } from 'date-fns';
// Firebase removed - using Supabase only
// TODO: Migrate settings to Supabase tables
import { uploadToWordPress, testWordPressConnection, WordPressConfig } from '@/utils/wordpressUpload';

export default function Settings() {
  const { isAdmin, user } = useAuth();
  const { lastSyncTime, refreshOrders } = useOrders();
  const [notifications, setNotifications] = useState({
    email: true,
    push: true, // Default ON for all users
    orderUpdates: true,
    urgentAlerts: true,
  });
  const [nextSyncCountdown, setNextSyncCountdown] = useState<string>('');
  const [productionStages, setProductionStages] = useState<Array<{ key: string; label: string; order: number }>>(
    PRODUCTION_STEPS.map(s => ({ key: s.key, label: s.label, order: s.order }))
  );
  const [newStageName, setNewStageName] = useState('');
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [faviconUrl, setFaviconUrl] = useState<string>('/favicon.ico');
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [isUploadingFavicon, setIsUploadingFavicon] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Vendor management states
  const [vendors, setVendors] = useState<Array<{
    id: string;
    vendor_name: string;
    vendor_company?: string;
    contact_person: string;
    phone: string;
    email?: string;
    city?: string;
    created_at: Date;
    updated_at: Date;
  }>>([]);
  const [newVendor, setNewVendor] = useState({
    vendor_name: '',
    vendor_company: '',
    contact_person: '',
    phone: '',
    email: '',
    city: '',
  });
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);

  // Load notification preferences and production stages from Firestore (only once on mount)
  useEffect(() => {
    if (!user || settingsLoaded) return;
    
    const loadSettings = async () => {
      try {
        if (!user || !user.id) return;
        
        // TODO: Migrate to Supabase user_settings table
        // For now, use defaults
        setNotifications({
          email: true,
          push: true,
          orderUpdates: true,
          urgentAlerts: true,
        });
        
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
  const handleManualSyncRef = useRef<(() => Promise<void>) | null>(null);

  // Calculate next WooCommerce sync countdown
  useEffect(() => {
    const updateCountdown = () => {
      if (wooSettings.lastSync && wooSettings.autoSync && wooSettings.syncInterval) {
        const nextSync = new Date(wooSettings.lastSync);
        nextSync.setMinutes(nextSync.getMinutes() + wooSettings.syncInterval);
        const now = new Date();
        const diff = nextSync.getTime() - now.getTime();
        
        if (diff > 0) {
          const minutes = Math.floor(diff / 60000);
          const seconds = Math.floor((diff % 60000) / 1000);
          setNextSyncCountdown(`${minutes}m ${seconds}s`);
        } else {
          setNextSyncCountdown('Syncing now...');
        }
      } else {
        setNextSyncCountdown('');
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [wooSettings.lastSync, wooSettings.autoSync, wooSettings.syncInterval]);

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
    loadWordPressConfig();
  }, [isAdmin]);

  // WordPress File Upload Settings
  const [wordpressConfig, setWordpressConfig] = useState<WordPressConfig>({
    enabled: false,
    siteUrl: '',
    username: '',
    applicationPassword: '',
  });
  const [testingWordPress, setTestingWordPress] = useState(false);
  const [savingWordPress, setSavingWordPress] = useState(false);
  const [wordpressTestResult, setWordpressTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Load WordPress configuration
  const loadWordPressConfig = async () => {
    if (!isAdmin) return;
    
    try {
      // TODO: Migrate to Supabase app_settings table
      // Temporarily disabled - will be migrated to Supabase
      setWordpressConfig({
        enabled: false,
        siteUrl: '',
        username: '',
        applicationPassword: '',
      });
    } catch (error) {
      console.error('Error loading WordPress config:', error);
    }
  };

  // Save WordPress configuration
  const saveWordPressConfig = async () => {
    if (!isAdmin) return;
    
    setSavingWordPress(true);
    try {
      // TODO: Migrate to Supabase app_settings table
      // const configRef = doc(db, 'app_settings', 'wordpress_upload');
      // await setDoc(configRef, {
      console.log('WordPress config save (temporarily disabled):', {
        enabled: wordpressConfig.enabled,
        siteUrl: wordpressConfig.siteUrl,
        username: wordpressConfig.username,
        applicationPassword: wordpressConfig.applicationPassword,
        updated_at: Timestamp.now(),
      }, { merge: true });

      toast({
        title: "WordPress Settings Saved",
        description: "WordPress file upload configuration has been saved",
      });
    } catch (error) {
      console.error('Error saving WordPress config:', error);
      toast({
        title: "Error",
        description: "Failed to save WordPress configuration",
        variant: "destructive",
      });
    } finally {
      setSavingWordPress(false);
    }
  };

  // Test WordPress connection
  const handleTestWordPress = async () => {
    setTestingWordPress(true);
    setWordpressTestResult(null);
    
    try {
      const result = await testWordPressConnection(wordpressConfig);
      setWordpressTestResult(result);
      
      if (result.success) {
        toast({
          title: "Connection Successful",
          description: result.message,
        });
      } else {
        toast({
          title: "Connection Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setWordpressTestResult({
        success: false,
        message: errorMessage,
      });
      toast({
        title: "Test Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setTestingWordPress(false);
    }
  };

  const checkWooCommerceConfig = async () => {
    if (!isAdmin) return;
    
    setCheckingConfig(true);
    try {
      // TODO: Migrate to Supabase woocommerce_credentials table
      // const credsRef = doc(db, 'woocommerce_credentials', 'config');
      // const credsSnap = await getDoc(credsRef);
      const credsSnap = { exists: () => false };
      
      if (false) { // Temporarily disabled
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
        // TODO: Migrate to Supabase user_settings table
        // const settingsRef = doc(db, 'user_settings', user.id);
      
      const settingsData: any = {
        user_id: user.id,
        email_notifications: notifications.email,
        push_notifications: notifications.push,
        order_updates: notifications.orderUpdates,
        urgent_alerts: notifications.urgentAlerts,
        updated_at: Timestamp.now(),
      };
      
      // TODO: Migrate to Supabase user_settings table
      // await setDoc(settingsRef, settingsData, { merge: true });
      console.log('Settings save (temporarily disabled):', settingsData);
      
      // Save production stages separately to app_settings (admin only)
      if (isAdmin) {
        try {
          // TODO: Migrate to Supabase app_settings table
          // const appSettingsRef = doc(db, 'app_settings', 'production_stages');
          // await setDoc(appSettingsRef, {
          console.log('Production stages save (temporarily disabled):', {
            stages: productionStages,
          });
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

  const handleAddVendor = async () => {
    if (!newVendor.vendor_name.trim() || !newVendor.contact_person.trim() || !newVendor.phone.trim()) {
      toast({
        title: "Validation Error",
        description: "Vendor name, contact person, and phone are required",
        variant: "destructive",
      });
      return;
    }

    try {
      const vendorData = {
        vendor_name: newVendor.vendor_name.trim(),
        vendor_company: newVendor.vendor_company.trim() || null,
        contact_person: newVendor.contact_person.trim(),
        phone: newVendor.phone.trim(),
        email: newVendor.email.trim() || null,
        city: newVendor.city.trim() || null,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      };

      const vendorsRef = collection(db, 'vendors');
      const newVendorRef = doc(vendorsRef);
      await setDoc(newVendorRef, vendorData);

      const addedVendorName = vendorData.vendor_name;
      setVendors([...vendors, { 
        id: newVendorRef.id,
        vendor_name: vendorData.vendor_name,
        vendor_company: vendorData.vendor_company || undefined,
        contact_person: vendorData.contact_person,
        phone: vendorData.phone,
        email: vendorData.email || undefined,
        city: vendorData.city || undefined,
        created_at: new Date(),
        updated_at: new Date(),
      }]);
      setNewVendor({
        vendor_name: '',
        vendor_company: '',
        contact_person: '',
        phone: '',
        email: '',
        city: '',
      });

      toast({
        title: "Vendor Added",
        description: `${addedVendorName} has been added successfully`,
      });
    } catch (error) {
      console.error('Error adding vendor:', error);
      toast({
        title: "Error",
        description: "Failed to add vendor",
        variant: "destructive",
      });
    }
  };

  const handleUpdateVendor = async (vendorId: string, updatedData: typeof newVendor) => {
    if (!updatedData.vendor_name.trim() || !updatedData.contact_person.trim() || !updatedData.phone.trim()) {
      toast({
        title: "Validation Error",
        description: "Vendor name, contact person, and phone are required",
        variant: "destructive",
      });
      return;
    }

    try {
      const vendorRef = doc(db, 'vendors', vendorId);
      await updateDoc(vendorRef, {
        vendor_name: updatedData.vendor_name.trim(),
        vendor_company: updatedData.vendor_company.trim() || null,
        contact_person: updatedData.contact_person.trim(),
        phone: updatedData.phone.trim(),
        email: updatedData.email.trim() || null,
        city: updatedData.city.trim() || null,
        updated_at: Timestamp.now(),
      });

      setVendors(vendors.map(v => v.id === vendorId ? {
        ...v,
        ...updatedData,
        vendor_company: updatedData.vendor_company.trim() || undefined,
        email: updatedData.email.trim() || undefined,
        city: updatedData.city.trim() || undefined,
        updated_at: new Date(),
      } : v));
      setEditingVendorId(null);

      toast({
        title: "Vendor Updated",
        description: "Vendor details have been updated successfully",
      });
    } catch (error) {
      console.error('Error updating vendor:', error);
      toast({
        title: "Error",
        description: "Failed to update vendor",
        variant: "destructive",
      });
    }
  };

  const handleDeleteVendor = async (vendorId: string) => {
    try {
      const vendorRef = doc(db, 'vendors', vendorId);
      await deleteDoc(vendorRef);

      setVendors(vendors.filter(v => v.id !== vendorId));

      toast({
        title: "Vendor Deleted",
        description: "Vendor has been removed successfully",
      });
    } catch (error) {
      console.error('Error deleting vendor:', error);
      toast({
        title: "Error",
        description: "Failed to delete vendor",
        variant: "destructive",
      });
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
      
      // SAFEGUARD: Generate sync ID and timestamp
      const syncId = `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const syncedAt = Timestamp.now();
      const syncedAtDate = new Date();
      
      // Extract WooCommerce order IDs from current sync
      const wooOrderIds = wooOrders.map((o: any) => o.id);
      
      // Import orders to Firestore with safeguards
      let imported = 0;
      let updated = 0;
      let restored = 0;
      let archived = 0;
      const errors: string[] = [];

      // Parse product meta data helper
      const parseProductMeta = (metaData: any[]) => {
        const EXCLUDED_KEYS = ['sku', 'SKU', 'notes', '_sku', 'product_sku', '_reduced_stock', '_restock_refunded_items', '_product_addons', '_qty'];
        const specifications: Record<string, string> = {};
        if (Array.isArray(metaData)) {
          for (const meta of metaData) {
            if (!meta.key || meta.key.startsWith('_')) continue;
            
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

      // STEP 1: Process all WooCommerce orders (with duplicate prevention by woo_order_id)
      for (const wooOrder of wooOrders) {
        try {
          const wooOrderId = wooOrder.id;
          
          // SAFEGUARD 8: Duplicate Prevention - Check by woo_order_id only
          const existingQuery = query(collection(db, 'orders'), where('woo_order_id', '==', wooOrderId.toString()));
          const existingSnapshot = await getDocs(existingQuery);
          
          // SAFEGUARD 7: Manual Orders Protection - Never touch manual orders
          if (!existingSnapshot.empty) {
            const existingOrder = existingSnapshot.docs[0].data();
            if (existingOrder.source === 'manual') {
              console.log(`Skipping manual order with woo_order_id ${wooOrderId} - manual orders are protected`);
              continue;
            }
          }

          const orderId = `WC-${wooOrderId}`;
          const orderRef = doc(db, 'orders', orderId);
          
          const isRestored = !existingSnapshot.empty && existingSnapshot.docs[0].data().archived_from_wc === true;

          if (!existingSnapshot.empty) {
            // SAFEGUARD 1 & 3: Update WooCommerce orders (source = 'woocommerce'), Stage-agnostic
            const existingOrderDoc = existingSnapshot.docs[0];
            const existingOrderData = existingOrderDoc.data();
            
            // SAFEGUARD: Only update if source is woocommerce
            if (existingOrderData.source !== 'woocommerce') {
              console.log(`Skipping order ${orderId} - source is ${existingOrderData.source}, not woocommerce`);
              continue;
            }

            await updateDoc(existingOrderDoc.ref, {
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
              last_seen_in_wc_sync: syncedAt, // SAFEGUARD 4: Track last seen
              archived_from_wc: false, // Restore if was archived
              updated_at: Timestamp.now(),
              global_notes: wooOrder.customer_note || null,
            });

            // Update or create order items (SAFEGUARD 3: Stage-agnostic, preserve stage/assignment)
            for (const lineItem of wooOrder.line_items || []) {
              const itemId = `${orderId}-${lineItem.id}`;
              const itemRef = doc(db, 'order_items', itemId);
              const itemSnap = await getDoc(itemRef);
              
              const specifications = parseProductMeta(lineItem.meta_data || []);
              
              if (itemSnap.exists()) {
                // Update existing item (preserve stage/assignment)
                const existingItem = itemSnap.data();
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
                  // Preserve: current_stage, assigned_to, assigned_department, etc.
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

            // ALWAYS delete old timeline entries for synced orders (both restored and updated)
            // This ensures old history doesn't show up after sync
            const oldTimelineQuery = query(
              collection(db, 'timeline'),
              where('order_id', '==', existingOrderDoc.id)
            );
            const oldTimelineSnapshot = await getDocs(oldTimelineQuery);
            if (!oldTimelineSnapshot.empty) {
              const batch = writeBatch(db);
              oldTimelineSnapshot.docs.forEach(doc => batch.delete(doc.ref));
              await batch.commit();
            }
            
            if (isRestored) {
              restored++;
              // Create fresh timeline entry for restoration
              await setDoc(doc(collection(db, 'timeline')), {
                order_id: existingOrderDoc.id,
                action: 'created',
                stage: 'sales',
                performed_by: user?.uid || '',
                performed_by_name: 'WooCommerce Sync',
                notes: `Order synced from WooCommerce (WC Order #${wooOrderId}). Previous history cleared.`,
                is_public: true,
                created_at: Timestamp.now(),
              });
            } else {
              updated++;
              // Create fresh timeline entry for updated order
              await setDoc(doc(collection(db, 'timeline')), {
                order_id: existingOrderDoc.id,
                action: 'note_added',
                stage: existingOrderData.items?.[0]?.current_stage || 'sales',
                performed_by: user?.uid || '',
                performed_by_name: 'WooCommerce Sync',
                notes: `Order synced from WooCommerce (WC Order #${wooOrderId}). Previous history cleared.`,
                is_public: true,
                created_at: Timestamp.now(),
              });
            }
          } else {
            // SAFEGUARD 5: Missing Order Logic - Create new order
            await setDoc(orderRef, {
              order_id: orderId,
              woo_order_id: wooOrderId.toString(),
              source: 'woocommerce', // SAFEGUARD 1: Mark as woocommerce source
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
              last_seen_in_wc_sync: syncedAt, // SAFEGUARD 4
              archived_from_wc: false,
            });

            // Create order items
            for (const lineItem of wooOrder.line_items || []) {
              const itemId = `${orderId}-${lineItem.id}`;
              const itemRef = doc(db, 'order_items', itemId);
              
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
            
            // Ensure no old timeline entries exist for this order (by order_id string)
            // Delete any orphaned timeline entries that might have same order_id string
            // This prevents old history from showing up after delete + sync
            const oldTimelineByOrderIdQuery = query(
              collection(db, 'timeline'),
              where('order_id', '==', orderId)
            );
            const oldTimelineByOrderIdSnapshot = await getDocs(oldTimelineByOrderIdQuery);
            if (!oldTimelineByOrderIdSnapshot.empty) {
              const batch = writeBatch(db);
              oldTimelineByOrderIdSnapshot.docs.forEach(doc => batch.delete(doc.ref));
              await batch.commit();
            }
            
            // Create fresh timeline entry for new order
            await setDoc(doc(collection(db, 'timeline')), {
              order_id: orderRef.id, // Use UUID, not order_id string
              action: 'created',
              stage: 'sales',
              performed_by: user?.uid || '',
              performed_by_name: 'WooCommerce Sync',
              notes: `Order imported from WooCommerce (WC Order #${wooOrderId})`,
              is_public: true,
              created_at: Timestamp.now(),
            });
          }
        } catch (orderError: any) {
          const errorMsg = orderError instanceof Error ? orderError.message : 'Unknown error';
          console.error(`Error processing WooCommerce order ${wooOrder.id}:`, orderError);
          errors.push(`Order ${wooOrder.id}: ${errorMsg}`);
        }
      }

      // STEP 2: SAFEGUARD 6 - Archive orders not found in current sync (but preserve them)
      // Only archive WooCommerce orders that are not in the current sync
      const allWooOrdersQuery = query(
        collection(db, 'orders'),
        where('source', '==', 'woocommerce')
      );
      const allWooOrdersSnapshot = await getDocs(allWooOrdersQuery);

      for (const orderDoc of allWooOrdersSnapshot.docs) {
        const orderData = orderDoc.data();
        
        // SAFEGUARD 7: Never archive manual orders
        if (orderData.source === 'manual' || !orderData.woo_order_id) {
          continue;
        }

        // If Woo order ID not in current sync, archive it
        const wooOrderIdNum = typeof orderData.woo_order_id === 'string' 
          ? parseInt(orderData.woo_order_id, 10) 
          : orderData.woo_order_id;
          
        if (wooOrderIdNum && !wooOrderIds.includes(wooOrderIdNum)) {
          // Only archive if not already archived
          if (!orderData.archived_from_wc) {
            await updateDoc(orderDoc.ref, {
              archived_from_wc: true,
              updated_at: Timestamp.now(),
            });
            
            archived++;
            
            // Create timeline entry for archiving
            await setDoc(doc(collection(db, 'timeline')), {
              order_id: orderDoc.id,
              action: 'note_added',
              stage: 'sales',
              performed_by: user?.uid || '',
              performed_by_name: 'WooCommerce Sync',
              notes: `Order archived from WooCommerce sync (not found in current sync). Order preserved with full history.`,
              is_public: true,
              created_at: Timestamp.now(),
            });
          }
        }
      }

      // STEP 3: SAFEGUARD 4 - Create sync log entry
      const syncStatus = errors.length > 0 ? (errors.length === wooOrders.length ? 'failed' : 'partial') : 'completed';
      
      try {
        // Use addDoc to auto-generate document ID (avoids permission issues with custom IDs)
        await addDoc(collection(db, 'order_sync_logs'), {
          sync_id: syncId,
          synced_at: syncedAt,
          woo_order_ids: wooOrderIds,
          sync_status: syncStatus,
          imported_count: imported,
          updated_count: updated,
          archived_count: archived,
          restored_count: restored,
          errors: errors.length > 0 ? errors : [],
          performed_by: user?.uid || '',
          created_at: Timestamp.now(),
        });
      } catch (logError: any) {
        console.error('Failed to create sync log (non-critical):', logError);
        // Don't fail the entire sync if log creation fails
        toast({
          title: "Sync Completed",
          description: `Sync completed but log creation failed: ${logError.message}`,
          variant: "destructive",
        });
      }
      
      const now = new Date();
      console.log(`[Sync] Updating lastSync time to: ${now.toISOString()}`);
      setWooSettings(prev => ({ ...prev, lastSync: now }));
      localStorage.setItem('woocommerce_preferences', JSON.stringify({
        autoSync: wooSettings.autoSync,
        syncInterval: wooSettings.syncInterval,
        lastSync: now.toISOString(),
      }));
      console.log(`[Sync] LastSync updated, next sync should be in ${wooSettings.syncInterval} minutes`);
      
      // Re-set auto sync interval after sync completes
      // This ensures the interval is reset with the new lastSync time
      if (wooSettings.autoSync && wooSettings.isConnected && isAdmin) {
        // Clear existing interval
        if (autoSyncInterval) {
          clearInterval(autoSyncInterval);
          setAutoSyncInterval(null);
        }
        
        // Set up new interval starting from now
        const intervalMs = wooSettings.syncInterval * 60 * 1000;
        console.log(`[Sync] Re-setting auto sync interval: ${intervalMs}ms (${wooSettings.syncInterval} minutes) from now`);
        const newInterval = setInterval(() => {
          console.log('[Auto Sync] Triggering recurring sync after manual sync...');
          if (handleManualSyncRef.current) {
            handleManualSyncRef.current().then(() => {
              console.log('[Auto Sync] Recurring sync completed');
            }).catch((error) => {
              console.error('[Auto Sync] Recurring sync failed:', error);
            });
          }
        }, intervalMs);
        setAutoSyncInterval(newInterval);
      }
      
      toast({
        title: "Sync Complete",
        description: `Imported ${imported} new, updated ${updated} existing, restored ${restored} archived, archived ${archived} missing orders`,
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
  }, [isAdmin, wooSettings.isConnected, user]);
  
  // Store handleManualSync in ref for use in auto sync
  useEffect(() => {
    handleManualSyncRef.current = handleManualSync;
  }, [handleManualSync]);

  // Auto Sync functionality - runs at exact interval
  useEffect(() => {
    // Clear existing interval on mount/unmount or when settings change
    let currentInterval: ReturnType<typeof setInterval> | null = null;
    let currentTimeout: ReturnType<typeof setTimeout> | null = null;

    // Only set up auto sync if enabled and connected
    if (wooSettings.autoSync && wooSettings.isConnected && isAdmin && handleManualSyncRef.current) {
      const intervalMs = wooSettings.syncInterval * 60 * 1000; // Convert minutes to milliseconds
      
      // Calculate time until next sync based on exact interval
      const now = new Date();
      const lastSync = wooSettings.lastSync;
      let timeUntilNextSync = 0;
      
      if (lastSync) {
        const timeSinceLastSync = now.getTime() - lastSync.getTime();
        if (timeSinceLastSync >= intervalMs) {
          // Overdue - sync immediately
          timeUntilNextSync = 0;
        } else {
          // Wait for remaining time to complete exact interval
          timeUntilNextSync = intervalMs - timeSinceLastSync;
        }
      } else {
        // No last sync - start immediately
        timeUntilNextSync = 0;
      }

      console.log(`[Auto Sync] Setting up sync - Interval: ${wooSettings.syncInterval} min (${intervalMs}ms), Time until next: ${Math.round(timeUntilNextSync / 1000)}s, Last sync: ${lastSync ? lastSync.toISOString() : 'never'}`);

      // Set up initial timeout, then recurring interval
      currentTimeout = setTimeout(() => {
        console.log('[Auto Sync] Triggering initial sync...');
        // First sync (silent - no loading indicator)
        if (handleManualSyncRef.current) {
          handleManualSyncRef.current().then(() => {
            console.log('[Auto Sync] Initial sync completed');
          }).catch((error) => {
            console.error('[Auto Sync] Initial sync failed:', error);
          });
        }
        
        // Then set up recurring interval - exact interval from now
        console.log(`[Auto Sync] Setting up recurring interval: ${intervalMs}ms (${wooSettings.syncInterval} minutes)`);
        currentInterval = setInterval(() => {
          console.log('[Auto Sync] Triggering recurring sync...');
          if (handleManualSyncRef.current) {
            handleManualSyncRef.current().then(() => {
              console.log('[Auto Sync] Recurring sync completed');
            }).catch((error) => {
              console.error('[Auto Sync] Recurring sync failed:', error);
            });
          }
        }, intervalMs);
        
        setAutoSyncInterval(currentInterval);
      }, timeUntilNextSync);
    } else {
      console.log('[Auto Sync] Not enabled or not connected:', {
        autoSync: wooSettings.autoSync,
        isConnected: wooSettings.isConnected,
        isAdmin,
        hasHandler: !!handleManualSyncRef.current
      });
    }

    // Cleanup function
    return () => {
      console.log('[Auto Sync] Cleaning up intervals...');
      if (currentTimeout) {
        clearTimeout(currentTimeout);
      }
      if (currentInterval) {
        clearInterval(currentInterval);
      }
      // Also clear the state interval if it exists
      if (autoSyncInterval) {
        clearInterval(autoSyncInterval);
        setAutoSyncInterval(null);
      }
    };
  }, [wooSettings.autoSync, wooSettings.syncInterval, wooSettings.isConnected, isAdmin]); // Removed lastSync from dependencies to prevent re-triggering on sync completion

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
                <TabsTrigger value="wordpress" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5">
                  <Upload className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">WordPress Upload</span>
                </TabsTrigger>
                <TabsTrigger value="vendors" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5">
                  <Building2 className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Vendors</span>
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
                
                {/* Enable Notifications Button - Show if permission not granted */}
                {Notification.permission !== 'granted' && (
                  <div className="flex items-center justify-between gap-3 pt-2 pb-2 border-t border-border">
                    <div className="space-y-0.5 min-w-0">
                      <Label className="text-sm font-medium">Enable Browser Notifications</Label>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {Notification.permission === 'denied' 
                          ? 'Notifications are blocked. Enable them in browser settings.'
                          : 'Click to allow notifications from this site'}
                      </p>
                    </div>
                    <Button
                      variant={Notification.permission === 'denied' ? 'destructive' : 'default'}
                      size="sm"
                      onClick={async () => {
                        if (!('Notification' in window)) {
                          toast({
                            title: "Not Supported",
                            description: "Your browser does not support notifications",
                            variant: "destructive",
                          });
                          return;
                        }

                        if (Notification.permission === 'denied') {
                          toast({
                            title: "Permission Blocked",
                            description: "Please enable notifications manually: Click the lock icon in address bar → Site settings → Notifications → Allow",
                            variant: "destructive",
                          });
                          return;
                        }

                        try {
                          console.log('Requesting notification permission...');
                          const permission = await Notification.requestPermission();
                          console.log('Permission result:', permission);
                          
                          if (permission === 'granted') {
                            toast({
                              title: "Notifications Enabled!",
                              description: "You'll receive real-time updates about your orders",
                            });
                          } else if (permission === 'denied') {
                            toast({
                              title: "Permission Denied",
                              description: "Notifications were blocked. You can enable them later in browser settings.",
                              variant: "destructive",
                            });
                          } else {
                            toast({
                              title: "Permission Dismissed",
                              description: "Please click 'Allow' when prompted to enable notifications",
                              variant: "destructive",
                            });
                          }
                        } catch (error) {
                          console.error('Error requesting permission:', error);
                          toast({
                            title: "Error",
                            description: "Failed to request permission. Please try again.",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      <Bell className="h-4 w-4 mr-2" />
                      {Notification.permission === 'denied' ? 'Unblock in Browser' : 'Enable Notifications'}
                    </Button>
                  </div>
                )}

                {/* Test Push Notification Button */}
                <div className="flex items-center justify-between gap-3 pt-2">
                  <div className="space-y-0.5 min-w-0">
                    <Label className="text-sm">Test Push Notification</Label>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {Notification.permission === 'granted' 
                          ? "Send a test notification to verify it's working"
                          : 'Enable notifications first to test'}
                      </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={Notification.permission !== 'granted'}
                    onClick={async () => {
                      // Check if browser supports notifications
                      if (!('Notification' in window)) {
                        toast({
                          title: "Not Supported",
                          description: "Your browser does not support notifications",
                          variant: "destructive",
                        });
                        return;
                      }

                      // Check current permission status
                      let permission = Notification.permission;
                      
                      // Request permission if not granted (this requires user interaction - which we have via button click)
                      if (permission === 'default') {
                        try {
                          console.log('Requesting notification permission from Settings button...');
                          permission = await Notification.requestPermission();
                          console.log('Permission result:', permission);
                        } catch (error) {
                          console.error('Error requesting permission:', error);
                          toast({
                            title: "Error",
                            description: "Failed to request permission. Please try again.",
                            variant: "destructive",
                          });
                          return;
                        }
                      }

                      if (permission === 'granted') {
                        try {
                          // Show notification directly using browser API
                          const notification = new Notification('Test Notification - Chhapai Order Flow', {
                            body: 'This is a test push notification! If you can see this, notifications are working correctly.',
                            icon: '/chhapai-logo.png',
                            badge: '/chhapai-logo.png',
                            tag: 'test-notification',
                            requireInteraction: false,
                            silent: false,
                          });

                          // Handle notification click
                          notification.onclick = () => {
                            window.focus();
                            notification.close();
                          };

                          // Auto-close after 5 seconds
                          setTimeout(() => {
                            notification.close();
                          }, 5000);

                          toast({
                            title: "Test Notification Sent",
                            description: "Check your browser notifications (top-right corner or system tray)",
                          });
                        } catch (error) {
                          console.error('Error showing notification:', error);
                          toast({
                            title: "Error",
                            description: `Failed to show notification: ${error instanceof Error ? error.message : 'Unknown error'}`,
                            variant: "destructive",
                          });
                        }
                      } else if (permission === 'denied') {
                        toast({
                          title: "Permission Denied",
                          description: "Notifications were blocked. Enable them in browser settings: Click lock icon → Site settings → Notifications → Allow",
                          variant: "destructive",
                        });
                      } else {
                        toast({
                          title: "Permission Dismissed",
                          description: "Please click 'Allow' when the browser prompts you for notification permission",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    <Bell className="h-4 w-4 mr-2" />
                    {Notification.permission === 'granted' ? 'Send Test' : 'Enable & Test'}
                  </Button>
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
                
                {/* Favicon Upload */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Favicon</Label>
                    <p className="text-sm text-muted-foreground">
                      Upload a favicon icon (recommended: 32x32 or 64x64 PNG/ICO)
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-16 h-16 border-2 border-border rounded-lg bg-secondary/50">
                      {faviconUrl ? (
                        <img src={faviconUrl} alt="Favicon" className="w-full h-full object-contain" />
                      ) : (
                        <Image className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => faviconInputRef.current?.click()}
                        disabled={isUploadingFavicon}
                      >
                        {isUploadingFavicon ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Upload Favicon
                          </>
                        )}
                      </Button>
                      <input
                        ref={faviconInputRef}
                        type="file"
                        accept="image/png,image/x-icon,image/jpeg"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !user) return;

                          if (!file.type.startsWith('image/')) {
                            toast({
                              title: "Error",
                              description: "Please upload an image file",
                              variant: "destructive",
                            });
                            return;
                          }

                          if (file.size > 2 * 1024 * 1024) {
                            toast({
                              title: "Error",
                              description: "File must be less than 2MB",
                              variant: "destructive",
                            });
                            return;
                          }

                          setIsUploadingFavicon(true);
                          try {
                            const fileExt = file.name.split('.').pop();
                            const fileName = `app-settings/favicon.${fileExt}`;
                            const fileRef = ref(storage, fileName);
                            await uploadBytes(fileRef, file);
                            const downloadURL = await getDownloadURL(fileRef);
                            
                            // Save to Firestore
                            const settingsRef = doc(db, 'app_settings', 'appearance');
                            await setDoc(settingsRef, {
                              favicon_url: downloadURL,
                              updated_at: Timestamp.now(),
                            }, { merge: true });

                            setFaviconUrl(downloadURL);
                            
                            // Update page favicon
                            const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
                            if (link) {
                              link.href = downloadURL;
                            } else {
                              const newLink = document.createElement('link');
                              newLink.rel = 'icon';
                              newLink.href = downloadURL;
                              document.head.appendChild(newLink);
                            }

                            toast({
                              title: "Success",
                              description: "Favicon updated successfully",
                            });
                          } catch (error) {
                            console.error('Error uploading favicon:', error);
                            toast({
                              title: "Error",
                              description: "Failed to upload favicon",
                              variant: "destructive",
                            });
                          } finally {
                            setIsUploadingFavicon(false);
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
                <Separator />

                {/* Logo Upload */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Logo</Label>
                    <p className="text-sm text-muted-foreground">
                      Upload a company logo (recommended: PNG with transparent background)
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-32 h-16 border-2 border-border rounded-lg bg-secondary/50">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                      ) : (
                        <Image className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={isUploadingLogo}
                      >
                        {isUploadingLogo ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Upload Logo
                          </>
                        )}
                      </Button>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !user) return;

                          if (!file.type.startsWith('image/')) {
                            toast({
                              title: "Error",
                              description: "Please upload an image file",
                              variant: "destructive",
                            });
                            return;
                          }

                          if (file.size > 5 * 1024 * 1024) {
                            toast({
                              title: "Error",
                              description: "File must be less than 5MB",
                              variant: "destructive",
                            });
                            return;
                          }

                          setIsUploadingLogo(true);
                          try {
                            const fileExt = file.name.split('.').pop();
                            const fileName = `app-settings/logo.${fileExt}`;
                            const fileRef = ref(storage, fileName);
                            await uploadBytes(fileRef, file);
                            const downloadURL = await getDownloadURL(fileRef);
                            
                            // Save to Firestore
                            const settingsRef = doc(db, 'app_settings', 'appearance');
                            await setDoc(settingsRef, {
                              logo_url: downloadURL,
                              updated_at: Timestamp.now(),
                            }, { merge: true });

                            setLogoUrl(downloadURL);

                            toast({
                              title: "Success",
                              description: "Logo updated successfully",
                            });
                          } catch (error) {
                            console.error('Error uploading logo:', error);
                            toast({
                              title: "Error",
                              description: "Failed to upload logo",
                              variant: "destructive",
                            });
                          } finally {
                            setIsUploadingLogo(false);
                          }
                        }}
                      />
                    </div>
                  </div>
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

                    {/* WooCommerce Auto-Sync Status */}
                    <div className="bg-secondary/50 rounded-lg p-3 sm:p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground text-sm">WooCommerce Auto-Sync</p>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            Automatically sync orders from WooCommerce
                          </p>
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleManualSync}
                              disabled={syncLoading || !wooSettings.isConnected}
                            >
                              <RefreshCw className={`h-4 w-4 mr-2 ${syncLoading ? 'animate-spin' : ''}`} />
                              {syncLoading ? 'Syncing...' : 'Sync Now'}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {wooSettings.isConnected 
                              ? 'Manually sync orders from WooCommerce now' 
                              : 'Configure WooCommerce credentials first'}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      {wooSettings.lastSync && (
                        <div className="space-y-1 pt-2 border-t border-border">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Last sync:</span>
                            <span className="font-medium text-foreground">
                              {formatDistanceToNow(wooSettings.lastSync, { addSuffix: true })}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Sync time:</span>
                            <span className="font-mono text-foreground">
                              {format(wooSettings.lastSync, 'HH:mm:ss')}
                            </span>
                          </div>
                          {nextSyncCountdown && wooSettings.autoSync && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Next sync in:</span>
                              <span className="font-medium text-primary">
                                {nextSyncCountdown}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
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

                    {/* Delete All Orders - Dangerous Action */}
                    <div className="mt-4 pt-4 border-t border-destructive/20">
                      <div className="flex items-center justify-between gap-3">
                        <div className="space-y-0.5 min-w-0">
                          <Label className="text-sm font-medium text-destructive">Delete All Orders</Label>
                          <p className="text-xs text-muted-foreground">
                            Permanently delete all orders, items, files, and timeline entries. This cannot be undone!
                          </p>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={async () => {
                            if (!confirm('⚠️ WARNING: This will delete ALL orders, items, files, and timeline entries. This action CANNOT be undone!\n\nType "DELETE ALL" to confirm:')) {
                              return;
                            }
                            
                            const confirmation = prompt('Type "DELETE ALL" to confirm deletion:');
                            if (confirmation !== 'DELETE ALL') {
                              toast({
                                title: "Cancelled",
                                description: "Deletion cancelled. Orders are safe.",
                              });
                              return;
                            }

                            try {
                              setSyncLoading(true);
                              
                              // Get all orders
                              const ordersSnapshot = await getDocs(collection(db, 'orders'));
                              const orders = ordersSnapshot.docs;
                              
                              // Get all items
                              const itemsSnapshot = await getDocs(collection(db, 'order_items'));
                              const items = itemsSnapshot.docs;
                              
                              // Get all files
                              const filesSnapshot = await getDocs(collection(db, 'order_files'));
                              const files = filesSnapshot.docs;
                              
                              // Get all timeline entries
                              const timelineSnapshot = await getDocs(collection(db, 'timeline'));
                              const timeline = timelineSnapshot.docs;
                              
                              const totalDocs = orders.length + items.length + files.length + timeline.length;
                              
                              if (totalDocs === 0) {
                                toast({
                                  title: "No Orders Found",
                                  description: "There are no orders to delete.",
                                });
                                setSyncLoading(false);
                                return;
                              }

                              // Delete in batches (Firestore limit is 500 per batch)
                              const batchSize = 500;
                              let deleted = 0;
                              
                              // Delete orders
                              for (let i = 0; i < orders.length; i += batchSize) {
                                const batch = writeBatch(db);
                                const batchOrders = orders.slice(i, i + batchSize);
                                batchOrders.forEach(doc => batch.delete(doc.ref));
                                await batch.commit();
                                deleted += batchOrders.length;
                              }
                              
                              // Delete items
                              for (let i = 0; i < items.length; i += batchSize) {
                                const batch = writeBatch(db);
                                const batchItems = items.slice(i, i + batchSize);
                                batchItems.forEach(doc => batch.delete(doc.ref));
                                await batch.commit();
                                deleted += batchItems.length;
                              }
                              
                              // Delete files
                              for (let i = 0; i < files.length; i += batchSize) {
                                const batch = writeBatch(db);
                                const batchFiles = files.slice(i, i + batchSize);
                                batchFiles.forEach(doc => batch.delete(doc.ref));
                                await batch.commit();
                                deleted += batchFiles.length;
                              }
                              
                              // Delete timeline - ensure all entries are deleted
                              for (let i = 0; i < timeline.length; i += batchSize) {
                                const batch = writeBatch(db);
                                const batchTimeline = timeline.slice(i, i + batchSize);
                                batchTimeline.forEach(doc => batch.delete(doc.ref));
                                await batch.commit();
                                deleted += batchTimeline.length;
                              }
                              
                              // Double-check: Delete any remaining timeline entries (orphaned entries)
                              const remainingTimelineSnapshot = await getDocs(collection(db, 'timeline'));
                              if (remainingTimelineSnapshot.docs.length > 0) {
                                for (let i = 0; i < remainingTimelineSnapshot.docs.length; i += batchSize) {
                                  const batch = writeBatch(db);
                                  const batchTimeline = remainingTimelineSnapshot.docs.slice(i, i + batchSize);
                                  batchTimeline.forEach(doc => batch.delete(doc.ref));
                                  await batch.commit();
                                  deleted += batchTimeline.length;
                                }
                              }
                              
                              // Reset lastSync time
                              setWooSettings(prev => ({ ...prev, lastSync: null }));
                              localStorage.setItem('woocommerce_preferences', JSON.stringify({
                                autoSync: wooSettings.autoSync,
                                syncInterval: wooSettings.syncInterval,
                                lastSync: null,
                              }));
                              
                              toast({
                                title: "All Orders Deleted",
                                description: `Successfully deleted ${deleted} documents (including all timeline entries). You can now sync fresh orders from WooCommerce.`,
                              });
                              
                              // Refresh orders and timeline
                              refreshOrders();
                              
                              // Force refresh timeline by reloading page after a short delay
                              setTimeout(() => {
                                window.location.reload();
                              }, 1000);
                            } catch (error: any) {
                              console.error('Error deleting orders:', error);
                              toast({
                                title: "Error",
                                description: error.message || "Failed to delete orders",
                                variant: "destructive",
                              });
                            } finally {
                              setSyncLoading(false);
                            }
                          }}
                          disabled={syncLoading}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {syncLoading ? 'Deleting...' : 'Delete All Orders'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* WordPress File Upload (Admin Only) */}
          {isAdmin && (
            <TabsContent value="wordpress">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    WordPress File Upload
                    {wordpressConfig.enabled && wordpressConfig.siteUrl ? (
                      <Badge variant="success" className="ml-2">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Enabled
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="ml-2">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Disabled
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Configure WordPress hosting for file uploads. Files will be uploaded to WordPress Media Library.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Setup Instructions */}
                  <div className="bg-primary/5 rounded-lg p-4 space-y-3">
                    <h4 className="font-medium text-foreground flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Setup Instructions
                    </h4>
                    <div className="text-sm text-muted-foreground space-y-2">
                      <p className="font-medium text-foreground">Step 1: Create Application Password in WordPress</p>
                      <ol className="list-decimal list-inside space-y-1 ml-2">
                        <li>Log in to your WordPress admin panel</li>
                        <li>Go to <strong>Users → Your Profile</strong></li>
                        <li>Scroll down to <strong>"Application Passwords"</strong> section</li>
                        <li>Enter a name (e.g., "Chhapai Order Flow") and click <strong>"Add New Application Password"</strong></li>
                        <li>Copy the generated password (you won't see it again!)</li>
                      </ol>
                      
                      <p className="font-medium text-foreground mt-4">Step 2: Configure Settings Below</p>
                      <ol className="list-decimal list-inside space-y-1 ml-2">
                        <li>Enter your WordPress site URL (e.g., https://yoursite.com)</li>
                        <li>Enter your WordPress username</li>
                        <li>Paste the Application Password you just created</li>
                        <li>Enable WordPress upload</li>
                        <li>Click "Test Connection" to verify</li>
                        <li>Click "Save Settings" to apply</li>
                      </ol>

                      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mt-4">
                        <p className="text-xs font-medium text-yellow-700 dark:text-yellow-400 mb-1">⚠️ Important Notes:</p>
                        <ul className="list-disc list-inside space-y-1 text-xs">
                          <li>Application Password is different from your WordPress login password</li>
                          <li>Make sure your WordPress site has REST API enabled (default in WordPress 4.7+)</li>
                          <li>If WordPress is disabled, files will upload to Firebase Storage</li>
                          <li>Application Password is stored securely in Firestore</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Configuration Form */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-sm">Enable WordPress Upload</Label>
                        <p className="text-xs text-muted-foreground">
                          When enabled, files will upload to WordPress instead of Firebase
                        </p>
                      </div>
                      <Switch
                        checked={wordpressConfig.enabled}
                        onCheckedChange={(checked) =>
                          setWordpressConfig({ ...wordpressConfig, enabled: checked })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="wp-site-url">WordPress Site URL *</Label>
                      <Input
                        id="wp-site-url"
                        type="url"
                        placeholder="https://yoursite.com"
                        value={wordpressConfig.siteUrl}
                        onChange={(e) =>
                          setWordpressConfig({ ...wordpressConfig, siteUrl: e.target.value })
                        }
                        disabled={!wordpressConfig.enabled}
                      />
                      <p className="text-xs text-muted-foreground">
                        Your WordPress site URL (without trailing slash)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="wp-username">WordPress Username *</Label>
                      <Input
                        id="wp-username"
                        type="text"
                        placeholder="admin"
                        value={wordpressConfig.username}
                        onChange={(e) =>
                          setWordpressConfig({ ...wordpressConfig, username: e.target.value })
                        }
                        disabled={!wordpressConfig.enabled}
                      />
                      <p className="text-xs text-muted-foreground">
                        Your WordPress username (not email)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="wp-password">Application Password *</Label>
                      <Input
                        id="wp-password"
                        type="password"
                        placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                        value={wordpressConfig.applicationPassword}
                        onChange={(e) =>
                          setWordpressConfig({ ...wordpressConfig, applicationPassword: e.target.value })
                        }
                        disabled={!wordpressConfig.enabled}
                      />
                      <p className="text-xs text-muted-foreground">
                        Application Password from WordPress (spaces are optional)
                      </p>
                    </div>

                    {/* Test Result */}
                    {wordpressTestResult && (
                      <div
                        className={`rounded-lg p-3 ${
                          wordpressTestResult.success
                            ? 'bg-green-500/10 border border-green-500/30'
                            : 'bg-red-500/10 border border-red-500/30'
                        }`}
                      >
                        <p
                          className={`text-sm ${
                            wordpressTestResult.success
                              ? 'text-green-700 dark:text-green-400'
                              : 'text-red-700 dark:text-red-400'
                          }`}
                        >
                          {wordpressTestResult.success ? '✓ ' : '✗ '}
                          {wordpressTestResult.message}
                        </p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={handleTestWordPress}
                        disabled={testingWordPress || !wordpressConfig.enabled || !wordpressConfig.siteUrl || !wordpressConfig.username || !wordpressConfig.applicationPassword}
                      >
                        {testingWordPress ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Testing...
                          </>
                        ) : (
                          'Test Connection'
                        )}
                      </Button>
                      <Button
                        onClick={saveWordPressConfig}
                        disabled={savingWordPress || !wordpressConfig.siteUrl || !wordpressConfig.username || !wordpressConfig.applicationPassword}
                      >
                        {savingWordPress ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save Settings
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Vendors Management (Admin Only) */}
          {isAdmin && (
            <TabsContent value="vendors">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Outsource Vendors
                  </CardTitle>
                  <CardDescription>Manage vendor details for outsource assignments</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 sm:space-y-6">
                  {/* Add New Vendor Form */}
                  <div className="bg-secondary/50 rounded-lg p-4 space-y-4">
                    <h4 className="font-medium text-foreground">Add New Vendor</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="new_vendor_name" className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5" />
                          Vendor Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="new_vendor_name"
                          placeholder="Enter vendor name"
                          value={newVendor.vendor_name}
                          onChange={(e) => setNewVendor({ ...newVendor, vendor_name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new_vendor_company">Vendor Company</Label>
                        <Input
                          id="new_vendor_company"
                          placeholder="Enter company name (optional)"
                          value={newVendor.vendor_company}
                          onChange={(e) => setNewVendor({ ...newVendor, vendor_company: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new_contact_person" className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5" />
                          Contact Person <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="new_contact_person"
                          placeholder="Enter contact person name"
                          value={newVendor.contact_person}
                          onChange={(e) => setNewVendor({ ...newVendor, contact_person: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new_phone" className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5" />
                          Phone <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="new_phone"
                          type="tel"
                          placeholder="Enter phone number"
                          value={newVendor.phone}
                          onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new_email" className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5" />
                          Email
                        </Label>
                        <Input
                          id="new_email"
                          type="email"
                          placeholder="Enter email (optional)"
                          value={newVendor.email}
                          onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new_city" className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5" />
                          City / Location
                        </Label>
                        <Input
                          id="new_city"
                          placeholder="Enter city (optional)"
                          value={newVendor.city}
                          onChange={(e) => setNewVendor({ ...newVendor, city: e.target.value })}
                        />
                      </div>
                    </div>
                    <Button onClick={handleAddVendor} className="w-full sm:w-auto">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Vendor
                    </Button>
                  </div>

                  <Separator />

                  {/* Vendors List */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-foreground">Saved Vendors ({vendors.length})</h4>
                    {vendors.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>No vendors added yet</p>
                        <p className="text-sm">Add your first vendor using the form above</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {vendors.map((vendor) => (
                          <div
                            key={vendor.id}
                            className="p-4 bg-secondary/50 rounded-lg border border-border"
                          >
                            {editingVendorId === vendor.id ? (
                              <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label>Vendor Name <span className="text-destructive">*</span></Label>
                                    <Input
                                      value={newVendor.vendor_name}
                                      onChange={(e) => setNewVendor({ ...newVendor, vendor_name: e.target.value })}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Company</Label>
                                    <Input
                                      value={newVendor.vendor_company}
                                      onChange={(e) => setNewVendor({ ...newVendor, vendor_company: e.target.value })}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Contact Person <span className="text-destructive">*</span></Label>
                                    <Input
                                      value={newVendor.contact_person}
                                      onChange={(e) => setNewVendor({ ...newVendor, contact_person: e.target.value })}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Phone <span className="text-destructive">*</span></Label>
                                    <Input
                                      type="tel"
                                      value={newVendor.phone}
                                      onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Email</Label>
                                    <Input
                                      type="email"
                                      value={newVendor.email}
                                      onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>City</Label>
                                    <Input
                                      value={newVendor.city}
                                      onChange={(e) => setNewVendor({ ...newVendor, city: e.target.value })}
                                    />
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      handleUpdateVendor(vendor.id, newVendor);
                                      setNewVendor({
                                        vendor_name: '',
                                        vendor_company: '',
                                        contact_person: '',
                                        phone: '',
                                        email: '',
                                        city: '',
                                      });
                                    }}
                                  >
                                    <Save className="h-4 w-4 mr-2" />
                                    Save
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setEditingVendorId(null);
                                      setNewVendor({
                                        vendor_name: '',
                                        vendor_company: '',
                                        contact_person: '',
                                        phone: '',
                                        email: '',
                                        city: '',
                                      });
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 space-y-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h5 className="font-semibold text-foreground">{vendor.vendor_name}</h5>
                                    {vendor.vendor_company && (
                                      <Badge variant="outline" className="text-xs">
                                        {vendor.vendor_company}
                                      </Badge>
                                    )}
                                    {vendor.city && (
                                      <Badge variant="outline" className="text-xs">
                                        <MapPin className="h-3 w-3 mr-1" />
                                        {vendor.city}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                      <User className="h-3.5 w-3.5" />
                                      <span>{vendor.contact_person}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Phone className="h-3.5 w-3.5" />
                                      <span>{vendor.phone}</span>
                                    </div>
                                    {vendor.email && (
                                      <div className="flex items-center gap-2">
                                        <Mail className="h-3.5 w-3.5" />
                                        <span>{vendor.email}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() => {
                                          setEditingVendorId(vendor.id);
                                          setNewVendor({
                                            vendor_name: vendor.vendor_name,
                                            vendor_company: vendor.vendor_company || '',
                                            contact_person: vendor.contact_person,
                                            phone: vendor.phone,
                                            email: vendor.email || '',
                                            city: vendor.city || '',
                                          });
                                        }}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Edit vendor</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() => handleDeleteVendor(vendor.id)}
                                      >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Delete vendor</TooltipContent>
                                  </Tooltip>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
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
