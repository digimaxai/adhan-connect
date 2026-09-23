// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import {
  detectSupabaseSessionInUrl,
  supabaseAuthLock,
  supabaseAuthStorage,
} from './supabaseAuthStorage';

// Trim: CI workflow variables can carry a pasted trailing newline, which makes the apikey header invalid.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!.trim();
const supabaseAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!.trim();

function resolveAuthStorageKey(url: string) {
  try {
    const projectRef = new URL(url).hostname.split('.')[0]?.trim();
    if (projectRef) return `sb-${projectRef}-auth-token`;
  } catch {
    // The client will surface an invalid project URL during initialisation.
  }
  return 'adhan-connect-supabase-auth-token';
}

export const SUPABASE_AUTH_STORAGE_KEY = resolveAuthStorageKey(supabaseUrl);

export const supabase = createClient(supabaseUrl, supabaseAnon, {
  auth: {
    storage: supabaseAuthStorage,
    storageKey: SUPABASE_AUTH_STORAGE_KEY,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: detectSupabaseSessionInUrl,
    flowType: 'pkce',
    lock: supabaseAuthLock,
  },
});
