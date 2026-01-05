
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkflowSettingsTab } from "@/features/settings/components/WorkflowSettingsTab";
import { VendorManagement } from "@/features/admin/components/VendorManagement";
import { Settings, Shield, Globe, Database, Bell, Building2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";


export default function AdminSettings() {
    const [searchParams, setSearchParams] = useSearchParams();
    const currentTab = searchParams.get('tab') || 'workflow';

    const handleTabChange = (value: string) => {
        setSearchParams({ tab: value });
    };

    return (
        <div className="container mx-auto p-6 space-y-8 animate-fade-in">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Admin Settings</h1>
                <p className="text-muted-foreground">Configure system-wide preferences, workflows, and integrations.</p>
            </div>

            <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-6">
                <div className="relative">
                    <TabsList className="h-auto p-1 bg-muted/50 rounded-lg inline-flex flex-wrap gap-1">
                        <TabsTrigger value="general" className="gap-2 px-4 py-2">
                            <Settings className="h-4 w-4" /> General
                        </TabsTrigger>
                        <TabsTrigger value="workflow" className="gap-2 px-4 py-2">
                            <Shield className="h-4 w-4" /> Workflow & Roles
                        </TabsTrigger>
                        <TabsTrigger value="integrations" className="gap-2 px-4 py-2">
                            <Globe className="h-4 w-4" /> Integrations
                        </TabsTrigger>
                        <TabsTrigger value="automation" className="gap-2 px-4 py-2">
                            <Bell className="h-4 w-4" /> Automation
                        </TabsTrigger>
                        <TabsTrigger value="vendors" className="gap-2 px-4 py-2">
                            <Building2 className="h-4 w-4" /> Vendors
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="workflow" className="space-y-6">
                    <div className="grid gap-6">
                        <WorkflowSettingsTab />
                    </div>
                </TabsContent>

                <TabsContent value="general">
                    <Card>
                        <CardHeader>
                            <CardTitle>System Information</CardTitle>
                            <CardDescription>General information about the application instance.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 border rounded-lg">
                                    <p className="text-sm text-muted-foreground">Version</p>
                                    <p className="font-mono font-medium">v2.4.0</p>
                                </div>
                                <div className="p-4 border rounded-lg">
                                    <p className="text-sm text-muted-foreground">Environment</p>
                                    <p className="font-mono font-medium">Production</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="vendors" className="space-y-6">
                    <div className="grid gap-6">
                        <VendorManagement />
                    </div>
                </TabsContent>

                <TabsContent value="integrations">
                    <Card>
                        <CardHeader>
                            <CardTitle>External Services</CardTitle>
                            <CardDescription>Manage connections to third-party services.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600 font-bold">W</div>
                                        <div>
                                            <p className="font-medium">WooCommerce</p>
                                            <p className="text-sm text-muted-foreground">Connected via Edge Functions</p>
                                        </div>
                                    </div>
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        Active
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
