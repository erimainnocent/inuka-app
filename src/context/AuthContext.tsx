import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, User, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

// ─── Role Types ──────────────────────────────────────────────────────────────
export type Role = 'student' | 'teacher_admin' | 'super_admin' | null;

export const isAdminRole = (role: Role): boolean =>
  role === 'teacher_admin' || role === 'super_admin';

export const isSuperAdmin = (role: Role): boolean => role === 'super_admin';

// ─── User Profile ─────────────────────────────────────────────────────────────
export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  role: Role;
  isDisabled: boolean;
  avatarUrl: string;
  enrolledCourseCount: number;
  totalLearningMinutes: number;
  lastLoginAt?: any;  // Firestore Timestamp — written on each sign-in session
  createdAt?: any;
  // ── Onboarding fields (Phase 4) ──
  onboardingComplete?: boolean;
  dateOfBirth?: string;
  learningPreferences?: {
    subjects: string[];
    sessionLength: string; // e.g. '15min' | '30min' | '60min'
  };
}

// ─── Context Shape ────────────────────────────────────────────────────────────
interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  role: Role;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);
  // Track whether we've already stamped lastLoginAt for this session
  const loginStampedRef = useRef<string | null>(null);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        // Real-time profile sync
        unsubscribeProfile = onSnapshot(
          doc(db, 'users', firebaseUser.uid),
          async (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data() as UserProfile;
              setProfile(data);
              setRole(data.role);
              setLoading(false);

              // Stamp lastLoginAt once per UID per app session
              if (loginStampedRef.current !== firebaseUser.uid) {
                loginStampedRef.current = firebaseUser.uid;
                try {
                  await updateDoc(doc(db, 'users', firebaseUser.uid), {
                    lastLoginAt: serverTimestamp(),
                  });
                } catch (_) {
                  // Non-critical — ignore
                }
              }
            } else {
              // First time: create the document
              await initializeUserDoc(firebaseUser);
            }
          },
          (error) => {
            console.error('Profile snapshot error:', error);
            // If it's a permission error, we might still be loading or auth failed
            if (error.code === 'permission-denied') {
              // Stay in loading state or handle accordingly
            }
            setLoading(false);
          }
        );
      } else {
        setProfile(null);
        setRole(null);
        setLoading(false);
        loginStampedRef.current = null; // Reset so next login stamps again
        if (unsubscribeProfile) unsubscribeProfile();
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const initializeUserDoc = async (firebaseUser: User) => {
    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        const newProfile: UserProfile = {
          uid: firebaseUser.uid,
          fullName: firebaseUser.displayName || '',
          email: firebaseUser.email || '',
          role: 'student',
          isDisabled: false,
          avatarUrl: firebaseUser.photoURL || '',
          enrolledCourseCount: 0,
          totalLearningMinutes: 0,
          onboardingComplete: false,
          createdAt: serverTimestamp(),
        };
        await setDoc(userRef, newProfile);
      }
    } catch (error) {
      console.error('Error initializing user doc:', error);
    }
  };

  const refreshUser = async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      const cloned = Object.create(
        Object.getPrototypeOf(auth.currentUser),
        Object.getOwnPropertyDescriptors(auth.currentUser)
      );
      setUser(cloned);
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, role, loading, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// ─── Hook ──────────────────────────────────────────────────────────────────────
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
