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
  Factory,
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
import { useNotifications } from '@/hooks/useNotifications';
import { toast } from '@/hooks/use-toast';
import { PRODUCTION_STEPS } from '@/types/order';
import { supabase } from '@/integrations/supabase/client';
import { uploadFileToSupabase } from '@/services/supabaseStorage';
import { useWorkflow } from '@/contexts/WorkflowContext';
import { WorkflowSettingsTab } from '@/features/settings/components/WorkflowSettingsTab';
import { UiVisibilitySettings } from '@/features/settings/components/UiVisibilitySettings';
import { Network, Layout } from 'lucide-react'; // For workflow icon

export default function Settings() {
  const { isAdmin, user, isLoading: authLoading } = useAuth();
  const { lastSyncTime, refreshOrders } = useOrders();
  const { permission, checkPermission, requestPushPermission, showPushNotification } = useNotifications();

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
  const { productionStages, updateProductionStages } = useWorkflow();
  // Local state for stages is no longer needed as it comes from context

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
          .select('value')
          .eq('key', 'appearance')
          .maybeSingle();

        if (settingsError && settingsError.code !== 'PGRST116') {
          console.error('Error loading appearance settings:', settingsError);
          return;
        }

        if (settingsData?.value) {
          const appearance = settingsData.value as {
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





  // Load production stages from Supabase
  // Production stages are loaded via useWorkflow context


  // Workflow Configuration State
  const [workflowConfig, setWorkflowConfig] = useState<any>(null);

  // Load workflow config
  useEffect(() => {
    if (!isAdmin) return;
    const loadWorkflowConfig = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'workflow_config')
          .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;

        if (data?.value) {
          setWorkflowConfig(data.value);
        }
      } catch (err) {
        console.error('Error loading workflow config:', err);
      }
    };
    loadWorkflowConfig();
  }, [isAdmin]);

  const handleUpdateWorkflow = async (newConfig: any) => {
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          key: 'workflow_config',
          value: newConfig,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      setWorkflowConfig(newConfig);
      toast({ title: "Workflow Updated", description: "Changes saved successfully." });
    } catch (err) {
      toast({ title: "Error", description: "Failed to save workflow", variant: "destructive" });
    }
  };


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
              key: 'production_stages',
              value: productionStages,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'key'
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

    // Use context to update
    try {
      await updateProductionStages(updatedStages);
      setNewStageName('');
      toast({
        title: "Stage Added",
        description: `"${newStageName}" has been added and saved`,
      });
    } catch (error) {
      // Error handled in context
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

    // Use context to update
    try {
      await updateProductionStages(updatedStages);
      toast({
        title: "Stage Removed",
        description: "Production stage has been removed and saved",
      });
    } catch (error) {
      // Error handled in context
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

                <TabsTrigger value="security" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5">
                  <Shield className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Security</span>
                </TabsTrigger>

                <TabsTrigger value="stages" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5">
                  <Factory className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Stages</span>
                </TabsTrigger>

                <TabsTrigger value="workflow" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5">
                  <Network className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Workflow</span>
                </TabsTrigger>

                <TabsTrigger value="ui_visibility" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5">
                  <Layout className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Dashboard View</span>
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
                    onCheckedChange={(checked) => setNotifications({ ...notifications, email: checked })}
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
                    onCheckedChange={(checked) => setNotifications({ ...notifications, push: checked })}
                  />
                </div>

                {/* Enable Notifications Button - Show if permission not granted */}
                {permission !== 'granted' && (
                  <div className="flex items-center justify-between gap-3 pt-2 pb-2 border-t border-border">
                    <div className="space-y-0.5 min-w-0">
                      <Label className="text-sm font-medium">Enable Browser Notifications</Label>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {permission === 'denied'
                          ? 'Notifications are blocked. Enable them in browser settings.'
                          : 'Click to allow notifications from this site'}
                      </p>
                    </div>
                    <Button
                      variant={permission === 'denied' ? 'outline' : 'default'}
                      size="sm"
                      onClick={async () => {
                        if (permission === 'denied') {
                          // Try checking again in case user changed it
                          checkPermission();

                          if (Notification.permission === 'denied') {
                            toast({
                              title: "Permission Blocked",
                              description: "Please enable manually: Click lock icon in address bar → Site settings → Notifications → Allow",
                              variant: "destructive",
                            });
                          }
                          return;
                        }

                        // Use hook method
                        await requestPushPermission();
                      }}
                    >
                      <Bell className="h-4 w-4 mr-2" />
                      {permission === 'denied' ? 'Check Permission' : 'Enable Notifications'}
                    </Button>
                  </div>
                )}

                {/* Test Push Notification Button */}
                <div className="flex items-center justify-between gap-3 pt-2">
                  <div className="space-y-0.5 min-w-0">
                    <Label className="text-sm">Test Push Notification</Label>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {permission === 'granted'
                        ? "Send a test notification to verify it's working"
                        : 'Enable notifications first to test'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={permission !== 'granted'}
                    onClick={async () => {
                      // Force a re-check first
                      checkPermission();

                      if (permission === 'granted') {
                        showPushNotification(
                          'Test Notification',
                          'This is a test push notification from Chhapai!',
                          faviconUrl
                        );
                        toast({
                          title: "Test Sent",
                          description: "Check your system notifications tray."
                        });
                      } else {
                        toast({
                          title: "Not Enabled",
                          description: "Please enable notifications first.",
                          variant: "destructive"
                        });
                      }
                    }}
                  >
                    <Bell className="h-4 w-4 mr-2" />
                    Send Test
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
                    onCheckedChange={(checked) => setNotifications({ ...notifications, orderUpdates: checked })}
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
                    onCheckedChange={(checked) => setNotifications({ ...notifications, urgentAlerts: checked })}
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

          {/* Workflow (Admin Only) */}
          {isAdmin && (
            <TabsContent value="workflow">
              <WorkflowSettingsTab />
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

          {isAdmin && (
            <TabsContent value="ui_visibility">
              <UiVisibilitySettings />
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
