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
import { supabase } from '@/integrations/supabase/client';

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
      const deptLower = department.toLowerCase().trim();
      
      // Map department names to role names
      const roleMap: Record<string, string> = {
        'sales': 'sales',
        'design': 'design',
        'prepress': 'prepress',
        'production': 'production',
        'outsource': 'production', // Outsource users might be in production role
      };
      
      const matchingRole = roleMap[deptLower];
      
      // Strategy 1: Fetch all users from user_roles with matching role (PRIMARY METHOD)
      // This ensures we get ALL users assigned to this department role
      let allUserIds = new Set<string>();
      
      if (matchingRole) {
        const { data: rolesData, error: rolesError } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .eq('role', matchingRole);
        
        if (rolesError) {
          console.error('[AssignUserDialog] Error fetching user_roles:', rolesError);
        } else if (rolesData) {
          rolesData.forEach(r => {
            if (r.user_id) {
              allUserIds.add(r.user_id);
            }
          });
          console.log(`[AssignUserDialog] Found ${rolesData.length} users in user_roles for role: ${matchingRole}`);
        }
      }
      
      // Strategy 2: Also fetch from profiles table with case-insensitive matching
      // This catches users who might have department set in profiles but not in user_roles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, department')
        .not('user_id', 'is', null);
      
      if (profilesError) {
        console.error('[AssignUserDialog] Error fetching profiles:', profilesError);
      } else if (profiles) {
        // Filter profiles by department (case-insensitive)
        const matchingProfiles = profiles.filter(profile => {
          const profileDept = (profile.department || '').toLowerCase().trim();
          return profileDept === deptLower;
        });
        
        matchingProfiles.forEach(profile => {
          if (profile.user_id) {
            allUserIds.add(profile.user_id);
          }
        });
        
        console.log(`[AssignUserDialog] Found ${matchingProfiles.length} users in profiles for department: ${department}`);
      }

      // Now fetch full profile data for all collected user IDs
      let allUsers: any[] = [];
      
      if (allUserIds.size > 0) {
        const userIdsArray = Array.from(allUserIds);
        console.log(`[AssignUserDialog] Fetching profiles for ${userIdsArray.length} unique user IDs`);
        
        // Fetch in batches if too many users (Supabase limit is 1000 per query)
        const batchSize = 1000;
        for (let i = 0; i < userIdsArray.length; i += batchSize) {
          const batch = userIdsArray.slice(i, i + batchSize);
          const { data: userProfiles, error: userProfilesError } = await supabase
            .from('profiles')
            .select('user_id, full_name, department')
            .in('user_id', batch);
          
          if (userProfilesError) {
            console.error('[AssignUserDialog] Error fetching user profiles batch:', userProfilesError);
          } else if (userProfiles) {
            allUsers = [...allUsers, ...userProfiles];
          }
        }
      }

      // Deduplicate and sort by name
      const uniqueUsers = Array.from(
        new Map(allUsers.map(u => [u.user_id, u])).values()
      ).sort((a, b) => {
        const nameA = (a.full_name || 'Unknown').toLowerCase();
        const nameB = (b.full_name || 'Unknown').toLowerCase();
        return nameA.localeCompare(nameB);
      });

      const mappedUsers = uniqueUsers.map(profile => ({
        user_id: profile.user_id,
        full_name: profile.full_name || 'Unknown',
        department: profile.department || department,
      }));

      setUsers(mappedUsers);
      
      console.log(`[AssignUserDialog] Final result: Found ${mappedUsers.length} users for department: ${department}`, mappedUsers);
    } catch (error) {
      console.error('[AssignUserDialog] Error fetching users:', error);
      setUsers([]);
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
