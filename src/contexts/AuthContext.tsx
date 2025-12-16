import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updatePassword as firebaseUpdatePassword,
  onAuthStateChanged
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { auth, db } from '@/integrations/firebase/config';

export type AppRole = 'admin' | 'sales' | 'design' | 'prepress' | 'production';

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  department: string | null;
  phone: string | null;
  avatar_url: string | null;
}

interface AuthContextType {
  user: FirebaseUser | null;
  session: { user: FirebaseUser } | null;
  profile: Profile | null;
  role: AppRole | null;
  isLoading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, role: AppRole) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [session, setSession] = useState<{ user: FirebaseUser } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAdmin = role === 'admin';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setSession(firebaseUser ? { user: firebaseUser } : null);
      
      if (firebaseUser) {
        await fetchUserData(firebaseUser.uid);
      } else {
        setProfile(null);
        setRole(null);
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch profile
      const profileDoc = await getDoc(doc(db, 'profiles', userId));
      if (profileDoc.exists()) {
        const profileData = profileDoc.data();
        setProfile({
          id: profileDoc.id,
          user_id: userId,
          full_name: profileData.full_name || null,
          department: profileData.department || null,
          phone: profileData.phone || null,
          avatar_url: profileData.avatar_url || null,
        });
      }

      // Fetch role
      const rolesQuery = query(collection(db, 'user_roles'), where('user_id', '==', userId));
      const rolesSnapshot = await getDocs(rolesQuery);
      if (!rolesSnapshot.empty) {
        const roleData = rolesSnapshot.docs[0].data();
        setRole(roleData.role as AppRole);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { error: null };
    } catch (error: any) {
      return { error: error as Error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string, roleToAssign: AppRole) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;

      // Create profile
      await setDoc(doc(db, 'profiles', newUser.uid), {
        user_id: newUser.uid,
        full_name: fullName,
        department: roleToAssign,
        phone: null,
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Assign role
      await setDoc(doc(db, 'user_roles', `${newUser.uid}_${roleToAssign}`), {
        user_id: newUser.uid,
        role: roleToAssign,
        created_at: new Date().toISOString(),
      });

      return { error: null };
    } catch (error: any) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
  };

  const updatePassword = async (newPassword: string) => {
    try {
      if (!user) throw new Error('Not authenticated');
      await firebaseUpdatePassword(user, newPassword);
      return { error: null };
    } catch (error: any) {
      return { error: error as Error };
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    try {
      if (!user) return { error: new Error('Not authenticated') };
      
      const profileRef = doc(db, 'profiles', user.uid);
      const updateData: any = {};
      if (updates.full_name !== undefined) updateData.full_name = updates.full_name;
      if (updates.phone !== undefined) updateData.phone = updates.phone;
      if (updates.avatar_url !== undefined) updateData.avatar_url = updates.avatar_url;
      if (updates.department !== undefined) updateData.department = updates.department;
      updateData.updated_at = new Date().toISOString();

      await updateDoc(profileRef, updateData);

      if (profile) {
        setProfile({ ...profile, ...updates });
      }

      return { error: null };
    } catch (error: any) {
      return { error: error as Error };
    }
  };

  return (
    <AuthContext.Provider value={{
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
    }}>
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
