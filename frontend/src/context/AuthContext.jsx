import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);

const LEGACY_KEYS = ["sm_token", "sm_user", "sm_sal_unlocked_until"];

function clearLegacyStorage() {
  LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
}

async function fetchProfile() {
  const { data } = await api.get("/me");
  return {
    profile: data.user,
    needsProfile: Boolean(data.needsProfile)
  };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const legacyCleared = useRef(false);

  const applyProfile = useCallback((nextProfile, nextNeedsProfile) => {
    setProfile(nextProfile);
    setNeedsProfile(nextNeedsProfile);
  }, []);

  const refreshProfile = useCallback(async () => {
    const result = await fetchProfile();
    applyProfile(result.profile, result.needsProfile);
    return result;
  }, [applyProfile]);

  const loadProfileForSession = useCallback(async () => {
    try {
      await refreshProfile();
    } catch {
      setProfile(null);
      setNeedsProfile(false);
    }
  }, [refreshProfile]);

  useEffect(() => {
    if (!legacyCleared.current) {
      clearLegacyStorage();
      legacyCleared.current = true;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const nextSession = data.session ?? null;
      setSession(nextSession);
      setAuthUser(nextSession?.user ?? null);
      if (nextSession) {
        loadProfileForSession().finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthUser(nextSession?.user ?? null);
      if (nextSession) {
        loadProfileForSession();
      } else {
        setProfile(null);
        setNeedsProfile(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfileForSession]);

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }, []);

  const signUp = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin }
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setAuthUser(null);
    setProfile(null);
    setNeedsProfile(false);
  }, []);

  const resetPassword = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    if (error) throw error;
  }, []);

  const value = useMemo(() => ({
    session,
    authUser,
    profile,
    needsProfile,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    resetPassword,
    refreshProfile
  }), [
    session,
    authUser,
    profile,
    needsProfile,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    resetPassword,
    refreshProfile
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
