import { useState, useEffect } from 'react';
import { UserCog } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

interface TeamMember {
  user_id: string;
  name: string;
  email: string;
  phone?: string;
  roles: string[];
  team: string;
  department?: string;
}

interface EditTeamMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember | null;
  onSave: (memberId: string, updates: { name: string; phone: string; role: string; department: string }) => void;
}

const roles = [
  { value: 'admin', label: 'Admin' },
  { value: 'sales', label: 'Sales' },
  { value: 'design', label: 'Design' },
  { value: 'prepress', label: 'Prepress' },
  { value: 'production', label: 'Production' },
  { value: 'accounts', label: 'Accounts' },
  { value: 'hr', label: 'HR' },
];

const departments = [
  { value: 'sales', label: 'Sales' },
  { value: 'design', label: 'Design' },
  { value: 'prepress', label: 'Prepress' },
  { value: 'production', label: 'Production' },
  { value: 'accounts', label: 'Accounts' },
  { value: 'hr', label: 'HR' },
];

export function EditTeamMemberDialog({ open, onOpenChange, member, onSave }: EditTeamMemberDialogProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('');
  const [department, setDepartment] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (member) {
      setName(member.name);
      setPhone(member.phone || '');
      setRole(member.roles[0] || 'sales');
      setDepartment(member.department || member.team.toLowerCase() || 'sales');
    }
  }, [member]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!member) return;

    if (!name || !role || !department) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await onSave(member.user_id, { name, phone, role, department });
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating member:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!member) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Edit Team Member
          </DialogTitle>
          <DialogDescription>
            Update team member information
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Full Name *</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter full name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-phone">Phone</Label>
            <Input
              id="edit-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter phone number"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-role">Role (Permissions) *</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Controls user permissions</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-department">Department *</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Which orders they can see</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
