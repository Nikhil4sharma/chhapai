import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
  authReady: boolean; // Session initialized (from getSession or onAuthStateChange)
  profileReady: boolean; // Profile and role loaded
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
  const [authReady, setAuthReady] = useState(false); // Session initialized
  const [profileReady, setProfileReady] = useState(false); // Profile + role loaded

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
          console.log('[Auth] Profile loaded:', {
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
          console.log('[Auth] Role loaded:', roleData.role);
        } else {
          setRole(null);
          console.warn('[Auth] No role found for user:', userId);
        }
      } else {
        console.error('[Auth] Error fetching role (settled):', roleResult.reason);
        setRole(null);
      }

      // Mark profile as ready after both attempts complete
      setProfileReady(true);
      console.log('[Auth] User data fetch complete');
    } catch (error) {
      console.error('[Auth] Error fetching user data:', error);
      setProfileReady(true); // Still mark as ready to prevent infinite loading
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

    // CRITICAL: Use getSession() FIRST for initial session check
    // This prevents auth flicker on hard reload
    const initializeAuth = async () => {
      // CRITICAL: Mark as initialized immediately to prevent re-runs
      hasInitializedRef.current = true;
      
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (error) {
          console.error('[Auth] Error getting initial session:', error);
          setAuthReady(true);
          setProfileReady(true); // Mark profile ready even on error
          return;
        }

        console.log('[Auth] Initial session check:', initialSession?.user?.email || 'No session');
        
        // Set initial session state
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        setAuthReady(true);

        // If session exists, fetch user data immediately
        if (initialSession?.user) {
          await fetchUserData(initialSession.user.id);
        } else {
          // No session - mark profile as ready (no profile to load)
          setProfileReady(true);
        }
      } catch (error) {
        console.error('[Auth] Error initializing auth:', error);
        if (mounted) {
          setAuthReady(true);
          setProfileReady(true);
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
        console.log('[Auth] Ignoring INITIAL_SESSION event - already initialized');
        return;
      }
      
      // CRITICAL: Ignore TOKEN_REFRESHED events that happen on tab focus
      // These don't require re-fetching profile data
      if (event === 'TOKEN_REFRESHED' && session?.user && lastFetchedUserIdRef.current === session.user.id) {
        console.log('[Auth] Token refreshed but user already loaded, skipping profile fetch');
        // Still update session for token refresh
        setSession(session);
        return;
      }
      
      // Suppress "Invalid Refresh Token" errors when user is not authenticated (expected behavior)
      if (event === 'SIGNED_OUT' || (!session && event === 'TOKEN_REFRESHED')) {
        // This is expected when user is not logged in, don't log as error
        console.log('[Auth] Auth state changed:', event, 'No session');
      } else {
        console.log('[Auth] Auth state changed:', event, session?.user?.email);
      }
      
      // Update session and user state
      setSession(session);
      setUser(session?.user ?? null);
      
      // Mark auth as ready if not already
      if (!authReady) {
        setAuthReady(true);
      }

      if (session?.user) {
        // CRITICAL: Only fetch if profile is not already loaded for this user
        // AND we haven't already fetched for this user
        const shouldFetch = !profile || 
                           profile.user_id !== session.user.id ||
                           lastFetchedUserIdRef.current !== session.user.id;
        
        if (shouldFetch) {
          setProfileReady(false); // Reset profile ready state
          await fetchUserData(session.user.id);
        } else {
          console.log('[Auth] Profile already loaded for user, skipping fetch');
        }
      } else {
        // Session cleared - reset all state
        setProfile(null);
        setRole(null);
        lastFetchedUserIdRef.current = null;
        setProfileReady(true); // Mark as ready (no profile to load)
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
      console.log('[Auth] Signing out...');
      
      // Clear local state first
      setUser(null);
      setSession(null);
      setProfile(null);
      setRole(null);
      setProfileReady(true); // Mark profile ready (no profile to load)
      
      // Then sign out from Supabase
      const { error } = await supabase.auth.signOut({
        scope: 'global' // Sign out from all sessions
      });
      
      if (error) {
        console.error('[Auth] Error signing out:', error);
        // Even if error, clear local state
        setUser(null);
        setSession(null);
        setProfile(null);
        setRole(null);
        setProfileReady(true);
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
      console.error('[Auth] Error signing out:', error);
      // Ensure state is cleared even on error
      setUser(null);
      setSession(null);
      setProfile(null);
      setRole(null);
      setProfileReady(true);
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
      setProfileReady(false);
      await fetchUserData(user.id);

      return { error: null };
    } catch (error: any) {
      return { error: error as Error };
    }
  }, [user, fetchUserData]);

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

  // Compute isLoading based on authReady and profileReady
  // isLoading should be false only when:
  // 1. Auth is initialized (authReady = true)
  // 2. If session exists, profile must be ready; if no session, profileReady should be true
  const computedIsLoading = useMemo(() => {
    if (!authReady) return true;
    if (session && !profileReady) return true;
    if (!session && !profileReady) return true; // Wait for profileReady even if no session
    return false;
  }, [authReady, profileReady, session]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        isLoading: computedIsLoading,
        authReady,
        profileReady,
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
