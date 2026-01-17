import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';

export type AppRole = 'admin' | 'sales' | 'design' | 'prepress' | 'production' | 'dispatch' | 'super_admin' | 'hr_admin' | 'hr' | 'accounts' | 'outsource';

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
  authReady: boolean; // CRITICAL: Single source of truth - ALWAYS becomes true, even on error
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
  const [authReady, setAuthReady] = useState(false); // CRITICAL: Single source of truth - ALWAYS becomes true

  // CRITICAL: Guard to prevent infinite loops
  const hasInitializedRef = useRef<boolean>(false);
  const isFetchingRef = useRef<boolean>(false);
  const lastFetchedUserIdRef = useRef<string | null>(null);

  const isAdmin = useMemo(() => role === 'admin', [role]);

  // Memoized fetchUserData to prevent unnecessary re-renders
  const fetchUserData = useCallback(async (userId: string) => {
    // CRITICAL: Prevent concurrent fetches for the same user
    if (isFetchingRef.current && lastFetchedUserIdRef.current === userId) {
      console.log('[Auth] Already fetching user data for:', userId, '- skipping');
      return;
    }

    // CRITICAL: If we've already fetched for this user, skip
    if (lastFetchedUserIdRef.current === userId && profile && profile.user_id === userId) {
      console.log('[Auth] Already fetched user data for:', userId, '- skipping');
      return;
    }

    isFetchingRef.current = true;
    lastFetchedUserIdRef.current = userId;

    try {
      console.log('[Auth] Fetching user data for:', userId);

      // Fetch profile and role in parallel for better performance
      // Use select('*') to avoid column name issues, then map to our interface
      const [profileResult, roleResult] = await Promise.allSettled([
        supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle(), // Use maybeSingle() instead of single() to handle no rows gracefully
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle(), // Use maybeSingle() instead of single() to handle no rows gracefully
      ]);

      // Handle profile result
      if (profileResult.status === 'fulfilled') {
        const { data: profileData, error: profileError } = profileResult.value;

        if (profileError) {
          // Log full error details for debugging
          console.error('[Auth] Error fetching profile:', {
            message: profileError.message,
            code: profileError.code,
            details: profileError.details,
            hint: profileError.hint,
            status: profileError.status,
          });

          if (profileError.code === 'PGRST116') {
            console.warn('[Auth] Profile not found for user:', userId);
            setProfile(null);
          } else if (profileError.status === 400) {
            // 400 Bad Request - likely column name issue or RLS policy
            console.error('[Auth] 400 Bad Request - checking if columns exist or RLS policy issue');
            // Try with minimal select as fallback
            const { data: fallbackData, error: fallbackError } = await supabase
              .from('profiles')
              .select('id, user_id, full_name')
              .eq('user_id', userId)
              .maybeSingle();

            if (!fallbackError && fallbackData) {
              console.log('[Auth] Fallback query succeeded, using minimal profile data');
              setProfile({
                id: fallbackData.id,
                user_id: userId,
                full_name: fallbackData.full_name || null,
                department: null,
                phone: null,
                avatar_url: null,
                production_stage: null,
              });
            } else {
              console.error('[Auth] Fallback query also failed:', fallbackError);
              setProfile(null);
            }
          } else {
            // Other errors - set profile to null but don't block
            setProfile(null);
          }
        } else if (profileData) {
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
          console.log('[BOOTSTRAP] Profile loaded:', {
            userId,
            full_name: profileData.full_name,
            department: profileData.department,
          });
        } else {
          console.warn('[Auth] Profile query returned no data for user:', userId);
          setProfile(null);
        }
      } else {
        console.error('[Auth] Profile fetch promise rejected:', profileResult.reason);
      }

      // Handle role result
      if (roleResult.status === 'fulfilled') {
        const { data: roleData, error: roleError } = roleResult.value;

        if (roleError) {
          // Log full error details for debugging
          if (roleError.code !== 'PGRST116') {
            console.error('[Auth] Error fetching role:', {
              message: roleError.message,
              code: roleError.code,
              details: roleError.details,
              hint: roleError.hint,
              status: roleError.status,
            });
          }
          setRole(null);
        } else if (roleData) {
          setRole(roleData.role as AppRole);
          console.log('[BOOTSTRAP] Role loaded:', roleData.role);
        } else {
          setRole(null);
          console.warn('[BOOTSTRAP] No role found for user:', userId);
        }
      } else {
        console.error('[BOOTSTRAP] Error fetching role (settled):', roleResult.reason);
        setRole(null);
      }

      console.log('[BOOTSTRAP] User data fetch complete');
    } catch (error) {
      console.error('[BOOTSTRAP] Error fetching user data:', error);
      // Profile/role loading is non-blocking - errors don't prevent app from rendering
    } finally {
      isFetchingRef.current = false;
    }
  }, [profile]);

  useEffect(() => {
    let mounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    // CRITICAL: Only initialize once
    if (hasInitializedRef.current) {
      console.log('[Auth] Already initialized, skipping initialization');
      return;
    }

    // CRITICAL: Bootstrap flow - ALWAYS sets authReady = true, even on error
    const initializeAuth = async () => {
      // CRITICAL: Mark as initialized immediately to prevent re-runs
      hasInitializedRef.current = true;

      try {
        console.log('[BOOTSTRAP] Starting auth initialization...');
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();

        if (!mounted) {
          console.log('[BOOTSTRAP] Component unmounted during init, setting authReady');
          setAuthReady(true);
          return;
        }

        if (error) {
          console.error('[BOOTSTRAP] Error getting initial session:', error);
          // CRITICAL: ALWAYS set authReady = true, even on error
          setAuthReady(true);
          console.log('[BOOTSTRAP] Auth ready (error state)');
          return;
        }

        console.log('[BOOTSTRAP] Session restored:', initialSession?.user?.email || 'No session');

        // Set initial session state
        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        // If session exists, fetch user data BEFORE setting authReady
        // This ensures the requested route has access to the user's role/profile
        if (initialSession?.user) {
          console.log('[BOOTSTRAP] Fetching user profile and role...');
          try {
            await fetchUserData(initialSession.user.id);
          } catch (err) {
            console.error('[BOOTSTRAP] Initial profile fetch failed:', err);
            // Proceed anyway, role will be null
          }
        } else {
          console.log('[BOOTSTRAP] No session - auth ready');
        }

        // CRITICAL: Set authReady AFTER attempting to fetch profile/role
        setAuthReady(true);
        console.log('[BOOTSTRAP] Auth ready');

      } catch (error) {
        console.error('[BOOTSTRAP] Error initializing auth:', error);
        // CRITICAL: ALWAYS set authReady = true, even on error
        if (mounted) {
          setAuthReady(true);
          console.log('[BOOTSTRAP] Auth ready (error state)');
        }
      }
    };

    // Initialize auth immediately (only once)
    initializeAuth();

    // CRITICAL: Use onAuthStateChange ONLY for updates after initial load
    // This prevents duplicate fetches and race conditions
    // CRITICAL: Ignore TOKEN_REFRESHED events on tab visibility change to prevent reloads
    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      // CRITICAL: Ignore INITIAL_SESSION event - we already handled it in initializeAuth
      if (event === 'INITIAL_SESSION' && hasInitializedRef.current) {
        console.log('[BOOTSTRAP] Ignoring INITIAL_SESSION event - already initialized');
        return;
      }

      // CRITICAL: Ignore TOKEN_REFRESHED events that happen on tab focus
      // These don't require re-fetching profile data
      if (event === 'TOKEN_REFRESHED' && session?.user && lastFetchedUserIdRef.current === session.user.id) {
        console.log('[BOOTSTRAP] Token refreshed but user already loaded, skipping profile fetch');
        // Still update session for token refresh
        setSession(session);
        return;
      }

      // Suppress "Invalid Refresh Token" errors when user is not authenticated (expected behavior)
      if (event === 'SIGNED_OUT' || (!session && event === 'TOKEN_REFRESHED')) {
        // This is expected when user is not logged in, don't log as error
        console.log('[BOOTSTRAP] Auth state changed:', event, 'No session');
      } else {
        console.log('[BOOTSTRAP] Auth state changed:', event, session?.user?.email);
      }

      // Update session and user state
      setSession(session);
      setUser(session?.user ?? null);

      // CRITICAL: ALWAYS ensure authReady is true after auth state changes
      if (!authReady) {
        setAuthReady(true);
        console.log('[BOOTSTRAP] Auth ready (from state change)');
      }

      if (session?.user) {
        // CRITICAL: Only fetch if profile is not already loaded for this user
        // AND we haven't already fetched for this user
        const shouldFetch = !profile ||
          profile.user_id !== session.user.id ||
          lastFetchedUserIdRef.current !== session.user.id;

        if (shouldFetch) {
          console.log('[BOOTSTRAP] Fetching user profile and role (state change)...');
          // Don't await - non-blocking background fetch
          fetchUserData(session.user.id).catch(err => {
            console.error('[BOOTSTRAP] Background profile fetch failed:', err);
          });
        } else {
          console.log('[BOOTSTRAP] Profile already loaded for user, skipping fetch');
        }
      } else {
        // Session cleared - reset all state
        setProfile(null);
        setRole(null);
        lastFetchedUserIdRef.current = null;
        console.log('[BOOTSTRAP] Session cleared - state reset');
      }
    });

    subscription = authSubscription;

    return () => {
      mounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []); // CRITICAL: Empty dependencies - only run once on mount

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

  const signOut = useCallback(async () => {
    try {
      console.log('[BOOTSTRAP] Signing out...');

      // Clear local state first
      setUser(null);
      setSession(null);
      setProfile(null);
      setRole(null);
      lastFetchedUserIdRef.current = null;

      // Then sign out from Supabase
      const { error } = await supabase.auth.signOut({
        scope: 'global' // Sign out from all sessions
      });

      if (error) {
        // CRITICAL: If session is already missing, treat as successful logout
        // This happens when session expires or is already cleared
        if (error.message?.includes('Auth session missing') || error.name === 'AuthSessionMissingError') {
          console.log('[BOOTSTRAP] Session already missing - treating as successful logout');
          // State already cleared above, just clear localStorage
          if (typeof window !== 'undefined') {
            localStorage.removeItem('sb-hswgdeldouyclpeqbbgq-auth-token');
            // Clear all Supabase related storage
            Object.keys(localStorage).forEach(key => {
              if (key.startsWith('sb-')) {
                localStorage.removeItem(key);
              }
            });
          }
          return; // Exit successfully
        }

        // For other errors, log but still clear state
        console.error('[BOOTSTRAP] Error signing out:', error);
        // Even if error, clear local state
        setUser(null);
        setSession(null);
        setProfile(null);
        setRole(null);
        lastFetchedUserIdRef.current = null;
        throw error;
      }

      console.log('[BOOTSTRAP] Signed out successfully');

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
    } catch (error: any) {
      // CRITICAL: Catch AuthSessionMissingError at top level too
      if (error?.message?.includes('Auth session missing') || error?.name === 'AuthSessionMissingError') {
        console.log('[BOOTSTRAP] Session already missing (caught) - treating as successful logout');
        // Ensure state is cleared
        setUser(null);
        setSession(null);
        setProfile(null);
        setRole(null);
        lastFetchedUserIdRef.current = null;
        // Clear localStorage
        if (typeof window !== 'undefined') {
          localStorage.removeItem('sb-hswgdeldouyclpeqbbgq-auth-token');
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('sb-')) {
              localStorage.removeItem(key);
            }
          });
        }
        return; // Exit successfully without throwing
      }

      console.error('[BOOTSTRAP] Error signing out:', error);
      // Ensure state is cleared even on error
      setUser(null);
      setSession(null);
      setProfile(null);
      setRole(null);
      lastFetchedUserIdRef.current = null;
      throw error;
    }
  }, []);

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

  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    if (!user) {
      return { error: new Error('No user logged in') };
    }

    try {
      // Update auth.users metadata first (this will trigger the sync to profiles)
      if (updates.full_name || updates.avatar_url) {
        const { error: authError } = await supabase.auth.updateUser({
          data: {
            full_name: updates.full_name,
            avatar_url: updates.avatar_url,
          }
        });

        if (authError) {
          console.error('[Auth] Error updating auth.users metadata:', authError);
          // Continue anyway - we'll still try to update profiles directly
        }
      }

      // Also update profiles table directly for immediate effect
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

      // Refresh profile data (non-blocking)
      fetchUserData(user.id).catch(err => {
        console.error('[BOOTSTRAP] Error refreshing profile:', err);
      });

      return { error: null };
    } catch (error: any) {
      return { error: error as Error };
    }
  }, [user, fetchUserData]);

  const updateEmail = async (newEmail: string) => {
    try {
      // Hardcode production URL to ensure links always go to live site
      // irrespective of where the request originated (local/LAN)
      const redirectTo = 'https://chhapai.vercel.app';

      const { error } = await supabase.auth.updateUser({
        email: newEmail,
      }, {
        emailRedirectTo: redirectTo
      });
      if (error) throw error;
      return { error: null };
    } catch (error: any) {
      return { error: error as Error };
    }
  };

  // CRITICAL: isLoading ONLY depends on authReady
  // Profile/role loading is non-blocking - app renders even if they're null
  const computedIsLoading = useMemo(() => {
    return !authReady;
  }, [authReady]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        isLoading: computedIsLoading,
        authReady,
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
