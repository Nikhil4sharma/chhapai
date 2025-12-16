import { useState, useEffect } from 'react';
import { UserCircle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';

interface User {
  user_id: string;
  full_name: string;
  department: string;
}

interface AssignUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssign: (userId: string, userName: string) => void;
  department: string;
  currentUserId?: string;
}

export function AssignUserDialog({
  open,
  onOpenChange,
  onAssign,
  department,
  currentUserId,
}: AssignUserDialogProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>(currentUserId || '');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open, department]);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      // Fetch profiles with matching department
      const profilesQuery = query(
        collection(db, 'profiles'),
        where('department', '==', department)
      );
      const snapshot = await getDocs(profilesQuery);

      setUsers(snapshot.docs.map(doc => ({
        user_id: doc.data().user_id,
        full_name: doc.data().full_name,
        department: doc.data().department,
      })));
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssign = () => {
    const user = users.find(u => u.user_id === selectedUserId);
    if (user) {
      onAssign(user.user_id, user.full_name || 'Unknown');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCircle className="h-5 w-5" />
            Assign to Team Member
          </DialogTitle>
          <DialogDescription>
            Select a team member from {department} department to assign this item.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No team members found in {department} department
            </p>
          ) : (
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a team member" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.user_id} value={user.user_id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">
                          {user.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <span>{user.full_name || 'Unknown'}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={!selectedUserId || isLoading}>
              Assign
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
