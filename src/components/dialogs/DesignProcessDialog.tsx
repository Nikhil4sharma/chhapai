import { useState, useMemo, useEffect } from 'react';
import { Users, Palette, ArrowRight, icons as LucideIcons } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/features/auth/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useWorkflow } from '@/contexts/WorkflowContext';

interface DesignProcessDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (targetDept: string, userId?: string | null, status?: string, notes?: string) => void;
    currentDepartment?: string;
    orderId: string;
}

export function DesignProcessDialog({
    open,
    onOpenChange,
    onConfirm,
    currentDepartment,
    orderId
}: DesignProcessDialogProps) {
    const { role } = useAuth();
    const { config } = useWorkflow();
    const [selectedDept, setSelectedDept] = useState<string>('');
    const [selectedUser, setSelectedUser] = useState<string>('none');
    const [selectedStatus, setSelectedStatus] = useState<string>('');
    const [notes, setNotes] = useState('');
    const [users, setUsers] = useState<{ id: string, name: string, role?: string }[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    // Set default selection when dialog opens or config loads
    useEffect(() => {
        if (open && config.departments.length > 0 && !selectedDept) {
            // Default to first department (usually Sales)
            setSelectedDept(config.departments[0].id);
        }
    }, [open, config.departments, selectedDept]);

    // Get current department config object
    const currentDeptConfig = useMemo(() =>
        config.departments.find(d => d.id === selectedDept),
        [config.departments, selectedDept]);

    // Update status when department changes
    useEffect(() => {
        if (currentDeptConfig && currentDeptConfig.statuses.length > 0) {
            setSelectedStatus(currentDeptConfig.statuses[0].value);
        } else {
            setSelectedStatus('');
        }
    }, [currentDeptConfig]);

    // Fetch users when department changes
    useEffect(() => {
        const fetchUsers = async () => {
            if (!selectedDept) return;

            setLoadingUsers(true);
            try {
                // Fetch profiles with matching department
                const { data: profiles, error } = await supabase
                    .from('profiles')
                    .select('user_id, full_name, department')
                    .eq('department', selectedDept);

                if (error) throw error;

                if (profiles) {
                    setUsers(profiles.map(p => ({
                        id: p.user_id,
                        name: p.full_name || 'Unknown',
                        role: p.department
                    })));
                } else {
                    setUsers([]);
                }
            } catch (err) {
                console.error('Error fetching users:', err);
                setUsers([]);
            } finally {
                setLoadingUsers(false);
            }
        };

        if (selectedDept) {
            fetchUsers();
            setSelectedUser('none');
        }
    }, [selectedDept]);

    const handleSubmit = () => {
        const userIdToAssign = selectedUser === 'none' ? null : selectedUser;
        onConfirm(selectedDept, userIdToAssign, selectedStatus, notes);
        onOpenChange(false);
    };

    // Helper to dynamically get Icon component
    const getIcon = (iconName: string) => {
        const Icon = (LucideIcons as any)[iconName];
        return Icon ? Icon : Palette;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg overflow-hidden flex flex-col max-h-[90vh] p-0 gap-0">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="text-xl flex items-center gap-2">
                        <Palette className="h-5 w-5 text-primary" />
                        Process Design
                    </DialogTitle>
                    <DialogDescription>
                        Move this item to the next stage of the workflow.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                    {/* Department Selection */}
                    <div className="space-y-3">
                        <Label className="text-sm font-medium text-foreground/80">Select Next Destination</Label>
                        <RadioGroup value={selectedDept} onValueChange={setSelectedDept} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {config.departments.map((dept) => {
                                const Icon = getIcon(dept.icon);
                                // Generate dynamic classes for border color based on text color convention
                                // Assuming dept.color is like 'text-blue-500', we try to make 'border-blue-500'
                                const borderColor = dept.color.replace('text-', 'border-');
                                const activeBg = dept.bg.replace('/10', '/5');

                                return (
                                    <div key={dept.id} className="relative group">
                                        <RadioGroupItem
                                            value={dept.id}
                                            id={dept.id}
                                            className="peer sr-only"
                                        />
                                        <Label
                                            htmlFor={dept.id}
                                            className={cn(
                                                "flex flex-col gap-2 p-3 rounded-xl border border-border cursor-pointer transition-all hover:bg-muted/50 hover:border-primary/50 hover:shadow-sm h-full",
                                                "peer-data-[state=checked]:border-2 peer-data-[state=checked]:shadow-md",
                                                // Dynamic active state styles
                                                `peer-data-[state=checked]:${borderColor}`,
                                                `peer-data-[state=checked]:${activeBg}`
                                            )}
                                        >
                                            <div className="flex items-center justify-between w-full">
                                                <div className={cn("h-8 w-8 rounded-full flex items-center justify-center transition-colors", dept.bg)}>
                                                    <Icon className={cn("h-4 w-4", dept.color)} />
                                                </div>
                                                <div className="h-4 w-4 rounded-full border-2 border-muted peer-data-[state=checked]:border-primary peer-group-data-[state=checked]:bg-primary transition-all scale-0 peer-data-[state=checked]:scale-100 opacity-0 peer-data-[state=checked]:opacity-100"></div>
                                            </div>
                                            <div>
                                                <p className="font-semibold text-sm text-foreground">{dept.label}</p>
                                                <p className="text-[11px] text-muted-foreground leading-tight mt-1">{dept.description}</p>
                                            </div>
                                        </Label>
                                    </div>
                                );
                            })}
                        </RadioGroup>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Status Selection */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-foreground/80">Set Status</Label>
                            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                                <SelectTrigger className="h-10 bg-muted/20">
                                    <SelectValue placeholder="Select status..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {currentDeptConfig?.statuses.map((status) => (
                                        <SelectItem key={status.value} value={status.value}>
                                            {status.label}
                                        </SelectItem>
                                    ))}
                                    {(!currentDeptConfig?.statuses || currentDeptConfig.statuses.length === 0) && (
                                        <div className="p-2 text-xs text-muted-foreground text-center">No status options configured</div>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* User Selection */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-foreground/80">Assign User <span className="text-muted-foreground font-normal text-xs">(Optional)</span></Label>
                            <Select value={selectedUser} onValueChange={setSelectedUser} disabled={loadingUsers}>
                                <SelectTrigger className="h-10 bg-muted/20">
                                    <div className="flex items-center gap-2">
                                        <Users className="h-4 w-4 text-muted-foreground" />
                                        <SelectValue placeholder={loadingUsers ? "Loading user list..." : "Select user..."} />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">-- Department Pool --</SelectItem>
                                    {users.map(u => (
                                        <SelectItem key={u.id} value={u.id}>
                                            <span className="flex items-center gap-2">
                                                <span>{u.name}</span>
                                            </span>
                                        </SelectItem>
                                    ))}
                                    {users.length === 0 && !loadingUsers && (
                                        <div className="p-2 text-xs text-muted-foreground text-center">No users found in {selectedDept}</div>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground/80">Notes / Internal Instructions</Label>
                        <Textarea
                            placeholder={`Add notes for the ${currentDeptConfig?.label || 'next'} team...`}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="min-h-[80px] bg-muted/20 resize-none focus-visible:ring-1 focus-visible:ring-primary/50"
                        />
                    </div>
                </div>

                <DialogFooter className="p-4 bg-muted/10 border-t border-border mt-auto gap-2 sm:gap-0">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="h-10">
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} className="h-10 px-6 bg-primary hover:bg-primary/90 transition-all shadow-sm hover:shadow-md">
                        <span className="flex items-center gap-2">
                            Proceed to {currentDeptConfig?.label.split(' ')[0] || 'Next Stage'}
                            <ArrowRight className="h-4 w-4" />
                        </span>
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
