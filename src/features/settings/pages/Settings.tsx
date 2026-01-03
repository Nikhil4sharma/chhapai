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
import { useAuth } from '@/features/auth/context/AuthContext';
import { useOrders } from '@/features/orders/context/OrderContext';
import { toast } from '@/hooks/use-toast';
import { PRODUCTION_STEPS } from '@/types/order';
import { supabase } from '@/integrations/supabase/client';
import { uploadFileToSupabase } from '@/services/supabaseStorage';

export default function Settings() {
  const { isAdmin, user, isLoading: authLoading } = useAuth();
  const { lastSyncTime, refreshOrders } = useOrders();
  
  // CRITICAL: Wait for auth to be ready before rendering
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  // CRITICAL: Only admin can access settings
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="p-6">
          <CardContent className="text-center">
            <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
            <p className="text-muted-foreground">You need admin privileges to access settings.</p>
          </CardContent>
        </Card>
      </div>
    );
  }
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
  const [faviconUrl, setFaviconUrl] = useState<string>('/favicon.ico');
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [isUploadingFavicon, setIsUploadingFavicon] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Load appearance settings from Supabase
  useEffect(() => {
    if (!isAdmin) return;
    
    const loadAppearanceSettings = async () => {
      try {
        const { data: settingsData, error: settingsError } = await supabase
          .from('app_settings')
          .select('setting_value')
          .eq('setting_key', 'appearance')
          .maybeSingle();

        if (settingsError && settingsError.code !== 'PGRST116') {
          console.error('Error loading appearance settings:', settingsError);
          return;
        }

        if (settingsData?.setting_value) {
          const appearance = settingsData.setting_value as {
            favicon_url?: string;
            logo_url?: string;
          };
          
          if (appearance.favicon_url) {
            setFaviconUrl(appearance.favicon_url);
          }
          
          if (appearance.logo_url) {
            setLogoUrl(appearance.logo_url);
          }
        }
      } catch (error) {
        console.error('Error loading appearance settings:', error);
      }
    };

    loadAppearanceSettings();
  }, [isAdmin]);

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



  // Load vendors from Supabase
  useEffect(() => {
    if (!isAdmin) return;
    
    const loadVendors = async () => {
      try {
        const { data: vendorsData, error: vendorsError } = await supabase
          .from('vendors')
          .select('*')
          .order('created_at', { ascending: false });

        if (vendorsError) throw vendorsError;

        const mappedVendors = (vendorsData || []).map(v => ({
          id: v.id,
          vendor_name: v.vendor_name,
          vendor_company: v.vendor_company || undefined,
          contact_person: v.contact_person,
          phone: v.phone,
          email: v.email || undefined,
          city: v.city || undefined,
          created_at: new Date(v.created_at),
          updated_at: new Date(v.updated_at),
        }));

        setVendors(mappedVendors);
      } catch (error) {
        console.error('Error loading vendors:', error);
      }
    };

    loadVendors();
  }, [isAdmin]);

  // Load production stages from Supabase
  useEffect(() => {
    if (!isAdmin) return;
    
    const loadProductionStages = async () => {
      try {
        const { data: settingsData, error: settingsError } = await supabase
          .from('app_settings')
          .select('setting_value')
          .eq('setting_key', 'production_stages')
          .single();

        if (settingsError && settingsError.code !== 'PGRST116') {
          console.error('Error loading production stages:', settingsError);
          return;
        }

        if (settingsData?.setting_value) {
          const stages = settingsData.setting_value as Array<{ key: string; label: string; order: number }>;
          if (Array.isArray(stages) && stages.length > 0) {
            setProductionStages(stages);
          }
        }
      } catch (error) {
        console.error('Error loading production stages:', error);
      }
    };

    loadProductionStages();
  }, [isAdmin]);


  // WooCommerce and WordPress functionality removed - not needed anymore

  const handleSave = async () => {
    if (!user) return;
    
    try {
      // Save user notification settings (these columns don't exist in user_settings table yet)
      // Store in localStorage for now
      const settingsData = {
        user_id: user.id,
        email_notifications: notifications.email,
        push_notifications: notifications.push,
        order_updates: notifications.orderUpdates,
        urgent_alerts: notifications.urgentAlerts,
      };
      
      // Save notification preferences to localStorage
      // Note: user_settings table only has sound_enabled and push_enabled columns
      // Future: Add these columns to user_settings table if needed
      localStorage.setItem('user_notification_settings', JSON.stringify(settingsData));
      
      // Only save sound_enabled and push_enabled to user_settings table if needed
      // (Currently handled by useNotifications hook separately)
      
      // Save production stages separately to app_settings (admin only)
      if (isAdmin) {
        try {
          const { error: stagesError } = await supabase
            .from('app_settings')
            .upsert({
              setting_key: 'production_stages',
              setting_value: productionStages,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'setting_key'
            });

          if (stagesError) throw stagesError;
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
    
    // Save immediately to Supabase
    try {
      const { error: settingsError } = await supabase
        .from('app_settings')
        .upsert({
          setting_key: 'production_stages',
          setting_value: updatedStages,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'setting_key'
        });

      if (settingsError) throw settingsError;
      
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
      };

      const { data: newVendorData, error: vendorError } = await supabase
        .from('vendors')
        .insert(vendorData)
        .select()
        .single();

      if (vendorError) throw vendorError;
      if (!newVendorData) throw new Error('Vendor creation failed');

      const addedVendorName = vendorData.vendor_name;
      setVendors([...vendors, { 
        id: newVendorData.id,
        vendor_name: newVendorData.vendor_name,
        vendor_company: newVendorData.vendor_company || undefined,
        contact_person: newVendorData.contact_person,
        phone: newVendorData.phone,
        email: newVendorData.email || undefined,
        city: newVendorData.city || undefined,
        created_at: new Date(newVendorData.created_at),
        updated_at: new Date(newVendorData.updated_at),
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
      const { error: vendorError } = await supabase
        .from('vendors')
        .update({
          vendor_name: updatedData.vendor_name.trim(),
          vendor_company: updatedData.vendor_company.trim() || null,
          contact_person: updatedData.contact_person.trim(),
          phone: updatedData.phone.trim(),
          email: updatedData.email.trim() || null,
          city: updatedData.city.trim() || null,
        })
        .eq('id', vendorId);

      if (vendorError) throw vendorError;

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
      const { error: vendorError } = await supabase
        .from('vendors')
        .delete()
        .eq('id', vendorId);

      if (vendorError) throw vendorError;

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
    
    // Save immediately to Supabase
    try {
      const { error: settingsError } = await supabase
        .from('app_settings')
        .upsert({
          setting_key: 'production_stages',
          setting_value: updatedStages,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'setting_key'
        });

      if (settingsError) throw settingsError;
      
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

  // WooCommerce and WordPress functionality removed - not needed anymore

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
                            
                            // Upload to Supabase Storage
                            const { url: downloadURL } = await uploadFileToSupabase(
                              file,
                              'order-files',
                              'app-settings'
                            );
                            
                            // Load existing appearance settings first to merge
                            const { data: existingSettings } = await supabase
                              .from('app_settings')
                              .select('setting_value')
                              .eq('setting_key', 'appearance')
                              .maybeSingle();

                            const existingAppearance = (existingSettings?.setting_value as any) || {};
                            
                            // Save to Supabase app_settings table with merged values
                            const { error: saveError } = await supabase
                              .from('app_settings')
                              .upsert({
                                setting_key: 'appearance',
                                setting_value: {
                                  ...existingAppearance,
                                  favicon_url: downloadURL,
                                },
                                updated_at: new Date().toISOString(),
                              }, {
                                onConflict: 'setting_key'
                              });

                            if (saveError) {
                              throw new Error(`Failed to save favicon: ${saveError.message}`);
                            }

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
                            
                            // Upload to Supabase Storage
                            const { url: downloadURL } = await uploadFileToSupabase(
                              file,
                              'order-files',
                              'app-settings'
                            );
                            
                            // Load existing appearance settings first to merge
                            const { data: existingSettings } = await supabase
                              .from('app_settings')
                              .select('setting_value')
                              .eq('setting_key', 'appearance')
                              .maybeSingle();

                            const existingAppearance = (existingSettings?.setting_value as any) || {};
                            
                            // Save to Supabase app_settings table with merged values
                            const { error: saveError } = await supabase
                              .from('app_settings')
                              .upsert({
                                setting_key: 'appearance',
                                setting_value: {
                                  ...existingAppearance,
                                  logo_url: downloadURL,
                                },
                                updated_at: new Date().toISOString(),
                              }, {
                                onConflict: 'setting_key'
                              });

                            if (saveError) {
                              throw new Error(`Failed to save logo: ${saveError.message}`);
                            }

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
