
import { useState } from 'react';
import { Plus, Trash2, Save, X, ChevronRight, ChevronDown, Check } from 'lucide-react';
import { Department, WorkflowConfig, DepartmentConfig, StatusConfig, WorkflowAction, ProductStatus } from '@/types/workflow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWorkflow } from '@/contexts/WorkflowContext';
import { toast } from '@/hooks/use-toast';

// Helper to get available departments
const DEPARTMENTS: Department[] = ['sales', 'design', 'prepress', 'production', 'outsource'];

// Available colors for statuses
const STATUS_COLORS = [
    { label: 'Gray', value: 'bg-gray-100 text-gray-800' },
    { label: 'Blue', value: 'bg-blue-100 text-blue-800' },
    { label: 'Green', value: 'bg-green-100 text-green-800' },
    { label: 'Yellow', value: 'bg-yellow-100 text-yellow-800' },
    { label: 'Red', value: 'bg-red-100 text-red-800' },
    { label: 'Purple', value: 'bg-purple-100 text-purple-800' },
    { label: 'Pink', value: 'bg-pink-100 text-pink-800' },
    { label: 'Indigo', value: 'bg-indigo-100 text-indigo-800' },
    { label: 'Orange', value: 'bg-orange-100 text-orange-800' },
    { label: 'Emerald', value: 'bg-emerald-100 text-emerald-800' },
    { label: 'Amber', value: 'bg-amber-100 text-amber-800' },
];

