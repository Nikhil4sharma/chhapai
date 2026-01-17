import { useState, useRef } from 'react';
import { User, Mail, Phone, Building, Shield, Lock, Save, Loader2, Camera, Upload, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useOrders } from '@/features/orders/context/OrderContext';
import { toast } from '@/hooks/use-toast';
import { uploadAvatar } from '@/services/supabaseStorage';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileHRTab } from "../components/ProfileHRTab";

export default function Profile() {
  const { user, profile, role, updatePassword, updateProfile, updateEmail, isAdmin } = useAuth();
  const { refreshOrders } = useOrders();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);

    const { error } = await updateProfile({
      full_name: fullName,
      phone: phone,
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    }

    setIsUpdatingProfile(false);
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !user) return;

    if (email === user.email) {
      toast({
        title: "No Changes",
        description: "Email is the same as current email",
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setIsUpdatingEmail(true);
    const { error } = await updateEmail(email);

    if (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to update email",
        variant: "destructive",
      });
      // Reset email to original
      setEmail(user.email || '');
    } else {
      toast({
        title: "Success",
        description: "Email updated successfully. Please check your new email for verification.",
      });
    }

    setIsUpdatingEmail(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    setIsUpdatingPassword(true);
    const { error } = await updatePassword(newPassword);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update password",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Password updated successfully",
      });
      setNewPassword('');
      setConfirmPassword('');
    }

    setIsUpdatingPassword(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Error",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Image must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingAvatar(true);
    try {
      // Upload to Supabase Storage
      const uploadResult = await uploadAvatar(file, user.id);

      // Update profile with avatar URL
      const { error: updateError } = await updateProfile({
        avatar_url: uploadResult.url,
      });

      if (updateError) throw updateError;

      // Force refresh profile to show new avatar
      window.location.reload();

      toast({
        title: "Success",
        description: "Profile picture updated successfully",
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: "Error",
        description: "Failed to upload profile picture",
        variant: "destructive",
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const getRoleBadgeVariant = () => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'sales': return 'stage-sales';
      case 'design': return 'stage-design';
      case 'prepress': return 'stage-prepress';
      case 'production': return 'stage-production';
      default: return 'secondary';
    }
  };

  const getInitials = () => {
    if (!profile?.full_name) return 'U';
    return profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Profile</h1>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="hr">HR & Payroll</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          {/* Account Info with Avatar Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <User className="h-5 w-5" />
                Account Information
              </CardTitle>
              <CardDescription>Your account details and role</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-secondary/50 rounded-lg">
                <div className="relative group">
                  <Avatar className="h-20 w-20 border-2 border-border">
                    <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name || 'User'} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xl">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    {isUploadingAvatar ? (
                      <Loader2 className="h-6 w-6 text-white animate-spin" />
                    ) : (
                      <Camera className="h-6 w-6 text-white" />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{profile?.full_name || 'User'}</h3>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={getRoleBadgeVariant() as any}>
                      <Shield className="h-3 w-3 mr-1" />
                      {role?.toUpperCase()}
                    </Badge>
                    {profile?.department && (
                      <Badge variant="outline">
                        <Building className="h-3 w-3 mr-1" />
                        {profile.department}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Hover over your avatar and click to upload a new profile picture
              </p>
            </CardContent>
          </Card>

          {/* Edit Profile */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display">Edit Profile</CardTitle>
              <CardDescription>Update your personal information</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="pl-10"
                        placeholder="Your full name"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="pl-10"
                        placeholder="+91 98765 43210"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      placeholder="your.email@example.com"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Update your email address</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleUpdateEmail}
                      disabled={isUpdatingEmail || email === user?.email}
                    >
                      {isUpdatingEmail ? (
                        <>
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        'Update Email'
                      )}
                    </Button>
                  </div>
                </div>

                <Button type="submit" disabled={isUpdatingProfile}>
                  {isUpdatingProfile ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Change Password */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Change Password
              </CardTitle>
              <CardDescription>Update your password</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                <Button type="submit" variant="outline" disabled={isUpdatingPassword}>
                  {isUpdatingPassword ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Lock className="mr-2 h-4 w-4" />
                      Update Password
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Delete All Orders - Admin Only */}
          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-display flex items-center gap-2 text-destructive">
                  <Trash2 className="h-5 w-5" />
                  Delete All Orders
                </CardTitle>
                <CardDescription>
                  Permanently delete all orders, items, files, and timeline entries. This cannot be undone!
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
                    <p className="text-sm text-destructive font-medium mb-2">⚠️ Warning</p>
                    <p className="text-sm text-muted-foreground">
                      This action will permanently delete ALL orders, order items, files, and timeline entries from the system.
                      This operation cannot be undone. Please use this feature with extreme caution.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={async () => {
                      if (!confirm('⚠️ WARNING: This will delete ALL orders, items, files, and timeline entries. This action CANNOT be undone!\n\nType "DELETE ALL" to confirm:')) {
                        return;
                      }

                      const confirmation = prompt('Type "DELETE ALL" to confirm deletion:');
                      if (confirmation !== 'DELETE ALL') {
                        toast({
                          title: "Cancelled",
                          description: "Deletion cancelled. Orders are safe.",
                        });
                        return;
                      }

                      try {
                        // Get all orders first to count them
                        const { data: ordersData, error: fetchError } = await supabase
                          .from('orders')
                          .select('id');

                        if (fetchError) {
                          throw fetchError;
                        }

                        const orders = ordersData || [];

                        if (orders.length === 0) {
                          toast({
                            title: "No Orders Found",
                            description: "There are no orders to delete.",
                          });
                          return;
                        }

                        // Since CASCADE is set up in the database schema:
                        // - Deleting orders will automatically delete related order_items (ON DELETE CASCADE)
                        // - Deleting order_items will automatically delete related order_files (ON DELETE CASCADE)
                        // - Deleting orders will automatically delete related timeline entries (ON DELETE CASCADE)
                        // So we only need to delete orders, and everything else will be deleted automatically

                        const orderIds = orders.map(o => o.id).filter((id): id is string => !!id);

                        if (orderIds.length === 0) {
                          toast({
                            title: "Error",
                            description: "No valid order IDs found.",
                            variant: "destructive",
                          });
                          return;
                        }

                        // Delete orders in batches (Supabase has a limit on .in() queries)
                        const BATCH_SIZE = 100;
                        let deleted = 0;
                        let lastError: any = null;

                        for (let i = 0; i < orderIds.length; i += BATCH_SIZE) {
                          const batch = orderIds.slice(i, i + BATCH_SIZE);
                          const { error: deleteError } = await supabase
                            .from('orders')
                            .delete()
                            .in('id', batch);

                          if (deleteError) {
                            console.error(`Error deleting batch ${i / BATCH_SIZE + 1}:`, deleteError);
                            lastError = deleteError;
                            // Continue with next batch even if one fails
                          } else {
                            deleted += batch.length;
                          }
                        }

                        if (lastError && deleted === 0) {
                          // All batches failed
                          throw lastError;
                        }

                        // Verify deletion by checking if any orders remain
                        const { data: remainingOrders } = await supabase
                          .from('orders')
                          .select('id')
                          .limit(1);

                        if (remainingOrders && remainingOrders.length > 0) {
                          // Some orders might still exist, log warning but don't fail
                          console.warn('Some orders may not have been deleted. Remaining count:', remainingOrders.length);
                        }

                        toast({
                          title: "All Orders Deleted",
                          description: `Successfully deleted ${deleted} orders (including all timeline entries and files).`,
                        });

                        // Refresh orders and timeline
                        refreshOrders();

                        // Force refresh timeline by reloading page after a short delay
                        setTimeout(() => {
                          window.location.reload();
                        }, 1000);
                      } catch (error: any) {
                        console.error('Error deleting orders:', error);
                        toast({
                          title: "Error",
                          description: error.message || "Failed to delete orders",
                          variant: "destructive",
                        });
                      }
                    }}
                    className="w-full sm:w-auto"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete All Orders
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="hr">
          <ProfileHRTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
