import { useState, useEffect } from 'react';
import { Users, Mail, Phone, Shield, MoreVertical, Plus, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { AddTeamMemberDialog } from '@/components/dialogs/AddTeamMemberDialog';
import { EditTeamMemberDialog } from '@/components/dialogs/EditTeamMemberDialog';
import { DeleteConfirmDialog } from '@/components/dialogs/DeleteConfirmDialog';

interface TeamMember {
  user_id: string;
  name: string;
  email: string;
  phone?: string;
  roles: string[];
  team: string;
  department?: string;
}

const roleColors: Record<string, string> = {
  admin: 'bg-priority-red/10 text-priority-red border-priority-red/20',
  sales: 'bg-primary/10 text-primary border-primary/20',
  design: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  prepress: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  production: 'bg-priority-yellow/10 text-priority-yellow border-priority-yellow/20',
};

export default function Team() {
  const { isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchTeamMembers = async () => {
    setLoading(true);
    try {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*');

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      // Combine profiles with roles
      const members: TeamMember[] = (profiles || []).map(profile => {
        const userRoles = roles?.filter(r => r.user_id === profile.user_id).map(r => r.role) || [];
        const primaryRole = userRoles[0] || 'sales';
        const team = primaryRole.charAt(0).toUpperCase() + primaryRole.slice(1);
        
        return {
          user_id: profile.user_id,
          name: profile.full_name || 'Unknown',
          email: profile.user_id, // We'll show user_id as placeholder
          phone: profile.phone || undefined,
          roles: userRoles,
          team,
          department: profile.department || undefined,
        };
      });

      setUsers(members);
    } catch (error) {
      console.error('Error fetching team members:', error);
      toast({
        title: "Error",
        description: "Failed to load team members",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.team.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddMember = async (member: {
    name: string;
    email: string;
    phone: string;
    role: string;
    password: string;
  }) => {
    try {
      // Create user via Supabase auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: member.email,
        password: member.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: member.name,
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        // Wait a moment for the trigger to create the profile
        await new Promise(resolve => setTimeout(resolve, 500));

        // Update profile with department
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            full_name: member.name,
            phone: member.phone || null,
            department: member.role, // Use role as department
          })
          .eq('user_id', authData.user.id);

        if (profileError) console.error('Profile update error:', profileError);

        // Add role - check if role already exists first
        const { data: existingRole } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', authData.user.id)
          .maybeSingle();

        if (!existingRole) {
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert({
              user_id: authData.user.id,
              role: member.role as any,
            });

          if (roleError) console.error('Role insert error:', roleError);
        }
      }

      toast({
        title: "Success",
        description: `${member.name} has been added to the team`,
      });

      fetchTeamMembers();
    } catch (error: any) {
      console.error('Error adding member:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add team member",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleEditMember = async (memberId: string, updates: { name: string; phone: string; role: string; department: string }) => {
    try {
      // Update profile with both department and name
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: updates.name,
          phone: updates.phone || null,
          department: updates.department,
        })
        .eq('user_id', memberId);

      if (profileError) throw profileError;

      // Update role - first check if exists
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', memberId)
        .maybeSingle();

      if (existingRole) {
        // Update existing role
        const { error: roleError } = await supabase
          .from('user_roles')
          .update({ role: updates.role as any })
          .eq('user_id', memberId);

        if (roleError) throw roleError;
      } else {
        // Insert new role
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: memberId,
            role: updates.role as any,
          });

        if (roleError) throw roleError;
      }

      toast({
        title: "Success",
        description: "Team member updated successfully",
      });

      fetchTeamMembers();
    } catch (error: any) {
      console.error('Error updating member:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update team member",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleDeleteMember = async () => {
    if (!selectedMember) return;
    
    setDeleteLoading(true);
    try {
      // Delete user role first
      const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', selectedMember.user_id);

      if (roleError) {
        console.error('Role delete error:', roleError);
        // Continue even if role delete fails
      }

      // Delete profile (trigger will clear order_items.assigned_to)
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', selectedMember.user_id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${selectedMember.name} has been removed from the team`,
      });

      setDeleteDialogOpen(false);
      setSelectedMember(null);
      fetchTeamMembers();
    } catch (error: any) {
      console.error('Error deleting member:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete team member. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const openEditDialog = (member: TeamMember) => {
    setSelectedMember(member);
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (member: TeamMember) => {
    setSelectedMember(member);
    setDeleteDialogOpen(true);
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Team Members</h1>
            <p className="text-muted-foreground">Manage your team and their roles</p>
          </div>
          {isAdmin && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={() => setAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Member
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add a new team member</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search team members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading team members...</p>
          </div>
        )}

        {/* Team Grid */}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUsers.map((user) => (
              <Card key={user.user_id} className="card-hover">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {user.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold text-foreground">{user.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {user.department ? user.department.charAt(0).toUpperCase() + user.department.slice(1) : user.team}
                        </p>
                      </div>
                    </div>
                    {isAdmin && (
                      <DropdownMenu>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                          </TooltipTrigger>
                          <TooltipContent>More actions</TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent align="end" className="bg-popover">
                          <DropdownMenuItem onClick={() => openEditDialog(user)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => openDeleteDialog(user)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  <div className="mt-4 space-y-2">
                    {user.phone && (
                      <a 
                        href={`tel:${user.phone}`}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Phone className="h-4 w-4" />
                        {user.phone}
                      </a>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {user.roles.map((role) => (
                      <Badge 
                        key={role} 
                        variant="outline"
                        className={roleColors[role] || 'bg-secondary'}
                      >
                        {role === 'admin' && <Shield className="h-3 w-3 mr-1" />}
                        {role}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No team members found</h3>
            <p className="text-muted-foreground">
              {searchQuery ? 'Try adjusting your search' : 'Add your first team member to get started'}
            </p>
          </div>
        )}

        {/* Dialogs */}
        <AddTeamMemberDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          onAdd={handleAddMember}
        />

        <EditTeamMemberDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          member={selectedMember}
          onSave={handleEditMember}
        />

        <DeleteConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete Team Member"
          description={`Are you sure you want to delete ${selectedMember?.name}? This action cannot be undone. Their order assignments will be cleared.`}
          onConfirm={handleDeleteMember}
          loading={deleteLoading}
        />
      </div>
    </TooltipProvider>
  );
}
