import { useState } from 'react';
import { UserPlus } from 'lucide-react';
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

interface AddTeamMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (member: {
    name: string;
    email: string;
    phone: string;
    role?: string;
    department: string;
    password?: string;
    category: 'office' | 'factory';
  }) => void;
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

export function AddTeamMemberDialog({ open, onOpenChange, onAdd }: AddTeamMemberDialogProps) {
  const [category, setCategory] = useState<'office' | 'factory'>('office');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('');
  const [department, setDepartment] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || (!department)) {
      toast({
        title: "Error",
        description: "Name and Department are required",
        variant: "destructive",
      });
      return;
    }

    if (category === 'office' && (!email || !role || !password)) {
      toast({
        title: "Error",
        description: "Email, Role and Password are required for Office employees",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await onAdd({
        name,
        email: category === 'office' ? email : `factory_${Date.now()}@internal.app`,
        phone,
        role: category === 'office' ? role : 'production',
        department,
        password: category === 'office' ? password : `Factory@${Date.now()}`,
        category
      });
      setName('');
      setEmail('');
      setPhone('');
      setRole('');
      setDepartment('');
      setPassword('');
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding member:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add Team Member
          </DialogTitle>
          <DialogDescription>
            Create a new team member account
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-4 mb-4 border-b border-slate-200 dark:border-slate-800 pb-2">
            <button
              type="button"
              onClick={() => setCategory('office')}
              className={`pb-2 text-sm font-medium transition-all ${category === 'office' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500'}`}
            >
              Office Employee
            </button>
            <button
              type="button"
              onClick={() => setCategory('factory')}
              className={`pb-2 text-sm font-medium transition-all ${category === 'factory' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500'}`}
            >
              Factory Employee
            </button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter full name"
              required
            />
          </div>

          {category === 'office' && (
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email address"
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter phone number"
            />
          </div>

          {category === 'office' && (
            <div className="space-y-2">
              <Label htmlFor="role">Role (Permissions) *</Label>
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
              <p className="text-xs text-muted-foreground">Controls user permissions and access</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="department">Department *</Label>
            {category === 'office' ? (
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
            ) : (
              <Input
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Enter department (e.g. Cutting, Binding)"
                required
              />
            )}
          </div>

          {category === 'office' && (
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Member'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
