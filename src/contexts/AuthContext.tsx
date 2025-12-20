import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';

export type AppRole = 'admin' | 'sales' | 'design' | 'prepress' | 'production';

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  department: string | null;
  phone: string | null;
  avatar_url: string | null;
  production_stage?: string | null; // Production stage for production users
}

interface AuthContextType {
  user: SupabaseUser | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  isLoading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, role: AppRole) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  updateEmail: (newEmail: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAdmin = role === 'admin';

  useEffect(() => {
    let mounted = true;
    let loadingTimeout: NodeJS.Timeout;
    let subscription: { unsubscribe: () => void } | null = null;

    // Set a timeout to prevent infinite loading
    loadingTimeout = setTimeout(() => {
      if (mounted) {
        console.warn('Auth loading timeout - setting isLoading to false');
        setIsLoading(false);
      }
    }, 10000); // 10 second timeout (increased for Vercel)

    // CRITICAL: Use onAuthStateChange as the SINGLE source of truth for auth state
    // This fires INITIAL_SESSION event on mount which gives us the current session
    // This prevents race conditions and ensures consistent user state on page reload
    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      clearTimeout(loadingTimeout);
      
      console.log('[Auth] Auth state changed:', event, session?.user?.email);
      
      // Always update session and user state from the event (this is the source of truth)
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // CRITICAL: Always fetch user data when session exists
        // This ensures profile and role are loaded before UI renders
        await fetchUserData(session.user.id);
      } else {
        // CRITICAL: Clear all data when session is null
        setProfile(null);
        setRole(null);
        setIsLoading(false);
      }
    });

    subscription = authSubscription;

    return () => {
      mounted = false;
      clearTimeout(loadingTimeout);
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const fetchUserData = async (userId: string) => {
    try {
      console.log('[Auth] Fetching user data for:', userId);
      
      // Set timeout for fetch operations
      const fetchTimeout = setTimeout(() => {
        console.warn('fetchUserData timeout - setting isLoading to false');
        setIsLoading(false);
      }, 15000); // 15 second timeout (increased for Vercel)

      // Fetch profile and role in parallel for better performance
      const [profileResult, roleResult] = await Promise.allSettled([
        supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .single(),
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .limit(1)
          .single(),
      ]);

      let profileLoaded = false;
      let roleLoaded = false;

      // Handle profile result
      if (profileResult.status === 'fulfilled') {
        const { data: profileData, error: profileError } = profileResult.value;
        
        if (profileError) {
          if (profileError.code === 'PGRST116') {
            // No rows returned - profile doesn't exist
            console.warn('[Auth] Profile not found for user:', userId);
            setProfile(null);
          } else {
            // Other error - log it but don't fail completely
            console.error('[Auth] Error fetching profile:', profileError);
            // Keep existing profile state if error, don't set to null
          }
          profileLoaded = true;
        } else if (profileData) {
          // Profile found - set it
          const profileObj = {
            id: profileData.id,
            user_id: userId,
            full_name: profileData.full_name || null,
            department: profileData.department || null,
            phone: profileData.phone || null,
            avatar_url: profileData.avatar_url || null,
            production_stage: profileData.production_stage || null,
          };
          setProfile(profileObj);
          console.log('[Auth] Profile loaded successfully:', {
            userId,
            full_name: profileData.full_name,
            department: profileData.department,
          });
          profileLoaded = true;
        } else {
          // No data and no error - shouldn't happen, but handle it
          console.warn('[Auth] Profile query returned no data and no error for user:', userId);
          setProfile(null);
          profileLoaded = true;
        }
      } else {
        // Promise rejected
        console.error('[Auth] Profile fetch promise rejected:', profileResult.reason);
        // Don't clear profile on error - keep existing state
        profileLoaded = true;
      }

      // Handle role result
      if (roleResult.status === 'fulfilled') {
        const { data: roleData, error: roleError } = roleResult.value;
        
        if (roleError && roleError.code !== 'PGRST116') {
          console.error('Error fetching role:', roleError);
        }

        if (roleData) {
          setRole(roleData.role as AppRole);
          console.log('[Auth] Role loaded:', roleData.role);
          roleLoaded = true;
        } else {
          // If no role found, set null but mark as loaded
          setRole(null);
          console.warn('[Auth] No role found for user:', userId);
          roleLoaded = true;
        }
      } else {
        console.error('Error fetching role (settled):', roleResult.reason);
        // Even on error, mark as attempted
        roleLoaded = true;
      }

      clearTimeout(fetchTimeout);
      
      // CRITICAL: Only set loading to false when BOTH profile and role fetch attempts are complete
      // This ensures data is loaded before UI renders, preventing "User" placeholder issue
      if (profileLoaded && roleLoaded) {
        setIsLoading(false);
        console.log('[Auth] User data fetch complete - profile and role loaded');
      } else {
        // If somehow we reach here without both being loaded, set loading to false anyway
        // This prevents infinite loading, but log a warning
        console.warn('[Auth] User data fetch incomplete - setting loading to false anyway', { profileLoaded, roleLoaded });
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      // CRITICAL: Always set loading to false on error to prevent blank screen
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('[Auth] Sign in error:', error);
        
        // Handle specific error cases with better messages
        if (error.message?.includes('Email not confirmed') || error.message?.includes('email_not_confirmed')) {
          return { 
            error: new Error('Email not confirmed. Please contact admin or run CONFIRM_EXISTING_USERS_EMAIL.sql in Supabase.') 
          };
        }
        
        // Handle invalid credentials - most common case
        if (error.message?.includes('Invalid login credentials') || 
            error.message?.includes('Invalid email or password') ||
            error.status === 400 ||
            error.status === 401) {
          return { 
            error: new Error('Invalid email or password. Please check your credentials.') 
          };
        }
        
        // Generic error
        return {
          error: new Error(error.message || 'Login failed. Please try again.')
        };
      }
      
      // Success - session will be handled by onAuthStateChange
      console.log('[Auth] Sign in successful:', data.user?.email);
      return { error: null };
    } catch (error: any) {
      console.error('[Auth] Sign in exception:', error);
      // Ensure we always return an Error object
      if (error instanceof Error) {
        return { error };
      }
      return { error: new Error(error?.message || 'An unexpected error occurred') };
    }
  };

  const signUp = async (email: string, password: string, fullName: string, roleToAssign: AppRole) => {
    try {
      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('User creation failed');

      const userId = authData.user.id;

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: userId,
          full_name: fullName,
        });

      if (profileError) throw profileError;

      // Create role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: roleToAssign,
        });

      if (roleError) throw roleError;

      return { error: null };
    } catch (error: any) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    try {
      console.log('[Auth] Signing out...');
      
      // Clear local state first
      setUser(null);
      setSession(null);
      setProfile(null);
      setRole(null);
      
      // Then sign out from Supabase
      const { error } = await supabase.auth.signOut({
        scope: 'global' // Sign out from all sessions
      });
      
      if (error) {
        console.error('Error signing out:', error);
        // Even if error, clear local state
        setUser(null);
        setSession(null);
        setProfile(null);
        setRole(null);
        throw error;
      }
      
      console.log('[Auth] Signed out successfully');
      
      // Clear localStorage to ensure session is removed
      if (typeof window !== 'undefined') {
        localStorage.removeItem('sb-hswgdeldouyclpeqbbgq-auth-token');
        // Clear all Supabase related storage
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('sb-')) {
            localStorage.removeItem(key);
          }
        });
      }
    } catch (error) {
      console.error('Error signing out:', error);
      // Ensure state is cleared even on error
      setUser(null);
      setSession(null);
      setProfile(null);
      setRole(null);
      throw error;
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      return { error: null };
    } catch (error: any) {
      return { error: error as Error };
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) {
      return { error: new Error('No user logged in') };
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: updates.full_name,
          department: updates.department,
          phone: updates.phone,
          avatar_url: updates.avatar_url,
          production_stage: updates.production_stage,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) throw error;

      // Refresh profile data
      await fetchUserData(user.id);

      return { error: null };
    } catch (error: any) {
      return { error: error as Error };
    }
  };

  const updateEmail = async (newEmail: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail,
      });
      if (error) throw error;
      return { error: null };
    } catch (error: any) {
      return { error: error as Error };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        isLoading,
        isAdmin,
        signIn,
        signUp,
        signOut,
        updatePassword,
        updateProfile,
        updateEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
