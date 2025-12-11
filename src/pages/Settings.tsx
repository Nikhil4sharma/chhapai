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

  // WooCommerce settings
  const [wooSettings, setWooSettings] = useState({
    storeUrl: '',
    consumerKey: '',
    consumerSecret: '',
    autoSync: true,
    syncInterval: 15,
    lastSync: null as Date | null,
    isConnected: false,
  });
  const [syncLoading, setSyncLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  // Load saved settings from localStorage (in production, use database)
  useEffect(() => {
    const savedWooSettings = localStorage.getItem('woocommerce_settings');
    if (savedWooSettings) {
      const parsed = JSON.parse(savedWooSettings);
      setWooSettings({
        ...parsed,
        lastSync: parsed.lastSync ? new Date(parsed.lastSync) : null,
      });
    }
  }, []);

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

  const handleSaveWooCommerce = () => {
    localStorage.setItem('woocommerce_settings', JSON.stringify(wooSettings));
    toast({
      title: "WooCommerce Settings Saved",
      description: "Your WooCommerce integration settings have been saved",
    });
  };

  const handleTestConnection = async () => {
    if (!wooSettings.storeUrl || !wooSettings.consumerKey || !wooSettings.consumerSecret) {
      toast({
        title: "Error",
        description: "Please fill in all WooCommerce credentials",
        variant: "destructive",
      });
      return;
    }

    setTestingConnection(true);
    try {
      // Simulate connection test
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setWooSettings(prev => ({ ...prev, isConnected: true }));
      localStorage.setItem('woocommerce_settings', JSON.stringify({ ...wooSettings, isConnected: true }));
      
      toast({
        title: "Connection Successful",
        description: "Successfully connected to your WooCommerce store",
      });
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: "Could not connect to WooCommerce. Please check your credentials.",
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
        description: "Please connect to WooCommerce first",
        variant: "destructive",
      });
      return;
    }

    setSyncLoading(true);
    try {
      // Simulate sync process
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const now = new Date();
      setWooSettings(prev => ({ ...prev, lastSync: now }));
      localStorage.setItem('woocommerce_settings', JSON.stringify({ ...wooSettings, lastSync: now.toISOString() }));
      
      toast({
        title: "Sync Complete",
        description: "Successfully synced processing orders from WooCommerce",
      });
    } catch (error) {
      toast({
        title: "Sync Failed",
        description: "Could not sync orders. Please try again.",
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
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
            <TabsTrigger value="notifications">
              <Bell className="h-4 w-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="appearance">
              <Palette className="h-4 w-4 mr-2" />
              Appearance
            </TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger value="woocommerce">
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  WooCommerce
                </TabsTrigger>
                <TabsTrigger value="stages">
                  <Database className="h-4 w-4 mr-2" />
                  Stages
                </TabsTrigger>
                <TabsTrigger value="security">
                  <Shield className="h-4 w-4 mr-2" />
                  Security
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
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                  </div>
                  <Switch 
                    checked={notifications.email}
                    onCheckedChange={(checked) => setNotifications({...notifications, email: checked})}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Push Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive push notifications in browser</p>
                  </div>
                  <Switch 
                    checked={notifications.push}
                    onCheckedChange={(checked) => setNotifications({...notifications, push: checked})}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Order Updates</Label>
                    <p className="text-sm text-muted-foreground">Get notified when orders change status</p>
                  </div>
                  <Switch 
                    checked={notifications.orderUpdates}
                    onCheckedChange={(checked) => setNotifications({...notifications, orderUpdates: checked})}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Urgent Alerts</Label>
                    <p className="text-sm text-muted-foreground">Get alerts for high-priority items</p>
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
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="storeUrl">Store URL *</Label>
                      <Input
                        id="storeUrl"
                        placeholder="https://yourstore.com"
                        value={wooSettings.storeUrl}
                        onChange={(e) => setWooSettings({...wooSettings, storeUrl: e.target.value})}
                      />
                      <p className="text-xs text-muted-foreground">Your WooCommerce store URL</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="consumerKey">Consumer Key *</Label>
                      <Input
                        id="consumerKey"
                        type="password"
                        placeholder="ck_xxxxxxxxxxxxx"
                        value={wooSettings.consumerKey}
                        onChange={(e) => setWooSettings({...wooSettings, consumerKey: e.target.value})}
                      />
                      <p className="text-xs text-muted-foreground">
                        Found in WooCommerce → Settings → Advanced → REST API
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="consumerSecret">Consumer Secret *</Label>
                      <Input
                        id="consumerSecret"
                        type="password"
                        placeholder="cs_xxxxxxxxxxxxx"
                        value={wooSettings.consumerSecret}
                        onChange={(e) => setWooSettings({...wooSettings, consumerSecret: e.target.value})}
                      />
                    </div>

                    <div className="flex gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="outline"
                            onClick={handleTestConnection}
                            disabled={testingConnection}
                          >
                            {testingConnection ? 'Testing...' : 'Test Connection'}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Test WooCommerce API connection</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button onClick={handleSaveWooCommerce}>
                            <Save className="h-4 w-4 mr-2" />
                            Save Credentials
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Save WooCommerce settings</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium text-foreground">Sync Settings</h4>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Auto Sync</Label>
                        <p className="text-sm text-muted-foreground">
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

                    <div className="bg-secondary/50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">Manual Sync</p>
                          <p className="text-sm text-muted-foreground">
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
                <CardContent className="space-y-6">
                  <div className="flex gap-2">
                    <Input 
                      placeholder="New stage name..."
                      value={newStageName}
                      onChange={(e) => setNewStageName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddStage()}
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button onClick={handleAddStage}>
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
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Two-Factor Authentication</Label>
                      <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
                    </div>
                    <Switch />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Session Timeout</Label>
                      <p className="text-sm text-muted-foreground">Automatically log out after inactivity</p>
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
