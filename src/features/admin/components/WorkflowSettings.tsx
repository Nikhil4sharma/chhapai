
import { useState } from 'react';
import { useWorkflow } from '@/contexts/WorkflowContext';
import { DepartmentConfig, StatusConfig } from '@/types/workflow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Save, GripVertical, HelpCircle, icons as LucideIcons } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

const InfoTooltip = ({ content }: { content: string }) => (
    <TooltipProvider>
        <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-help transition-colors" />
            </TooltipTrigger>
            <TooltipContent>
                <p className="max-w-xs text-sm">{content}</p>
            </TooltipContent>
        </Tooltip>
    </TooltipProvider>
);

export function WorkflowSettings() {
    const { config, updateConfig, isLoading } = useWorkflow();
    const [departments, setDepartments] = useState<DepartmentConfig[]>(config.departments);
    const [isSaving, setIsSaving] = useState(false);

    // Sync local state with context when config changes (and not editing)
    // This might overwrite unsaved changes if config updates from elsewhere, 
    // but for admin settings simpler is better.
    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateConfig({ departments });
            toast.success("Workflow settings saved successfully");
        } catch (error) {
            toast.error("Failed to save workflow settings");
        } finally {
            setIsSaving(false);
        }
    };

    const addDepartment = () => {
        const newDept: DepartmentConfig = {
            id: `new_dept_${Date.now()}`,
            label: 'New Department',
            description: 'Department description',
            icon: 'Box',
            color: 'text-gray-500',
            bg: 'bg-gray-500/10',
            statuses: []
        };
        setDepartments([...departments, newDept]);
    };

    const updateDepartment = (index: number, updates: Partial<DepartmentConfig>) => {
        const newDepts = [...departments];
        newDepts[index] = { ...newDepts[index], ...updates };
        setDepartments(newDepts);
    };

    const removeDepartment = (index: number) => {
        const newDepts = [...departments];
        newDepts.splice(index, 1);
        setDepartments(newDepts);
    };

    const addStatus = (deptIndex: number) => {
        const newDepts = [...departments];
        newDepts[deptIndex].statuses.push({ value: `status_${Date.now()}`, label: 'New Status' });
        setDepartments(newDepts);
    };

    const updateStatus = (deptIndex: number, statusIndex: number, updates: Partial<StatusConfig>) => {
        const newDepts = [...departments];
        newDepts[deptIndex].statuses[statusIndex] = {
            ...newDepts[deptIndex].statuses[statusIndex],
            ...updates
        };
        setDepartments(newDepts);
    };

    const removeStatus = (deptIndex: number, statusIndex: number) => {
        const newDepts = [...departments];
        newDepts[deptIndex].statuses.splice(statusIndex, 1);
        setDepartments(newDepts);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-semibold">Workflow Configuration</h2>
                    <p className="text-muted-foreground">Manage departments, active stages, and status options.</p>
                </div>
                <Button onClick={handleSave} disabled={isLoading || isSaving}>
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
            </div>

            <div className="grid gap-6">
                {departments.map((dept, deptIndex) => {
                    // Resolve Icon dynamically
                    const IconComponent = (LucideIcons as any)[dept.icon] || LucideIcons.Box;

                    return (
                        <Card key={dept.id || deptIndex} className="relative overflow-hidden group/card shadow-sm hover:shadow-md transition-shadow">
                            <div className={cn("absolute left-0 top-0 bottom-0 w-1 transition-colors", dept.color.replace('text-', 'bg-'))} />
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1 flex-1">
                                        <div className="flex items-center gap-2">
                                            <IconComponent className={cn("h-6 w-6 mr-2", dept.color)} />
                                            <Input
                                                value={dept.label}
                                                onChange={(e) => updateDepartment(deptIndex, { label: e.target.value })}
                                                className="font-semibold text-lg h-9 w-64 border-transparent hover:border-input focus:border-input px-2 -ml-2 rounded transition-colors"
                                                placeholder="Department Name"
                                            />
                                            <Badge variant="outline" className="font-mono text-xs">{dept.id}</Badge>
                                        </div>
                                        <Input
                                            value={dept.description}
                                            onChange={(e) => updateDepartment(deptIndex, { description: e.target.value })}
                                            className="text-muted-foreground h-7 w-96 border-transparent hover:border-input focus:border-input px-2 -ml-2 text-sm"
                                            placeholder="Brief description of this department's role"
                                        />
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => removeDepartment(deptIndex)} className="text-muted-foreground hover:text-destructive">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <Accordion type="single" collapsible>
                                    <AccordionItem value="settings" className="border-b-0">
                                        <AccordionTrigger className="hover:no-underline py-2 text-sm text-muted-foreground data-[state=open]:text-foreground">
                                            Configure Settings & Statuses
                                        </AccordionTrigger>
                                        <AccordionContent className="space-y-6 pt-4">
                                            {/* Appearance Settings */}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 bg-muted/30 rounded-lg border border-border/50">
                                                <div className="space-y-3">
                                                    <Label className="flex items-center gap-2">
                                                        ID (Unique Key)
                                                        <InfoTooltip content="Unique identifier used in the system. Use lowercase, no spaces (e.g., 'sales', 'prepress')." />
                                                    </Label>
                                                    <Input
                                                        value={dept.id}
                                                        onChange={(e) => updateDepartment(deptIndex, { id: e.target.value })}
                                                        placeholder="e.g., sales"
                                                        className="font-mono"
                                                    />
                                                </div>
                                                <div className="space-y-3">
                                                    <Label className="flex items-center gap-2">
                                                        Icon (Lucide Name)
                                                        <InfoTooltip content="Name of the icon from the Lucide library. Case-sensitive." />
                                                    </Label>
                                                    <div className="relative">
                                                        <Input
                                                            value={dept.icon}
                                                            onChange={(e) => updateDepartment(deptIndex, { icon: e.target.value })}
                                                            placeholder="e.g. ShoppingCart"
                                                            className="pr-10"
                                                        />
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                                            <IconComponent className="h-4 w-4" />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="space-y-3">
                                                    <Label className="flex items-center gap-2">
                                                        Appearance
                                                        <InfoTooltip content="Tailwind CSS classes for styling. 'Text' for icon/text color, 'Bg' for background tint." />
                                                    </Label>
                                                    <div className="flex gap-2">
                                                        <Input
                                                            value={dept.color}
                                                            onChange={(e) => updateDepartment(deptIndex, { color: e.target.value })}
                                                            placeholder="text-blue-500"
                                                        />
                                                        <Input
                                                            value={dept.bg}
                                                            onChange={(e) => updateDepartment(deptIndex, { bg: e.target.value })}
                                                            placeholder="bg-blue-500/10"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Status Management */}
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="text-sm font-medium">Status Workflow</h4>
                                                        <InfoTooltip content="Define the stages an order goes through in this department. Users will select these to update progress." />
                                                    </div>
                                                    <Button variant="outline" size="sm" onClick={() => addStatus(deptIndex)}>
                                                        <Plus className="h-3 w-3 mr-1" /> Add Status
                                                    </Button>
                                                </div>

                                                <div className="space-y-2">
                                                    {dept.statuses.length > 0 && (
                                                        <div className="grid grid-cols-[24px_1fr_1fr_40px] gap-2 px-2 pb-1 text-xs text-muted-foreground font-medium">
                                                            <div></div>
                                                            <div>Display Label</div>
                                                            <div>Internal Value (ID)</div>
                                                            <div></div>
                                                        </div>
                                                    )}
                                                    {dept.statuses.map((status, statusIndex) => (
                                                        <div key={statusIndex} className="flex items-center gap-2 p-2 bg-background border rounded-md group hover:border-primary/50 transition-colors">
                                                            <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab opacity-50" />
                                                            <div className="flex-1 grid grid-cols-2 gap-2">
                                                                <Input
                                                                    value={status.label}
                                                                    onChange={(e) => updateStatus(deptIndex, statusIndex, { label: e.target.value })}
                                                                    placeholder="e.g. Pending Approval"
                                                                    className="h-8"
                                                                />
                                                                <Input
                                                                    value={status.value}
                                                                    onChange={(e) => updateStatus(deptIndex, statusIndex, { value: e.target.value })}
                                                                    placeholder="e.g. pending_approval"
                                                                    className="h-8 font-mono text-xs"
                                                                />
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                                                                onClick={() => removeStatus(deptIndex, statusIndex)}
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                    {dept.statuses.length === 0 && (
                                                        <div className="text-sm text-muted-foreground text-center py-8 border rounded-md bg-muted/10 border-dashed">
                                                            No statuses defined. Orders cannot be tracked in this department without statuses.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>
                            </CardContent>
                        </Card>
                    );
                })}

                <Button variant="outline" className="border-dashed h-12 w-full hover:bg-muted/50" onClick={addDepartment}>
                    <Plus className="h-4 w-4 mr-2" /> Add New Department
                </Button>
            </div>
        </div>
    );
}

