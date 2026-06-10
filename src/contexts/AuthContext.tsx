import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { User, Session, AuthResponse } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";

export type AppRole = "owner" | "admin" | "operator" | "support" | "customer";

export type Profile = {
  id: string;
  user_id: string;
  full_name: string;
  role: AppRole;
  created_at: string;
  updated_at: string;
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<AuthResponse["data"]>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_CHECK_TIMEOUT_MS = 1500;
const PROFILE_FETCH_TIMEOUT_MS = 1500;

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T | null> => {
  let timeoutId: number | undefined;
  const timeout = new Promise<null>((resolve) => {
    timeoutId = window.setTimeout(() => resolve(null), timeoutMs);
  });
  const result = await Promise.race([promise, timeout]);
  if (timeoutId) window.clearTimeout(timeoutId);
  return result;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data: legacyData, error: legacyError } = await supabase
      .from("dealfinder_profiles" as never)
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!legacyError && legacyData) {
      setProfile(legacyData as Profile);
      return legacyData as Profile;
    }

    const { data, error } = await supabase
      .from("idfit_profiles" as never)
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const nextProfile = error ? null : (data as Profile | null);
    setProfile(nextProfile);
    return nextProfile;
  };

  useEffect(() => {
    let active = true;

    if (!isSupabaseConfigured) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!active) return;
        setLoading(true);
        setSession(session);
        setUser(session?.user ?? null);
        try {
          if (session?.user) {
            await withTimeout(fetchProfile(session.user.id), PROFILE_FETCH_TIMEOUT_MS);
          } else {
            setProfile(null);
          }
        } finally {
          if (active) setLoading(false);
        }
      }
    );

    const loadingTimeout = window.setTimeout(() => {
      if (active) setLoading(false);
    }, SESSION_CHECK_TIMEOUT_MS);

    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (!active) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await withTimeout(fetchProfile(session.user.id), PROFILE_FETCH_TIMEOUT_MS);
        }
      })
      .catch(() => {
        if (!active) return;
        setSession(null);
        setUser(null);
        setProfile(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      window.clearTimeout(loadingTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    if (!isSupabaseConfigured) throw new Error("Supabase 환경변수가 아직 설정되지 않았습니다.");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
    return data;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) throw new Error("Supabase 환경변수가 아직 설정되지 않았습니다.");

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) return;

    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