export function WorkflowSettingsTab() {
    const { config, updateConfig } = useWorkflow();
    const [localConfig, setLocalConfig] = useState<WorkflowConfig>(JSON.parse(JSON.stringify(config)));
    const [selectedDept, setSelectedDept] = useState<Department>('sales');
    const [expandedStatus, setExpandedStatus] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateConfig(localConfig);
            toast({ title: "Workflow Saved", description: "Workflow configuration updated successfully." });
        } catch (error) {
            console.error('Failed to save workflow:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const updateDepartmentLabel = (label: string) => {
        setLocalConfig(prev => {
            const deptConfig = prev[selectedDept] || {
                label: label,
                statuses: [],
                allowedTransitions: {}
            };

            return {
                ...prev,
                [selectedDept]: { ...deptConfig, label }
            };
        });
    };

    const addStatus = () => {
        const newStatus: StatusConfig = {
            value: `new_status_${Date.now()}` as ProductStatus,
            label: 'New Status',
            allowedActions: [],
            color: 'bg-gray-100 text-gray-800'
        };
        setLocalConfig(prev => {
            const currentDeptConfig = prev[selectedDept] || { label: selectedDept, statuses: [] };
            return {
                ...prev,
                [selectedDept]: {
                    ...currentDeptConfig,
                    statuses: [...(currentDeptConfig.statuses || []), newStatus]
                }
            };
        });
        setExpandedStatus(newStatus.value);
    };

    const removeStatus = (statusValue: string) => {
        setLocalConfig(prev => ({
            ...prev,
            [selectedDept]: {
                ...prev[selectedDept],
                statuses: prev[selectedDept].statuses.filter(s => s.value !== statusValue)
            }
        }));
    };

    const updateStatus = (statusValue: string, updates: Partial<StatusConfig>) => {
        setLocalConfig(prev => ({
            ...prev,
            [selectedDept]: {
                ...prev[selectedDept],
                statuses: prev[selectedDept].statuses.map(s =>
                    s.value === statusValue ? { ...s, ...updates } : s
                )
            }
        }));
    };

    const addAction = (statusValue: string) => {
        const newAction: WorkflowAction = {
            id: `action_${Date.now()}`,
            label: 'New Action',
            targetStatus: 'new_order' as ProductStatus, // Default placeholder
            style: 'primary'
        };

        setLocalConfig(prev => ({
            ...prev,
            [selectedDept]: {
                ...prev[selectedDept],
                statuses: prev[selectedDept].statuses.map(s => {
                    if (s.value === statusValue) {
                        return { ...s, allowedActions: [...s.allowedActions, newAction] };
                    }
                    return s;
                })
            }
        }));
    };

    const removeAction = (statusValue: string, actionId: string) => {
        setLocalConfig(prev => ({
            ...prev,
            [selectedDept]: {
                ...prev[selectedDept],
                statuses: prev[selectedDept].statuses.map(s => {
                    if (s.value === statusValue) {
                        return { ...s, allowedActions: s.allowedActions.filter(a => a.id !== actionId) };
                    }
                    return s;
                })
            }
        }));
    };

    const updateAction = (statusValue: string, actionId: string, updates: Partial<WorkflowAction>) => {
        setLocalConfig(prev => ({
            ...prev,
            [selectedDept]: {
                ...prev[selectedDept],
                statuses: prev[selectedDept].statuses.map(s => {
                    if (s.value === statusValue) {
                        return {
                            ...s,
                            allowedActions: s.allowedActions.map(a =>
                                a.id === actionId ? { ...a, ...updates } : a
                            )
                        };
                    }
                    return s;
                })
            }
        }));
    };

    // Helper to get all statuses across departments for dropdowns
    const getAllStatuses = () => {
        const allStatuses: { dept: Department, value: string, label: string }[] = [];
        Object.entries(localConfig).forEach(([dept, conf]) => {
            conf.statuses.forEach(s => {
                allStatuses.push({ dept: dept as Department, value: s.value, label: s.label });
            });
        });
        return allStatuses;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-medium">Workflow Configuration</h3>
                    <p className="text-sm text-muted-foreground">Manage departments, statuses, and flow actions.</p>
                </div>
                <Button onClick={handleSave} disabled={isSaving}>
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? 'Saving...' : 'Save Workflow'}
                </Button>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
                {/* Department Sidebar */}
                <Card className="md:w-64 h-fit">
                    <CardContent className="p-3 space-y-1">
                        {DEPARTMENTS.map(dept => (
                            <Button
                                key={dept}
                                variant={selectedDept === dept ? "secondary" : "ghost"}
                                className="w-full justify-start capitalize"
                                onClick={() => setSelectedDept(dept)}
                            >
                                {localConfig[dept]?.label || dept}
                            </Button>
                        ))}
                    </CardContent>
                </Card>

                {/* Main Content Area */}
                <div className="flex-1 space-y-6">
                    {/* Department Settings */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="capitalize flex items-center gap-2">
                                {localConfig[selectedDept]?.label || selectedDept} Workflow
                                <Badge variant="outline" className="text-xs font-normal">
                                    {selectedDept}
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Department Label</Label>
                                <Input
                                    value={localConfig[selectedDept]?.label || ''}
                                    onChange={(e) => updateDepartmentLabel(e.target.value)}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Statuses List */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Statuses</h4>
                            <Button size="sm" variant="outline" onClick={addStatus}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Status
                            </Button>
                        </div>

                        {/* Check if department config exists before accessing statuses */}
                        {localConfig[selectedDept] && localConfig[selectedDept]?.statuses ? (
                            localConfig[selectedDept].statuses.map((status, index) => (
                                <Card key={index} className="overflow-hidden">
                                    <div
                                        className="p-4 flex items-center justify-between bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => setExpandedStatus(expandedStatus === status.value ? null : status.value)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <ChevronRight className={`h-4 w-4 transition-transform ${expandedStatus === status.value ? 'rotate-90' : ''}`} />
                                            <Badge className={status.color}>{status.label}</Badge>
                                            <span className="text-xs text-muted-foreground font-mono">{status.value}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="text-xs text-muted-foreground mr-2">
                                                {status.allowedActions.length} Actions
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-destructive hover:text-destructive"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeStatus(status.value);
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    {expandedStatus === status.value && (
                                        <CardContent className="p-4 pt-0 border-t bg-card animate-in slide-in-from-top-2">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                                <div className="space-y-2">
                                                    <Label>Status Label</Label>
                                                    <Input
                                                        value={status.label}
                                                        onChange={(e) => updateStatus(status.value, { label: e.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Value (ID)</Label>
                                                    <Input
                                                        value={status.value}
                                                        onChange={(e) => updateStatus(status.value, { value: e.target.value as ProductStatus })}
                                                        placeholder="unique_status_id"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Color Style</Label>
                                                    <Select
                                                        value={status.color}
                                                        onValueChange={(val) => updateStatus(status.value, { color: val })}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {STATUS_COLORS.map(c => (
                                                                <SelectItem key={c.value} value={c.value}>
                                                                    <div className="flex items-center gap-2">
                                                                        <div className={`w-3 h-3 rounded-full ${c.value.split(' ')[0]}`} />
                                                                        {c.label}
                                                                    </div>
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            <Separator className="my-4" />

                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <Label className="text-xs font-semibold uppercase text-muted-foreground">Allowed Actions / Transitions</Label>
                                                    <Button size="sm" variant="ghost" onClick={() => addAction(status.value)} className="h-7 text-xs">
                                                        <Plus className="h-3 w-3 mr-1" />
                                                        Add Action
                                                    </Button>
                                                </div>

                                                {status.allowedActions.length === 0 && (
                                                    <div className="text-sm text-muted-foreground italic py-2">
                                                        No actions defined. This status is a dead-end.
                                                    </div>
                                                )}

                                                <div className="space-y-2">
                                                    {status.allowedActions.map((action, aIndex) => (
                                                        <div key={aIndex} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end p-2 border rounded-md bg-background">
                                                            <div className="md:col-span-3 space-y-1">
                                                                <Label className="text-[10px]">Button Label</Label>
                                                                <Input
                                                                    className="h-8 text-xs"
                                                                    value={action.label}
                                                                    onChange={(e) => updateAction(status.value, action.id, { label: e.target.value })}
                                                                />
                                                            </div>
                                                            <div className="md:col-span-3 space-y-1">
                                                                <Label className="text-[10px]">Target Dept (Optional)</Label>
                                                                <Select
                                                                    value={action.targetDepartment || "same"}
                                                                    onValueChange={(val) => updateAction(status.value, action.id, { targetDepartment: val === "same" ? undefined : val as Department })}
                                                                >
                                                                    <SelectTrigger className="h-8 text-xs">
                                                                        <SelectValue placeholder="Same Department" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="same">Same Department</SelectItem>
                                                                        {DEPARTMENTS.map(d => (
                                                                            <SelectItem key={d} value={d}>
                                                                                {localConfig[d]?.label || d}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div className="md:col-span-4 space-y-1">
                                                                <Label className="text-[10px]">Target Status</Label>
                                                                <Select
                                                                    value={action.targetStatus}
                                                                    onValueChange={(val) => updateAction(status.value, action.id, { targetStatus: val as ProductStatus })}
                                                                >
                                                                    <SelectTrigger className="h-8 text-xs">
                                                                        <SelectValue placeholder="Select Status" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {getAllStatuses()
                                                                            .filter(s => action.targetDepartment ? s.dept === action.targetDepartment : s.dept === selectedDept)
                                                                            .map(s => (
                                                                                <SelectItem key={s.value} value={s.value}>
                                                                                    {s.label} ({s.value})
                                                                                </SelectItem>
                                                                            ))
                                                                        }
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div className="md:col-span-1 space-y-1">
                                                                <Label className="text-[10px]">Style</Label>
                                                                <Select
                                                                    value={action.style || 'primary'}
                                                                    onValueChange={(val: any) => updateAction(status.value, action.id, { style: val })}
                                                                >
                                                                    <SelectTrigger className="h-8 text-xs px-2">
                                                                        <div className={`w-3 h-3 rounded-full ${action.style === 'danger' ? 'bg-red-500' :
                                                                            action.style === 'success' ? 'bg-green-500' :
                                                                                action.style === 'secondary' ? 'bg-gray-500' : 'bg-blue-500'
                                                                            }`} />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="primary">Blue</SelectItem>
                                                                        <SelectItem value="secondary">Gray</SelectItem>
                                                                        <SelectItem value="success">Green</SelectItem>
                                                                        <SelectItem value="danger">Red</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div className="md:col-span-1 flex justify-center pb-1">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-6 w-6 text-destructive"
                                                                    onClick={() => removeAction(status.value, action.id)}
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </CardContent>
                                    )}
                                </Card>
                            ))
                        ) : (
                            <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg bg-muted/20">
                                <p className="mb-2">No statuses defined for {selectedDept}.</p>
                                <Button variant="outline" size="sm" onClick={() => updateDepartmentLabel(localConfig[selectedDept]?.label || selectedDept)}>
                                    Initialize Defaults
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
