'use client';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { AdminRole, Profile } from '@/lib/types';
import { must } from './ui';

/** all administrator writes go through these audited server functions */
export const rpc = <T = unknown>(fn: string, args: Record<string, unknown>) => must<T>(supabase!.rpc(fn, args));

export async function profilesFor(ids: (string | null | undefined)[]): Promise<Record<string, Pick<Profile, 'user_id' | 'first_name' | 'last_name' | 'email' | 'identity_status' | 'account_status' | 'phone'>>> {
  const u = [...new Set(ids.filter(Boolean))] as string[];
  if (!u.length) return {};
  const rows = await must(supabase!.from('sulfa_profiles').select('user_id, first_name, last_name, email, identity_status, account_status, phone').in('user_id', u)) as Profile[];
  return Object.fromEntries(rows.map(r => [r.user_id, r]));
}
export const fullName = (p?: { first_name: string; last_name: string; email?: string | null } | null) => (p ? `${p.first_name} ${p.last_name}`.trim() || p.email || '—' : '—');

export function useCan(): (roles: AdminRole[]) => boolean {
  const { role } = useAuth();
  return roles => !!role && roles.includes(role);
}
export const DECIDERS: AdminRole[] = ['SUPER_ADMIN', 'ADMIN'];
export const SUPER: AdminRole[] = ['SUPER_ADMIN'];
