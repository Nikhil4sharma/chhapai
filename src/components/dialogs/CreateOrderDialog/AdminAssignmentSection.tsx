import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User } from 'lucide-react';

interface AdminAssignmentSectionProps {
    selectedDepartment: string;
    setSelectedDepartment: (value: string) => void;
    selectedUser: string;
    setSelectedUser: (value: string) => void;
    departmentUsers: any[];
}

export function AdminAssignmentSection({
    selectedDepartment,
    setSelectedDepartment,
    selectedUser,
    setSelectedUser,
    departmentUsers
}: AdminAssignmentSectionProps) {
    return (
        <Card className="border-2 border-indigo-100 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 shadow-sm">
            <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-indigo-900 dark:text-indigo-100">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 shadow-sm">
                        <User className="h-4 w-4 text-white" />
                    </div>
                    Admin Assignment
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="admin_department" className="text-sm font-medium">Department *</Label>
                        <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                            <SelectTrigger id="admin_department" className="bg-white dark:bg-slate-950">
                                <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="sales">Sales</SelectItem>
                                <SelectItem value="design">Design</SelectItem>
                                <SelectItem value="prepress">Prepress</SelectItem>
                                <SelectItem value="production">Production</SelectItem>
                                <SelectItem value="outsource">Outsource</SelectItem>
                                <SelectItem value="dispatch">Dispatch</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="admin_user" className="text-sm font-medium">Assign To *</Label>
                        <Select value={selectedUser} onValueChange={setSelectedUser}>
                            <SelectTrigger id="admin_user" className="bg-white dark:bg-slate-950">
                                <SelectValue placeholder="Select user" />
                            </SelectTrigger>
                            <SelectContent>
                                {departmentUsers.map(u => (
                                    <SelectItem key={u.user_id} value={u.user_id}>
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-5 w-5">
                                                <AvatarFallback className="text-xs">
                                                    {(u.full_name?.[0] || '?').toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            {u.full_name}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
