import { useState, useEffect } from 'react';
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
import { supabase } from '@/integrations/supabase/client';

export default function Settings() {
  const { isAdmin } = useAuth();
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    orderUpdates: true,
    urgentAlerts: true,
  });

  const [productionStages, setProductionStages] = useState<Array<{ key: string; label: string; order: number }>>(
    PRODUCTION_STEPS.map(s => ({ key: s.key, label: s.label, order: s.order }))
  );
  const [newStageName, setNewStageName] = useState('');

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

  const checkWooCommerceConfig = async () => {
    setCheckingConfig(true);
    try {
      const { data, error } = await supabase.functions.invoke('woocommerce', {
        body: { action: 'check-config' },
      });

      if (error) throw error;

      setWooSettings(prev => ({
        ...prev,
        isConnected: data.configured,
        storeUrlMasked: data.storeUrl,
      }));
    } catch (error) {
      console.error('Failed to check WooCommerce config:', error);
    } finally {
      setCheckingConfig(false);
    }
  };

  const handleSave = () => {
    toast({
      title: "Settings Saved",
      description: "Your preferences have been updated",
    });
  };

  const handleAddStage = () => {
    if (!newStageName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a stage name",
        variant: "destructive",
      });
      return;
    }
    
    const newStage = {
      key: newStageName.toLowerCase().replace(/\s+/g, '_'),
      label: newStageName,
      order: productionStages.length + 1,
    };
    
    setProductionStages([...productionStages, newStage]);
    setNewStageName('');
    
    toast({
      title: "Stage Added",
      description: `"${newStageName}" has been added to production stages`,
    });
  };

  const handleRemoveStage = (key: string) => {
    setProductionStages(productionStages.filter(s => s.key !== key));
    toast({
      title: "Stage Removed",
      description: "Production stage has been removed",
    });
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
    setTestingConnection(true);
    try {
      const { data, error } = await supabase.functions.invoke('woocommerce', {
        body: { action: 'test-connection' },
      });

      if (error) throw error;

      if (data.success) {
        setWooSettings(prev => ({ ...prev, isConnected: true }));
        toast({
          title: "Connection Successful",
          description: "Successfully connected to your WooCommerce store",
        });
      } else {
        toast({
          title: "Connection Failed",
          description: data.error || "Could not connect to WooCommerce",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Connection Failed",
        description: error.message || "Could not connect to WooCommerce. Please check backend secrets.",
        variant: "destructive",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleManualSync = async () => {
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
      const { data, error } = await supabase.functions.invoke('woocommerce', {
        body: { action: 'sync-orders' },
      });

      if (error) throw error;

      if (data.success) {
        const now = new Date();
        setWooSettings(prev => ({ ...prev, lastSync: now }));
        localStorage.setItem('woocommerce_preferences', JSON.stringify({
          autoSync: wooSettings.autoSync,
          syncInterval: wooSettings.syncInterval,
          lastSync: now.toISOString(),
        }));
        
        toast({
          title: "Sync Complete",
          description: `Imported ${data.imported} orders, ${data.skipped} already existed`,
        });
      } else {
        toast({
          title: "Sync Failed",
          description: data.error || "Could not sync orders",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Sync Failed",
        description: error.message || "Could not sync orders. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSyncLoading(false);
    }
  };

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
                          <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">
                              WooCommerce credentials need to be configured in the backend secrets.
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Required secrets: WOOCOMMERCE_STORE_URL, WOOCOMMERCE_CONSUMER_KEY, WOOCOMMERCE_CONSUMER_SECRET
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
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
                        onCheckedChange={(checked) => setWooSettings({...wooSettings, autoSync: checked})}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Sync Interval (minutes)</Label>
                      <Input
                        type="number"
                        min={5}
                        max={60}
                        value={wooSettings.syncInterval}
                        onChange={(e) => setWooSettings({...wooSettings, syncInterval: parseInt(e.target.value) || 15})}
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
                      <p className="font-medium text-foreground mb-1">Note:</p>
                      <p>Only orders with "Processing" status will be imported. Orders will be created in the Sales stage.</p>
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
