import { createClient, type SupabaseClient, type User, type Session } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || 'https://xsymqphrfkklhegnkhav.supabase.co';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || 'public-anon-key-placeholder';

export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_ANON_KEY &&
  import.meta.env.VITE_SUPABASE_ANON_KEY !== 'public-anon-key-placeholder'
);

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type { User, Session };

