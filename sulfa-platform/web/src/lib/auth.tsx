'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { vault } from './vault';
import type { Profile, AdminRole } from './types';

type Ctx = {
  ready: boolean; session: Session | null; profile: Profile | null; role: AdminRole | null; profileError: string | null;
  refreshProfile: () => Promise<void>; signOut: () => Promise<void>;
};
const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!supabase);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AdminRole | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const known = useRef<string | null>(null);                              // user id whose role is already loaded
  const load = useCallback(async (s: Session | null) => {
    if (!s || !supabase) { known.current = null; vault.setUser(null); setSession(null); setProfile(null); setRole(null); setReady(true); return; }
    vault.setUser(s.user.id);
    if (known.current !== s.user.id) setReady(false);                                                      // nobody routes on a session whose role is not known yet
    const [p, a] = await Promise.all([
      supabase.rpc('sulfa_ensure_profile'),                               // creates the SULFA profile on first sign-in only
      supabase.from('sulfa_admins').select('role, active').eq('user_id', s.user.id).maybeSingle(),
    ]);
    const r = a.data && a.data.active ? (a.data.role as AdminRole) : null;
    if (p.error) { setProfileError(p.error.message); setProfile(null); } else { setProfileError(null); setProfile(p.data as Profile); vault.set('me', { profile: p.data, role: r }); }
    setRole(r);
    known.current = s.user.id;
    setSession(s);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      const s = data.session;
      if (s) {                                                             // instant start: last known profile and role of THIS user,
        vault.setUser(s.user.id); vault.sweep();                           // then the server's answer replaces them
        const me = vault.get<{ profile: Profile; role: AdminRole | null }>('me');
        if (me) { known.current = s.user.id; setProfile(me.data.profile); setRole(me.data.role); setSession(s); setReady(true); }
      } else vault.sweep();
      load(s);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((evt, s) => {
      if (evt === 'SIGNED_IN' || evt === 'SIGNED_OUT' || evt === 'USER_UPDATED') load(s);
      else if (evt === 'TOKEN_REFRESHED') setSession(s);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [load]);

  const value: Ctx = {
    ready, session, profile, role, profileError,
    refreshProfile: async () => { if (supabase) { const { data } = await supabase.auth.getSession(); await load(data.session); } },
    signOut: async () => { if (supabase) await supabase.auth.signOut(); vault.wipe(); vault.setUser(null); known.current = null; setSession(null); setProfile(null); setRole(null); },
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): Ctx {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}
