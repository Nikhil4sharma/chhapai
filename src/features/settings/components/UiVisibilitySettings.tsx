
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Save, Layout } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { UiModule, UiVisibilityRule } from '@/hooks/useUiVisibility';

export function UiVisibilitySettings() {
    const [loading, setLoading] = useState(true);
    const [modules, setModules] = useState<UiModule[]>([]);
    const [selectedScopeType, setSelectedScopeType] = useState<'department' | 'user'>('department');
    const [selectedScopeId, setSelectedScopeId] = useState<string>('sales'); // Default dept
    const [users, setUsers] = useState<{ id: string, full_name: string }[]>([]);
    const [rules, setRules] = useState<Record<string, boolean>>({});
    const [saving, setSaving] = useState(false);

    // Departments list (static for now, could be dynamic)
    const departments = ['sales', 'design', 'prepress', 'production', 'outsource', 'dispatch', 'admin', 'hr', 'accounts'];

    // Fetch initial data
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Fetch Modules
                const { data: modulesData } = await supabase.from('ui_modules').select('*').order('page_type');
                if (modulesData) setModules(modulesData as UiModule[]);

                // 2. Fetch Users (for selection)
                const { data: usersData } = await supabase.from('profiles').select('id, full_name');
                if (usersData) setUsers(usersData);

            } catch (error) {
                console.error('Error fetching UI settings data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Fetch rules when selection changes
    useEffect(() => {
        const fetchRules = async () => {
            if (!selectedScopeId) return;

            try {
                // Fetch existing rules for this scope
                const { data: rulesData } = await supabase
                    .from('ui_visibility_rules')
                    .select('module_key, is_visible')
                    .eq('scope_type', selectedScopeType)
                    .eq('scope_id', selectedScopeId);

                // Convert to map for easy access
                const ruleMap: Record<string, boolean> = {};

                // Default all to TRUE
                modules.forEach(m => ruleMap[m.module_key] = true);

                // Apply overrides
                rulesData?.forEach(r => {
                    ruleMap[r.module_key] = r.is_visible;
                });

                setRules(ruleMap);
            } catch (error) {
                console.error('Error fetching rules:', error);
            }
        };

        if (modules.length > 0) {
            fetchRules();
        }
    }, [selectedScopeType, selectedScopeId, modules]);

    const handleToggle = (moduleKey: string, checked: boolean) => {
        setRules(prev => ({ ...prev, [moduleKey]: checked }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const updates = Object.entries(rules).map(([moduleKey, isVisible]) => ({
                scope_type: selectedScopeType,
                scope_id: selectedScopeId,
                module_key: moduleKey,
                is_visible: isVisible,
                updated_at: new Date().toISOString()
            }));

            // Upsert rules
            const { error } = await supabase
                .from('ui_visibility_rules')
                .upsert(updates, { onConflict: 'scope_type,scope_id,module_key' });

            if (error) throw error;

            toast({
                title: "Settings Saved",
                description: `Visibility rules updated for ${selectedScopeType === 'department' ? selectedScopeId.toUpperCase() : 'User'}`,
            });
        } catch (error) {
            console.error('Error saving rules:', error);
            toast({ title: "Error", description: "Failed to save settings", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    // Group modules by page_type
    const productCardModules = modules.filter(m => m.page_type === 'product_card');
    const orderDetailsModules = modules.filter(m => m.page_type === 'order_details');

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>UI Visibility Control</CardTitle>
                    <CardDescription>Configure what different users and departments can see</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex flex-col sm:flex-row gap-4 p-4 bg-muted/30 rounded-lg">

                        <div className="space-y-2 min-w-[200px]">
                            <Label>Scope Type</Label>
                            <Select value={selectedScopeType} onValueChange={(v: any) => { setSelectedScopeType(v); setSelectedScopeId(v === 'department' ? 'sales' : users[0]?.id || ''); }}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="department">Department</SelectItem>
                                    <SelectItem value="user">Specific User</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2 flex-1">
                            <Label>Select {selectedScopeType === 'department' ? 'Department' : 'User'}</Label>
                            <Select value={selectedScopeId} onValueChange={setSelectedScopeId}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {selectedScopeType === 'department' ? (
                                        departments.map(d => (
                                            <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>
                                        ))
                                    ) : (
                                        users.map(u => (
                                            <SelectItem key={u.id} value={u.id}>{u.full_name || 'Unknown User'}</SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <Tabs defaultValue="product_card">
                        <TabsList>
                            <TabsTrigger value="product_card">Product Card</TabsTrigger>
                            <TabsTrigger value="order_details">Order Details Page</TabsTrigger>
                        </TabsList>

                        <TabsContent value="product_card" className="space-y-6 pt-4">
                            {/* Actions Section */}
                            <div>
                                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Action Buttons</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {productCardModules.filter(m => m.module_key.includes('_button')).map(module => (
                                        <div key={module.module_key} className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
                                            <div className="space-y-1">
                                                <div className="font-medium">{module.label}</div>
                                                <div className="text-xs text-muted-foreground">{module.description}</div>
                                            </div>
                                            <Switch
                                                checked={rules[module.module_key] ?? true}
                                                onCheckedChange={(checked) => handleToggle(module.module_key, checked)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Content Section */}
                            <div>
                                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Content & Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {productCardModules.filter(m => !m.module_key.includes('_button')).map(module => (
                                        <div key={module.module_key} className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
                                            <div className="space-y-1">
                                                <div className="font-medium">{module.label}</div>
                                                <div className="text-xs text-muted-foreground">{module.description}</div>
                                            </div>
                                            <Switch
                                                checked={rules[module.module_key] ?? true}
                                                onCheckedChange={(checked) => handleToggle(module.module_key, checked)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="order_details" className="space-y-4 pt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {orderDetailsModules.map(module => (
                                    <div key={module.module_key} className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
                                        <div className="space-y-1">
                                            <div className="font-medium">{module.label}</div>
                                            <div className="text-xs text-muted-foreground">{module.description}</div>
                                        </div>
                                        <Switch
                                            checked={rules[module.module_key] ?? true}
                                            onCheckedChange={(checked) => handleToggle(module.module_key, checked)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </TabsContent>
                    </Tabs>

                    <div className="flex justify-end pt-4 border-t">
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save Visibility Rules
                        </Button>
                    </div>

                </CardContent>
            </Card>
        </div>
    );
}
