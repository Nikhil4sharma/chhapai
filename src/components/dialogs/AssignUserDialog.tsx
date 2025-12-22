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
      
      // Map department names to role names (CRITICAL: This is the primary source of truth)
      const roleMap: Record<string, string> = {
        'sales': 'sales',
        'design': 'design',
        'prepress': 'prepress',
        'production': 'production',
        'outsource': 'production', // Outsource users might be in production role
        'dispatch': 'production', // Dispatch is handled by production team
      };
      
      const matchingRole = roleMap[deptLower];
      
      // CRITICAL: Strategy 1 - Fetch ALL users from user_roles with matching role (PRIMARY METHOD)
      // This is the source of truth - if user has role='design' in user_roles, they ARE in design department
      let allUserIds = new Set<string>();
      let usersFromRoles = 0;
      
      if (matchingRole) {
        const { data: rolesData, error: rolesError } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .eq('role', matchingRole);
        
        if (rolesError) {
          console.error('[AssignUserDialog] Error fetching user_roles:', rolesError);
        } else if (rolesData && rolesData.length > 0) {
          rolesData.forEach(r => {
            if (r.user_id) {
              allUserIds.add(r.user_id);
              usersFromRoles++;
            }
          });
          console.log(`[AssignUserDialog] Found ${usersFromRoles} users in user_roles for role: ${matchingRole}`);
        } else {
          console.warn(`[AssignUserDialog] No users found in user_roles for role: ${matchingRole}, department: ${department}`);
        }
      } else {
        console.warn(`[AssignUserDialog] No role mapping found for department: ${department}`);
      }
      
      // Strategy 2: Also fetch from profiles table with case-insensitive matching (BACKUP METHOD)
      // This catches edge cases where department is set in profiles but role might be missing
      // But user_roles is PRIMARY - profiles is just backup
      let usersFromProfiles = 0;
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
          if (profile.user_id && !allUserIds.has(profile.user_id)) {
            allUserIds.add(profile.user_id);
            usersFromProfiles++;
          }
        });
        
        console.log(`[AssignUserDialog] Found ${usersFromProfiles} additional users in profiles for department: ${department}`);
      }
      
      console.log(`[AssignUserDialog] Total unique users collected: ${allUserIds.size} (${usersFromRoles} from roles, ${usersFromProfiles} from profiles)`);

      // CRITICAL: Now fetch full profile data for ALL collected user IDs
      // Don't filter by department again - we already have the right users
      let allUsers: any[] = [];
      const profileMap = new Map<string, any>();
      
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
            userProfiles.forEach(profile => {
              profileMap.set(profile.user_id, profile);
            });
            allUsers = [...allUsers, ...userProfiles];
          }
        }
        
        // CRITICAL: Include users that have role but no profile entry
        // Create entries for users found in user_roles but missing from profiles
        userIdsArray.forEach(userId => {
          if (!profileMap.has(userId)) {
            console.warn(`[AssignUserDialog] User ${userId} has role but no profile entry - creating fallback entry`);
            allUsers.push({
              user_id: userId,
              full_name: null,
              department: department,
            });
          }
        });
      } else {
        console.warn(`[AssignUserDialog] No user IDs collected for department: ${department}`);
      }

      // Deduplicate and sort by name
      const uniqueUsers = Array.from(
        new Map(allUsers.map(u => [u.user_id, u])).values()
      ).sort((a, b) => {
        const nameA = (a.full_name || 'Unknown User').toLowerCase();
        const nameB = (b.full_name || 'Unknown User').toLowerCase();
        return nameA.localeCompare(nameB);
      });

      // Map to User interface - use department from profile or fallback to passed department
      const mappedUsers = uniqueUsers.map(profile => ({
        user_id: profile.user_id,
        full_name: profile.full_name || `User (${profile.user_id.slice(0, 8)}...)`,
        department: profile.department || department, // Use profile department or fallback
      }));

      setUsers(mappedUsers);
      
      console.log(`[AssignUserDialog] Final result: Found ${mappedUsers.length} users for department: ${department}`, {
        department,
        matchingRole,
        userCount: mappedUsers.length,
        users: mappedUsers.map(u => ({ name: u.full_name, id: u.user_id }))
      });
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
