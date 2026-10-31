import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, displayName?: string, redirectTo?: string) => Promise<{ error?: string; requiresConfirmation?: boolean }>;
  signOut: () => Promise<void>;
  isConfigured: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const LOCAL_STORAGE_USER_KEY = 'studyroom.auth.user';

function getInitialUser(): User | null {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
    if (stored) return JSON.parse(stored) as User;
    const prefRaw = localStorage.getItem('studyroom.preferences');
    if (prefRaw) {
      const pref = JSON.parse(prefRaw);
      if (pref?.email) {
        return {
          id: `saved_${pref.email.replace(/[^a-z0-9]/g, '_')}`,
          email: pref.email,
          user_metadata: { displayName: pref.displayName || pref.email.split('@')[0] },
          app_metadata: {},
          aud: 'authenticated',
          created_at: new Date().toISOString(),
        } as unknown as User;
      }
    }
  } catch {
    /* ignored */
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getInitialUser);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isSupabaseConfigured) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        if (session?.user) {
          setUser(session.user);
          try {
            localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(session.user));
          } catch {
            /* ignored */
          }
        }
        setLoading(false);
      }).catch(() => {
        setLoading(false);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        if (session?.user) {
          setUser(session.user);
          try {
            localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(session.user));
          } catch {
            /* ignored */
          }
        }
        setLoading(false);
      });

      return () => {
        subscription.unsubscribe();
      };
    } else {
      setLoading(false);
    }
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return { error: 'Please enter your email address.' };
    if (!password) return { error: 'Please enter your password.' };

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (error) return { error: error.message };
      setSession(data.session);
      setUser(data.user);
      if (data.user) {
        try {
          localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(data.user));
        } catch {
          /* ignored */
        }
      }
      return {};
    } else {
      const devUser = {
        id: `dev_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`,
        email: cleanEmail,
        user_metadata: {
          displayName: cleanEmail.split('@')[0],
        },
        app_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      } as unknown as User;
      setUser(devUser);
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(devUser));
      return {};
    }
  };

  const signUp = async (email: string, password: string, displayName?: string, redirectTo?: string): Promise<{ error?: string; requiresConfirmation?: boolean }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return { error: 'Please enter an email address.' };
    if (!password || password.length < 6) return { error: 'Password must be at least 6 characters.' };

    if (isSupabaseConfigured) {
      const emailRedirectTo = typeof window !== 'undefined'
        ? `${window.location.origin}${redirectTo ? (redirectTo.startsWith('/') ? redirectTo : `/${redirectTo}`) : '/'}`
        : undefined;

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo,
          data: {
            displayName: displayName?.trim() || cleanEmail.split('@')[0],
          },
        },
      });
      if (error) return { error: error.message };
      setSession(data.session);
      setUser(data.user);
      if (data.user) {
        try {
          localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(data.user));
        } catch {
          /* ignored */
        }
      }
      const requiresConfirmation = !data.session;
      return { requiresConfirmation };
    } else {
      const devUser = {
        id: `dev_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`,
        email: cleanEmail,
        user_metadata: {
          displayName: displayName?.trim() || cleanEmail.split('@')[0],
        },
        app_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      } as unknown as User;
      setUser(devUser);
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(devUser));
      return {};
    }
  };

  const signOut = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut().catch(() => {});
    }
    localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, isConfigured: isSupabaseConfigured }}>
      {children}
    </AuthContext.Provider>
  );
}

const defaultAuthValue: AuthContextValue = {
  user: null,
  session: null,
  loading: false,
  signIn: async () => ({}),
  signUp: async () => ({}),
  signOut: async () => {},
  isConfigured: false,
};

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  return context ?? defaultAuthValue;
}
