import { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Edit, Shield, Loader2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, AppRole } from '@/features/auth/context/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkflowSettingsTab as WorkflowSettings } from '@/features/settings/components/WorkflowSettingsTab';

interface UserWithRole {
  id: string;
  user_id: string;
  full_name: string | null;
  department: string | null;
  email: string;
  role: AppRole;
}

export default function Admin() {
  const { isAdmin, signUp } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // New user form
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<AppRole>('sales');
  const [newDepartment, setNewDepartment] = useState('sales');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*');

      if (profilesError) throw profilesError;

      // Fetch roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      // Combine profiles with roles
      const combinedUsers: UserWithRole[] = (profiles || []).map(profile => {
        const userRole = (roles || []).find(r => r.user_id === profile.user_id);
        return {
          id: profile.id,
          user_id: profile.user_id,
          full_name: profile.full_name,
          department: profile.department,
          email: '', // Email is in auth.users, not in profiles
          role: (userRole?.role as AppRole) || 'sales',
        };
      });

      setUsers(combinedUsers);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newEmail || !newPassword || !newFullName) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      // Create user via Supabase Auth
      // Note: Email auto-confirm trigger se automatically confirm ho jayega
      // Agar trigger nahi hai, toh FIX_EMAIL_CONFIRMATION_AND_LOGIN.sql run karo
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newEmail,
        password: newPassword,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: newFullName,
          }
        }
      });

      // If user created but email not confirmed, try to confirm via SQL (if trigger exists)
      // Note: Frontend se directly confirm nahi kar sakte, trigger automatically karega

      if (authError) throw authError;
      if (!authData.user) throw new Error('User creation failed');

      const newUser = authData.user;

      // Create profile in Supabase
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: newUser.id,
          full_name: newFullName,
          department: newDepartment,
          phone: null,
          avatar_url: null,
        });

      if (profileError) throw profileError;

      // Create role in Supabase
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: newUser.id,
          role: newRole as any,
        });

      if (roleError) throw roleError;

      // Note: Email auto-confirm trigger se automatically confirm ho jayega
      // Agar trigger nahi hai, toh FIX_EMAIL_CONFIRMATION_AND_LOGIN.sql run karo

      toast({
        title: "Success",
        description: `User ${newEmail} created successfully. Email will be auto-confirmed if trigger is enabled.`,
      });
      setDialogOpen(false);
      setNewEmail('');
      setNewPassword('');
      setNewFullName('');
      setNewRole('sales');
      setNewDepartment('sales');
      fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    try {
      // Delete user roles
      const { error: rolesError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (rolesError) throw rolesError;

      // Delete profile (CASCADE will handle related data)
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', userId);

      if (profileError) throw profileError;

      toast({
        title: "Success",
        description: `${userName || 'User'} has been removed`,
      });

      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    }
  };

  const handleUpdateRole = async (userId: string, newRole: AppRole) => {
    try {
      // Delete all existing roles for this user
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      // Create new role
      const { error: insertError } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: newRole as any,
        });

      if (insertError) throw insertError;

      toast({
        title: "Success",
        description: "User role updated",
      });

      fetchUsers();
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: "Error",
        description: "Failed to update role",
        variant: "destructive",
      });
    }
  };

  const handleUpdateDepartment = async (userId: string, department: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          department,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Department updated",
      });

      fetchUsers();
    } catch (error: any) {
      console.error('Error updating department:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update department",
        variant: "destructive",
      });
    }
  };


  const getRoleBadgeVariant = (role: AppRole) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'sales': return 'stage-sales';
      case 'design': return 'stage-design';
      case 'prepress': return 'stage-prepress';
      case 'production': return 'stage-production';
      default: return 'secondary';
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">You don't have permission to access this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Admin Panel</h1>
          <p className="text-muted-foreground">Manage users, roles, and system workflows</p>
        </div>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="workflow">Workflow Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          <div className="flex justify-end">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New User</DialogTitle>
                  <DialogDescription>
                    Add a new user to the system and assign their role
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="newFullName">Full Name</Label>
                    <Input
                      id="newFullName"
                      value={newFullName}
                      onChange={(e) => setNewFullName(e.target.value)}
                      placeholder="John Doe"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newEmail">Email</Label>
                    <Input
                      id="newEmail"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="user@company.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newRole">Role (Permissions)</Label>
                    <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="sales">Sales</SelectItem>
                        <SelectItem value="design">Design</SelectItem>
                        <SelectItem value="prepress">Prepress</SelectItem>
                        <SelectItem value="production">Production</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Controls user permissions</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newDepartment">Department</Label>
                    <Select value={newDepartment} onValueChange={setNewDepartment}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sales">Sales</SelectItem>
                        <SelectItem value="design">Design</SelectItem>
                        <SelectItem value="prepress">Prepress</SelectItem>
                        <SelectItem value="production">Production</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Which orders they can see</p>
                  </div>


                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isCreating}>
                      {isCreating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          Create User
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <Users className="h-5 w-5" />
                All Users ({users.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="min-w-[600px] px-4 sm:px-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[180px]">Name</TableHead>
                          <TableHead className="w-[140px]">Department</TableHead>
                          <TableHead className="w-[140px]">Role</TableHead>
                          <TableHead className="text-right w-[80px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <p className="font-medium text-sm truncate max-w-[160px]">{user.full_name || 'Unnamed'}</p>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={user.department || 'sales'}
                                onValueChange={(v) => handleUpdateDepartment(user.user_id, v)}
                              >
                                <SelectTrigger className="w-28 h-8 text-xs">
                                  <SelectValue>{user.department || 'Select'}</SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="sales">Sales</SelectItem>
                                  <SelectItem value="design">Design</SelectItem>
                                  <SelectItem value="prepress">Prepress</SelectItem>
                                  <SelectItem value="production">Production</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={user.role}
                                onValueChange={(v) => handleUpdateRole(user.user_id, v as AppRole)}
                              >
                                <SelectTrigger className="w-28 h-8 text-xs">
                                  <Badge variant={getRoleBadgeVariant(user.role) as any} className="text-xs">
                                    {user.role}
                                  </Badge>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="sales">Sales</SelectItem>
                                  <SelectItem value="design">Design</SelectItem>
                                  <SelectItem value="prepress">Prepress</SelectItem>
                                  <SelectItem value="production">Production</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleDeleteUser(user.user_id, user.full_name || 'User')}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflow">
          <WorkflowSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

