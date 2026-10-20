import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** null when the site was built without Supabase settings: pages then say so instead of showing invented data */
export const supabase: SupabaseClient | null =
  url.startsWith('https://') && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;

export const configured = supabase !== null;
export const DOCS_BUCKET = 'sulfa-identity';
