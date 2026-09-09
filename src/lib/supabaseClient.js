import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn(
    '[DinkManager] Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local — see supabase/schema.sql for the database setup.'
  );
}

// A safe no-op stand-in so the app can still render (with a setup banner)
// before real Supabase credentials are provided.
const stub = new Proxy(
  {},
  {
    get() {
      throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.');
    },
  }
);

export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : stub;
