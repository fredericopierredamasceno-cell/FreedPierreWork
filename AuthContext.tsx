import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type AuthState = { user: User | null; session: Session | null; loading: boolean; configured: boolean };
const AuthContext = createContext<AuthState>({ user: null, session: null, loading: true, configured: false });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, session: null, loading: !!supabase, configured: !!supabase });
  useEffect(() => {
    if (!supabase) { setState({ user: null, session: null, loading: false, configured: false }); return; }
    supabase.auth.getSession().then(({ data }) => setState({ user: data.session?.user ?? null, session: data.session, loading: false, configured: true }));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setState({ user: session?.user ?? null, session, loading: false, configured: true }));
    return () => listener.subscription.unsubscribe();
  }, []);
  return <AuthContext.Provider value={useMemo(() => state, [state])}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
